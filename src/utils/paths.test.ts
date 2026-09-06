import { describe, expect, it } from "vitest";
import { safeRelativePath, resolveWithinRoot } from "./paths.js";
import { UnsafeArchiveError } from "../core/errors.js";

describe("safeRelativePath", () => {
  it("accepts normal relative paths", () => {
    expect(safeRelativePath("conversations.json")).toBe("conversations.json");
    expect(safeRelativePath("folder/file.txt")).toBe("folder/file.txt");
  });

  it("rejects path traversal", () => {
    expect(() => safeRelativePath("../../../etc/passwd")).toThrow(UnsafeArchiveError);
    expect(() => safeRelativePath("folder/../../escape.txt")).toThrow(UnsafeArchiveError);
  });

  it("rejects absolute paths", () => {
    expect(() => safeRelativePath("/etc/passwd")).toThrow(UnsafeArchiveError);
    expect(() => safeRelativePath("C:\\Windows\\System32")).toThrow(UnsafeArchiveError);
  });

  it("rejects null bytes", () => {
    expect(() => safeRelativePath("file\0.txt")).toThrow(UnsafeArchiveError);
  });

  it("normalizes backslashes to forward slashes", () => {
    expect(safeRelativePath("folder\\file.txt")).toBe("folder/file.txt");
  });
});

describe("resolveWithinRoot", () => {
  it("resolves safe paths within the root", () => {
    const resolved = resolveWithinRoot("/tmp/root", "sub/file.txt");
    expect(resolved).toBe("/tmp/root/sub/file.txt");
  });

  it("throws for traversal attempts", () => {
    expect(() => resolveWithinRoot("/tmp/root", "../escape.txt")).toThrow(UnsafeArchiveError);
  });
});
