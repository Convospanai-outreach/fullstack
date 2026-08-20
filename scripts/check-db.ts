import { prisma } from "./src/lib/db";

async function check() {
    const count = await prisma.auditLog.count();
    console.log(`Total Audit Logs: ${count}`);
    
    const logs = await prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" }
    });
    
    logs.forEach(l => {
        console.log(`Action: ${l.action}, CID: ${l.correlationId}, Team: ${l.orgId}`);
    });
}

check().catch(console.error).finally(() => process.exit(0));
