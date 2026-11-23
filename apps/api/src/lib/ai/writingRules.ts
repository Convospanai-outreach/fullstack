// Shared writing rules for every AI draft (cold email, follow-ups, drips, LinkedIn, posts, landing copy).
// Distilled from the team's own writing skills in src/lib/ai/copySkills (delete-ai-words, humanizer,
// cold-email, brand-voice-enforcement). The scanner in ./aiTells checks drafts against the same rules.
// Keep these blocks short: they are sent with every draft, so every line costs tokens.

/** How every draft must sound. Goes into system prompts. */
export const HUMAN_VOICE_RULES = `## WRITE LIKE A PERSON
Priority when rules collide: accurate, clear, specific, then human-sounding.
- Start with the useful point. Cut throat-clearing ("I hope this finds you well", "In today's...", "It's worth noting").
- Short paragraphs. Vary sentence length. Use contractions (don't, it's, you're). Prefer active voice.
- Be specific: names, numbers, dates, places. If a fact is not in the input, leave it out.
- No reframe tricks: never "not X, it's Y", "less X, more Y", "it's not just about X", "the real problem is".
- No em dashes. Use a full stop, comma, colon or parentheses.
- Banned words: delve, leverage, unlock, unleash, harness, seamless, robust, innovative, cutting-edge, game-changer,
  streamline, empower, elevate, synergy, holistic, transformative, pivotal, crucial, tapestry, realm, testament,
  journey, navigate (as a metaphor), solution, ecosystem, best-in-class, world-class.
- Plain verbs, not "serves as / stands as / boasts / plays a role in". Say "is", "has", "uses".
- Cut filler transitions: Furthermore, Moreover, Additionally, That said. Cut assistant chatter: Certainly, Happy to help.
- No forced lists of three, no metaphors, no hype ("This changes everything", "Let that sink in").
- If the point is made, stop.`;

/** Cold first-touch email. Replaces generic subject/length guidance. */
export const COLD_EMAIL_RULES = `## COLD EMAIL RULES
- Write like a peer who noticed something relevant, not a vendor. "You/your" should outnumber "I/we".
- Personalisation must connect to the problem: if you delete the opening line and the email still makes sense, rewrite it.
- One ask, low friction, answerable in one line ("Worth a look?", "Relevant for your team?"). Never ask for a 30-minute call on the first touch.
- One proof point beats a feature list. No links unless the input gives one. No HTML.
- Subject: 2 to 5 words, lowercase, looks like an internal email ("hyderabad site", "ops hiring"). No pitch, no urgency, no emoji, no first name, no fake "Re:".`;

/** Follow-ups (opened-no-reply, never-opened, later touches). */
export const FOLLOW_UP_RULES = `## FOLLOW-UP RULES
- Each follow-up adds something new: a different angle, fresh proof, or a useful resource. Never "just checking in" or "bumping this".
- It must stand alone: the reader may not have read the earlier email.
- The last touch is a clean break-up: short, no guilt, easy to say no.`;

/** Tone flexes by reader; the team's style settings are the voice constant. */
export const TONE_BY_READER = `## TONE BY READER
Voice stays the team's (see STYLE SETTINGS). Tone flexes:
- C-suite / founders: ultra-brief, peer-level, understated.
- Managers and heads of function: specific value, a little more detail.
- Technical readers: precise, no fluff.`;

/** Nurture and lifecycle sequences (drip playbooks). From the emails and email-sequence skills. */
export const NURTURE_RULES = `## SEQUENCE EMAIL RULES
- One email, one job: one idea and one call to action. Value before the ask; most emails in a sequence teach, few sell.
- Open with a first line about the reader's situation, not about you. Short paragraphs of one to three sentences, written for a phone screen.
- Subject: clear beats clever, specific beats vague, under 50 characters. No emoji, no fake "Re:", no all caps, no urgency words.
- Each email must make sense on its own; the reader may have skipped the last one. Never "as I mentioned" or "just following up".
- The last email of a sequence gives an easy way out ("If now isn't the time, no reply needed").`;

const FRAMEWORKS = [
    "Problem, Agitate, Solution: name the problem, show what it costs, then the fix.",
    "Before, After, Bridge: where they are, where they could be, how to get there.",
    "Features, Advantages, Benefits: one capability, what it changes, why they care.",
    "Picture, Promise, Prove, Push: paint the outcome, promise it, back it with given proof only, then ask.",
];

/** Rotates the copy framework across a sequence so consecutive emails don't read the same. */
export function frameworkFor(index: number) {
    return `Structure this email as ${FRAMEWORKS[index % FRAMEWORKS.length]}`;
}

/** Social posts. Visible-before-"more" limits from the copywriting skill's platform-specs.json. */
export const SOCIAL_POST_RULES = `## SOCIAL POST RULES
- The hook carries the post. LinkedIn shows about 210 characters before "see more", Instagram and Facebook about 125: the point and the reason to keep reading go before that cut.
- First line: a specific claim, number, mistake or question about the reader. Never "In today's world", "Let's talk about", "Here's the thing" or "Unpopular opinion".
- One idea per post. Short lines, white space between them. Hashtags only at the end.
- Write from the creator's experience to one reader. No "we're excited to announce", no engagement bait ("Agree?", "Like if…").`;

/** Landing-page copy. From the copywriting skill's headline and CTA patterns. */
export const LANDING_COPY_RULES = `## LANDING COPY RULES
- Headline: the reader's outcome, specific and under 12 words. Pick the shape the material supports: "{outcome} without {pain}", "{outcome} by {mechanism}", "The {category} for {audience}", or a plain benefit. No question headlines, no "What if", no "Everything you need".
- Subheadline: how it works in plain words plus who it is for. No new claim.
- CTA labels: verb plus what they get ("Get the checklist", "Book a 20-minute review"). Never "Submit", "Learn more" or "Click here". One primary CTA, repeated; no competing asks.
- Proof only from the brief. Never invent numbers, logos, customer names or testimonials.
- Lead magnet offers name the promise: a specific outcome for a specific person in a short time, usable in ten minutes. Ask for email only.`;
