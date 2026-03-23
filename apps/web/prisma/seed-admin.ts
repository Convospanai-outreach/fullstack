import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Admin User";

    if (!adminEmail || !adminPassword) {
        console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment");
        process.exit(1);
    }

    // Check if admin already exists
    const existing = await prisma.user.findUnique({
        where: { email: adminEmail }
    });

    if (existing) {
        console.log(`✅ Admin user already exists: ${adminEmail}`);
        return;
    }

    // Create admin user
    const hashedPassword = await hash(adminPassword, 12);
    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            password: hashedPassword,
            name: adminName,
            role: "admin",
            emailVerified: new Date(),
        }
    });

    // Create default team
    const team = await prisma.team.create({
        data: {
            name: `${adminName}'s Team`,
            members: {
                create: {
                    userId: admin.id,
                    email: admin.email,
                    role: "owner",
                    status: "active"
                }
            }
        }
    });

    // Create default settings
    await prisma.settings.create({
        data: {
            userId: admin.id,
            theme: "dark"
        }
    });

    console.log(`✅ Admin user created: ${adminEmail}`);
    console.log(`✅ Team created: ${team.name}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
