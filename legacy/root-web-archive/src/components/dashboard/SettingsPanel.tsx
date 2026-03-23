"use client";
import { useState } from "react";
import ProfileEditor from "./ProfileEditor";
import TeamSettings from "./settings/TeamSettings";
import BillingSettings from "./settings/BillingSettings";
import NotificationSettings from "./settings/NotificationSettings";

export default function SettingsPanel() {
    const [activeTab, setActiveTab] = useState("profile");

    return (
        <div className="glass p-4 rounded-2xl">
            <h4 className="text-md font-semibold text-purple-300 mb-3">Workspace Settings</h4>
            <div className="flex gap-2 mb-4 border-b border-white/10 pb-2 overflow-x-auto">
                <TabButton id="profile" label="Profile" active={activeTab} onClick={setActiveTab} />
                <TabButton id="team" label="Team" active={activeTab} onClick={setActiveTab} />
                <TabButton id="billing" label="Billing" active={activeTab} onClick={setActiveTab} />
                <TabButton id="notifications" label="Notifications" active={activeTab} onClick={setActiveTab} />
            </div>

            {activeTab === "profile" && <ProfileEditorWrapper />}
            {activeTab === "team" && <TeamSettings />}
            {activeTab === "billing" && <BillingSettings />}
            {activeTab === "notifications" && <NotificationSettings />}
        </div>
    );
}

function TabButton({ id, label, active, onClick }: { id: string; label: string; active: string; onClick: (id: string) => void }) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${active === id ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
        >
            {label}
        </button>
    );
}

function ProfileEditorWrapper() {
    return (
        <>
            <div className="flex flex-col gap-3 text-sm text-gray-300 mb-6">
                {/* Replaced by official Notifications tab, disabling these placeholders to avoid confusion */}
                <div className="p-4 bg-white/5 rounded border border-white/5 text-xs text-gray-500">
                    Legacy settings moved to their respective tabs.
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
                <ProfileEditor />
            </div>
        </>
    )
}
