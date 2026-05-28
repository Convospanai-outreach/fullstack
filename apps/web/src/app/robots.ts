export default function robots() {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [process.env['NEXT_PUBLIC_API_URL'] + "/", "/dashboard/", "/settings/"],
        },
        sitemap: "https://craftmyfunnel.com/sitemap.xml",
    };
}
