import { open as openZip, type Entry, type ZipFile } from "yauzl";
import { stat, readdir, readFile, open as openFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { safeRelativePath } from "../utils/paths.js";
import { streamToBuffer } from "../utils/streams.js";
import { InputNotFoundError, UnsafeArchiveError } from "./errors.js";

/**
 * Guard against decompression bombs: reject any single entry whose
 * uncompressed size exceeds this bound. Generous, but bounded.
 */
const MAX_ENTRY_UNCOMPRESSED_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB

/**
 * Read-only view over a source export, whether it's a zip archive or an
 * already-extracted directory. Adapters must go through this rather than
 * touching the filesystem/archive directly, so path safety is enforced in
 * one place (AGENT.md section 17).
 */
export interface InputSource {
  readonly label: string;
  listFiles(): Promise<string[]>;
  readFile(relativePath: string): Promise<Buffer>;
  readText(relativePath: string): Promise<string>;
  openStream(relativePath: string): Promise<Readable>;
  hasFile(relativePath: string): Promise<boolean>;
}

export async function openInputSource(inputPath: string): Promise<InputSource> {
  let stats;
  try {
    stats = await stat(inputPath);
  } catch {
    throw new InputNotFoundError(inputPath);
  }

  if (stats.isDirectory()) {
    return new DirectoryInputSource(inputPath);
  }

  if (await isZipFile(inputPath)) {
    return ZipInputSource.open(inputPath);
  }

  // Some exports (e.g. Trello's "Export as JSON") are a single loose file
  // rather than a zip or a directory tree.
  return new SingleFileInputSource(inputPath);
}

/** Sniff the ZIP local-file-header signature ("PK") rather than trusting the extension. */
async function isZipFile(filePath: string): Promise<boolean> {
  const handle = await openFile(filePath, "r");
  try {
    const buffer = Buffer.alloc(2);
    const { bytesRead } = await handle.read(buffer, 0, 2, 0);
    return bytesRead === 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  } finally {
    await handle.close();
  }
}

class SingleFileInputSource implements InputSource {
  readonly label: string;
  private readonly fileName: string;

  constructor(private readonly filePath: string) {
    this.label = filePath;
    this.fileName = path.basename(filePath);
  }

  async listFiles(): Promise<string[]> {
    return [this.fileName];
  }

  async hasFile(relativePath: string): Promise<boolean> {
    return safeRelativePath(relativePath) === this.fileName;
  }

  private assertKnownFile(relativePath: string): void {
    if (!(safeRelativePath(relativePath) === this.fileName)) {
      throw new InputNotFoundError(relativePath);
    }
  }

  async readFile(relativePath: string): Promise<Buffer> {
    this.assertKnownFile(relativePath);
    return readFile(this.filePath);
  }

  async readText(relativePath: string): Promise<string> {
    return (await this.readFile(relativePath)).toString("utf8");
  }

  async openStream(relativePath: string): Promise<Readable> {
    this.assertKnownFile(relativePath);
    const { createReadStream } = await import("node:fs");
    return createReadStream(this.filePath);
  }
}

class DirectoryInputSource implements InputSource {
  readonly label: string;

  constructor(private readonly rootDir: string) {
    this.label = rootDir;
  }

  private resolve(relativePath: string): string {
    const safe = safeRelativePath(relativePath);
    return path.join(this.rootDir, safe);
  }

  async listFiles(): Promise<string[]> {
    const results: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          results.push(path.relative(this.rootDir, full).split(path.sep).join("/"));
        }
      }
    };
    await walk(this.rootDir);
    return results.sort();
  }

  async readFile(relativePath: string): Promise<Buffer> {
    return readFile(this.resolve(relativePath));
  }

  async readText(relativePath: string): Promise<string> {
    return readFile(this.resolve(relativePath), "utf8");
  }

  async openStream(relativePath: string): Promise<Readable> {
    const { createReadStream } = await import("node:fs");
    return createReadStream(this.resolve(relativePath));
  }

  async hasFile(relativePath: string): Promise<boolean> {
    try {
      const s = await stat(this.resolve(relativePath));
      return s.isFile();
    } catch {
      return false;
    }
  }
}

class ZipInputSource implements InputSource {
  readonly label: string;
  private readonly entriesByPath = new Map<string, Entry>();

  private constructor(
    private readonly zipFile: ZipFile,
    archivePath: string,
  ) {
    this.label = archivePath;
  }

  static async open(archivePath: string): Promise<ZipInputSource> {
    const zipFile = await new Promise<ZipFile>((resolve, reject) => {
      openZip(archivePath, { lazyEntries: true, autoClose: false }, (err, zip) => {
        if (err || !zip) {
          reject(err ?? new Error("Failed to open zip"));
          return;
        }
        resolve(zip);
      });
    });

    const source = new ZipInputSource(zipFile, archivePath);
    await source.indexEntries();
    return source;
  }

  private async indexEntries(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.zipFile.on("entry", (entry: Entry) => {
        try {
          if (!/\/$/.test(entry.fileName)) {
            if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
              throw new UnsafeArchiveError(
                `Archive entry exceeds maximum allowed size: ${entry.fileName}`,
              );
            }
            const safe = safeRelativePath(entry.fileName);
            this.entriesByPath.set(safe, entry);
          }
          this.zipFile.readEntry();
        } catch (err) {
          reject(err);
        }
      });
      this.zipFile.on("end", () => resolve());
      this.zipFile.on("error", reject);
      this.zipFile.readEntry();
    });
  }

  async listFiles(): Promise<string[]> {
    return Array.from(this.entriesByPath.keys()).sort();
  }

  async hasFile(relativePath: string): Promise<boolean> {
    return this.entriesByPath.has(safeRelativePath(relativePath));
  }

  private getEntry(relativePath: string): Entry {
    const safe = safeRelativePath(relativePath);
    const entry = this.entriesByPath.get(safe);
    if (!entry) {
      throw new InputNotFoundError(relativePath);
    }
    return entry;
  }

  async openStream(relativePath: string): Promise<Readable> {
    const entry = this.getEntry(relativePath);
    return new Promise((resolve, reject) => {
      this.zipFile.openReadStream(entry, (err, stream) => {
        if (err || !stream) {
          reject(err ?? new Error("Failed to open zip entry stream"));
          return;
        }
        resolve(stream);
      });
    });
  }

  async readFile(relativePath: string): Promise<Buffer> {
    const stream = await this.openStream(relativePath);
    return streamToBuffer(stream);
  }

  async readText(relativePath: string): Promise<string> {
    const buffer = await this.readFile(relativePath);
    return buffer.toString("utf8");
  }
}
