import fs from "fs";
import path from "path";

const analyticsFile = path.join(process.cwd(), "content/settings/analytics.json");

// The Google Analytics 4 ID an editor set in the CMS, or undefined when there is none or it is not a
// well-formed ID (only letters and digits are accepted, so the value is safe to put in a script address).
export function getGa4MeasurementId(file: string = analyticsFile): string | undefined {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { ga4MeasurementId?: unknown };
        const id = typeof parsed.ga4MeasurementId === "string" ? parsed.ga4MeasurementId.trim().toUpperCase() : "";
        return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : undefined;
    } catch {
        return undefined;
    }
}
