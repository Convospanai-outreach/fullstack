"use client";
import { useState } from "react";

export default function ProfileEditor({ initial }: any) {
    const [profile, setProfile] = useState(initial);

    return (
        <div className="glass p-4 rounded-2xl">
            <h4 className="text-md font-semibold text-purple-300 mb-3">User Profile</h4>

            <label className="text-xs text-gray-400">Name</label>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full mt-1 mb-3 p-2 rounded bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]" />

            <label className="text-xs text-gray-400">Email</label>
            <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full mt-1 mb-3 p-2 rounded bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]" />

            <button className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500">Save</button>
        </div>
    );
}
