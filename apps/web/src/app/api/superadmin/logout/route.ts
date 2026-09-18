import { NextResponse } from "next/server";
import { SUPERADMIN_COOKIE_NAME } from "@/lib/superadmin/session";
import { serializeCookie } from "@/lib/superadmin/cookieHeader";

export async function POST() {
    const response = NextResponse.json({ ok: true });
    response.headers.append("Set-Cookie", serializeCookie(SUPERADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 }));
    return response;
}
