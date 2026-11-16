import { describe, expect, it } from "vitest";
import { appendUnsubscribeFooter } from "@/lib/email/unsubscribeHeaders";

describe("appendUnsubscribeFooter", () => {
  it("adds the unsubscribe link and, when the team has one, its postal address", () => {
    const html = appendUnsubscribeFooter("<p>Hi</p>", "t1", "1 Main St, Pune 411001");
    expect(html).toContain("/api/email/unsubscribe/t1");
    expect(html).toContain("1 Main St, Pune 411001");
  });

  it("escapes the address and leaves it out when blank or missing", () => {
    expect(appendUnsubscribeFooter("", "t1", "A & B <Ltd>")).toContain("A &amp; B &lt;Ltd&gt;");
    expect(appendUnsubscribeFooter("", "t1", "   ")).not.toContain("   ");
    expect(appendUnsubscribeFooter("", "t1")).toContain("unsubscribe here</a>.</p>");
  });
});
