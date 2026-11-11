import fs from "fs";
import path from "path";
import { parseFrontmatter } from "./frontmatter";

export interface Job {
    slug: string;
    title: string;
    location: string;
    type: string;
    department: string;
    open: boolean;
    order: number;
    description: string;
}

const SLUG = /^[a-z0-9_-]+$/i;

const jobsDirectory = path.join(process.cwd(), "content/jobs");

// Openings are written in the CMS: the description is the body. Without `open: true` a position is not
// shown, and with no openings the careers page says so.
export function getJobs(directory: string = jobsDirectory, options: { includeClosed?: boolean } = {}): Job[] {
    if (!fs.existsSync(directory)) return [];

    return fs
        .readdirSync(directory)
        .filter((file) => file.endsWith(".md") && SLUG.test(file.slice(0, -3)))
        .map((file) => {
            const { data, content } = parseFrontmatter(fs.readFileSync(path.join(directory, file), "utf8"));
            const order = Number(data["order"]);
            return {
                slug: file.replace(/\.md$/, ""),
                title: data["title"] ?? "",
                location: data["location"] ?? "",
                type: data["type"] ?? "",
                department: data["department"] ?? "",
                open: data["open"] === "true",
                order: Number.isFinite(order) ? order : 0,
                description: content.trim(),
            };
        })
        .filter((job) => job.title && (options.includeClosed || job.open))
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

// Only an open position can be found, and only by a plain slug.
export function getJobBySlug(slug: string, directory: string = jobsDirectory): Job | undefined {
    if (!SLUG.test(slug)) return undefined;
    return getJobs(directory).find((job) => job.slug === slug);
}
