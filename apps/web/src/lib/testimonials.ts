import fs from "fs";
import path from "path";
import { parseFrontmatter } from "./frontmatter";

export interface Testimonial {
    slug: string;
    name: string;
    role: string;
    company: string;
    quote: string;
    order: number;
}

const testimonialsDirectory = path.join(process.cwd(), "content/testimonials");

// Entries are written in the CMS: the quote is the body. One without a name or a quote is left out, and
// with no entries the site shows no testimonials section at all.
export function getTestimonials(directory: string = testimonialsDirectory): Testimonial[] {
    if (!fs.existsSync(directory)) return [];

    return fs
        .readdirSync(directory)
        .filter((file) => file.endsWith(".md"))
        .map((file) => {
            const { data, content } = parseFrontmatter(fs.readFileSync(path.join(directory, file), "utf8"));
            const order = Number(data["order"]);
            return {
                slug: file.replace(/\.md$/, ""),
                name: data["name"] ?? "",
                role: data["role"] ?? "",
                company: data["company"] ?? "",
                quote: content.trim(),
                order: Number.isFinite(order) ? order : 0,
            };
        })
        .filter((t) => t.name && t.quote)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
