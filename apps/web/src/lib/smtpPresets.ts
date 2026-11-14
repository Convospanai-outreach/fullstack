// Known SMTP hosts: what to fill in, and what the domain's SPF record needs so mail sent through them
// passes. Chosen from the SMTP host the user types, so nobody has to look up ports or include values.

export interface SmtpPreset {
    id: string;
    label: string;
    host: string;
    port: number;
    secure: boolean;
    // The include: the domain's SPF record needs for this host; null when it depends on the account.
    spfInclude: string | null;
    note?: string;
}

export const SMTP_PRESETS: SmtpPreset[] = [
    { id: "gmail", label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 587, secure: false, spfInclude: "_spf.google.com", note: "Use an app password, not your Google password." },
    { id: "outlook", label: "Microsoft 365 / Outlook", host: "smtp.office365.com", port: 587, secure: false, spfInclude: "spf.protection.outlook.com" },
    { id: "zoho", label: "Zoho Mail", host: "smtp.zoho.com", port: 587, secure: false, spfInclude: "zoho.com", note: "Use smtp.zoho.in or smtp.zoho.eu if your account is in India or Europe." },
    { id: "hostinger", label: "Hostinger Email", host: "smtp.hostinger.com", port: 465, secure: true, spfInclude: "_spf.mail.hostinger.com" },
    { id: "sendgrid", label: "SendGrid", host: "smtp.sendgrid.net", port: 587, secure: false, spfInclude: "sendgrid.net", note: "The username is the word apikey; the password is your API key." },
    { id: "mailgun", label: "Mailgun", host: "smtp.mailgun.org", port: 587, secure: false, spfInclude: "mailgun.org" },
    { id: "brevo", label: "Brevo", host: "smtp-relay.brevo.com", port: 587, secure: false, spfInclude: "spf.brevo.com" },
];

/** The preset whose host the user has typed, ignoring case and spaces; undefined for any other host. */
export function presetForHost(host: unknown): SmtpPreset | undefined {
    const value = typeof host === "string" ? host.trim().toLowerCase() : "";
    return value ? SMTP_PRESETS.find((p) => p.host === value) : undefined;
}

/** The domain part of an email address, or "" when there is none. */
export function domainOfEmail(email: unknown): string {
    const value = typeof email === "string" ? email.trim().toLowerCase() : "";
    const at = value.lastIndexOf("@");
    return at > 0 && at < value.length - 1 ? value.slice(at + 1) : "";
}
