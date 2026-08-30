import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lLMUsageLog: {
            findMany: vi.fn(),
        },
        overseerSignal: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

import { detectProviderDegradation } from "./overseerSignalService";

describe("detectProviderDegradation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("ignores a provider with fewer than the minimum sample size", async () => {
        mockPrisma.lLMUsageLog.findMany.mockResolvedValue([
            { provider: "openai", success: false },
            { provider: "openai", success: false },
        ]); // below default MIN_SAMPLE_SIZE of 5

        const result = await detectProviderDegradation();

        expect(result).toEqual({ providersChecked: 1, signalsOpened: 0, signalsResolved: 0 });
        expect(mockPrisma.overseerSignal.create).not.toHaveBeenCalled();
    });

    it("opens a WARN signal when failure rate crosses the warn threshold but not critical", async () => {
        mockPrisma.lLMUsageLog.findMany.mockResolvedValue([
            ...Array(3).fill({ provider: "openai", success: false }),
            ...Array(3).fill({ provider: "openai", success: true }),
        ]); // 50% failure rate
        mockPrisma.overseerSignal.findFirst.mockResolvedValue(null);
        mockPrisma.overseerSignal.create.mockResolvedValue({});

        const result = await detectProviderDegradation();

        expect(result.signalsOpened).toBe(1);
        const createArgs = mockPrisma.overseerSignal.create.mock.calls[0][0].data;
        expect(createArgs.severity).toBe("WARN");
        expect(createArgs.category).toBe("PROVIDER_DEGRADATION");
        expect(createArgs.subject).toBe("openai");
    });

    it("opens a CRITICAL signal when failure rate crosses the critical threshold", async () => {
        mockPrisma.lLMUsageLog.findMany.mockResolvedValue(
            Array(6).fill({ provider: "groq", success: false })
        ); // 100% failure rate
        mockPrisma.overseerSignal.findFirst.mockResolvedValue(null);
        mockPrisma.overseerSignal.create.mockResolvedValue({});

        await detectProviderDegradation();

        const createArgs = mockPrisma.overseerSignal.create.mock.calls[0][0].data;
        expect(createArgs.severity).toBe("CRITICAL");
    });

    it("does not create a duplicate OPEN signal, updating the existing one instead", async () => {
        mockPrisma.lLMUsageLog.findMany.mockResolvedValue(
            Array(6).fill({ provider: "openai", success: false })
        );
        mockPrisma.overseerSignal.findFirst.mockResolvedValue({ id: "existing-1" });
        mockPrisma.overseerSignal.update.mockResolvedValue({});

        const result = await detectProviderDegradation();

        expect(result.signalsOpened).toBe(0);
        expect(mockPrisma.overseerSignal.create).not.toHaveBeenCalled();
        expect(mockPrisma.overseerSignal.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "existing-1" } })
        );
    });

    it("auto-resolves an existing OPEN signal once the provider recovers", async () => {
        mockPrisma.lLMUsageLog.findMany.mockResolvedValue(
            Array(6).fill({ provider: "openai", success: true })
        ); // 0% failure rate now
        mockPrisma.overseerSignal.findFirst.mockResolvedValue({ id: "existing-1" });
        mockPrisma.overseerSignal.update.mockResolvedValue({});

        const result = await detectProviderDegradation();

        expect(result.signalsResolved).toBe(1);
        const updateArgs = mockPrisma.overseerSignal.update.mock.calls[0][0];
        expect(updateArgs.where).toEqual({ id: "existing-1" });
        expect(updateArgs.data.status).toBe("RESOLVED");
    });
});
