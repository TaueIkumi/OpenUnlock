import path from "node:path";
import { UnsafeArchiveError } from "../core/errors.js";

/**
 * Normalize an archive entry path to a safe, relative, forward-slash path.
 * Rejects path traversal, absolute paths, and null bytes.
 *
 * See AGENT.md section 17 (Security and Privacy): every extracted path
 * must be validated before writing.
 */
export function safeRelativePath(entryPath: string): string {
  if (entryPath.includes("\0")) {
    throw new UnsafeArchiveError(`Archive entry contains a null byte: ${entryPath}`);
  }

  const normalized = entryPath.replace(/\\/g, "/");

  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new UnsafeArchiveError(`Archive entry has an absolute path: ${entryPath}`);
  }

  const resolved = path.posix.normalize(normalized);

  if (resolved === ".." || resolved.startsWith("../") || resolved.startsWith("/")) {
    throw new UnsafeArchiveError(`Archive entry escapes the archive root: ${entryPath}`);
  }

  return resolved;
}

/**
 * Resolve a relative path against a base directory and verify the result
 * stays within that directory (defense against zip slip / symlink escape).
 */
export function resolveWithinRoot(rootDir: string, relativePath: string): string {
  const safe = safeRelativePath(relativePath);
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(resolvedRoot, safe);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new UnsafeArchiveError(`Resolved path escapes root: ${relativePath}`);
  }

  return resolvedTarget;
}
