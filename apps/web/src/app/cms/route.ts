import { canonicalOrigin, DECAP_SCRIPT } from "@/lib/decapCms";

export const dynamic = "force-dynamic";

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Content Manager</title>
<link href="/cms/config.yml" type="text/yaml" rel="cms-config-url">
</head>
<body>
<script src="${DECAP_SCRIPT.src}" integrity="${DECAP_SCRIPT.integrity}" crossorigin="anonymous"></script>
</body>
</html>
`;

export async function GET(req: Request) {
    const origin = canonicalOrigin(req.url);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    // The GitHub login is registered for one address; another hostname is sent there.
    if (host !== new URL(origin).host) {
        return Response.redirect(`${origin}/cms`, 308);
    }
    return new Response(PAGE, {
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow",
        },
    });
}
