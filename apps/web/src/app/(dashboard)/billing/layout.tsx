import { SettingsFrame } from "@/components/settings/SettingsFrame";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
    return <SettingsFrame>{children}</SettingsFrame>;
}
