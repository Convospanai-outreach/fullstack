// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import InstagramSourceLine from "./InstagramSourceLine";

describe("InstagramSourceLine", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("shows the keyword and the post the lead came from", () => {
        act(() => root.render(<InstagramSourceLine source={{ triggerId: "t1", keyword: "GUIDE", contentPostId: "p1", postTitle: "Free guide: five ways", platform: "INSTAGRAM" }} />));

        expect(container.textContent).toBe("From Instagram: keyword GUIDE on post Free guide: five ways");
    });

    it("shows only the keyword when the post is gone or the trigger covers any post", () => {
        act(() => root.render(<InstagramSourceLine source={{ triggerId: "t1", keyword: "GUIDE", contentPostId: null, postTitle: null, platform: "INSTAGRAM" }} />));

        expect(container.textContent).toBe("From Instagram: keyword GUIDE");
    });

    it("renders nothing when the lead has no Instagram source", () => {
        act(() => root.render(<InstagramSourceLine source={null} />));

        expect(container.textContent).toBe("");
    });
});
