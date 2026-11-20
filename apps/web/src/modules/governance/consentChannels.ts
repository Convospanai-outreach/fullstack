export type ConsentChannelState = { channel: "EMAIL" | "WHATSAPP" | "PHONE"; status: "GRANTED" | "REVOKED" | "NONE" };

type LedgerRow = { channel: string; status: string; purpose: string; grantedAt: Date | string };

const CHANNELS = ["EMAIL", "WHATSAPP", "PHONE"] as const;

// What the lead page shows per channel: the newest ledger row decides, as it does when sending. An
// INBOUND_REPLY row is a reply window, not consent, so it is left out.
export function consentChannels(rows: LedgerRow[]): ConsentChannelState[] {
    return CHANNELS.map((channel) => {
        const newest = rows
            .filter((r) => r.channel === channel && r.purpose !== "INBOUND_REPLY")
            .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())[0];
        if (!newest) return { channel, status: "NONE" };
        return { channel, status: newest.status === "GRANTED" ? "GRANTED" : "REVOKED" };
    });
}
