const fs = require('fs');

const files = [
    { name: 'apps/web/src/scripts/validate-production-readiness.ts' },
    { name: 'apps/web/src/scripts/test-hybrid-ai.ts' },
    { name: 'apps/web/src/scripts/test-conversation-flow.ts' },
    { name: 'apps/web/src/scripts/test-caller-flow.ts' },
    { name: 'apps/web/src/scripts/setup-enterprise-pilot.ts' },
    { name: 'apps/web/src/scripts/seed-readiness.ts' },
    { name: 'apps/web/src/scripts/seed-marketplace.ts' },
    { name: 'apps/web/src/scripts/archive-audit-logs.ts' },
    { name: 'apps/web/src/modules/training/SyntheticDataService.ts' },
    { name: 'apps/web/src/modules/search/service/SearchService.ts' },
    { name: 'apps/web/src/modules/learning/EventStore.ts' },
    { name: 'apps/web/src/modules/icp-builder/service/icpService.ts' },
    { name: 'apps/web/src/modules/conversation/ConversationService.ts' },
    { name: 'apps/web/src/modules/contract/contractResolver.ts' },
    { name: 'apps/web/src/modules/compliance/ResidencyLockService.ts' },
    { name: 'apps/web/src/modules/caller/CallerService.ts' },
    { name: 'apps/web/src/lib/db-replica.ts' },
    { name: 'apps/web/src/lib/queue.ts' },
    { name: 'apps/web/src/lib/permissions.ts' },
    { name: 'apps/web/src/lib/identity/IdentityService.ts' },
    { name: 'apps/web/src/lib/dbFactory.ts' },
    { name: 'apps/web/src/lib/ai/HybridRouter.ts' }
];

for (const fp of files) {
    if(!fs.existsSync(fp.name)) continue;
    let content = fs.readFileSync(fp.name, 'utf8');
    
    // Replace all occurrences of "@prisma/client" with "@/types/prisma-safe" except in db-replica and dbFactory
    // Actually, for dbFactory.ts and db-replica.ts, they import PrismaClient. 
    // Let's replace PrismaClient to import from "@/lib/db" and everything else from "@/types/prisma-safe"
    
    // Convert generic PrismaClient imports
    content = content.replace(/from\s+['"]@prisma\/client['"]/g, 'from "@/types/prisma-safe"');
    content = content.replace(/import\s+{\s*PrismaClient\s*}\s*from\s+["']@\/types\/prisma-safe["']/g, 'import { PrismaClient } from "@/lib/db"');
    content = content.replace(/import\s+{\s*PrismaClient\s*,\s*[^}]*\s*}\s*from\s+["']@\/types\/prisma-safe["']/g, 'import { PrismaClient } from "@/lib/db"'); 
    // That regex might be messy, but I can just do specific replaces for PrismaClient
    content = content.replace(/import\s+{\s*(.*?)PrismaClient(.*?)\s*}\s*from\s+["']@\/types\/prisma-safe["']/g, 'import { PrismaClient } from "@/lib/db"'); // Simplistic fix 
    content = content.replace(/import\s+{\s*(.*?)\s*}\s*from\s+["']@\/types\/prisma-safe["']/g, (match, p1) => {
        if(p1.includes('PrismaClient') || p1.includes('Prisma')) {
            const hasPrismaClient = p1.includes('PrismaClient');
            const hasPrisma = p1.includes('Prisma');
            const others = p1.split(',').map(s=>s.trim()).filter(s=> s!=='PrismaClient' && s!=='Prisma' && s.length>0);
            
            let result = '';
            if(others.length > 0) {
                result += `import { ${others.join(', ')} } from "@/types/prisma-safe";\n`;
            }
            if(hasPrismaClient || hasPrisma) {
                result += `import { ${hasPrismaClient ? 'PrismaClient' : ''}${hasPrismaClient && hasPrisma ? ', ' : ''}${hasPrisma ? 'Prisma' : ''} } from "@/lib/db";\n`;
            }
            return result.trim();
        }
        return match;
    });

    fs.writeFileSync(fp.name, content);
}

// Now update lib/db.ts to export Prisma and PrismaClient so others can use it
let dbContent = fs.readFileSync('apps/web/src/lib/db.ts', 'utf8');
if(!dbContent.includes('export type { PrismaClient, Prisma };')) {
    dbContent += '\nexport type { PrismaClient, Prisma };\n';
    fs.writeFileSync('apps/web/src/lib/db.ts', dbContent);
}

// Update check-web-prisma-imports.mjs to ONLY allow lib/db.ts
let checkScript = fs.readFileSync('scripts/check-web-prisma-imports.mjs', 'utf8');
checkScript = checkScript.replace(/const allowed = new Set\(\[.*?\]\);/ms, 'const allowed = new Set([\n  path.normalize("apps/web/src/lib/db.ts"),\n]);');
fs.writeFileSync('scripts/check-web-prisma-imports.mjs', checkScript);

console.log("Done patching.");
