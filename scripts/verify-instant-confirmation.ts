// Smoke checks for instant confirmation's pure rules, against fixtures: the consent gate, the eligibility rule
// (which sequences can send, and through which channel) and the switch parser. No database, network or Jev.
// Run from apps/api so its "@/" imports resolve: cd apps/api && npx tsx ../../scripts/verify-instant-confirmation.ts
import { consentAllowsContact } from "../apps/api/src/modules/landing-agent/leadConsent";
import { channelOfSingleStep, instantConfirmationOf } from "../apps/api/src/modules/landing-agent/instantConfirmation";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
const check = (name: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    checks.push({ name, ok, detail: ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
};

const given = { given: true, text: "I agree.", at: "2026-11-01T10:00:00.000Z", pageSlug: "guide", source: "landing_form" };

// Consent gate: a form without a consent box sends; a form with one sends only when it was ticked.
check("consent: no consent box on the form", consentAllowsContact({ name: "Ada" }), true);
check("consent: no payload at all", consentAllowsContact(null), true);
check("consent: ticked", consentAllowsContact({ name: "Ada", consent: given }), true);
check("consent: declined", consentAllowsContact({ name: "Ada", consent: { ...given, given: false } }), false);
check("consent: malformed record is not consent", consentAllowsContact({ consent: { given: "yes" } }), false);

// Eligibility: exactly one active step, an email or a WhatsApp step with an approved template name.
const email = { stepType: "EMAIL", subject: "Thanks", body: "Thanks for signing up.", whatsappTemplateName: null, whatsappTemplateLanguage: null };
const whatsapp = { stepType: "WHATSAPP", subject: null, body: "Ada", whatsappTemplateName: "welcome_tpl", whatsappTemplateLanguage: "en" };
check("eligible: one email step", channelOfSingleStep([email]), "email");
check("eligible: one WhatsApp step with a template", channelOfSingleStep([whatsapp]), "whatsapp");
check("not eligible: WhatsApp step with no template", channelOfSingleStep([{ ...whatsapp, whatsappTemplateName: null }]), null);
check("not eligible: a delay step", channelOfSingleStep([{ ...email, stepType: "DELAY" }]), null);
check("not eligible: two steps", channelOfSingleStep([email, email]), null);
check("not eligible: no steps", channelOfSingleStep([]), null);

// Switch: only a switched-on setting with a sequence counts.
check("switch: on with a sequence", instantConfirmationOf({ enabled: true, sequenceId: "seq-1" }), { enabled: true, sequenceId: "seq-1" });
check("switch: off", instantConfirmationOf({ enabled: false, sequenceId: "seq-1" }), null);
check("switch: on without a sequence", instantConfirmationOf({ enabled: true, sequenceId: "" }), null);
check("switch: never set", instantConfirmationOf(undefined), null);

let failed = 0;
for (const c of checks) {
    if (c.ok) console.log(`PASS ${c.name}`);
    else {
        failed += 1;
        console.log(`FAIL ${c.name}: ${c.detail}`);
    }
}
console.log(`${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
