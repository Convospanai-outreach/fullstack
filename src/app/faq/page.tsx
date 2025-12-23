import SectionTitle from "../../components/SectionTitle";
import GlassCard from "../../components/GlassCard";

export default function FAQPage() {
    return (
        <div className="section pt-32 pb-20">
            <SectionTitle title="Common Questions, Personal Answers" />
            <div className="grid gap-6 max-w-2xl mx-auto mt-12">
                <GlassCard title="Do I need to be technical?">
                    <p className="text-gray-300">
                        You want power without the headache. <span className="font-semibold text-white">Yes</span>, ConvoSpan is built for founders who dream big, not code deep. If you can dream it, we’ll automate it.
                    </p>
                </GlassCard>

                <GlassCard title="Will automation make my outreach feel robotic?">
                    <p className="text-gray-300">
                        You want authentic conversations, not spam. That’s exactly why we built ConvoSpan — to make your automation feel personal, real, and human.
                    </p>
                </GlassCard>

                <GlassCard title="Is this just another extensive tool I have to learn?">
                    <p className="text-gray-300">
                        You’re busy building a business. You need solutions, not homework. We designed ConvoSpan to work <em>with</em> you from day one, using plain English and intuitive agents to do the heavy lifting.
                    </p>
                </GlassCard>
            </div>
        </div>
    );
}
