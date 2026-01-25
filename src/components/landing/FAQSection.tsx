import SectionTitle from '../SectionTitle';
import { Plus } from 'lucide-react';

export default function FAQSection() {
    return (
        <section className="py-24 bg-gradient-to-b from-transparent to-black/20">
            <SectionTitle title="Frequently Asked Questions" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="space-y-4">
                    <FAQItem
                        question="How does the 'Sovereign Firewall' protect my data?"
                        answer="Your PII never leaves your physical premises. Our local Micro-LLM (Phi-3) sanitizes all data locally before any cloud AI process begins, ensuring total privacy."
                    />
                    <FAQItem
                        question="Why do you use Phi-3 Locally?"
                        answer="Phi-3 is a state-of-the-art small language model that runs efficiently on your Edge Node. It provides 'human-level' policy enforcement without sending your sensitive strategy to big tech clouds."
                    />
                    <FAQItem
                        question="Do I need special hardware?"
                        answer="Yes. ConvoSpan Edge requires a supported node (Raspberry Pi 4/5 or NVIDIA Jetson) to run the local Cortex Engine."
                    />
                    <FAQItem
                        question="Is this compliant with India's DPDP Act?"
                        answer="Absolutely. Our Region-Aware RAG system automatically adapts aggressive sales language to Indian business norms (e.g., 'do the needful'), preventing cultural friction while maintaining compliance."
                    />
                    <FAQItem
                        question="What happens if my internet connection fails?"
                        answer="Our Offline Mode queues your work locally. The Edge Node continues to process and verify drafts, syncing them when you're back online."
                    />
                    <FAQItem
                        question="Can I customize the compliance rules?"
                        answer="Yes. You can configure sensitive entity types and confidence thresholds directly from the dashboard."
                    />
                    <FAQItem
                        question="Is ConvoSpan SafeRun™ safe?"
                        answer="Yes, with ConvoSpan SafeRun™. We use a local extension that mimics human behavior and requires your approval, ensuring you never risk your account with unauthorized cloud scripts."
                    />
                    <FAQItem
                        question="Can I integrate with my CRM?"
                        answer="Absolutely. One-click integrations are available for HubSpot, Salesforce, Pipedrive, and Slack."
                    />
                    <FAQItem
                        question="How tailored is the AI writing?"
                        answer="Our AI uses your local 'Golden Records' to ensure every message sounds exactly like you and adheres to your specific company policies."
                    />
                </div>
            </div>
        </section>
    );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    // Simple state interaction could be added here, 
    // relying on <details/summary> for native accordion behavior for simplicity & SEO
    return (
        <details className="group bg-white/5 border border-white/10 rounded-lg overflow-hidden transition-all duration-300 open:bg-white/10">
            <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                <h3 className="text-lg font-medium text-white">{question}</h3>
                <span className="text-blue-400 transition-transform duration-300 group-open:rotate-45">
                    <Plus className="w-5 h-5" />
                </span>
            </summary>
            <div className="px-6 pb-6 text-gray-400 leading-relaxed animate-in slide-in-from-top-2 opacity-100">
                {answer}
            </div>
        </details>
    );
}
