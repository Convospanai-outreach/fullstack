import { lookupMx, lookupTxt } from "./dnsLookup";
import type { DomainAuthCheckResult } from "./domainAuthService";

// DNS check for a domain sending through the team's own SMTP server. Unlike Google or Resend, nothing
// here is known in advance: the DKIM selector and key come from the SMTP host, so the check uses the
// selector the user gives (or common ones) and each record carries a plain hint on what to add.
// It proves records exist, not that mail is signed with them.

type Status = "VERIFIED" | "MISSING";
const status = (found: boolean): Status => (found ? "VERIFIED" : "MISSING");

const COMMON_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "s1", "s2", "mail", "smtp", "dkim", "zoho", "mandrill"];
const SELECTOR = /^[a-z0-9][a-z0-9_-]{0,62}$/i;
const SPF_INCLUDE = /^[a-z0-9_][a-z0-9._-]{0,200}$/i;
const DOMAIN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export interface SmtpDomainRecord { status: Status; host: string; values: string[]; expected?: string; hint?: string }
export type SmtpDomainCheckResult = Omit<DomainAuthCheckResult, "records"> & { records: Record<string, SmtpDomainRecord> };

export async function checkSmtpDomainAuth(input: { domain: string; selector?: string | null; spfInclude?: string | null }): Promise<SmtpDomainCheckResult> {
    const domain = input.domain.trim().toLowerCase().replace(/\.$/, "");
    if (!DOMAIN.test(domain)) throw new Error("Enter a valid domain, such as example.com.");
    const given = input.selector?.trim();
    if (given && !SELECTOR.test(given)) throw new Error("Enter a valid DKIM selector.");
    const include = input.spfInclude?.trim().toLowerCase();
    if (include && !SPF_INCLUDE.test(include)) throw new Error("Enter a valid SPF include, such as _spf.google.com.");

    const selectors = given ? [given.toLowerCase()] : COMMON_SELECTORS;
    const labels = domain.split(".");
    const dmarcHosts = Array.from({ length: labels.length - 1 }, (_, i) => `_dmarc.${labels.slice(i).join(".")}`);

    const [mxValues, rootTxt, dmarcTxts, dkimTxts] = await Promise.all([
        lookupMx(domain),
        lookupTxt(domain),
        Promise.all(dmarcHosts.map((h) => lookupTxt(h))),
        Promise.all(selectors.map((s) => lookupTxt(`${s}._domainkey.${domain}`))),
    ]);

    const spfRecords = rootTxt.filter((v) => /^v=spf1\b/i.test(v));
    const spfCovers = (r: string) => !include || r.toLowerCase().includes(`include:${include}`) || /redirect=/i.test(r);
    const spfOk = spfRecords.length === 1 && spfCovers(spfRecords[0]!);
    const spfExpected = `v=spf1 ${include ? `include:${include} ` : ""}~all`;
    const spfHint = spfRecords.length > 1
        ? "Your domain has more than one SPF record, which receivers treat as a failure. Merge them into one."
        : spfRecords.length === 1
            ? `Add include:${include} inside your existing SPF record (do not create a second one).`
            : `Add a TXT record at ${domain}: ${spfExpected}`;

    const dmarcIdx = dmarcTxts.findIndex((list) => list.some((v) => /^v=DMARC1\b/i.test(v)));
    const dmarcValue = dmarcIdx >= 0 ? dmarcTxts[dmarcIdx]!.filter((v) => /^v=DMARC1\b/i.test(v)) : [];
    const dmarcExpected = `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`;

    const dkimIdx = dkimTxts.findIndex((list) => list.some((v) => /(^|;)\s*p=[^;\s]/i.test(v)));
    const dkimHost = `${dkimIdx >= 0 ? selectors[dkimIdx] : selectors[0]}._domainkey.${domain}`;
    const dkimValue = dkimIdx >= 0 ? dkimTxts[dkimIdx]!.filter((v) => /(^|;)\s*p=/i.test(v)) : [];

    const records: Record<string, SmtpDomainRecord> = {
        mx: {
            status: status(mxValues.length > 0), host: domain, values: mxValues,
            ...(mxValues.length ? {} : { hint: "No MX record. Without one, replies to your From address have nowhere to go. Add the MX records your mailbox provider gives you." }),
        },
        spf: { status: status(spfOk), host: domain, values: spfRecords, expected: spfExpected, ...(spfOk ? {} : { hint: spfHint }) },
        dmarc: {
            status: status(dmarcValue.length > 0), host: dmarcHosts[0]!, values: dmarcValue, expected: dmarcExpected,
            ...(dmarcValue.length ? {} : { hint: `Add a TXT record at ${dmarcHosts[0]}: ${dmarcExpected}. p=none only monitors, which is a safe start.` }),
        },
        dkim: {
            status: status(dkimValue.length > 0), host: dkimHost, values: dkimValue,
            ...(dkimValue.length ? {} : {
                hint: given
                    ? `No DKIM key at ${dkimHost}. In your SMTP provider's dashboard, find the DKIM record for ${domain}, then add it exactly as shown.`
                    : "No DKIM key found at common selectors. Your SMTP provider shows the selector and key in its dashboard: enter the selector above, then add the record.",
            }),
        },
    };

    const missing = [
        ...(records["mx"]!.status === "MISSING" ? ["MX"] : []),
        ...(!spfOk ? ["SPF"] : []),
        ...(records["dmarc"]!.status === "MISSING" ? ["DMARC"] : []),
        ...(records["dkim"]!.status === "MISSING" ? ["DKIM"] : []),
    ];
    return {
        domain,
        selector: given?.toLowerCase() ?? (dkimIdx >= 0 ? selectors[dkimIdx]! : ""),
        status: status(missing.length === 0),
        checkedAt: new Date().toISOString(),
        missing,
        records,
    };
}
