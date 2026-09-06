import type { DiagnosticCollector } from "../../core/diagnostics.js";

export interface SlackTextContext {
  displayNameByUserId: Map<string, string>;
  channelNameById: Map<string, string>;
}

const TOKEN_PATTERN = /<([^>]+)>/g;

/**
 * Render Slack's inline markup (`<@U123>`, `<#C123|name>`, `<https://x|label>`,
 * `<!here>`, ...) into plain Markdown-friendly text. Unknown token shapes
 * are left as-is (not dropped) and reported once via diagnostics.
 */
export function renderSlackText(
  text: string,
  context: SlackTextContext,
  diagnostics: DiagnosticCollector,
  ref: string,
): string {
  return text.replace(TOKEN_PATTERN, (full, inner: string) => {
    const pipeIndex = inner.indexOf("|");
    const head = pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
    const label = pipeIndex >= 0 ? inner.slice(pipeIndex + 1) : undefined;

    if (head.startsWith("@")) {
      const userId = head.slice(1);
      const name = label ?? context.displayNameByUserId.get(userId);
      return `@${name ?? userId}`;
    }

    if (head.startsWith("#")) {
      const channelId = head.slice(1);
      const name = label ?? context.channelNameById.get(channelId);
      return `#${name ?? channelId}`;
    }

    if (head === "!here") return "@here";
    if (head === "!channel") return "@channel";
    if (head === "!everyone") return "@everyone";
    if (head.startsWith("!subteam^")) return label ? `@${label}` : full;

    if (/^[a-z]+:\/\//i.test(head)) {
      return label ? `[${label}](${head})` : head;
    }

    diagnostics.unsupported(`Unrecognized Slack markup token: ${full}`, ref);
    return full;
  });
}
