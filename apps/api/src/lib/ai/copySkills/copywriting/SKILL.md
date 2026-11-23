---
name: copywriting
description: >-
  Writes and edits persuasive marketing copy (landing pages, sales pages, ads,
  headlines, CTAs) and checks it with tools: platform character limits with a
  truncation preview, plain copy metrics, customer-word mining, an HTML page
  preview with a skim test, and A/B sample sizing. Use when asked to write copy
  for a page or ad, rewrite a weak headline, punch up copy that isn't converting,
  check ad, email or SEO length limits, mine reviews for the customer's own
  words, or decide whether a test is worth running. Not for LinkedIn or social
  posts, email sequences, in-product microcopy, or pricing and offer design.
license: MIT
metadata:
  brand: How to AI by Ruben Hassid
  protocol: howtoai-v1
  version: 2.0.0
  updated: 2026-09-29
  source: coreyhaines31/marketingskills (copywriting, copy-editing)
  source-sha: 7868cb9
  source-license: MIT
---

# Copywriting

A page converts on its argument, not its adjectives. Marketing copy is one claim, proof placed
where doubt arises, and a next step the reader already wants to take. Most weak copy isn't badly
written, it's a wrong or missing argument, well phrased. Scripts do what a model does badly
(counting, limits, ratios, sample sizes); judgment is yours. Run commands from this folder (use
`python` if `python3` is missing). No code execution? See "Without code".

## Before writing

Gather these from the user and their materials; ask only for what's missing:

1. **The action**: the one thing this page exists to cause. Two primary actions means two pages.
2. **The reader**: who they are, what brought them (ad, search, referral), how aware they are of
   the problem and product. Awareness sets how much convincing the copy owes.
3. **The claim**: why you, over doing nothing and over alternatives, in one sentence. If nobody
   can state it, stop and say so: that's positioning work, and no phrasing out-writes it.
4. **The proof inventory**: real numbers, named customers, testimonials, guarantees. Copy can
   only spend proof that exists.
5. **Their words**: reviews, tickets, sales-call notes. The headline that converts is usually a
   sentence a customer already said; company-coined vocabulary reads as noise. Mine it first:
   `python3 scripts/voc.py mine reviews.csv calls.txt --speaker customer --ours draft.txt`
   gives phrases, pain/desire/outcome/objection/trigger sentences, a quote bank with sources
   and the vocabulary gap vs a draft. Quote only with permission; never invent a testimonial.

If `howtoai/voice/` exists in the working directory (in Claude Code: `${CLAUDE_PLUGIN_DATA}/voice/`),
read it first and obey it: the user's voice files beat every default here.

## The argument

- **One claim per page.** The headline states it, every section advances it. Anything serving a
  second claim gets cut or moved to its own page.
- **Order sections by the reader's objection sequence**; each answers the doubt the previous one
  raised. The default spine:
  1. "Why should I care?" hero: claim + subheadline specifics + CTA
  2. "Says who?" proof bar: logos, a hard number, a rating
  3. "Do you actually get my problem?" the problem, in their words
  4. "Okay, how?" 3-5 benefits (never 10), each outcome → mechanism → proof
  5. "Will it work for *me*? How hard?" how-it-works in 3 steps, use cases
  6. "What's the catch?" FAQ, comparison, guarantee
  7. "Fine, what now?" final CTA: restate the claim, reverse the risk
- **Proof sits beside the claim it proves**, not pooled in a testimonials section at the bottom.
- **Skim test:** section headlines alone must carry the whole argument; most visitors read
  nothing else. `scripts/preview.py` runs it (below).

## Headlines, CTAs and line-level craft

The headline is the claim stated as the most specific believable thing you can say. Generate
options across patterns, then deliver 2-3 with rationale and a pick. Each must pass: specific?
clear to a cold stranger? a promise the product actually cashes? The subheadline carries what
the headline deferred: the who, the how, one number. A CTA is the next obvious step: verb + the
thing they get ("Start my free trial", "See it on your data"), never Submit, Learn More, Click
Here; match the ask to the reader's commitment level and put click triggers under the button.
Read `references/headline-cta-patterns.md` (patterns, when each fails, commitment ladder). With 5-10
candidates in a file, one per line, run `python3 scripts/copy_check.py score --headlines options.txt`:
it ranks them on length, specificity, outcome words, you-focus and banned words, with reasons. It is
triage, not a prediction; the pick is yours.

- **Specific beats adjectives.** "Cut weekly reporting from 4 hours to 15 minutes" beats "save
  time on reporting." A line that can't be made specific is filler: cut it or fetch the fact.
  Exact numbers read as measured, round ones as invented ("2,847 teams", "in 14 days").
- **Run the So What chain to the end.** Feature → capability → the reader's own outcome (time,
  money, status, risk). "Insights you'd miss" is one hop short of "decisions in half the time."
- **Clarity beats cleverness where the reader decides** (headline, CTA, pricing). Be clever only
  once meaning is secure. Active voice, no hedges, no exclamation marks, no superlatives you
  can't prove, more "you" than "we".

## Limits: ads, email, SEO, SMS

Models miscount characters and forget where the reader's view cuts off. Before delivering any
ad, subject line, meta tag or SMS, run each string:
`python3 scripts/copy_check.py fit google-ads rsa-headline "text"` (text, file or `-`; `--lines`
for one item per line). It reports used/limit, ok, cut or over, and marks the cut (`<<CUT>>`).
SEO titles are judged by estimated pixels, SMS by encoding and billed segments (one curly quote
drops 160 to 70), X counts each link as 23; `specs` lists every field. Put the hook and offer
before the cut. Limits change: verify in the platform's preview before a large spend.

## Edit mode: punching up existing copy

When the user brings copy ("punch this up", "why isn't this converting"), run
`python3 scripts/copy_check.py score page.txt`, then read `references/copy-teardown.md` (passes, page
shapes, teardown format) and run its passes in order: **message → sections → lines**. Never polish
sentences a message fix will delete. `score` gives plain flags, not a grade: you vs we, reading grade,
specificity per 100 words, kill-list hits, filler, exclamations, unproven superlatives, question
headlines, weak CTAs, rhythm, AI tells, dashes. They are heuristics (names found by capitalisation,
syllables by rule of thumb): read what a flag points at, and never chase a number by inventing a
fact.

The deliverable is a teardown, not tracked changes: biggest problem first, fixes by impact with
rewritten lines, a can't-fix list (proof or claim to go get), and what already works.

## Show the page, then test

- **Preview.** Put the copy into the page structure (`assets/example-copy.json` shows it,
  `assets/page-content.schema.json` defines it) and run
  `python3 scripts/preview.py copy.json --out preview.html`. SKIM shows only headlines and
  buttons (does the argument survive?), MOBILE narrows the frame, badges mark pass, cut or over
  for SEO title, meta description, share text, buttons and any `checks` lines. It warns on a
  missing hero, over five benefits, or hero and final CTAs that differ.
- **Before suggesting a test,** size it:
  `python3 scripts/copy_check.py abtest --baseline 3.2% --lift 20% --visitors-per-week 800`
  gives visitors per variant, weeks needed and the smallest lift the traffic can detect. On "not
  testable", say so and ship the best-reasoned version. It sizes a test; never promise a lift.

## Gotchas

- **Never invent specifics.** Made-up numbers, fake testimonials and imaginary customer counts
  are legal exposure, not just bad taste. If the fact doesn't exist, flag the gap and soften the
  claim. Cutting weasel words can't add it: "streamline your workflow" minus "streamline" is
  still empty; fetch a number, name or mechanism.
- **The most common broken page is three pages interleaved**: three claims fighting for one
  headline. Fix by subtraction and reordering, never word polish; diagnose the message first.
- **Message match beats copy quality.** Ad says "half price", page says "Eat better": wrong-page bounce.
- **AI-tell scaffolding gets discounted on sight**: "It's not X. It's Y.", parallel triads,
  "seamless/robust" clusters, dash-heavy rhythm. One concrete detail beats three abstractions.

## Without code

- **fit:** take `limit` and `visible` for the field from `assets/platform-specs.json`, count
  characters in tens (spaces and punctuation count), mark the cut, say the count was by hand.
- **score:** walk `references/copy-teardown.md`, search the copy for each form in
  `assets/kill-list.json`, tally "you/your" against "we/our".
- **voc:** tally repeated two-to-four-word phrases, copy strong short lines verbatim with their
  source, list customer words the draft never uses. **preview:** outline the sections in spine
  order, then list only headlines and buttons.
- **abtest:** visitors per variant ~ 16 x p x (1 - p) / (absolute lift)^2, p the baseline (5%
  to 6% gives 7,600; exact is 8,158, so a floor). Divide by weekly traffic; over about 8 weeks
  means do not test.

## File map

| Path | Open or run it when | What you get |
|---|---|---|
| `scripts/copy_check.py` | Any ad, subject, meta or SMS; edit mode; a headline shortlist; before proposing a test | `fit`, `specs`, `score` (`--headlines`), `abtest`; text or `--json` |
| `scripts/voc.py` | The user has reviews, tickets, interviews or call notes | Phrases, cue sentences, quote bank with sources, vocabulary gap vs a draft |
| `scripts/preview.py` | You need to show or check the page as a page | Self-contained HTML: skim, mobile, limit badges, search preview |
| `assets/platform-specs.json` | Reading limits without code | Limit and visible characters per platform field, notes, confidence |
| `assets/kill-list.json` | Editing, or checking words by hand | Marketing-speak, phrases, weak CTAs, AI tells, each with a fix |
| `assets/page-content.schema.json`, `assets/example-copy.json` | Structuring copy for the preview | The page shape it validates against; a fictional full page to copy (replace every claim) |
| `references/headline-cta-patterns.md` | Choosing or rewriting a headline, subheadline or CTA | Patterns, failure conditions, commitment ladder, click triggers |
| `references/copy-teardown.md` | Edit mode; judging a page against its shape | Three passes, page shapes, refresh vs rewrite, teardown format |

## Boundaries

LinkedIn or social posts → **linkedin-post**. Email sequences → **email-marketing**. In-product
microcopy → **ux-copy**. Designing the offer (bonuses, guarantees) → **irresistible-offers**; price
levels and tiers → **pricing-strategy**. Unclear differentiation → **positioning**.
