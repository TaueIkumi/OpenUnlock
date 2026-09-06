import { describe, expect, it } from "vitest";
import { escapeHtml, renderConversationBody, renderDocumentBody } from "./render.js";
import type { Document, Message, Person } from "../../core/canonical/types.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });
});

describe("renderDocumentBody", () => {
  it("HTML-escapes markdown/text content rather than interpreting it as markup", () => {
    const document: Document = {
      id: "doc1",
      type: "document",
      format: "markdown",
      content: "<script>alert(1)</script>",
      source: { service: "test" },
    };
    const body = renderDocumentBody(document, () => undefined, () => {});
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("sanitizes html-format content, stripping scripts and dangerous attributes", () => {
    const document: Document = {
      id: "doc1",
      type: "document",
      format: "html",
      content: '<div>hi</div><script>alert(1)</script><img src=x onerror="alert(2)">',
      source: { service: "test" },
    };
    const body = renderDocumentBody(document, () => undefined, () => {});
    expect(body).toContain("<div>hi</div>");
    expect(body).not.toContain("<script");
    expect(body).not.toContain("onerror");
  });

  it("strips a javascript: URI from a sanitized html-format link", () => {
    const document: Document = {
      id: "doc1",
      type: "document",
      format: "html",
      content: '<a href="javascript:alert(1)">click me</a>',
      source: { service: "test" },
    };
    const body = renderDocumentBody(document, () => undefined, () => {});
    expect(body).not.toContain("javascript:");
  });

  it("resolves an openunlock entity link to a real anchor tag", () => {
    const document: Document = {
      id: "doc1",
      type: "document",
      format: "markdown",
      content: "See [Other Page](openunlock://entity/doc2) for details.",
      source: { service: "test" },
    };
    const body = renderDocumentBody(document, (id) => (id === "doc2" ? "./doc2.html" : undefined), () => {});
    expect(body).toContain('<a href="./doc2.html">Other Page</a>');
  });

  it("reports and leaves untouched a link to an entity not in this export", () => {
    const document: Document = {
      id: "doc1",
      type: "document",
      format: "markdown",
      content: "See [Missing](openunlock://entity/missing-id) for details.",
      source: { service: "test" },
    };
    const missing: string[] = [];
    const body = renderDocumentBody(document, () => undefined, (id) => missing.push(id));
    expect(missing).toEqual(["missing-id"]);
    expect(body).toContain("openunlock://entity/missing-id");
  });
});

describe("renderConversationBody", () => {
  it("HTML-escapes message content", () => {
    const message: Message = {
      id: "m1",
      type: "message",
      content: "<script>alert(1)</script>",
      source: { service: "test" },
    };
    const person: Person = { id: "p1", type: "person", displayName: "Alice", source: { service: "test" } };
    const body = renderConversationBody(
      { id: "c1", type: "conversation", messageIds: ["m1"], source: { service: "test" } },
      new Map([["m1", message]]),
      new Map([["p1", person]]),
    );
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });
});
