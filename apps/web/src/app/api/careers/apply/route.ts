import { NextResponse } from "next/server";
import { clientIpFromRequest, looksLikeBot, verifyTurnstile } from "@/lib/botCheck";
import { getJobBySlug } from "@/lib/careers";
import { internalErrorMessage } from "@/lib/internalError";
import { checkResume } from "@/lib/resumeFile";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

// Public application form for an open position. The resume is stored with the application and only a
// signed-in superadmin can download it.
export async function POST(req: Request) {
    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Cheap bot checks look like success so a bot learns nothing about what tripped them.
    if (looksLikeBot({ website: form.get("website") ?? undefined, elapsedMs: Number(form.get("elapsedMs")) })) {
        return NextResponse.json({ success: true });
    }

    const ip = clientIpFromRequest(req);
    if (!(await verifyTurnstile(form.get("turnstileToken"), ip))) {
        return NextResponse.json({ error: "Please complete the verification and try again." }, { status: 403 });
    }

    const name = text(form.get("name"));
    const email = text(form.get("email")).toLowerCase();
    const phone = text(form.get("phone"));
    const coverNote = text(form.get("coverNote"));
    const resume = form.get("resume");

    if (!name || name.length > 120) return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    if (email.length > 254 || !EMAIL_REGEX.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    if (phone.length > 40) return NextResponse.json({ error: "The phone number is too long" }, { status: 400 });
    if (coverNote.length > 4000) return NextResponse.json({ error: "The note is too long" }, { status: 400 });
    if (!(resume instanceof File)) return NextResponse.json({ error: "Please attach your resume" }, { status: 400 });

    const job = getJobBySlug(text(form.get("jobSlug")));
    if (!job) return NextResponse.json({ error: "This position is not open" }, { status: 404 });

    const bytes = Buffer.from(await resume.arrayBuffer());
    const checked = checkResume(resume.name, bytes);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    const { checkRateLimit } = await import("@/lib/rateLimit");
    const limits = await Promise.all([
        checkRateLimit(`ip:${ip}`, { windowMs: DAY_MS, maxRequests: 10 }, "careers-apply"),
        checkRateLimit(`email:${email}`, { windowMs: DAY_MS, maxRequests: 3 }, "careers-apply"),
    ]);
    if (limits.some((limit) => !limit.allowed)) {
        return NextResponse.json({ error: "Too many applications. Please try again tomorrow." }, { status: 429 });
    }

    try {
        const { prisma } = await import("@/lib/db");
        await prisma.jobApplication.create({
            data: {
                jobSlug: job.slug,
                jobTitle: job.title,
                name,
                email,
                phone: phone || null,
                coverNote: coverNote || null,
                resumeName: resume.name.slice(0, 200),
                resumeType: checked.type,
                resumeSize: bytes.length,
                resumeData: bytes,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: internalErrorMessage(error, "Could not submit your application. Please try again.") }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
}
