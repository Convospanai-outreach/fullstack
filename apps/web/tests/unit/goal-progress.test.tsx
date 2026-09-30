import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import { GoalProgress } from "@/components/dashboard/GoalProgress";

const KEY = "/api/proxy/dashboard/meeting-goal";

function render(goal: unknown) {
    return renderToStaticMarkup(
        <SWRConfig value={{ fallback: { [KEY]: goal }, provider: () => new Map() }}>
            <GoalProgress />
        </SWRConfig>,
    );
}

describe("Home: monthly meeting goal", () => {
    it("asks for a goal when none is set", () => {
        const html = render({ goal: null, booked: 2, dayOfMonth: 10, daysInMonth: 30, pace: null });

        expect(html).toContain("Set a monthly meeting goal");
        expect(html).toContain("2 meetings booked this month");
        expect(html).not.toContain("progressbar");
    });

    it("shows booked / goal and says when the team is on pace", () => {
        const html = render({ goal: 20, booked: 12, dayOfMonth: 15, daysInMonth: 30, pace: { expected: 10, onPace: true, behindBy: 0 } });

        expect(html).toContain("12");
        expect(html).toContain("/ 20 meetings booked this month");
        expect(html).toContain("On pace");
        expect(html).toContain('style="width:60%"');
        expect(html).toContain("Edit goal");
    });

    it("says how many meetings behind pace the team is", () => {
        const html = render({ goal: 10, booked: 4, dayOfMonth: 16, daysInMonth: 30, pace: { expected: 5.33, onPace: false, behindBy: 2 } });

        expect(html).toContain("Behind by 2");
        expect(html).not.toContain("On pace");
    });

    it("caps the bar at 100% once the goal is beaten", () => {
        const html = render({ goal: 5, booked: 9, dayOfMonth: 20, daysInMonth: 30, pace: { expected: 3.33, onPace: true, behindBy: 0 } });

        expect(html).toContain('style="width:100%"');
    });

    it("renders nothing until the API answers", () => {
        expect(render(undefined)).toBe("");
    });
});
