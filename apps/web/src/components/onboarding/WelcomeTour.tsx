"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Tour steps — one per sidebar area plus the Help menu. Targets must match real hrefs
// in DashboardSidebar.tsx (scoped to the sidebar nav, since the logo also links to
// /dashboard) or the data-tour hook on WorkspaceHelpPanel.
// Copy is grounded in apps/web/src/lib/featureHelp.ts — see OPEN-83 follow-up.
const TOUR_STEPS = [
    {
        target: "h1",
        content: "Welcome to CraftMyFunnel! Here's a 60-second map of your workspace.",
        position: "bottom",
    },
    {
        target: "aside nav a[href='/dashboard']",
        content: "Home: start here to see what needs you today.",
        position: "right",
    },
    {
        target: "aside nav a[href='/inbox']",
        content: "Inbox: replies to answer and anything waiting for your approval. The badge counts both.",
        position: "right",
    },
    {
        target: "aside nav a[href='/leads']",
        content: "Leads, Campaigns and Pipeline: build your list, reach out, and track deals. Each opens with tabs for its related pages, like Accounts, Automations and Calendar.",
        position: "right",
    },
    {
        target: "aside nav a[href='/templates']",
        content: "Content and Reports: templates, landing pages and playbooks; then ROI, journey and buyer signals.",
        position: "right",
    },
    {
        target: "aside a[href='/settings']",
        content: "Settings: your workspace, mailboxes and integrations, trust controls, team and billing, and personal preferences.",
        position: "right",
    },
    {
        target: "[data-tour='help-panel']",
        content: "Help: explains the page you're on, links to the help center and Labs (beta and advanced tools), and switches the theme.",
        position: "bottom",
    },
];

export default function WelcomeTour() {
    const [stepIndex, setStepIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Show once per browser: gated by localStorage, cleared only by handleClose below.
    useEffect(() => {
        const hasSeenTour = localStorage.getItem("convo_tour_seen");
        if (!hasSeenTour) {
            // Delay slightly to let page load
            setTimeout(() => setVisible(true), 1000);
        }
    }, []);

    useEffect(() => {
        if (!visible) return;
        const step = TOUR_STEPS[stepIndex]!;
        const el = document.querySelector(step.target);
        if (el) {
            setTargetRect(el.getBoundingClientRect());
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
            // Skip if element not found (e.g. mobile menu hidden)
            handleNext();
        }
    }, [stepIndex, visible]);

    const handleNext = () => {
        if (stepIndex < TOUR_STEPS.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setVisible(false);
        localStorage.setItem("convo_tour_seen", "true");
    };

    if (!visible || !targetRect) return null;

    const step = TOUR_STEPS[stepIndex];

    // Simple positioning logic
    let top = targetRect.bottom + 10;
    let left = targetRect.left;

    // Adjust based on position preference (very basic)
    if (step && step.position === "right") {
        top = targetRect.top;
        left = targetRect.right + 10;
    }

    // Keep the tooltip on-screen for header targets sitting near the right edge.
    const tooltipWidth = 264; // w-64
    if (typeof window !== "undefined") {
        left = Math.min(left, window.innerWidth - tooltipWidth - 16);
    }

    return createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Highlight overlay - complex to do perfectly, so skipping mask for now */}

            {/* Tooltip */}
            <div
                className="absolute bg-white text-gray-900 p-4 rounded-xl shadow-2xl w-64 pointer-events-auto border-2 border-indigo-500 animate-in fade-in zoom-in duration-300"
                style={{ top: top + window.scrollY, left: left + window.scrollX }}
            >
                <div className="text-[11px] font-medium text-indigo-500 mb-1">
                    Step {stepIndex + 1} of {TOUR_STEPS.length}
                </div>
                <div className="text-sm font-medium mb-2">{step?.content}</div>
                <div className="flex justify-between items-center mt-3">
                    <button onClick={handleClose} className="text-xs text-gray-500 hover:text-gray-800">Skip</button>
                    <button onClick={handleNext} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
                        {stepIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                    </button>
                </div>
                {/* Arrow */}
                <div className="absolute w-3 h-3 bg-white border-t border-l border-indigo-500 transform -rotate-45 -top-1.5 left-4" />
            </div>
        </div>,
        document.body
    );
}
