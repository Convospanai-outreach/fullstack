
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

async function runScript(scriptName: string) {
    console.log(`\n---------------------------------------------------`);
    console.log(`🚀 Running ${scriptName}...`);
    console.log(`---------------------------------------------------`);
    try {
        const { stdout, stderr } = await execAsync(`npx tsx scripts/${scriptName}`);
        console.log(stdout);
        if (stderr) console.error(stderr);
        console.log(`✅ ${scriptName} PASSED`);
        return true;
    } catch (e: any) {
        console.error(`❌ ${scriptName} FAILED`);
        console.error(e.stdout);
        console.error(e.stderr);
        return false;
    }
}

async function main() {
    console.log("Starting FINAL PRE-DEPLOYMENT SYSTEM AUDIT...");
    console.log("Target: Enterprise AI Platform (Micro-LLM, RAG, Causal, Learning)");

    const scripts = [
        "verify-learning-loop.ts", // Immutable audit, event store
        "verify-rag-ranking.ts",   // Outcome-weighted re-ranking
        "test-causal-engine.ts",   // A/B Testing, variant injection
        "verify-ml-training.ts",   // Training pipeline, governance
        "test-micro-llm.ts"        // Stage 0 Local Client
    ];

    let passed = 0;
    for (const script of scripts) {
        const success = await runScript(script);
        if (success) passed++;
        else process.exit(1); // Fail fast
    }

    console.log(`\n===================================================`);
    console.log(`🎉 SYSTEM AUDIT COMPLETE: ${passed}/${scripts.length} SUITES PASSED`);
    console.log(`===================================================`);
}

main();
