import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isSuperAdminRole } from "@/lib/auth";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { internalErrorMessage } from "@/lib/internalError";
import { clientIp } from "@/lib/clientIp";

const CONTENT_DIR = path.join(process.cwd(), "content");

async function getActorEnterpriseRole() {
    const session = await getServerSession(authOptions);
    return session?.user?.enterpriseRole;
}

// Writing platform content and pushing it to the app's git repo are recorded before they run, so
// neither can happen unrecorded: if the row cannot be written, the action does not run. The file
// name is recorded, never its content.
async function auditCms(req: NextRequest, action: "CMS_WRITE" | "CMS_PUSH", file: string) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) throw new Error("No signed-in user to record the action for");
    const { prisma } = await import("@/lib/db");
    await prisma.superAdminAuditLog.create({
        data: { userId, action, ipAddress: clientIp(req.headers), metadata: { file } },
    });
}

// Helper to sanitize and resolve paths safely
function getSafePath(file: string): string {
    const resolved = path.resolve(CONTENT_DIR, file);
    if (resolved !== CONTENT_DIR && !resolved.startsWith(CONTENT_DIR + path.sep)) {
        throw new Error("Directory traversal detected");
    }
    return resolved;
}

export async function GET(req: NextRequest) {
    const enterpriseRole = await getActorEnterpriseRole();
    // This route touches a single platform-wide content directory and pushes to the
    // app's own git repo, not per-tenant data. ORG_ADMIN/CMS_EDITOR (canAccessCMS) are
    // self-service-assignable per-workspace roles (WORKSPACE_ASSIGNABLE_ROLES), so any
    // customer who invites a teammate as ORG_ADMIN or CMS_EDITOR of their own workspace
    // could otherwise deface shared content or force a git push - the same self-service
    // role anti-pattern already fixed under OPEN-124/153/174.
    if (!isSuperAdminRole(enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");

    try {
        if (file) {
            const safePath = getSafePath(file);
            if (!fs.existsSync(safePath)) {
                return NextResponse.json({ error: "File not found" }, { status: 404 });
            }
            const content = fs.readFileSync(safePath, "utf8");
            return NextResponse.json({ content });
        }

        // List files recursively
        const listFiles = (dir: string): string[] => {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { recursive: true })
                .map((f) => String(f).replace(/\\/g, "/"))
                .filter((f) => f.endsWith(".md"));
        };

        return NextResponse.json({ files: listFiles(CONTENT_DIR) });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}

export async function POST(req: NextRequest) {
    const enterpriseRole = await getActorEnterpriseRole();
    // This route touches a single platform-wide content directory and pushes to the
    // app's own git repo, not per-tenant data. ORG_ADMIN/CMS_EDITOR (canAccessCMS) are
    // self-service-assignable per-workspace roles (WORKSPACE_ASSIGNABLE_ROLES), so any
    // customer who invites a teammate as ORG_ADMIN or CMS_EDITOR of their own workspace
    // could otherwise deface shared content or force a git push - the same self-service
    // role anti-pattern already fixed under OPEN-124/153/174.
    if (!isSuperAdminRole(enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { file, content } = await req.json();
        if (!file || typeof content !== "string") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const safePath = getSafePath(file);
        await auditCms(req, "CMS_WRITE", file);
        fs.mkdirSync(path.dirname(safePath), { recursive: true });
        fs.writeFileSync(safePath, content, "utf8");

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}

// Git Commit & Sync
export async function PUT(req: NextRequest) {
    const enterpriseRole = await getActorEnterpriseRole();
    // This route touches a single platform-wide content directory and pushes to the
    // app's own git repo, not per-tenant data. ORG_ADMIN/CMS_EDITOR (canAccessCMS) are
    // self-service-assignable per-workspace roles (WORKSPACE_ASSIGNABLE_ROLES), so any
    // customer who invites a teammate as ORG_ADMIN or CMS_EDITOR of their own workspace
    // could otherwise deface shared content or force a git push - the same self-service
    // role anti-pattern already fixed under OPEN-124/153/174.
    if (!isSuperAdminRole(enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { file } = await req.json();
        if (!file) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Validate the path stays inside CONTENT_DIR before it ever touches a
        // child process argument - execFileSync below passes args as an array (no
        // shell), so this isn't for command-injection safety, just path safety.
        getSafePath(file);
        await auditCms(req, "CMS_PUSH", file);
        const relativePath = path.join("content", file);

        // 1. Stage the file
        execFileSync("git", ["add", relativePath], { cwd: process.cwd() });

        // 2. Commit the file
        execFileSync("git", ["commit", "-m", `cms: auto-update content file: ${file}`], { cwd: process.cwd() });

        // 3. Push using the system's own git credential helper - never read
        // or embed a token in the remote URL from application code.
        execFileSync("git", ["push", "origin", "HEAD"], { cwd: process.cwd() });

        return NextResponse.json({ success: true, message: "Sync complete" });
    } catch (err: any) {
        return NextResponse.json({ error: internalErrorMessage(err) }, { status: 500 });
    }
}
