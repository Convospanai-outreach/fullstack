# Headline and CTA Patterns

Pattern library with failure conditions. A pattern is a starting shape, not a
fill-in exercise: the winner is the one whose strongest slot is filled by the
strongest true thing you have.

## Contents

- Choosing a pattern
- Headline patterns
- Subheadlines
- CTA patterns
- The commitment ladder
- Click triggers

## Choosing a pattern

Match the pattern to the strongest material available, not to preference:

| Your strongest asset | Reach for |
|---|---|
| A hard, verified number | Proof or outcome-with-timeframe patterns |
| A hated, universal status quo | Problem or "never again" patterns |
| A crowded category + one real difference | Differentiation patterns |
| A narrow, self-identifying audience | Audience patterns |
| A product that does one simple thing well | Plain benefit statement |

Generate 5–10 across patterns, then triage them with
`python3 scripts/copy_check.py score --headlines FILE` (one per line) before
you cut to the 2–3 that survive. The ranking is triage on length, specificity,
outcome words, you-focus and banned words. It is not a conversion prediction.

## Headline patterns

| Pattern | Example | Fails when |
|---|---|---|
| {Outcome} without {pain} | "Build your website without writing code" | The pain named isn't the reader's actual blocker, or the outcome half is vague, leaving only the negative |
| {Outcome} in {timeframe} | "Get your tax refund in 10 days" | The timeframe isn't verifiably true, or isn't meaningfully better than normal |
| {Outcome} by {mechanism} | "Generate more leads by seeing which companies visit your site" | The mechanism needs explaining: a mechanism the reader doesn't instantly grasp subtracts instead of adds |
| Turn {input} into {output} | "Turn hard-earned sales into repeat customers" | The reader doesn't feel they already own the input: the pattern's power is activating an existing asset |
| Never {bad event} again | "Never miss a sales opportunity again" | The bad event is rare or low-stakes; "never lose a draft again" moves nobody who lost one once |
| Stop {pain}. Start {gain}. | "Stop chasing invoices. Start getting paid on time." | Either half is abstract: this pattern doubles vagueness as fast as it doubles punch |
| {Question naming the pain}? | "Hate returning stuff to Amazon?" | Any real share of arriving traffic would answer "no": a question headline invites the no and the bounce |
| The {category} for {audience} | "Advanced analytics for Shopify e-commerce" | The reader doesn't already know the category, or the audience is too broad to feel like "that's me" |
| The {category} that {differentiator} | "The CRM that updates itself" | The differentiator is a parity feature every competitor also claims |
| The {opposite-of-usual} way to {outcome} | "The easiest way to turn your passion into income" | The reader doesn't recognize a "usual way" to contrast against |
| Finally, {category} that {benefit} | "Finally, accounting software that doesn't suck" | Frustration with incumbents isn't real and shared: without it this reads as snark, and the tone must fit the brand |
| You don't have to {be expert / have resource} to {outcome} | "You don't have to be an SEO pro to rank higher" | The audience *is* expert: it reads as talking down |
| {Number} {people like them} use {product} to {outcome} | "50,000 marketers use Drip to send better emails" | The number is small or unverifiable: weak social proof is worse than none |
| Plain benefit statement | "Sound clear in online meetings" | The product genuinely does many things: flat statement of one benefit undersells a platform |
| Everything you need to {outcome} | "Everything you need to launch your course" | Buyers are expert enough to hear "bloated", and it says nothing specific |
| What if you could {outcome}? | "What if you could close deals 30% faster?" | Almost always: hypothetical framing is weaker than declaring the same claim; use only when the claim is too big to assert credibly |

## Subheadlines

The subheadline carries what the headline deferred. One to two sentences, no
new claim: specifics for the claim already made:

**{How it works, in plain words} + {who it's for or proof point}**

> Headline: "The CRM that updates itself"
> Subheadline: "Connects to your email and calendar, then logs every contact,
> call, and deal stage automatically, trusted by 4,000 small sales teams."

Failure mode: a subheadline that restates the headline in different words.
If it adds no who, how, or number, it's a wasted line in the most expensive
real estate on the page.

## CTA patterns

Formula: **verb + the thing they get** (+ a qualifier that lowers risk).

| Pattern | Example | Fails when |
|---|---|---|
| Start {my/your} free trial | "Start my free trial" | There's no trial: never dress a demo request as a trial. First person ("my") lifts casual brands, reads off in formal enterprise voice |
| Get {the specific thing} | "Get the pricing teardown checklist" | The thing is vague ("Get started"): the pattern only works when the noun is concrete |
| See {product} in action / on {their data} | "See it on your data" | Fulfillment is a sales call in disguise: the CTA promised watching, not talking |
| Create your first {unit of value} | "Create your first invoice" | Time-to-first-value is actually long; the CTA writes a check onboarding bounces |
| Watch a {length} demo | "Watch the 2-minute demo" | The video is longer than promised, or gated behind a form: bait-and-form kills trust |
| Talk to {a human role} | "Talk to a founder" | Traffic is cold: this is a high-commitment ask; right for bottom-of-page or product-aware readers |

Weak defaults ("Submit", "Learn More", "Click Here", "Sign Up", "Get Started")
name the reader's effort or nothing at all, never the value received. They and
their replacements live in `assets/kill-list.json`; `score` flags them. Button
labels stay short: two to four words, and past about 25 characters buttons
wrap on mobile (`copy_check.py fit button cta "label"`).

## The commitment ladder

Match the ask to how aware the arriving reader is. Asking one rung above their
stage is the most common silent conversion killer:

| Reader's stage | Right ask |
|---|---|
| Problem-aware, solution-unaware | Learn: guide, checklist, teardown: value for an email at most |
| Solution-aware, evaluating | See: demo video, interactive tour, live example |
| Product-aware, near decision | Try: free trial, free tier, sandbox |
| Ready, needs logistics | Buy / talk: purchase, book a call, contact sales |

One primary CTA per page. A secondary CTA is allowed only one rung lower
(e.g., "Start free trial" primary, "Watch demo" secondary), never a
competing offer.

## Click triggers

Two to four short lines under or beside the button, each killing one named
hesitation. Only claim what's true:

- "No credit card required": kills the forgot-to-cancel fear
- "Set up in 10 minutes": kills the effort objection (use the real number)
- "Cancel anytime" / "30-day money-back guarantee": kills the lock-in fear
- "Join 2,400 agencies": borrowed courage at the decision point
- "You'll get X immediately after": kills the what-happens-next uncertainty

Failure mode: stacking all five as decoration. Pick the two to three that
answer this page's actual objections: triggers that don't match a real
hesitation read as protesting too much.
