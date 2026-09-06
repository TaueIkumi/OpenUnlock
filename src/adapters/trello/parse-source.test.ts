import { describe, expect, it } from "vitest";
import { timestampFromObjectId } from "./parse-source.js";

describe("timestampFromObjectId", () => {
  it("extracts the embedded creation time from a Mongo ObjectId", () => {
    expect(timestampFromObjectId("5f8d0d55b54764421b7b6b1c")).toBe("2020-10-19T03:51:49.000Z");
  });

  it("returns undefined for non-ObjectId ids", () => {
    expect(timestampFromObjectId("card1")).toBeUndefined();
    expect(timestampFromObjectId("")).toBeUndefined();
  });
});
