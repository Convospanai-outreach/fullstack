import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessCMS } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { execSync } from "child_process";
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

// Helper to get GitHub token dynamically from Windows Credential Manager
function getGitToken(): string | null {
    try {
        const tmpDir = path.join(process.cwd(), "tmp");
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        // Inline PowerShell command to query Credential Manager using customized TEMP/TMP
        const psCommand = `
            $env:TEMP = "${tmpDir.replace(/\\/g, '\\\\')}"
            $env:TMP = "${tmpDir.replace(/\\/g, '\\\\')}"
            $code = @"
            using System;
            using System.Runtime.InteropServices;
            public class CredReader {
                [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
                public static extern bool CredRead(string target, uint type, int reserved, out IntPtr credentialPtr);
                [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
                public struct CREDENTIAL {
                    public uint Flags;
                    public uint Type;
                    public string TargetName;
                    public string Comment;
                    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
                    public uint CredentialBlobSize;
                    public IntPtr CredentialBlob;
                    public uint Persist;
                    public uint AttributeCount;
                    public IntPtr Attributes;
                    public string TargetAlias;
                    public string UserName;
                }
                public static string GetPassword(string target) {
                    IntPtr credPtr = IntPtr.Zero;
                    if (CredRead(target, 1, 0, out credPtr)) {
                        CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
                        byte[] blob = new byte[cred.CredentialBlobSize];
                        Marshal.Copy(cred.CredentialBlob, blob, 0, (int)cred.CredentialBlobSize);
                        return System.Text.Encoding.Unicode.GetString(blob);
                    }
                    return null;
                }
            }
"@
            Add-Type -TypeDefinition $code
            [CredReader]::GetPassword("git:https://github.com")
        `;

        const output = execSync(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`, {
            encoding: "utf8",
            windowsHide: true,
        });

        const token = output.trim();
        return token && token.startsWith("github_pat_") ? token : null;
    } catch (err) {
        console.error("[CMS Git Helper] Failed to resolve token:", err);
        return null;
    }
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

        // 1. Stage the file
        execSync(`git add content/${file}`, { cwd: process.cwd() });

        // 2. Commit the file
        execSync(`git commit -m "cms: auto-update content file: ${file}"`, { cwd: process.cwd() });

        // 3. Retrieve token and push
        const token = getGitToken();
        if (token) {
            // Push with temporary authenticated URL
            const authedUrl = `https://x-access-token:${token}@github.com/Convospanai-outreach/fullstack.git`;
            execSync(`git remote set-url origin "${authedUrl}"`, { cwd: process.cwd() });
            try {
                execSync("git push origin HEAD", { cwd: process.cwd() });
            } finally {
                // Restore origin URL
                execSync("git remote set-url origin \"https://github.com/Convospanai-outreach/fullstack.git\"", { cwd: process.cwd() });
            }
        } else {
            // Fallback push (rely on pre-stored SSH / system helpers)
            execSync("git push origin HEAD", { cwd: process.cwd() });
        }

        return NextResponse.json({ success: true, message: "Sync complete" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
