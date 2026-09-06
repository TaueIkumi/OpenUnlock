export abstract class OpenUnlockError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

export class InputNotFoundError extends OpenUnlockError {
  readonly code = "INPUT_NOT_FOUND";

  constructor(inputPath: string) {
    super(`Input not found: ${inputPath}`);
  }
}

export class UnsupportedFormatError extends OpenUnlockError {
  readonly code = "UNSUPPORTED_FORMAT";

  constructor(message: string) {
    super(message);
  }
}

export class AmbiguousFormatError extends OpenUnlockError {
  readonly code = "AMBIGUOUS_FORMAT";

  constructor(candidates: string[]) {
    super(
      `Could not determine source format with confidence. Candidates: ${candidates.join(
        ", ",
      )}. Specify --from explicitly.`,
    );
  }
}

export class MalformedExportError extends OpenUnlockError {
  readonly code = "MALFORMED_EXPORT";

  constructor(message: string) {
    super(message);
  }
}

export class UnsafeArchiveError extends OpenUnlockError {
  readonly code = "UNSAFE_ARCHIVE";

  constructor(message: string) {
    super(message);
  }
}

export class WriteError extends OpenUnlockError {
  readonly code = "WRITE_ERROR";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class SchemaValidationError extends OpenUnlockError {
  readonly code = "SCHEMA_VALIDATION";

  constructor(message: string) {
    super(message);
  }
}
