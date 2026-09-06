/**
 * Diagnostics framework. See AGENT.md section 13.
 */

export type DiagnosticCategory =
  | "info"
  | "warning"
  | "error"
  | "unsupported"
  | "missing-reference"
  | "malformed-source"
  | "lossy-conversion";

export interface Diagnostic {
  category: DiagnosticCategory;
  message: string;
  /** Identifier or path of the entity/source location this diagnostic concerns. */
  ref?: string;
}

export class DiagnosticCollector {
  private readonly diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  info(message: string, ref?: string): void {
    this.add({ category: "info", message, ref });
  }

  warning(message: string, ref?: string): void {
    this.add({ category: "warning", message, ref });
  }

  error(message: string, ref?: string): void {
    this.add({ category: "error", message, ref });
  }

  unsupported(message: string, ref?: string): void {
    this.add({ category: "unsupported", message, ref });
  }

  missingReference(message: string, ref?: string): void {
    this.add({ category: "missing-reference", message, ref });
  }

  malformedSource(message: string, ref?: string): void {
    this.add({ category: "malformed-source", message, ref });
  }

  lossyConversion(message: string, ref?: string): void {
    this.add({ category: "lossy-conversion", message, ref });
  }

  all(): readonly Diagnostic[] {
    return this.diagnostics;
  }

  hasErrors(): boolean {
    return this.diagnostics.some((d) => d.category === "error");
  }

  countByCategory(): Record<DiagnosticCategory, number> {
    const counts: Record<DiagnosticCategory, number> = {
      info: 0,
      warning: 0,
      error: 0,
      unsupported: 0,
      "missing-reference": 0,
      "malformed-source": 0,
      "lossy-conversion": 0,
    };
    for (const d of this.diagnostics) {
      counts[d.category]++;
    }
    return counts;
  }
}
