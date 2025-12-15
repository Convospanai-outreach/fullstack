"use client";

import { useState, useEffect } from "react";
// @ts-ignore
import { createPortal } from "react-dom";

// Simple Tour steps
const TOUR_STEPS = [
    { target: "h1", content: "Welcome to ConvoSpan! This is your command center.", position: "bottom" },
    { target: "a[href='/campaigns']", content: "Create and manage your email campaigns here.", position: "right" },
    { target: "a[href='/agents']", content: "Configure AI agents to handle specialized tasks.", position: "right" },
    { target: "a[href='/settings']", content: "Manage your API keys and team settings.", position: "right" },
];

export default function WelcomeTour() {
    const [stepIndex, setStepIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Initial check - hardcoded to always show for demo, or check localstorage
    useEffect(() => {
        const hasSeenTour = localStorage.getItem("convo_tour_seen");
        if (!hasSeenTour) {
            // Delay slightly to let page load
            setTimeout(() => setVisible(true), 1000);
        }
    }, []);

    useEffect(() => {
        if (!visible) return;
        const step = TOUR_STEPS[stepIndex];
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
    if (step.position === "right") {
        top = targetRect.top;
        left = targetRect.right + 10;
    }

    return createPortal(
        <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Highlight overlay - complex to do perfectly, so skipping mask for now */}

            {/* Tooltip */}
            <div
                className="absolute bg-white text-gray-900 p-4 rounded-xl shadow-2xl w-64 pointer-events-auto border-2 border-indigo-500 animate-in fade-in zoom-in duration-300"
                style={{ top: top + window.scrollY, left: left + window.scrollX }}
            >
                <div className="text-sm font-medium mb-2">{step.content}</div>
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
