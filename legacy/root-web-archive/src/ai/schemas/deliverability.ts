
import { z } from "zod";

export const DeliverabilityAnalysisSchema = z.object({
    placementSummary: z.object({
        isps: z.array(z.object({
            name: z.string(), // Gmail, Outlook, Yahoo
            inbox: z.number().describe("Percentage 0-100"),
            promotions: z.number().optional().describe("Percentage 0-100"),
            spam: z.number().describe("Percentage 0-100"),
            missing: z.number().optional()
        })),
        disclaimer: z.string().describe("Mandatory disclaimer about seed inboxes")
    }),

    deliverySignals: z.object({
        analysis: z.string().describe("Analysis of delivery patterns, bounces, and complaints"),
        keyObservations: z.array(z.string())
    }),

    engagementSignals: z.object({
        analysis: z.string().describe("Analysis of opens, clicks, and decay"),
        proxyStatement: z.string().describe("Mandatory statement about engagement as a proxy")
    }),

    contentRisk: z.object({
        factors: z.array(z.object({
            name: z.string(), // e.g., "Subject Line Aggressiveness"
            riskLevel: z.enum(["Low", "Medium", "High"]),
            observation: z.string(),
            reasoning: z.string()
        })),
        overallRiskProfile: z.enum(["Low", "Medium", "High"])
    }),

    topContributingFactors: z.array(z.object({
        signalType: z.enum(["Content", "Engagement", "Delivery"]),
        observation: z.string(),
        whyItMatters: z.string(),
        confidence: z.enum(["Low", "Medium", "High"])
    })).max(5),

    healthySignals: z.array(z.string()).describe("List of neutral or positive elements"),

    recommendations: z.array(z.object({
        element: z.string().describe("The exact element to change"),
        alternative: z.string().describe("Specific alternative suggestion"),
        expectedImpact: z.string(),
        testRecommendation: z.string().describe("Controlled test proposal")
    })),

    testingGuidance: z.object({
        proposedTest: z.string(),
        metricsToObserve: z.array(z.string())
    }),

    userExplanation: z.string().describe("Legally safe, plain-language explanation for the dashboard")
});

export type DeliverabilityAnalysis = z.infer<typeof DeliverabilityAnalysisSchema>;
