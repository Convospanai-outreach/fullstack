// A/B tests between two published landing pages (phase 6B). Each test serves one shared path (<domain>/<slug>).
// Every query is scoped by teamId. Starting, pausing, ending or picking a winner rewrites the Worker's KV mapping
// (landingExperimentKv.ts) so the edge does not need to call the API on each request.
import { prisma } from "@/lib/db";
import { APIError } from "@/lib/apiResponse";
import { verdictFor, type ExperimentVerdict } from "./landingExperimentStats";
import { writeExperimentToKv } from "./landingExperimentKv";
import { RESERVED_PATH_MESSAGE, isReservedPath } from "./reservedPaths";
import { AB_COOKIE_PREFIX, readCookie } from "./landingExperimentAssignment";

// Same rule as a page path (service.ts setPageSlug / schemas.ts), so an experiment path is also a valid address.
export const EXPERIMENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

const ADDRESS_TAKEN = "This web address is taken. Try another.";

interface ExperimentRow {
    id: string;
    teamId: string;
    name: string;
    slug: string;
    status: "draft" | "running" | "paused" | "ended";
    startedAt: Date | null;
    endedAt: Date | null;
    winnerPageId: string | null;
    variants: Array<{ id: string; landingPageId: string; name: string; weight: number }>;
}

async function findExperimentOrThrow(teamId: string, experimentId: string): Promise<ExperimentRow> {
    const experiment = (await prisma.landingExperiment.findFirst({
        where: { id: experimentId, teamId },
        include: { variants: true },
    })) as ExperimentRow | null;
    if (!experiment) {
        throw new APIError("Experiment not found", 404, "NOT_FOUND");
    }
    return experiment;
}

// Pages are looked up within the team; the caller compares the count and the status.
async function loadTeamPages(teamId: string, pageIds: string[]) {
    return prisma.landingPage.findMany({
        where: { id: { in: pageIds }, teamId },
        select: { id: true, slug: true, status: true },
    });
}

export async function createExperiment(input: {
    teamId: string;
    name: string;
    slug: string;
    pageAId: string;
    pageBId: string;
    weightA: number;
}) {
    if (!Number.isInteger(input.weightA) || input.weightA < 1 || input.weightA > 99) {
        throw new APIError("The weight of variant A must be a whole number from 1 to 99.", 400, "VALIDATION_ERROR");
    }
    if (input.pageAId === input.pageBId) {
        throw new APIError("Variant A and variant B must be different pages.", 400, "VALIDATION_ERROR");
    }
    if (!EXPERIMENT_SLUG_PATTERN.test(input.slug)) {
        throw new APIError("Use 2 to 63 letters, numbers or hyphens, starting with a letter or number.", 400, "VALIDATION_ERROR");
    }
    if (isReservedPath(input.slug)) {
        throw new APIError(RESERVED_PATH_MESSAGE, 400, "VALIDATION_ERROR");
    }
    const pages = await loadTeamPages(input.teamId, [input.pageAId, input.pageBId]);
    if (pages.length !== 2) {
        throw new APIError("Both variant pages must be pages of this team.", 404, "NOT_FOUND");
    }
    // Both ways: the path cannot be a page's address, and cannot be another test's path.
    if (await prisma.landingPage.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
        throw new APIError(ADDRESS_TAKEN, 409, "CONFLICT");
    }
    if (await prisma.landingExperiment.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
        throw new APIError(ADDRESS_TAKEN, 409, "CONFLICT");
    }
    return prisma.landingExperiment.create({
        data: {
            teamId: input.teamId,
            name: input.name,
            slug: input.slug,
            status: "draft",
            variants: {
                create: [
                    { name: "A", landingPageId: input.pageAId, weight: input.weightA },
                    { name: "B", landingPageId: input.pageBId, weight: 100 - input.weightA },
                ],
            },
        },
        include: { variants: true },
    });
}

export async function listExperiments(input: { teamId: string }) {
    return prisma.landingExperiment.findMany({
        where: { teamId: input.teamId },
        include: { variants: true },
        orderBy: { createdAt: "desc" },
    });
}

export async function startExperiment(input: { teamId: string; experimentId: string; now?: Date }) {
    const experiment = await findExperimentOrThrow(input.teamId, input.experimentId);
    if (experiment.status !== "draft" && experiment.status !== "paused") {
        throw new APIError("Only a draft or paused test can be started.", 409, "CONFLICT");
    }
    const pageIds = experiment.variants.map((v) => v.landingPageId);
    const pages = await loadTeamPages(input.teamId, pageIds);
    if (pages.length !== 2 || pages.some((p) => p.status !== "published")) {
        throw new APIError("Both variant pages must be published before the test starts.", 409, "CONFLICT");
    }
    // A page can be an arm of only one running or paused test.
    const busy = await prisma.landingExperimentVariant.findFirst({
        where: {
            landingPageId: { in: pageIds },
            experiment: { status: { in: ["running", "paused"] }, id: { not: experiment.id } },
        },
        select: { id: true },
    });
    if (busy) {
        throw new APIError("One of these pages is already in another test.", 409, "CONFLICT");
    }
    const updated = await prisma.landingExperiment.update({
        where: { id: experiment.id },
        data: { status: "running", startedAt: experiment.startedAt ?? input.now ?? new Date(), endedAt: null },
    });
    await writeExperimentToKv(experiment.id);
    return updated;
}

export async function pauseExperiment(input: { teamId: string; experimentId: string }) {
    const experiment = await findExperimentOrThrow(input.teamId, input.experimentId);
    if (experiment.status !== "running") {
        throw new APIError("Only a running test can be paused.", 409, "CONFLICT");
    }
    const updated = await prisma.landingExperiment.update({ where: { id: experiment.id }, data: { status: "paused" } });
    await writeExperimentToKv(experiment.id);
    return updated;
}

export async function endExperiment(input: { teamId: string; experimentId: string; now?: Date }) {
    const experiment = await findExperimentOrThrow(input.teamId, input.experimentId);
    if (experiment.status !== "running" && experiment.status !== "paused") {
        throw new APIError("Only a running or paused test can be ended.", 409, "CONFLICT");
    }
    const updated = await prisma.landingExperiment.update({
        where: { id: experiment.id },
        data: { status: "ended", endedAt: input.now ?? new Date() },
    });
    await writeExperimentToKv(experiment.id);
    return updated;
}

// Ends the test (if still open) and points the shared path at the chosen page. The other page stays a normal page.
export async function pickWinner(input: { teamId: string; experimentId: string; pageId: string; now?: Date }) {
    const experiment = await findExperimentOrThrow(input.teamId, input.experimentId);
    if (experiment.status === "draft") {
        throw new APIError("A winner can only be picked after the test has started.", 409, "CONFLICT");
    }
    if (!experiment.variants.some((v) => v.landingPageId === input.pageId)) {
        throw new APIError("The winner must be one of the two variant pages.", 400, "VALIDATION_ERROR");
    }
    const updated = await prisma.landingExperiment.update({
        where: { id: experiment.id },
        data: { status: "ended", endedAt: experiment.endedAt ?? input.now ?? new Date(), winnerPageId: input.pageId },
    });
    await writeExperimentToKv(experiment.id);
    return updated;
}

// The page's open test variant, when the visitor was sent to this arm by the test: the test cookie must name it.
// A direct visit to the page's own address has no test cookie, so it is not counted for the test.
export async function variantForPage(pageId: string, cookieHeader: string | null): Promise<string | null> {
    const variant = await prisma.landingExperimentVariant.findFirst({
        where: { landingPageId: pageId, experiment: { status: "running" } },
        select: { id: true, name: true, experimentId: true },
    });
    if (!variant) return null;
    return readCookie(cookieHeader, `${AB_COOKIE_PREFIX}${variant.experimentId}`) === variant.name ? variant.id : null;
}

export interface VariantCounts {
    visitors: number;
    formStarts: number;
    leads: number;
    conversionRate: number;
}

export async function getExperimentResults(input: { teamId: string; experimentId: string; now?: Date }) {
    const now = input.now ?? new Date();
    const experiment = await findExperimentOrThrow(input.teamId, input.experimentId);
    const counts: Record<"A" | "B", VariantCounts> = {
        A: { visitors: 0, formStarts: 0, leads: 0, conversionRate: 0 },
        B: { visitors: 0, formStarts: 0, leads: 0, conversionRate: 0 },
    };
    for (const name of ["A", "B"] as const) {
        const variant = experiment.variants.find((v) => v.name === name);
        if (!variant) continue;
        const events = await prisma.landingEvent.findMany({
            where: { teamId: input.teamId, variantId: variant.id, eventName: { in: ["page_view", "form_start"] } },
            select: { id: true, sessionId: true, eventName: true },
        });
        // A visit with no session id counts once per event, so it is never merged with another visit.
        const visitors = new Set(events.filter((e) => e.eventName === "page_view").map((e) => e.sessionId ?? e.id));
        const starters = new Set(events.filter((e) => e.eventName === "form_start").map((e) => e.sessionId ?? e.id));
        const leads = await prisma.landingLead.count({ where: { teamId: input.teamId, variantId: variant.id } });
        counts[name] = {
            visitors: visitors.size,
            formStarts: starters.size,
            leads,
            conversionRate: visitors.size > 0 ? leads / visitors.size : 0,
        };
    }
    const verdict: ExperimentVerdict = verdictFor({
        visitorsA: counts.A.visitors,
        conversionsA: counts.A.leads,
        visitorsB: counts.B.visitors,
        conversionsB: counts.B.leads,
        startedAt: experiment.startedAt ?? now,
        now,
    });
    return { experimentId: experiment.id, status: experiment.status, variants: counts, verdict };
}
