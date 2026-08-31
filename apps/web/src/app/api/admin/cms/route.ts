import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessCMS } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content");

async function getActorEnterpriseRole() {
    const clerkActor = await findOrCreateClerkAppUser();
    if (clerkActor) return clerkActor.enterpriseRole;

    const session = await getServerSession(authOptions);
    return session?.user?.enterpriseRole;
}

// Helper to sanitize and resolve paths safely
function getSafePath(file: string): string {
    const resolved = path.resolve(CONTENT_DIR, file);
    if (!resolved.startsWith(CONTENT_DIR)) {
        throw new Error("Directory traversal detected");
    }
    return resolved;
}

export async function GET(req: NextRequest) {
    const enterpriseRole = await getActorEnterpriseRole();
    if (!canAccessCMS(enterpriseRole)) {
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
    if (!canAccessCMS(enterpriseRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { file, content } = await req.json();
        if (!file || typeof content !== "string") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const safePath = getSafePath(file);
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
    if (!canAccessCMS(enterpriseRole)) {
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
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
