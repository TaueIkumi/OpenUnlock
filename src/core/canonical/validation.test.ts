import { describe, expect, it } from "vitest";
import { validateCanonicalEntity } from "./validation.js";
import { SchemaValidationError } from "../errors.js";

describe("validateCanonicalEntity", () => {
  it("accepts a valid document entity", () => {
    const entity = validateCanonicalEntity({
      id: "doc-1",
      type: "document",
      content: "hello",
      format: "markdown",
      source: { service: "notion" },
    });
    expect(entity.id).toBe("doc-1");
  });

  it("rejects an entity with an unknown type", () => {
    expect(() =>
      validateCanonicalEntity({ id: "x", type: "unknown-type", source: { service: "x" } }),
    ).toThrow(SchemaValidationError);
  });

  it("rejects an entity missing required fields", () => {
    expect(() => validateCanonicalEntity({ id: "x", type: "document" })).toThrow(
      SchemaValidationError,
    );
  });

  it("tolerates unknown metadata fields", () => {
    const entity = validateCanonicalEntity({
      id: "p-1",
      type: "person",
      source: { service: "slack" },
      metadata: { slack: { future: "field" } },
    });
    expect(entity.metadata).toEqual({ slack: { future: "field" } });
  });
});
