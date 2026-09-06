import { describe, expect, it } from "vitest";
import { renderSlackText } from "./render-text.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";

function context() {
  return {
    displayNameByUserId: new Map([["U001", "Alice Doe"]]),
    channelNameById: new Map([["C001", "general"]]),
  };
}

describe("renderSlackText", () => {
  it("renders user mentions using the display name", () => {
    const diagnostics = new DiagnosticCollector();
    expect(renderSlackText("hi <@U001>", context(), diagnostics, "ref")).toBe("hi @Alice Doe");
  });

  it("renders channel references", () => {
    const diagnostics = new DiagnosticCollector();
    expect(renderSlackText("see <#C001|general>", context(), diagnostics, "ref")).toBe(
      "see #general",
    );
  });

  it("renders here/channel/everyone", () => {
    const diagnostics = new DiagnosticCollector();
    expect(renderSlackText("<!here> standup", context(), diagnostics, "ref")).toBe(
      "@here standup",
    );
  });

  it("renders links with labels as Markdown links", () => {
    const diagnostics = new DiagnosticCollector();
    expect(
      renderSlackText("see <https://example.com|the doc>", context(), diagnostics, "ref"),
    ).toBe("see [the doc](https://example.com)");
  });

  it("reports unrecognized tokens without dropping them", () => {
    const diagnostics = new DiagnosticCollector();
    const result = renderSlackText("weird <?????>", context(), diagnostics, "ref");
    expect(result).toBe("weird <?????>");
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
  });
});
