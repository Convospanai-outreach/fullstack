---
name: lead-magnets
description: >-
  Designs lead magnets and free tools that grow an email list — checklists,
  templates, mini-courses, calculators, graders — and builds the asset
  in-session. Use for "lead magnet", "grow my email list", "free tool idea",
  or "what should I give away".
license: MIT
metadata:
  brand: How to AI by Ruben Hassid
  protocol: howtoai-v1
  source: coreyhaines31/marketingskills (lead-magnets, free-tools)
  source-sha: 7868cb9
  source-license: MIT
  upgraded: "2026-08"
  claude-ai-description: >-
    Designs lead magnets and free tools that grow an email list, and builds
    the asset in-session. Use for "lead magnet", "grow my email list", "free
    tool idea", or "what should I give away".
---

# Lead Magnets

A lead magnet trades ten minutes of real value for an email address — and
auditions the paid thing behind it. Every idea passes two gates before format
even comes up: does it attract the person who buys, and will they actually
consume it? Fail the first and the list fills with people who will never pay;
fail the second and the asset gets archived instead of doing its job.

## Work backwards from the paid thing

Start at the offer and reason toward the magnet, never the reverse.

- **The buyer test.** Describe the person who wants this magnet badly enough
  to trade an email. If that person isn't the buyer, stop — "free Canva
  templates" from a $5k/month design agency recruits exactly the people who've
  decided to do it themselves.
- **Right position.** The magnet solves the problem immediately before the one
  the paid thing solves — or the first slice of the same problem — so using it
  makes the next gap visible.
- **Complete on the slice, not the pie.** It must fully solve its narrow
  problem: held-back teasers read as bait. But it leaves the bigger problem
  standing — solve everything and there's nothing left to sell.

## One painful problem, ten minutes

Specificity beats size. Perceived value comes from precision of the promise
and speed to result, not page count — the checklist usually outconverts the
ebook it summarizes.

- Promise shape: **[specific outcome] for [specific person] in
  [number/timeframe]**. "12-point profit-leak checklist for restaurant owners"
  beats "The Restaurant Finance Guide."
- The name carries the conversion. Name = the promise. If it needs a paragraph
  of explanation, the magnet is too broad — narrow the problem, not the
  description.
- Ten minutes to first result; one sitting to full value.
- The generic-content bar: if a reader could get the same thing from any AI
  assistant in one prompt, it converts nobody. Clear the bar with what can't
  be generated — your data, your real examples, your named system, or output
  personalized to them.

## Content or a tool?

One question decides: does the value depend on the user's own inputs?

- Same answer for everyone → **content** (checklist, template, swipe file,
  mini-course). Ships in hours, near-zero maintenance.
- Verdict depends on their numbers or situation → **tool** (calculator,
  grader, quiz). Personalized output gets consumed on the spot and shared, and
  a tool page can earn "[thing] calculator" search traffic that content can't.
  The cost: a tool is a commitment — it has to keep working and its numbers
  have to stay right.
- Default to content for speed. Build the tool when the promise is inherently
  a verdict: "what would this save / cost / score *for me*."

Tool scope is a discipline: one input set → one output. No accounts, no saved
results, no feature roadmap — a scoped tool that ships beats a mini-product
that doesn't.

## Design for consumption

A consumed magnet converts; an archived one is a download statistic.

- Front-load the win: the first five minutes deliver the thing they came for.
  No "about this guide," no methodology preamble, no setup chapter.
- Format for use, not reading: checklist printable, template pre-filled with a
  worked example and usable in five minutes, mini-course lessons standalone.
- Put the bridge inside the asset: the final step or closing page names the
  natural next move toward the paid thing. The moment of "this worked" happens
  inside the magnet — meet it there, not on your website.

## Capture and delivery

- Ask for email only. Each added field costs roughly 5–10% of conversions; add
  one only when the offer is heavy (workshop, demo) and the field actually
  gets used.
- Deliver by email, not just an instant download: fake addresses get nothing,
  and opening the delivery email to claim the asset trains inboxes — and the
  subscriber — that your sends get opened.
- For tools, gate the report, not the tool: anyone can run the calculator or
  grader; the emailed full report is the trade. Gating the inputs kills usage
  and the search/link value that justified building it.
- The thank-you page's job is the next step — a booking link, the trial, the
  related asset — never "check your inbox" alone.
- A content upgrade (post-specific bonus inside an article) converts 2–5×
  better than a site-wide generic magnet. If a post already pulls traffic,
  upgrade it before creating anything new.

## Build it in the session

Most magnets can be built on the spot — offer this whenever the design is
settled:

- Checklists, cheat sheets, templates, swipe-file skeletons, mini-course
  emails → drafted complete, ready for light design and upload.
- Calculators, graders, quizzes → one self-contained HTML file: inline CSS/JS,
  no external dependencies, mobile-first, the math visible, email gate on the
  full report.
- Draft with the bridge CTA already inside, pointed at the user's paid thing.

## Picking a format

Recommending, comparing, or building a format? Read
[references/magnet-formats.md](references/magnet-formats.md) first — effort,
payoff, and fails-when per format, build specs, and the diagnostics table for
judging a live magnet that underperforms.

## Setup

First run: ask what the paid offer is and who buys it, then store both in
`howtoai/lead-magnets/config.json` (Claude Code:
`${CLAUDE_PLUGIN_DATA}/lead-magnets/config.json`) and read it on later runs
instead of re-asking.

## Boundaries

- Opt-in page and promotion copy → the copywriting skill.
- Everything emailed after delivery → email-marketing. The delivery email
  belongs to the magnet; the nurture sequence that follows doesn't.

## Gotchas

- **A wrong-list magnet is negative value, not zero.** Freebie-seekers ignore
  your sends, sinking open rates; mailbox providers read that as a spam signal
  and throttle delivery to the buyers on the same list. And the ESP bills per
  subscriber.
- **Viral ≠ qualified.** The quiz everyone shares fills the list with
  everyone. Qualification lives in the promise itself — a magnet only a buyer
  would bother wanting.
- **Downloads are the vanity metric.** A magnet can "succeed" at thousands of
  downloads and zero customers. Judge it on what leads do next — early email
  opens, bridge-step take-rate, buyer-profile match — tracked by source.
- **Renaming beats rebuilding.** When a right-list magnet underperforms, the
  promise (name and framing) is the usual culprit, not the content. Test a
  sharper name before making a new asset.
- **Never attach the file to the delivery email.** Attachments from unfamiliar
  senders trip spam filters and strip your click data. Host it, link it.
- **Tools rot silently.** A calculator with stale numbers or a broken submit
  quietly damages trust with every visitor. A tool needs an owner and a review
  cadence — or don't build one.
