import { SettingsFrame } from "@/components/settings/SettingsFrame";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return <SettingsFrame>{children}</SettingsFrame>;
}
