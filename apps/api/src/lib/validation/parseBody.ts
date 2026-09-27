import { NextResponse } from "next/server";
import { z } from "zod";

export type ParseBodyResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

// Reads a JSON body and validates it against `schema`. On failure returns a
// ready 400 response in the routes' usual error shape plus zod's field errors,
// so a handler can `if (!parsed.ok) return parsed.response;`. Malformed JSON is
// also a 400 here (it used to surface as a 500 from an unguarded req.json()).
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<ParseBodyResult<z.infer<S>>> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return {
            ok: false,
            response: NextResponse.json({ error: "Invalid JSON body", code: "VALIDATION_ERROR" }, { status: 400 }),
        };
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Invalid payload", code: "VALIDATION_ERROR", details: z.flattenError(parsed.error) },
                { status: 400 }
            ),
        };
    }

    return { ok: true, data: parsed.data };
}
