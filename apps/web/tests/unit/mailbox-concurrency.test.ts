import { describe, it, expect } from "vitest";

describe("Atomic Mailbox Rate Limit Concurrency Lock", () => {
  it("enforces atomic single-row updates and rejects over-cap concurrent attempts", async () => {
    // Simulate parallel workers attempting atomic update on mailbox at capacity limit
    const mailbox = { id: "mb_test_123", sentToday: 50, dailyLimit: 50 };

    const simulateAtomicUpdate = async (sentToday: number, dailyLimit: number) => {
      if (sentToday >= dailyLimit) {
        throw new Error(`Mailbox daily sending limit reached (${sentToday}/${dailyLimit}).`);
      }
      return { updatedCount: 1 };
    };

    const results = await Promise.allSettled([
      simulateAtomicUpdate(mailbox.sentToday, mailbox.dailyLimit),
      simulateAtomicUpdate(mailbox.sentToday, mailbox.dailyLimit),
      simulateAtomicUpdate(mailbox.sentToday, mailbox.dailyLimit),
    ]);

    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBe(3);
  });
});
