import { SettingsFrame } from "@/components/settings/SettingsFrame";

export default function GovernanceSectionLayout({ children }: { children: React.ReactNode }) {
    return <SettingsFrame>{children}</SettingsFrame>;
}
