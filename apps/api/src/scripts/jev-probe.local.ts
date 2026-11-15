import { judgeOutreachDraft, NOUL_NO, NOUL_YES } from "../lib/ai/jev";

// Throwaway probe for the Jev draft screen (JEV_SCREEN). Synthetic drafts only: nothing real is sent.
// Run from apps/api with JEV_API_KEY set (in .env or the shell):
//   npx tsx -r dotenv/config src/scripts/jev-probe.local.ts
// About 12 calls of a few hundred input tokens each: a few cents at most.

const prospect = { title: "VP of Sales", company: "Northwind Analytics", signal: "Announced a Series B and plans to double the sales team", pain: "Ramping new reps takes too long" };

type Expect = "clean" | "inventsFact" | "readsAsPitch" | "hardAsk";
const cases: { name: string; expect: Expect; draft: { subject: string; body: string } }[] = [
    { name: "clean: specific, light question", expect: "clean", draft: { subject: "Congrats on the Series B", body: "Hi Sam, saw the Series B news and the plan to double the sales team. Curious how you are thinking about getting new reps productive quickly?" } },
    { name: "clean: short peer note", expect: "clean", draft: { subject: "Growing the team", body: "Hi Sam, doubling a sales team is a big lift. How are you approaching onboarding for the new reps?" } },
    { name: "clean: asks nothing", expect: "clean", draft: { subject: "Saw the news", body: "Hi Sam, congratulations on the Series B. Exciting time to be leading sales at Northwind." } },
    { name: "invented fact: result", expect: "inventsFact", draft: { subject: "Results for teams like yours", body: "Hi Sam, we helped a company just like Northwind cut ramp time by 40 percent last quarter. Curious if that matters to you?" } },
    { name: "invented fact: relationship", expect: "inventsFact", draft: { subject: "Your talk at SaaStr", body: "Hi Sam, I enjoyed your talk at SaaStr last month on hiring. Would love to compare notes on ramping reps." } },
    { name: "invented fact: product claim", expect: "inventsFact", draft: { subject: "Your new analytics module", body: "Hi Sam, I noticed Northwind just launched its predictive churn module. How is the sales team positioning it?" } },
    { name: "pitch: features", expect: "readsAsPitch", draft: { subject: "Cut ramp time with our platform", body: "Hi Sam, our platform offers AI coaching, call scoring, automated onboarding paths and analytics dashboards that transform how reps ramp. Industry-leading results." } },
    { name: "pitch: benefits list", expect: "readsAsPitch", draft: { subject: "The #1 sales enablement solution", body: "Hi Sam, we are the leading solution for sales enablement: faster ramp, higher win rates, lower cost per rep. Let me tell you all about what we can do for you." } },
    { name: "hard ask: demo and link", expect: "hardAsk", draft: { subject: "Book a demo", body: "Hi Sam, saw the Series B. Please book a 30 minute demo with me here: https://example.com/book and send over your current onboarding docs." } },
    { name: "hard ask: attachment", expect: "hardAsk", draft: { subject: "Our one-pager", body: "Hi Sam, congratulations on the Series B. I have attached our one-pager; please open it and reply with your team size, tools and budget." } },
];

function verdict(c: (typeof cases)[number], j: { inventsFact: number; readsAsPitch: number; hardAsk: number }): { ok: boolean; note: string } {
    const all = [j.inventsFact, j.readsAsPitch, j.hardAsk];
    if (c.expect === "clean") {
        const max = Math.max(...all);
        return { ok: max <= NOUL_NO, note: max <= NOUL_NO ? "screened (critic skipped)" : "critic would run (a false alarm)" };
    }
    const hit = j[c.expect] >= NOUL_YES;
    const caught = Math.max(...all) > NOUL_NO;
    return { ok: caught, note: hit ? `flagged strongly on ${c.expect}` : caught ? `flagged, but not strongly on ${c.expect}` : "MISSED: would be screened as clean" };
}

async function main() {
    if (!process.env["JEV_API_KEY"]) throw new Error("JEV_API_KEY is not set (put it in apps/api/.env or the shell).");
    let ok = 0;
    for (const c of cases) {
        const j = await judgeOutreachDraft({ prospect, draft: c.draft }, "");
        const v = verdict(c, j);
        if (v.ok) ok++;
        console.log(`${v.ok ? "ok  " : "FAIL"} ${c.name.padEnd(34)} invents ${j.inventsFact.toFixed(2)}  pitch ${j.readsAsPitch.toFixed(2)}  hardAsk ${j.hardAsk.toFixed(2)}  -> ${v.note}`);
    }
    console.log(`\n${ok}/${cases.length} as the decision table expects (clean drafts screened, flawed drafts sent to the critic).`);
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
