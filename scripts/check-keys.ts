import { prisma } from "./src/lib/db";

console.log("Prisma keys:", Object.keys(prisma).filter(k => k.toLowerCase().includes('approval')));
