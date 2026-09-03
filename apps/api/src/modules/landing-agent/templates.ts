import type { WireframeOption } from "./types";

// Hand-designed page structures offered alongside the 3 AI-generated wireframe
// options in generateWireframes (see service.ts) - these give teams a proven
// starting layout instead of only ever seeing freshly generated copy/structure.
// Descriptions are prefixed "Template:" so the UI (WireframeOptionCard.tsx) can
// badge them distinctly from AI options without a schema change.

export const LANDING_PAGE_TEMPLATES: WireframeOption[] = [
    {
        title: "SaaS Product Launch",
        description: "Template: Feature-led flow for a self-serve software product.",
        framework: "AIDA",
        sections: [
            { id: "hero", type: "hero", heading: "Ship faster with a platform built for your team", body: "Everything you need to launch, measure, and iterate - without the usual setup tax.", ctaLabel: "Start Free Trial", imagePrompt: "Clean SaaS product dashboard on a laptop screen, soft studio lighting, modern office desk" },
            { id: "logos", type: "logos", heading: "Trusted by teams at growing companies" },
            { id: "challenge_solution", type: "challenge_solution", heading: "Stop stitching tools together", body: "Most teams lose hours a week to disconnected workflows. This brings it into one place." },
            { id: "benefits", type: "benefits", heading: "Why teams switch", bullets: ["Set up in minutes, not weeks", "Built-in analytics and reporting", "Scales from first user to full team"] },
            { id: "proof", type: "proof", heading: "Real results, not just promises", body: "Customers report faster onboarding and fewer dropped handoffs within the first month.", imagePrompt: "Abstract upward-trending analytics chart, clean vector style, blue and teal gradient" },
            { id: "testimonial", type: "testimonial", heading: "What customers say", body: "\"We replaced three tools with one and cut onboarding time in half.\"" },
            { id: "faq", type: "faq", heading: "Common questions", body: "Answers on pricing, setup time, and data migration." },
            { id: "final_cta", type: "final_cta", heading: "Ready to see it in action?", ctaLabel: "Book a Demo" },
            { id: "footer", type: "footer", heading: "Get started today", ctaLabel: "Start Free Trial" },
        ],
    },
    {
        title: "Lead Magnet / Ebook",
        description: "Template: Gated content download optimized for email capture.",
        framework: "PAS",
        sections: [
            { id: "hero", type: "hero", heading: "The playbook top performers don't share", body: "Download the free guide and get the exact framework used by leading teams.", ctaLabel: "Get the Free Guide", imagePrompt: "Flat-lay mockup of an ebook cover and printed pages on a wooden desk, warm natural light" },
            { id: "pain_points", type: "pain_points", heading: "Sound familiar?", bullets: ["Struggling to get consistent results", "Guessing instead of following a proven process", "No time to figure it out from scratch"] },
            { id: "benefits", type: "benefits", heading: "Inside this guide", bullets: ["Step-by-step framework", "Real examples and templates", "Common mistakes to avoid"] },
            { id: "proof", type: "proof", heading: "Downloaded by thousands of professionals", body: "Readers consistently report clearer priorities and faster execution.", imagePrompt: "Person reading a guide on a tablet at a bright cafe table, shallow depth of field" },
            { id: "cta_form", type: "cta_form", heading: "Get instant access", body: "Enter your email and we'll send the guide right away.", ctaLabel: "Send Me the Guide" },
            { id: "faq", type: "faq", heading: "Questions", body: "It's completely free, delivered instantly, and you can unsubscribe anytime." },
            { id: "footer", type: "footer", heading: "Don't miss out", ctaLabel: "Get the Free Guide" },
        ],
    },
    {
        title: "Webinar Registration",
        description: "Template: Event-driven page built around a scheduled date and RSVP.",
        framework: "AIDA",
        sections: [
            { id: "hero", type: "hero", heading: "Live Webinar: Turn strategy into execution", body: "Join our upcoming session and learn practical steps you can apply immediately.", ctaLabel: "Save My Seat", imagePrompt: "Presenter speaking to an engaged virtual audience shown on a laptop video call grid, warm office lighting" },
            { id: "challenge_solution", type: "challenge_solution", heading: "Why attend", body: "Most teams know what to do but struggle with how. This session closes that gap." },
            { id: "benefits", type: "benefits", heading: "What you'll learn", bullets: ["A repeatable framework you can apply next week", "Live Q&A with practitioners", "A follow-up resource kit for attendees"] },
            { id: "logos", type: "logos", heading: "Speakers from" },
            { id: "proof", type: "proof", heading: "Past attendees say it was worth their time", body: "Consistently rated highly for practical, actionable takeaways.", imagePrompt: "Simple calendar icon graphic with a highlighted date, minimal flat illustration style" },
            { id: "cta_form", type: "cta_form", heading: "Reserve your spot", body: "Seats are limited - register to receive the joining link.", ctaLabel: "Register Now" },
            { id: "faq", type: "faq", heading: "Details", body: "Can't make it live? Register anyway and we'll send the recording." },
            { id: "footer", type: "footer", heading: "See you there", ctaLabel: "Save My Seat" },
        ],
    },
    {
        title: "Service / Consultation",
        description: "Template: Trust-building layout for a booked-call service offer.",
        framework: "BEFORE_AFTER_BRIDGE",
        sections: [
            { id: "hero", type: "hero", heading: "Get expert help, without the guesswork", body: "Book a free consultation and get a clear plan tailored to your situation.", ctaLabel: "Book a Free Call", imagePrompt: "Professional consultant in a friendly conversation with a client across a desk, natural office light" },
            { id: "challenge_solution", type: "challenge_solution", heading: "Before / After", body: "Before: unclear next steps and wasted effort. After: a clear plan and a partner to execute it with." },
            { id: "benefits", type: "benefits", heading: "What's included", bullets: ["A free initial assessment", "A tailored action plan", "Ongoing support as you implement"] },
            { id: "proof", type: "proof", heading: "Proven track record", body: "Clients consistently report faster progress after working together.", imagePrompt: "Before and after style split image representing improvement, clean minimal design" },
            { id: "testimonial", type: "testimonial", heading: "Client feedback", body: "\"Within weeks we had a clear plan and were finally moving in the right direction.\"" },
            { id: "faq", type: "faq", heading: "Frequently asked", body: "Answers about pricing, timelines, and how the process works." },
            { id: "cta_form", type: "cta_form", heading: "Ready to get started?", body: "Book your free consultation - no obligation.", ctaLabel: "Book a Free Call" },
            { id: "footer", type: "footer", heading: "Let's talk", ctaLabel: "Book a Free Call" },
        ],
    },
];
