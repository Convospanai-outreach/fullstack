---
name: humanizer
description: >-
  Rewrite or draft text so it stops sounding like AI, then verify it with a bundled scanner instead of guessing. The scanner scores the
  "accent" (em dashes, stock words, formulaic structures, even rhythm), guards numbers, names and links through the rewrite, and matches a
  person's own voice from writing samples. Use when the user asks to humanize text, remove the ChatGPT voice, or make a draft sound natural,
  less robotic or more like them, and proactively when drafting emails, posts, bios, cover letters, newsletters or website copy that will be
  read as the user's own words. Not for code, legal contracts, citations or technical reference docs, and not a way to beat AI detectors.
license: MIT
metadata:
  brand: How to AI by Ruben Hassid
  version: 2.0.0
  updated: 2026-09-29
---

# Humanizer

AI-written text has a recognizable accent. Readers pattern-match it in seconds and trust drops. This skill removes the accent and keeps the
person: their facts, their register, their voice. Every tell is harmless alone; the density gives it away, so you manage density.

Be honest about scope. The score counts style tells. It is NOT an AI detector, and a low score guarantees nothing about any detector.
Never promise that a text will pass one. Bands: Clean 0-15, Light 16-34, Noticeable 35-59, Heavy 60+. On the test corpus typical chatbot
prose scores 65 or more, an ordinary human email under 15 and a formal human memo under 30 (a small corpus: a guide, not a law). Fluent AI
prose with few stock words can still land in Noticeable or lower, so read the text as well as the number. Aim for Clean or Light; do not
chase 0, and remember the score cannot judge whether a text is true, specific or sounds like the person.

## Workflow

Run commands from this folder (use `python` if `python3` is missing). Save texts to files such as `before.txt` and `after.txt`, or pipe one:
a file name of `-` reads stdin, for example `python3 scripts/tells.py scan - <<'EOF'`, then the text, then `EOF`.

1. **Voice.** If the user gave samples of their own writing, run
   `python3 scripts/tells.py fingerprint sample1.txt sample2.txt --out voice.json` (measurements only, no sentences are stored; offer to keep
   it for next time). If it warns that the samples look AI-written, say so and ask for text the user wrote themselves. No samples: set the
   register from who reads it (a friend, a board, the public); ask one question only if that is unclear.
2. **Scan.** Keep the original as `before.txt`, then run `python3 scripts/tells.py scan before.txt`. Read the band, the top 3 contributors
   and the hits (line, snippet, fix hint).
3. **Rewrite at sentence level.** Rebuild each sentence around its point. Swapping words leaves the robotic skeleton intact. When
   rewriting the user's text, keep their own word choices and quirks: the target voice is theirs. Keep every fact. Never invent one: if the
   source is vague, ask for the real detail or stay plain.
4. **Verify.** `python3 scripts/tells.py compare before.txt after.txt` (add `--formal` for letters, memos, condolences). Fix lost or
   invented facts first: numbers, dates, times and links are errors, names, quotes and acronyms are warnings to check against the
   original. Then fix the hits it still lists. With a voice file also run `python3 scripts/tells.py match after.txt --voice voice.json` and
   apply the deltas. Two fix loops at most, then deliver. Drafting from scratch: save the user's raw facts or notes as `before.txt`, so
   `compare` flags any number or name you invented.
5. **Deliver** the text only, plus one short line such as `Accent score 64 -> 8, all 5 facts kept.` (compare prints it; drop the line if
   the user prefers). Explain changes only if asked and never annotate the text.

**No code execution?** Do the same by hand. Read `assets/tells.json` for the full lexicon with reasons, rewrite, then check: no em dash, no
listed word or phrase, at most one triple, mixed sentence lengths, contractions unless formal, and every number, name, date and link of the
original still there with nothing new added.

## The worst offenders

The full lexicon (words, phrases, openers and closers, structures, with a reason and a fix for each) is in `assets/tells.json`. The ones to
know by heart: delve, tapestry, testament, realm, embark, unleash, unlock, elevate, empower, supercharge, game-changer, seamless, robust,
leverage (verb), utilize, navigate / landscape / journey (as metaphors), pivotal, crucial, foster, harness, streamline, cutting-edge,
"in today's fast-paced world", "it's important to note", "dive into", plus "I hope this email finds you well" and "please don't hesitate".

Ban one word and models slide to its neighbour (multifaceted, intricate, meticulous, paramount, bolster, garner). Replace the habit, do not
rotate the vocabulary. Boring replacements win: "use", "important", "also". If a listed word carries real meaning (robust in statistics, a
literal landscape), keep it.

## What to do instead

- **Em dashes: none.** Use two sentences, a comma, a colon, or parentheses for a true aside. Do not swap in spaced hyphens.
- **Say the second half directly.** Drop "not just X, it's Y", "whether you're X or Y", tacked-on ", highlighting / ensuring ...", "The
  result?" and "serves as".
- **Lopsided rhythm.** One triple per piece. Follow a 30-word sentence with a 4-word one. Vary paragraph length.
- **Structure.** Bullets and bold-term lists are for real lists. No headers on 400 words and no emoji as decoration. No intro that
  announces and no conclusion that repeats: start inside the point and stop when done.
- **Specifics over abstractions,** but only the ones the source gives. "Cut invoice processing from two days to twenty minutes" is good when
  those are the user's numbers.
- **Claims with an owner.** "I think this is a mistake," not "this could potentially be seen as problematic." One hedge is honest, three
  is evasion.
- **Write like the person would say it.** "I wanted to reach out to touch base regarding" fails; "Quick question about" passes. Contractions,
  fragments, And / But openers are fine. Do NOT fake typos or inject slang: forced casualness is its own tell and worse than the stiffness.

## Register warning

Humanizing is not casualizing. A condolence note, a board memo and a group-chat message are all human and sound nothing alike. Match the
situation: keep formal writing formal (no contractions, no slang) and remove only the accent. This command shows a condolence note and a
board memo that stay formal: `python3 scripts/tells.py example --register sensitive`.

## Example

Before (accent score 86, Heavy): "Introducing the AeroBrew Pro, a game-changing coffee maker that seamlessly blends cutting-edge technology
with timeless design. Whether you're a casual sipper or a dedicated connoisseur, AeroBrew Pro empowers you to unlock the full potential of
every bean. With a 12-cup capacity, a built-in grinder, and smart Wi-Fi connectivity, it elevates your morning routine to a whole new
level. Available now for just $129."

After (accent score 0): "The AeroBrew Pro is a coffee maker with a built-in grinder, Wi-Fi and a 12-cup capacity. It's available now for
$129."

Delivered line: `Accent score 86 -> 0, all 4 facts kept.` The source had no more facts than that, so the honest rewrite is short. Ask the user for
one real detail rather than inventing praise. Nine more verified pairs (emails, post, bio, cover letter, intro, announcement, condolence,
board memo) come from `python3 scripts/tells.py example`.

## File map

| Path | Open or run it when | What you get |
| --- | --- | --- |
| `scripts/tells.py` | Any rewrite of 50+ words; a voice to match; a before/after to check | Subcommands `scan`, `compare`, `fingerprint`, `match`, `example`; add `--json` for machine output |
| `assets/tells.json` | Code cannot run, or you want the reason and fix behind a hit | 240+ entries: words, phrases, openers and closers, structures, punctuation, rhythm thresholds |
| `assets/examples.json` | Unsure what a good rewrite looks like in a register | 10 verified before/after pairs: email, post, bio, letter, blurb, intro, announcement, sensitive |
