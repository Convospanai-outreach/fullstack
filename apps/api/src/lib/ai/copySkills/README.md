# Copy skills

The team's writing playbooks, kept here as the source for the AI drafting rules. The app does not send
these files to the model as they are (too long per call). Their rules are distilled into:

| Skill | Used in |
|---|---|
| delete-ai-words, humanizer, copywriting (kill-list) | `lib/ai/writingRules.ts` (HUMAN_VOICE_RULES), `lib/ai/aiTells` (scanner + critic + Jev screen) |
| cold-email | `lib/ai/writingRules.ts` (COLD_EMAIL_RULES, FOLLOW_UP_RULES) -> email composer Node A/B/C |
| brand-voice-enforcement | `lib/ai/writingRules.ts` (TONE_BY_READER) + team style settings |
| emails, email-sequence | `modules/playbooks/dripPlaybooks.ts` (nurture sequences) |
| copywriting (platform-specs, headline/CTA patterns) | `lib/ai/copyLimits.ts`, content post and landing copy prompts |
| lead-magnets, sales-funnel-blueprint | creator-funnel playbook wizard prompts |
| prospecting | ICP qualification guidance |

The Python scripts under `copywriting/scripts` and `humanizer/scripts` are the original CLI tools; the
app uses the TypeScript port in `lib/ai/aiTells` instead. Edit a skill here, then update the distilled
rules where the table says.
