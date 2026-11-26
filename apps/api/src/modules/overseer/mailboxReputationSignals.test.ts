import { describe, expect, it, vi } from "vitest";
import { assessMailboxReputation, lookupSpamhausDbl, type ReputationCounts } from "./mailboxReputationSignals";

const counts = (data: Partial<ReputationCounts> = {}): ReputationCounts => ({
    sent: 0, bounced: 0, hardBounced: 0, complained: 0, delayed: 0, failed: 0, ...data,
});

describe("mailbox reputation thresholds", () => {
    it.each([
        [counts({ sent: 5000, complained: 2 }), "WARNING", "complaint"],
        [counts({ sent: 3750, complained: 3 }), "CRITICAL", "complaint"],
        [counts({ sent: 5001, complained: 2 }), "OK", undefined],
        [counts({ sent: 667, complained: 2 }), "WARNING", "complaint"],
        [counts({ sent: 666, complained: 2 }), "CRITICAL", "complaint_hard_stop"],
        [counts({ sent: 10, complained: 1 }), "OK", undefined],
        [counts({ sent: 50, bounced: 2, hardBounced: 2 }), "CRITICAL", "hard_bounce"],
        [counts({ sent: 49, bounced: 2, hardBounced: 2 }), "WARNING", "bounce"],
        [counts({ sent: 49, delayed: 3 }), "OK", undefined],
        [counts({ sent: 50, delayed: 3 }), "WARNING", "delay"],
        [counts({ sent: 50, bounced: 1 }), "WARNING", "bounce"],
        [counts({ sent: 50, failed: 1 }), "WARNING", "failure"],
    ])("uses exact rates and sample floors for %j", (rates, level, code) => {
        const result = assessMailboxReputation(rates);
        expect(result.level).toBe(level);
        expect(result.signals[0]?.code).toBe(code);
    });

    it("uses recipient-provider rates without mixing their sample with other providers", () => {
        const result = assessMailboxReputation(counts({ sent: 20_000, complained: 2 }), {
            gmail: counts({ sent: 500, complained: 2 }),
            outlook: counts({ sent: 19_500 }),
        });
        expect(result).toMatchObject({ level: "CRITICAL", signals: [{ code: "complaint_hard_stop", recipientProvider: "gmail" }] });
    });

    it("uses verified domain signals ahead of warnings and leaves unknown blocklist answers neutral", () => {
        expect(assessMailboxReputation(counts(), {}, { dnsAlarm: true, blocklist: "UNKNOWN" }).level).toBe("WARNING");
        expect(assessMailboxReputation(counts(), {}, { blocklist: "UNKNOWN" }).level).toBe("OK");
        expect(assessMailboxReputation(counts(), {}, { dnsAlarm: true, blocklist: "LISTED", resendStatus: "failed" })).toMatchObject({
            level: "CRITICAL", signals: [{ code: "blocklist" }, { code: "resend_failed" }, { code: "dns" }],
        });
    });
});

describe("Spamhaus DBL", () => {
    it.each([
        [["127.0.1.2"], "LISTED"],
        [["127.255.255.254"], "UNKNOWN"],
        [["192.0.2.1"], "UNKNOWN"],
    ])("interprets a DBL answer of %j", async (ips, status) => {
        const resolve4 = vi.fn().mockResolvedValue(ips);
        await expect(lookupSpamhausDbl("example.test", resolve4)).resolves.toBe(status);
        expect(resolve4).toHaveBeenCalledWith("example.test.dbl.spamhaus.org");
    });

    it("recognizes NXDOMAIN and leaves transient DNS failures unknown", async () => {
        await expect(lookupSpamhausDbl("example.test", vi.fn().mockRejectedValue({ code: "ENOTFOUND" }))).resolves.toBe("CLEAR");
        await expect(lookupSpamhausDbl("example.test", vi.fn().mockRejectedValue({ code: "ETIMEOUT" }))).resolves.toBe("UNKNOWN");
    });

    it("times out an unresponsive resolver", async () => {
        vi.useFakeTimers();
        try {
            const lookup = lookupSpamhausDbl("example.test", () => new Promise(() => undefined));
            await vi.advanceTimersByTimeAsync(3_000);
            await expect(lookup).resolves.toBe("UNKNOWN");
        } finally {
            vi.useRealTimers();
        }
    });
});
