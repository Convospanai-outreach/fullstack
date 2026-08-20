---
name: brand-voice-enforcement
description: >
  This skill applies brand guidelines to content creation. It should be used when
  the user asks to "write an email", "draft a proposal", "create a pitch deck",
  "write a LinkedIn post", "draft a presentation", "write a Slack message",
  "draft sales content", or any content creation request where brand voice should
  be applied. Also triggers on "on-brand", "brand voice", "enforce voice",
  "apply brand guidelines", "brand-aligned content", "write in our voice",
  "use our brand tone", "make this sound like us", "rewrite this in our tone",
  or "this doesn't sound on-brand". Not for generating guidelines from scratch
  (use guideline-generation) or discovering brand materials (use discover-brand).
---

# Brand Voice Enforcement

Apply existing brand guidelines to all sales and marketing content generation. Load the user's brand guidelines, apply voice constants and tone flexes to the content request, validate output, and explain brand choices.

## Loading Brand Guidelines

Find the user's brand guidelines using this sequence. Stop as soon as you find them:

1. **Session context** — Check if brand guidelines were generated earlier in this session. If so, they are already in the conversation. Use them directly. Session-generated guidelines are the freshest and reflect the user's most recent intent.

2. **Local guidelines file** — Check for `.claude/brand-voice-guidelines.md` or `docs/BRAND_VOICE_GUIDELINES.md` inside the user's working folder.

3. **Ask the user** — If none of the above found guidelines, request them from the user before proceeding.

Also read `.claude/brand-voice.local.md` for enforcement settings:
- `strictness`: strict | balanced | flexible
- `always-explain`: whether to always explain brand choices

## Enforcement Workflow

### 1. Analyze the Content Request

Before writing, identify:
- **Content type**: email, presentation, proposal, social post, message, etc.
- **Target audience**: role, seniority, industry, company stage
- **Key messages needed**: which message pillars apply
- **Specific requirements**: length, format, tone overrides

### 2. Apply Voice Constants

Voice is the brand's personality — it stays constant across all content:
- Apply "We Are / We Are Not" attributes from guidelines
- Use brand personality consistently: **Governed, Terse, Problem-first, Operator-focused**
- Incorporate approved terminology (`governed`, `signal`, `approved`, `drafts`, `routes`, `surfaces`, `stage`, `pipeline`, `operators`)
- Reject prohibited terms (`seamless`, `revolutionary`, `game-changing`, `effortless`, `AI-powered magic`)
- Follow messaging framework and value propositions

### 3. Flex Tone for Context

Tone adapts by content type and audience:
- **Problem statements**: Blunt, short sentences, cold diagnosis.
- **Product layer descriptions**: Confident, plain verbs (*drafts, tracks, governs, routes*).
- **CTA / pilot invite**: Direct, scarcity-flavored (*"invite-only," "small group"*).
- **Trust/security**: Serious, no jokes.
- **Tagline**: Terse manifesto (*"Built for operators, not demos."*)

### 4. Generate Content

Create content that:
- Matches brand voice attributes throughout
- Follows tone guidelines for this specific content type
- Incorporates key messages naturally
- Uses preferred terminology
- Applies Seth Godin style (one idea per line, short punch, truth stated flat)

### 5. Validate and Explain

After generating content:
- Briefly highlight which brand guidelines were applied
- Explain key voice and tone decisions
- Note any areas where guidelines were adapted for context
- Offer to refine based on feedback

When `always-explain` is true in settings, include brand application notes with every response.
