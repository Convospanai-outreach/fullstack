import type { Resend } from "resend";

type DnsRecord = { type: string; name: string; content: string; priority?: number; proxied?: boolean };
const hostname = (value: string) => value.trim().toLowerCase().replace(/\.$/, "");
const within = (name: string, zone: string) => name === zone || name.endsWith(`.${zone}`);
const dnsName = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class MailDnsSetupError extends Error {}

export async function configureResendCloudflareDns(input: {
    resend: Resend;
    zoneId: string;
    token: string;
    senderDomain: string;
    inboundDomain?: string | undefined;
}) {
    const { resend, token, zoneId, senderDomain, inboundDomain } = input;
    if (!/^[a-f0-9]{32}$/i.test(zoneId) || !token || !dnsName.test(senderDomain) || (inboundDomain && !dnsName.test(inboundDomain))) {
        throw new MailDnsSetupError("Enter a valid Cloudflare zone ID, token, and mail domain.");
    }
    const domains = [{ name: senderDomain, capability: "sending" as const }];
    const receiving = inboundDomain ? [{ name: inboundDomain, capability: "receiving" as const }] : [];

    const cloudflare = async <T>(path: string, body?: DnsRecord & { ttl: number }): Promise<T> => {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            method: body ? "POST" : "GET",
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(12_000),
        });
        const result = await response.json() as { success: boolean; result: T };
        if (!response.ok || !result.success) throw new MailDnsSetupError("Cloudflare could not access or update the zone. Check the token's zone and DNS permissions.");
        return result.result;
    };

    const zone = await cloudflare<{ name: string; status: string }>("");
    const zoneName = hostname(zone.name);
    if (zone.status !== "active" || !within(senderDomain, zoneName) || (inboundDomain && (!within(inboundDomain, zoneName) || inboundDomain === zoneName || inboundDomain === senderDomain))) {
        throw new MailDnsSetupError("Use an active Cloudflare zone that contains the sender domain and a separate receiving subdomain.");
    }

    const statuses: Array<{ domain: string; ready: boolean }> = [];
    for (const { name, capability } of [...domains, ...receiving]) {
        let existingId: string | undefined;
        let after: string | undefined;
        do {
            const listed = await resend.domains.list({ limit: 100, ...(after ? { after } : {}) });
            if (listed.error || !listed.data) throw new MailDnsSetupError("Could not list Resend domains. Check the Resend API key's permissions.");
            existingId = listed.data.data.find((domain) => hostname(domain.name) === name)?.id;
            const next = listed.data.has_more ? listed.data.data.at(-1)?.id : undefined;
            after = next === after ? undefined : next;
        } while (!existingId && after);

        const result = existingId ? await resend.domains.get(existingId) : await resend.domains.create({
            name,
            capabilities: { sending: capability === "sending" ? "enabled" : "disabled", receiving: capability === "receiving" ? "enabled" : "disabled" },
        });
        if (result.error || !result.data) throw new MailDnsSetupError(`Could not open or create ${name} in Resend.`);
        const domain = result.data;
        if (domain.capabilities[capability] !== "enabled") throw new MailDnsSetupError(`Enable ${capability} for ${name} in Resend and try again.`);

        const providerRecords = domain.records.filter((record) => capability === "sending"
            ? record.record === "DKIM" || record.record === "SPF"
            : record.record === "Receiving");
        if (!providerRecords.length) throw new MailDnsSetupError(`Resend supplied no ${capability} DNS records for ${name}.`);

        const planned: DnsRecord[] = [];
        for (const record of providerRecords) {
            const owner = hostname(record.name);
            const fqdn = owner === "@" ? name : within(owner, name) ? owner : `${owner}.${name}`;
            const desired: DnsRecord = { type: record.type, name: fqdn, content: record.value };
            if (record.type === "MX" && "priority" in record) desired.priority = record.priority;
            if (record.type === "CNAME") desired.proxied = false;
            const query = new URLSearchParams({ "name.exact": fqdn, per_page: "100" });
            const current = await cloudflare<DnsRecord[]>(`/dns_records?${query}`);
            const sameType = current.filter((entry) => hostname(entry.name) === fqdn && entry.type === desired.type);
            const matches = (entry: DnsRecord) => (desired.type !== "MX" || entry.priority === desired.priority) && (desired.proxied !== false || !entry.proxied)
                && (desired.type === "TXT" ? entry.content.replace(/^"|"$/g, "") === desired.content.replace(/^"|"$/g, "") : hostname(entry.content) === hostname(desired.content));
            if (sameType.some((entry) => !matches(entry))) throw new MailDnsSetupError(`A different ${desired.type} record already exists at ${fqdn}. Review it in Cloudflare and try again.`);
            if (!sameType.some(matches)) planned.push(desired);
        }
        for (const record of planned) await cloudflare("/dns_records", { ...record, ttl: 1 });

        const ready = !planned.length && providerRecords.every((record) => record.status === "verified");
        if (!ready && (planned.length || domain.status !== "pending")) {
            const verification = await resend.domains.verify(domain.id);
            if (verification.error) throw new MailDnsSetupError(`Could not start verification for ${name} in Resend.`);
        }
        statuses.push({ domain: name, ready });
    }
    return statuses;
}
