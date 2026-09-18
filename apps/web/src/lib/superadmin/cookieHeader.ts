// Hand-rolled Set-Cookie serialization. NextResponse.cookies.set()'s overloaded
// rest-tuple type (next/dist/compiled/@edge-runtime/cookies) doesn't resolve
// cleanly under this project's exactOptionalPropertyTypes tsconfig, so the
// header is appended directly instead.
export function serializeCookie(
    name: string,
    value: string,
    options: { httpOnly?: boolean; secure?: boolean; sameSite?: "strict" | "lax" | "none"; path?: string; maxAge?: number }
): string {
    const segments = [`${name}=${encodeURIComponent(value)}`];
    if (options.path) segments.push(`Path=${options.path}`);
    if (typeof options.maxAge === "number") segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
    if (options.httpOnly) segments.push("HttpOnly");
    if (options.secure) segments.push("Secure");
    if (options.sameSite) segments.push(`SameSite=${options.sameSite[0]!.toUpperCase()}${options.sameSite.slice(1)}`);
    return segments.join("; ");
}
