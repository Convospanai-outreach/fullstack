"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Tour steps — one per sidebar group (not per item, to keep this short) plus
// the two header discovery affordances. Targets must match real hrefs in
// DashboardSidebar.tsx or the data-tour hooks on ToolsMenu/WorkspaceHelpPanel.
// Copy is grounded in apps/web/src/lib/featureHelp.ts — see OPEN-83 follow-up.
const TOUR_STEPS = [
    {
        target: "h1",
        content: "Welcome to CraftMyFunnel! Here's a 60-second map of your workspace.",
        position: "bottom",
    },
    {
        target: "a[href='/dashboard']",
        content: "Your daily workflow lives up top: Dashboard, Leads, Pipeline, Campaigns, and Calendar — everything for actually running outreach.",
        position: "right",
    },
    {
        target: "a[href='/intel']",
        content: "Analyze: Intel is live buying-interest signals, Analytics is after-the-fact performance, Governance is your safety/compliance posture. Three different kinds of reporting — worth knowing apart.",
        position: "right",
    },
    {
        target: "a[href='/templates']",
        content: "Growth: reusable Templates, an ICP Builder to define your ideal customer, Landing Pages, and Automations for \"when X happens, do Y\" rules.",
        position: "right",
    },
    {
        target: "a[href='/admin']",
        content: "Operations: Admin controls, Monitoring for infrastructure health, and Audit Logs for a history of what happened.",
        position: "right",
    },
    {
        target: "a[href='/team']",
        content: "Account: Team, Billing, and Settings — everything about your workspace itself, not your outreach.",
        position: "right",
    },
    {
        target: "a[href='/approvals']",
        content: "Approvals & Inbox: anything that needs your sign-off before it goes out shows up here.",
        position: "right",
    },
    {
        target: "[data-tour='tools-menu']",
        content: "There's more: 17 additional tools (LinkedIn automation, AI agents, a knowledge base, and more) live behind this Tools menu — it shows you which ones are actually turned on.",
        position: "bottom",
    },
    {
        target: "[data-tour='help-panel']",
        content: "Forgot what a page does? Click this compass icon anytime — it explains exactly the page you're on, and flags anything it's easy to confuse it with.",
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
