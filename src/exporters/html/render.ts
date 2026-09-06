import sanitizeHtmlLib from "sanitize-html";
import type { Conversation, Document, Message, Person } from "../../core/canonical/types.js";

/** Same `openunlock://entity/<id>` link markup every adapter can emit (see markdown/render.ts). */
const ENTITY_LINK_MARKUP_PATTERN = /(!?)\[([^\]]*)\]\(openunlock:\/\/entity\/([^\s)]+)\)/g;

const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  // sanitize-html's own defaults are a safe text-formatting allowlist
  // (AGENT.md section 17: never render untrusted HTML unsanitized) — img
  // is added explicitly since Evernote's ENML content embeds images.
  allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat(["img"]),
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    a: ["href"],
    img: ["src", "alt"],
  },
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ResolveLink = (id: string) => string | undefined;
type OnUnresolved = (id: string) => void;

/**
 * Plain text / markdown content: escape first (safe — none of the
 * `[]()` characters in the link markup need escaping), then resolve
 * links against the already-escaped string, so the captured label is
 * already safe to drop straight into the generated `<a>`/`<img>` tag.
 */
function renderTextBody(content: string, resolvePath: ResolveLink, onUnresolved: OnUnresolved): string {
  const escaped = escapeHtml(content);
  const withLinks = escaped.replace(
    ENTITY_LINK_MARKUP_PATTERN,
    (full, bang: string, label: string, id: string) => {
      const target = resolvePath(id);
      if (!target) {
        onUnresolved(id);
        return full;
      }
      const href = escapeHtml(target);
      return bang === "!" ? `<img src="${href}" alt="${label}">` : `<a href="${href}">${label}</a>`;
    },
  );

  const paragraphs = withLinks.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>\n")}</p>`).join("\n");
}

/**
 * Real HTML content (Evernote's ENML): resolve links first (on the raw
 * string — the label is escaped individually since the surrounding
 * content must NOT be escaped, unlike the text-format case), then run
 * everything through sanitize-html so any actually-dangerous markup from
 * the source export is stripped before it ever reaches a browser.
 */
function renderHtmlBody(content: string, resolvePath: ResolveLink, onUnresolved: OnUnresolved): string {
  const withLinks = content.replace(
    ENTITY_LINK_MARKUP_PATTERN,
    (full, bang: string, label: string, id: string) => {
      const target = resolvePath(id);
      if (!target) {
        onUnresolved(id);
        return full;
      }
      const href = escapeHtml(target);
      const safeLabel = escapeHtml(label);
      return bang === "!" ? `<img src="${href}" alt="${safeLabel}">` : `<a href="${href}">${safeLabel}</a>`;
    },
  );
  return sanitizeHtmlLib(withLinks, SANITIZE_OPTIONS);
}

export function renderDocumentBody(
  document: Document,
  resolvePath: ResolveLink,
  onUnresolved: OnUnresolved,
): string {
  const body =
    document.format === "html"
      ? renderHtmlBody(document.content, resolvePath, onUnresolved)
      : renderTextBody(document.content, resolvePath, onUnresolved);

  const metaParts = [document.source.service, document.createdAt].filter(Boolean) as string[];

  return (
    `<h1>${escapeHtml(document.title ?? "Untitled")}</h1>\n` +
    `<p class="meta">${metaParts.map(escapeHtml).join(" &middot; ")}</p>\n` +
    body
  );
}

export function renderConversationBody(
  conversation: Conversation,
  messagesById: Map<string, Message>,
  peopleById: Map<string, Person>,
): string {
  const metaParts = [conversation.source.service, conversation.createdAt].filter(Boolean) as string[];

  const messagesHtml = conversation.messageIds
    .map((id) => messagesById.get(id))
    .filter((m): m is Message => m !== undefined)
    .map((message) => {
      const author = message.authorId ? peopleById.get(message.authorId) : undefined;
      const speaker = author?.displayName ?? author?.id ?? "unknown";
      const content = message.content.trim();
      const body =
        content.length === 0
          ? "<p><em>[unsupported content — see diagnostics.json / canonical JSON]</em></p>"
          : renderTextBody(content, () => undefined, () => {});
      return `<div class="message">\n<h3>${escapeHtml(speaker)}</h3>\n${body}\n</div>`;
    })
    .join("\n");

  return (
    `<h1>${escapeHtml(conversation.title ?? "Untitled")}</h1>\n` +
    `<p class="meta">${metaParts.map(escapeHtml).join(" &middot; ")}</p>\n` +
    messagesHtml
  );
}

const PAGE_STYLE = [
  "body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;",
  "line-height:1.55;color:#1a1a1a;background:#fff}",
  "a{color:#0b5fff}",
  "img{max-width:100%}",
  ".meta{color:#666;font-size:.85em;margin-top:-.5rem}",
  ".message{margin-bottom:1.2rem}",
  ".message h3{margin-bottom:.2rem}",
].join("");

export function renderPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
