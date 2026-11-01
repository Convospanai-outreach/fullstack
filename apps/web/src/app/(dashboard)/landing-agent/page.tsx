import LandingPageList from "@/components/landing-agent/LandingPageList";
import LandingExperimentPanel from "@/components/landing-agent/LandingExperimentPanel";
import LandingFunnelReport from "@/components/landing-agent/LandingFunnelReport";

export default function LandingAgentListPage() {
    return (
        <>
            <LandingPageList />
            <LandingExperimentPanel />
            <LandingFunnelReport />
        </>
    );
}
