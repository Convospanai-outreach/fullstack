import type { Metadata } from "next";
import { beforeAll, describe, expect, it } from "vitest";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import robots, { getRobotsTxt } from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getJobs } from "@/lib/careers";

type Params = Record<string, string>;
type RouteModule = {
    metadata?: Metadata;
    generateMetadata?: (props: { params: Promise<Params> }) => Metadata | Promise<Metadata>;
    generateStaticParams?: () => Params[] | Promise<Params[]>;
};

const appDirectory = "../../src/app";
const pages = import.meta.glob<RouteModule>("../../src/app/**/page.tsx");
const layouts = import.meta.glob<RouteModule>("../../src/app/**/layout.tsx");
const siteOrigin = new URL(process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").origin;

describe("public page SEO parity", () => {
    const publicPages: { path: string; metadata: Metadata }[] = [];

    beforeAll(async () => {
        for (const [file, loadPage] of Object.entries(pages)) {
            const route = file.slice(appDirectory.length, -"/page.tsx".length).replace(/\/\([^)]+\)/g, "") || "/";
            const page = await loadPage();
            const loadLayout = layouts[file.replace(/page\.tsx$/, "layout.tsx")];
            // The careers page renders open CMS jobs on demand rather than generating static params.
            const paramsList: Params[] = route === "/careers/[slug]" ? getJobs().map(({ slug }) => ({ slug }))
                : page.generateStaticParams ? await page.generateStaticParams()
                : [{}];

            for (const params of paramsList) {
                const pathname = route.replace(/\[([^\]]+)\]/g, (segment, key: string) => params[key] ?? segment);
                expect(pathname, route).not.toMatch(/\[/);
                const layout = route !== "/" && loadLayout ? await loadLayout() : undefined;
                const metadata = page.generateMetadata
                    ? await page.generateMetadata({ params: Promise.resolve(params) })
                    : { ...layout?.metadata, ...page.metadata };
                publicPages.push({ path: pathname, metadata });
            }
        }
    });

    it("lists every public page once at the configured origin", () => {
        const urls = sitemap().map(({ url }) => new URL(url).href).sort();
        expect(urls).toEqual(publicPages.map(({ path }) => new URL(path, siteOrigin).href).sort());
    });

    it("gives every public page its own title, description and canonical URL", () => {
        const titles = new Set<string>();
        const missing = publicPages.filter(({ metadata }) => typeof metadata.title !== "string" || !metadata.title.trim()
            || !metadata.description?.trim() || !metadata.alternates?.canonical).map(({ path }) => path);
        expect(missing, "Routes missing a title, description or canonical").toEqual([]);
        for (const { path, metadata } of publicPages) {
            const title = (metadata.title as string).trim();
            expect(titles.has(title), path + " repeats the title " + title).toBe(false);
            titles.add(title);
            expect(new URL(String(metadata.alternates!.canonical), siteOrigin).href, path)
                .toBe(new URL(path, siteOrigin).href);
        }
    });

    it("keeps public pages crawlable and advertises the configured sitemap", () => {
        const result = robots();
        const publicPaths = publicPages.map(({ path }) => path);
        const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
        for (const rule of rules) {
            const blocked = [rule.disallow ?? []].flat();
            expect(publicPaths.filter((path) => blocked.some((prefix) => path.startsWith(prefix)))).toEqual([]);
        }
        const textRobots = getRobotsTxt();
        const blocked = Array.from(textRobots.matchAll(/^Disallow: (\S+)/gm), ([, path]) => path);
        expect(publicPaths.filter((path) => blocked.some((prefix) => path.startsWith(prefix)))).toEqual([]);
        expect(result.sitemap).toBe(siteOrigin + "/sitemap.xml");
        expect(textRobots).toContain("Sitemap: " + siteOrigin + "/sitemap.xml");
    });

    it("keeps the curated llms.txt links pointed at public pages or the full index", async () => {
        const response = await getLlmsTxt();
        const text = await response.text();
        const links = Array.from(text.matchAll(/\]\((https:\/\/craftmyfunnel\.live\/[^)]+)\)/g),
            ([, url]) => new URL(url).pathname);
        const valid = new Set([...publicPages.map(({ path }) => path), "/llms-full.txt"]);
        expect(links.length).toBeGreaterThan(0);
        expect(links.filter((path) => !valid.has(path))).toEqual([]);
    });
});
