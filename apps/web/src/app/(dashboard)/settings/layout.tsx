import { SettingsFrame } from "@/components/settings/SettingsFrame";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsFrame>{children}</SettingsFrame>;
}
