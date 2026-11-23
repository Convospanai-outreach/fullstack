# Copy Teardown: Edit Mode

The working method for improving existing copy. Passes run in order (message,
then sections, then lines) because line polish on a broken argument is deleted
work. After edits at any level, re-check the level above still holds.

## Contents

- Pass 1: Message
- Pass 2: Sections
- Pass 3: Lines
- The final read
- Marketing-speak kill list (pointer)
- Refresh or rewrite?
- Page shapes: the job and the trap
- Delivering the teardown

## Pass 1: Message

Answers whether the page argues one believable thing to one reader. If this
pass fails, fix it before anything else. Most "weak copy" fails here.

- [ ] The page's argument can be stated in one sentence. If it takes two,
      there are two pages here.
- [ ] The headline states that claim, not a riddle, a pun, or a welcome.
- [ ] One audience. Copy addressed to "businesses of all sizes" resonates
      with none of them.
- [ ] Sections run in the reader's objection order: each answers the doubt
      the previous one raised (care? → says who? → my problem? → how? →
      for me? → the catch? → what now?).
- [ ] Skim test passes: reading only headlines and the CTA tells the whole
      argument.
- [ ] Every proof element sits beside the claim it proves.
- [ ] The CTA's commitment level matches the traffic's awareness.
- [ ] The headline continues the promise of the ad, email, or link that
      brought the reader (when the source is known).

## Pass 2: Sections

Run each section through four questions:

**So what?** Every feature or claim bridges to the reader's own outcome:
time, money, status, risk. Add the "which means…" and keep going until it
lands on *their* result, not the product's capability. Impressive-but-empty
statements ("enterprise-grade infrastructure") either get a bridge or get cut.

**Prove it.** Every claim has evidence in sight (a number, a named customer,
a specific testimonial, a guarantee) or gets softened to what's honest.
"Trusted by thousands": which thousands? "Industry-leading": says who?
Testimonials must earn their space: a specific result plus name, role, company
beats a bare "Great product!" signed "John S." Never fabricate proof; list what's missing
for the user to go get.

**Could this be more specific?** Vague verbs ("improve", "optimize"), generic
nouns ("solutions", "workflows"), and adjectives doing a noun's job all get
replaced with numbers, timeframes, names, and mechanisms. What can't be made
specific is filler. Cut it.

**Where's the feeling?** Flat sections that should resonate: paint the
before-state in sensory detail, use a micro-story, name the cost they're
already paying. Emotion serves the argument: if a line exists only to
push feelings, cut it; readers smell manipulation.

Near every CTA, additionally: objections answered within eyeshot, a risk
reversal stated (guarantee, trial, cancel-anytime), the next step explicit
("what happens when I click?"), and no surprise. Price, card requirement, or
time commitment hidden until after the click is a refund request later.

## Pass 3: Lines

Now, and only now, the words:

- Cut intensifiers and filler: very, really, extremely, just, actually,
  basically, "in order to" → "to". `score` counts them per 100 words.
- Exclamation marks out. Confidence is in the claim, not the punctuation.
- Passive → active. Nominalizations back to verbs ("make a decision" →
  "decide").
- Front-load: the important word appears in a line's first five words.
- One idea per sentence; paragraphs 2–4 sentences; vary sentence length so
  it has a pulse.
- Run the kill list (`assets/kill-list.json`, or `score` in the tools).

## Marketing-speak kill list

The list now lives in one place: `assets/kill-list.json` (about 145 words and phrases, each with what to
put in its place). `python3 scripts/copy_check.py score FILE` finds every hit with context and the fix.
The rule behind it: these words say nothing while sounding finished, so the fix is never a synonym. It is
the named thing: the capability with a number, the before and after, the ranking with its source, or the
real effort ("set up in 10 minutes, no code"). By hand, read the JSON and search the copy for each form.

## Page shapes: the job and the trap

Check the page against the shape it claims to be. The trap column is the usual
failure.

| Page | Its job | The trap |
|---|---|---|
| Landing page (paid traffic) | One message, one CTA; continue the ad's exact promise | Extra navigation, second offers, a claim the ad never made |
| Homepage | Route mixed intents; broadest true claim up top, clear paths per audience | Writing it like a landing page: one message can't serve five audiences |
| Pricing | Resolve "which plan is me?"; recommend one plan visibly | Feature grids that never say who each plan is for |
| Feature page | Feature → capability → outcome, with a path to try it | Spec-sheet writing that never reaches the outcome |
| Sales page (long-form) | The full objection sequence for an expensive, considered yes | Length without order: long only works when each section answers the next doubt |
| About | The founding story as proof you'll solve their problem | Autobiography with no reader benefit and no CTA |
| Ad | Earn the click with one promise the landing page keeps | Cleverness that wins clicks the page can't convert; that costs money |

## Refresh or rewrite?

For published pages that have decayed:

| Signal | Action |
|---|---|
| Core message still true; stats, examples, screenshots stale | Refresh: update facts, dates, proof; verify links and pricing still true |
| Brand voice has drifted since publication | Refresh + a voice pass against current voice files |
| The audience, angle, or offer has changed | Rewrite: refreshed details on a wrong argument waste the traffic |
| Page structure no longer matches why people arrive | Rewrite around the current objection sequence |

## Delivering the teardown

1. **Verdict first.** The single biggest problem in one sentence, usually
   message-level. Don't bury it under ten line edits.
2. **Fixes ordered by impact**, each with the rewritten line or section;
   recommend copy, don't just flag problems. Show original → rewrite for the
   lines that matter most.
3. **The can't-fix list.** What the copy needs that writing can't supply:
   missing proof points, no differentiated claim, no testimonials with
   specifics. Name exactly what to go get.
4. **What already works**, named explicitly, so it survives the revision.
   Preserve the author's voice throughout: the job is a sharper version of
   their page, not your page in their fonts.
