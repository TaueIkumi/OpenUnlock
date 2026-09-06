import type { Diagnostic } from "../core/diagnostics.js";

export function printLine(message: string): void {
  process.stdout.write(message + "\n");
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printError(message: string): void {
  process.stderr.write(message + "\n");
}

const DIAGNOSTIC_ICON: Record<Diagnostic["category"], string> = {
  info: "✓",
  warning: "⚠",
  error: "✗",
  unsupported: "⚠",
  "missing-reference": "⚠",
  "malformed-source": "⚠",
  "lossy-conversion": "⚠",
};

export function printDiagnosticsSummary(diagnostics: readonly Diagnostic[]): void {
  const grouped = new Map<string, number>();
  for (const d of diagnostics) {
    grouped.set(d.message, (grouped.get(d.message) ?? 0) + 1);
  }
  for (const [message, count] of grouped) {
    const first = diagnostics.find((d) => d.message === message);
    const icon = first ? DIAGNOSTIC_ICON[first.category] : "⚠";
    const suffix = count > 1 ? ` (x${count})` : "";
    printLine(`${icon} ${message}${suffix}`);
  }
}
