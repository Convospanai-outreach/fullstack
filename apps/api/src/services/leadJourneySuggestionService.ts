import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/db";

export type LeadJourneySuggestion = {
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    reason: string;
    recommendation: string;
    suggestedAction?: {
        channel: string;
        status: string;
    };
};

function analyzerPath() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.join(here, "lead_journey_analyzer.py");
}

function pythonCommand() {
    return process.env["PYTHON"] || process.env["PYTHON_BIN"] || "python";
}

function runAnalyzer(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(pythonCommand(), [analyzerPath()], {
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error("Lead journey analyzer timed out."));
        }, 10_000);

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || `Lead journey analyzer exited with code ${code}`));
            }
        });

        child.stdin.end(input);
    });
}

export async function analyzeLeadJourney(params: {
    teamId: string;
    leadId: string;
    now?: Date;
}): Promise<{ suggestions: LeadJourneySuggestion[]; generatedAt: string }> {
    const lead = await (prisma as any).lead.findFirst({
        where: { id: params.leadId, teamId: params.teamId },
        include: {
            channelStatuses: true,
            leadActivities: { orderBy: { createdAt: "desc" }, take: 50 },
            emails: { orderBy: { createdAt: "desc" }, take: 25 },
        },
    });
    if (!lead) {
        const error = new Error("Lead not found") as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
    }

    const input = JSON.stringify({
        now: (params.now || new Date()).toISOString(),
        lead,
    });

    const parsed = JSON.parse(await runAnalyzer(input));
    if (!Array.isArray(parsed?.suggestions)) {
        throw new Error("Lead journey analyzer returned an invalid response.");
    }

    return {
        suggestions: parsed.suggestions,
        generatedAt: parsed.generatedAt || new Date().toISOString(),
    };
}
