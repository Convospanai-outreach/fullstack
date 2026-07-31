import { NextRequest } from "next/server";
import { GET as handleGet } from "../integrations/google/mailboxes/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    return handleGet(req);
}
