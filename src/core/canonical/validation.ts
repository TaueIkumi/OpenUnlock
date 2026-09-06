import { SchemaValidationError } from "../errors.js";
import { canonicalEntitySchema } from "./schema.js";
import type { AnyCanonicalEntity } from "./types.js";

export function validateCanonicalEntity(entity: unknown): AnyCanonicalEntity {
  const result = canonicalEntitySchema.safeParse(entity);
  if (!result.success) {
    throw new SchemaValidationError(
      `Invalid canonical entity: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data as AnyCanonicalEntity;
}
