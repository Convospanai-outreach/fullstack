"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

interface FAQItem {
    question: string;
    answer: string;
}

const FAQS: FAQItem[] = [
    {
        question: "How do I connect my LinkedIn account?",
        answer: "Go to Settings > API Configuration and enter your LinkedIn 'li_at' cookie. This allows our system to automate actions on your behalf."
    },
    {
        question: "What is the daily limit for connection requests?",
        answer: "To keep your account safe, we recommend a maximum of 20-30 connection requests per day. Our Safe-Mode Throttling System automatically enforces these limits."
    },
    {
        question: "Can I export my leads?",
        answer: "Yes! Go to the Dashboard and click the 'Export CSV' button in the Leads table to download your data."
    },
    {
        question: "How does the AI Agent work?",
        answer: "Our AI Agent uses Google Gemini to analyze prospect profiles and generate personalized connection messages and comments, increasing your acceptance rates."
    },
    {
        question: "Is my data secure?",
        answer: "Absolutely. We use industry-standard encryption and never share your data with third parties. Your API keys are stored securely."
    }
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-6">Frequently Asked Questions</h3>
            <div className="space-y-4">
                {FAQS.map((faq, index) => (
                    <div key={index} className="border-b border-white/10 last:border-0 pb-4 last:pb-0">
                        <button
                            className="w-full flex justify-between items-center text-left focus:outline-none"
                            onClick={() => toggle(index)}
                        >
                            <span className="text-white font-medium">{faq.question}</span>
                            <span className="text-blue-400 text-xl">
                                {openIndex === index ? "−" : "+"}
                            </span>
                        </button>
                        {openIndex === index && (
                            <div className="mt-2 text-gray-400 text-sm leading-relaxed animate-in fade-in slide-in-from-top-1">
                                {faq.answer}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
