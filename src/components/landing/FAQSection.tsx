import SectionTitle from '../SectionTitle';
import { Plus } from 'lucide-react';

export default function FAQSection() {
    return (
        <section className="py-24 bg-gradient-to-b from-transparent to-black/20">
            <SectionTitle title="Frequently Asked Questions" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="space-y-4">
                    <FAQItem
                        question="How does ConvoSpan ensure my emails don't go to spam?"
                        answer="We use advanced warm-up algorithms, Spintax content rotation, and domain health monitoring to maintain high deliverability rates."
                    />
                    <FAQItem
                        question="Is LinkedIn automation safe?"
                        answer="Yes. Our AI mimics human behavior with randomized delays and daily limits, keeping your account secure and compliant."
                    />
                    <FAQItem
                        question="Can I integrate with my CRM?"
                        answer="Absolutely. One-click integrations are available for HubSpot, Salesforce, Pipedrive, and Slack."
                    />
                    <FAQItem
                        question="What is an AI Agent?"
                        answer="AI Agents are autonomous workers that can perform tasks like researching leads, drafting personalized emails, and scheduling meetings."
                    />
                    <FAQItem
                        question="Do you provide lead data?"
                        answer="Yes, our proprietary B2B database gives you access to over 200M verified contacts with direct dials and emails."
                    />
                    <FAQItem
                        question="How does the credit system work?"
                        answer="Credits are used for premium actions like enriching data or running complex AI workflows. Unused credits roll over."
                    />
                    <FAQItem
                        question="Can I bring my own email domains?"
                        answer="Yes, you can connect unlimited email accounts and we will handle the rotation and warming."
                    />
                    <FAQItem
                        question="Is there a free trial?"
                        answer="We offer a 14-day full-access free trial. No credit card required to start."
                    />
                    <FAQItem
                        question="How tailored is the AI writing?"
                        answer="Our AI analyzes the prospect's LinkedIn profile, company news, and website to write highly personalized 1-on-1 messages."
                    />
                    <FAQItem
                        question="Can I collaborate with my team?"
                        answer="Yes, our Enterprise plan supports unlimited team seats with shared workspaces and unified reporting."
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
