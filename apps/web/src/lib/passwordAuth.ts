import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSsoEnforcedForEmail } from "@/lib/sso/oidc";
import { provisionUserTeam } from "@/lib/passwordOnboarding";
import { allowForEmail } from "@/lib/botCheck";

export const PASSWORD_MIN_LENGTH = 10;
// bcrypt silently ignores everything past 72 bytes, so longer passwords would
// all collapse to the same hash prefix - reject them instead. Measured in UTF-8
// bytes, not characters: a multibyte password can be under 72 characters and over 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;
const BCRYPT_COST = 12;

// Thrown from authorize(); NextAuth surfaces the message as the `error` code the
// login page maps to copy. Anything else is a plain "CredentialsSignin".
export const AUTH_ERROR_EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";
export const AUTH_ERROR_SSO_REQUIRED = "SSO_REQUIRED";
export const AUTH_ERROR_ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";
export const AUTH_ERROR_RATE_LIMITED = "RATE_LIMITED";

const LOGIN_ATTEMPT_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 10 };
const EMAIL_ATTEMPT_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 30 };

export const profileFieldsSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    company: z.string().trim().min(1, "Company name is required").max(120),
    phone: z
        .string()
        .trim()
        .refine((v) => {
            const digits = v.replace(/\D/g, "");
            return /^\+?[\d\s().-]+$/.test(v) && digits.length >= 7 && digits.length <= 15;
        }, "Enter a valid phone number"),
});

export const registerSchema = profileFieldsSchema.extend({
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
    password: z
        .string()
        .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
        .refine((v) => Buffer.byteLength(v, "utf8") <= PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} bytes`),
});

export function hashPassword(password: string) {
    return bcrypt.hash(password, BCRYPT_COST);
}

let dummyHash: string | undefined;

// Compared against when the email is unknown, so a miss costs the same bcrypt
// round as a hit and response time doesn't reveal which emails are registered.
function getDummyHash() {
    dummyHash ??= bcrypt.hashSync("not-a-real-password", BCRYPT_COST);
    return dummyHash;
}

function clientIp(req: unknown) {
    const headers = (req as { headers?: Record<string, string | string[] | undefined> } | undefined)?.headers;
    const forwarded = headers?.["x-forwarded-for"];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return value?.split(",")[0]?.trim() || "unknown";
}

export async function authorizeCredentials(
    credentials: Record<string, string> | undefined,
    req?: unknown
) {
    const email = typeof credentials?.["email"] === "string" ? credentials["email"].trim().toLowerCase() : "";
    const password = typeof credentials?.["password"] === "string" ? credentials["password"] : "";
    if (!email || !password || Buffer.byteLength(password, "utf8") > PASSWORD_MAX_LENGTH) return null;

    // Keyed on ip+email (not email alone) so an attacker can't lock a victim out
    // of their own account just by guessing at it.
    const { checkRateLimit } = await import("@/lib/rateLimit");
    const limit = await checkRateLimit(`${clientIp(req)}:${email}`, LOGIN_ATTEMPT_LIMIT, "credentials-login");
    if (!limit.allowed) throw new Error(AUTH_ERROR_RATE_LIMITED);

    // The IP above comes from a client-settable header, so also cap guesses per
    // address across all IPs. Generous enough that it is a ceiling on a distributed
    // guessing attack, not a way to lock a real user out.
    if (!(await allowForEmail(email, "credentials-login-email", EMAIL_ATTEMPT_LIMIT.maxRequests, EMAIL_ATTEMPT_LIMIT.windowMs))) {
        throw new Error(AUTH_ERROR_RATE_LIMITED);
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, image: true, password: true, emailVerified: true, suspendedAt: true },
    });

    const passwordOk = await bcrypt.compare(password, user?.password ?? getDummyHash());
    if (!user || !user.password || !passwordOk) return null;

    // Only after the password checks out, so these don't reveal which emails exist.
    if (!user.emailVerified) throw new Error(AUTH_ERROR_EMAIL_NOT_VERIFIED);
    // Suspended from the superadmin panel.
    if (user.suspendedAt) throw new Error(AUTH_ERROR_ACCOUNT_SUSPENDED);
    if (await isSsoEnforcedForEmail(email)) throw new Error(AUTH_ERROR_SSO_REQUIRED);

    // Normally done when the verification link is used; repeating it here (a no-op
    // once a membership exists) means a user who verified but hit an error mid-way
    // still ends up with a team instead of being stuck without one.
    await provisionUserTeam(email);

    return { id: user.id, email: user.email, name: user.name, image: user.image };
}
