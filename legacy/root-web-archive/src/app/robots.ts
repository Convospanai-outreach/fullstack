import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [process.env['NEXT_PUBLIC_API_URL'] + "/", "/dashboard/", "/settings/"],
        },
        sitemap: "https://convospan.com/sitemap.xml",
    };
}
