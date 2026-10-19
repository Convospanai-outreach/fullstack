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
    {
        title: "Online Course / Cohort",
        description: "Template: Enrollment page for a course, cohort or paid community.",
        framework: "AIDA",
        sections: [
            { id: "hero", type: "hero", heading: "Learn the skill that moves your career forward", body: "A practical, step-by-step program with live sessions, real projects and a community to keep you going.", ctaLabel: "Join the Next Cohort", imagePrompt: "Learner taking notes beside a laptop showing an online lesson, bright home workspace, natural light" },
            { id: "pain_points", type: "pain_points", heading: "Tired of tutorials that go nowhere?", bullets: ["Hours of videos but no real progress", "No one to ask when you get stuck", "Nothing to show employers or clients at the end"] },
            { id: "benefits", type: "benefits", heading: "What you'll walk away with", bullets: ["A finished project for your portfolio", "Weekly live sessions and feedback", "Lifetime access to lessons and updates"] },
            { id: "curriculum", type: "curriculum", heading: "How the program runs", bullets: ["Week 1-2: Foundations", "Week 3-4: Build your first project", "Week 5-6: Polish, present and get feedback"] },
            { id: "testimonial", type: "testimonial", heading: "From past students", body: "\"The live sessions kept me accountable - I finished a project I'm proud to show.\"" },
            { id: "faq", type: "faq", heading: "Before you enroll", body: "Answers on schedule, time commitment, refunds and what happens if you miss a session." },
            { id: "cta_form", type: "cta_form", heading: "Save your seat", body: "Seats are limited per cohort so everyone gets feedback.", ctaLabel: "Join the Next Cohort" },
            { id: "footer", type: "footer", heading: "Start learning with us", ctaLabel: "Join the Next Cohort" },
        ],
    },
    {
        title: "Agency / Done-for-You Services",
        description: "Template: Outcome-focused page for an agency or freelancer selling a done-for-you service.",
        framework: "PAS",
        sections: [
            { id: "hero", type: "hero", heading: "We grow your pipeline while you run your business", body: "A done-for-you service with clear deliverables, monthly reporting and no long lock-in.", ctaLabel: "Get a Free Audit", imagePrompt: "Small agency team reviewing a growth dashboard on a large screen in a modern studio, candid and focused" },
            { id: "pain_points", type: "pain_points", heading: "Growth shouldn't depend on your spare time", bullets: ["Marketing gets pushed to evenings and weekends", "Freelancers come and go without results", "No clear view of what is actually working"] },
            { id: "process", type: "process", heading: "How we work", bullets: ["Free audit of where you are today", "A 90-day plan with clear targets", "We execute, measure and report every month"] },
            { id: "proof", type: "proof", heading: "Results we're accountable for", body: "Every engagement starts with agreed targets, and you see progress against them in a monthly report.", imagePrompt: "Clean monthly performance report with upward trend charts on a tablet, minimal flat style" },
            { id: "logos", type: "logos", heading: "Teams we've worked with" },
            { id: "testimonial", type: "testimonial", heading: "Client feedback", body: "\"They took the whole thing off our plate and the numbers moved within the first quarter.\"" },
            { id: "faq", type: "faq", heading: "Common questions", body: "Answers on pricing, contract length, onboarding time and who you'll work with." },
            { id: "cta_form", type: "cta_form", heading: "Get your free audit", body: "Tell us about your business and we'll send back a short, honest assessment.", ctaLabel: "Get a Free Audit" },
            { id: "footer", type: "footer", heading: "Let's grow together", ctaLabel: "Get a Free Audit" },
        ],
    },
    {
        title: "Local Business",
        description: "Template: Booking page for a local shop, clinic, studio or home service.",
        framework: "AIDA",
        sections: [
            { id: "hero", type: "hero", heading: "Friendly, reliable service right in your neighbourhood", body: "Book in a minute and we'll confirm a time that suits you - no phone tag.", ctaLabel: "Book an Appointment", imagePrompt: "Welcoming storefront of a small local business on a sunny street, warm and inviting, no visible brand names" },
            { id: "services", type: "services", heading: "What we offer", bullets: ["Same-week appointments", "Clear prices before we start", "Friendly, trained staff"] },
            { id: "benefits", type: "benefits", heading: "Why locals choose us", bullets: ["Years of serving the community", "Flexible hours, including weekends", "Easy rescheduling if plans change"] },
            { id: "testimonial", type: "testimonial", heading: "What neighbours say", body: "\"Booked online in a minute, they were on time and explained everything clearly.\"" },
            { id: "proof", type: "proof", heading: "Easy to find, easy to reach", body: "Conveniently located with parking nearby. Add your address and opening hours here.", imagePrompt: "Simple stylised city map with a single location pin, flat illustration, soft colors" },
            { id: "faq", type: "faq", heading: "Good to know", body: "Answers on pricing, payment methods, cancellations and what to bring." },
            { id: "cta_form", type: "cta_form", heading: "Book your visit", body: "Leave your details and we'll confirm your time.", ctaLabel: "Book an Appointment" },
            { id: "footer", type: "footer", heading: "See you soon", ctaLabel: "Book an Appointment" },
        ],
    },
    {
        title: "Product Waitlist / Pre-launch",
        description: "Template: Early-access signup for a product that isn't launched yet.",
        framework: "AIDA",
        sections: [
            { id: "hero", type: "hero", heading: "Something better is coming - get early access", body: "Join the waitlist to be first in line, help shape the product and lock in launch pricing.", ctaLabel: "Join the Waitlist", imagePrompt: "Sleek product silhouette under a soft spotlight on a dark gradient background, teaser style, no text" },
            { id: "challenge_solution", type: "challenge_solution", heading: "Why we're building this", body: "The tools available today make a simple job hard. We're building the straightforward version we always wanted." },
            { id: "benefits", type: "benefits", heading: "Early access members get", bullets: ["First access before public launch", "Founding-member pricing", "A direct line to the team building it"] },
            { id: "proof", type: "proof", heading: "Join others already on the list", body: "People from teams of every size have signed up for early access.", imagePrompt: "Abstract grid of friendly avatar silhouettes forming a growing crowd, minimal flat illustration" },
            { id: "faq", type: "faq", heading: "Questions", body: "Answers on launch timing, pricing and how early access works." },
            { id: "cta_form", type: "cta_form", heading: "Get on the list", body: "We'll email you once when your access is ready - no spam.", ctaLabel: "Join the Waitlist" },
            { id: "footer", type: "footer", heading: "Be first in line", ctaLabel: "Join the Waitlist" },
        ],
    },
];
