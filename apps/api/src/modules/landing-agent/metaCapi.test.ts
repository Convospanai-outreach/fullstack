import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { buildLeadEvent, hashEmail, hashName, hashPhone, isEventTimeSendable, splitName } from "./metaCapi";

// Known answers: the inputs and SHA-256 values are Meta's own examples from the Customer Information
// Parameters page (re-checked by recomputing each hash), so the normalization is tested against Meta, not us.
describe("Meta customer data normalization and hashing (Meta's documented examples)", () => {
    it("hashes an email after trimming and lowercasing it", () => {
        expect(hashEmail("John_Smith@gmail.com")).toBe("62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f");
        expect(hashEmail("  JOHN_SMITH@GMAIL.COM ")).toBe("62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f");
    });

    it("hashes a phone number as digits only, with the country code and no leading zeros", () => {
        expect(hashPhone("+1 (650) 555-1212")).toBe("e323ec626319ca94ee8bff2e4c87cf613be6ea19919ed1364124e16807ab3176");
        expect(hashPhone("1-650-555-1212")).toBe("e323ec626319ca94ee8bff2e4c87cf613be6ea19919ed1364124e16807ab3176");
    });

    it("hashes a first name in lowercase with no punctuation, UTF-8 encoded", () => {
        expect(hashName("Mary")).toBe("6915771be1c5aa0c886870b6951b03d7eafc121fea0e80a5ea83beb7c449f4ec");
        expect(hashName("Valéry")).toBe("08e1996b5dd49e62a4b4c010d44e4345592a863bb9f8e3976219bac29417149c");
        expect(hashName("정")).toBe("8fa8cd9c440be61d0151429310034083132b35975c4bea67fdd74158eb51db14");
        expect(hashName("M.a-ry!")).toBe("6915771be1c5aa0c886870b6951b03d7eafc121fea0e80a5ea83beb7c449f4ec");
    });

    it("returns undefined for empty values, so no empty user_data field is sent", () => {
        expect(hashEmail("   ")).toBeUndefined();
        expect(hashPhone("+ -")).toBeUndefined();
        expect(hashName(undefined)).toBeUndefined();
    });

    it("hashes with SHA-256 hex, the form Meta expects", () => {
        expect(hashEmail("john_smith@gmail.com")).toBe(createHash("sha256").update("john_smith@gmail.com", "utf8").digest("hex"));
    });
});

describe("splitName", () => {
    it("takes the first word as first name and the last word as last name", () => {
        expect(splitName("Mary Ann Smith")).toEqual({ firstName: "Mary", lastName: "Smith" });
        expect(splitName("Mary")).toEqual({ firstName: "Mary" });
        expect(splitName("  ")).toEqual({});
    });
});

describe("isEventTimeSendable", () => {
    const now = 1_800_000_000;
    it("accepts events up to six days old", () => {
        expect(isEventTimeSendable(now - 6 * 86400, now)).toBe(true);
        expect(isEventTimeSendable(now, now)).toBe(true);
    });

    it("drops events older than six days (Meta rejects the whole batch past seven)", () => {
        expect(isEventTimeSendable(now - 6 * 86400 - 1, now)).toBe(false);
    });

    it("drops events stamped in the future", () => {
        expect(isEventTimeSendable(now + 600, now)).toBe(false);
    });
});

describe("buildLeadEvent", () => {
    const base = {
        eventId: "11111111-2222-4333-8444-555555555555",
        eventTime: 1_800_000_000,
        eventSourceUrl: "https://go.brand.test/spring",
        email: "John_Smith@gmail.com",
        name: "Mary Ann Smith",
        phone: "+1 (650) 555-1212",
        clientIp: "168.212.226.204",
        clientUserAgent: "Mozilla/5.0 (test)",
        fbc: "fb.1.1800000000000.IwAR123",
        fbp: "fb.1.1800000000000.1234567890",
    };

    it("builds a website Lead with the shared event_id and the required fields", () => {
        const payload = buildLeadEvent(base);
        expect(payload.data).toHaveLength(1);
        const event = payload.data[0]!;
        expect(event).toMatchObject({
            event_name: "Lead",
            event_time: 1_800_000_000,
            event_id: base.eventId,
            event_source_url: "https://go.brand.test/spring",
            action_source: "website",
        });
    });

    it("hashes em, ph, fn and ln, and leaves IP, user agent, fbc and fbp unhashed", () => {
        const user = buildLeadEvent(base).data[0]!.user_data;
        expect(user.em).toEqual([hashEmail(base.email)]);
        expect(user.ph).toEqual([hashPhone(base.phone)]);
        expect(user.fn).toEqual([hashName("Mary")]);
        expect(user.ln).toEqual([hashName("Smith")]);
        expect(user.client_ip_address).toBe("168.212.226.204");
        expect(user.client_user_agent).toBe("Mozilla/5.0 (test)");
        expect(user.fbc).toBe(base.fbc);
        expect(user.fbp).toBe(base.fbp);
    });

    it("omits every user_data field it does not have", () => {
        const user = buildLeadEvent({ eventId: base.eventId, eventTime: base.eventTime, eventSourceUrl: base.eventSourceUrl, email: "a@b.co" }).data[0]!.user_data;
        expect(Object.keys(user)).toEqual(["em"]);
    });

    it("sends test_event_code only when one is set", () => {
        expect(buildLeadEvent(base)).not.toHaveProperty("test_event_code");
        expect(buildLeadEvent({ ...base, testEventCode: "TEST12345" })).toHaveProperty("test_event_code", "TEST12345");
    });
});
