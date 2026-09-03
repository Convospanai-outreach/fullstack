"use client";
import { useState } from "react";

export default function ProfileEditor({ initial }: any) {
    const [profile, setProfile] = useState(initial);

    return (
        <div className="glass p-4 rounded-2xl">
            <h4 className="text-md font-semibold text-purple-600 mb-3">User Profile</h4>

            <label className="text-xs text-muted-foreground">Name</label>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full mt-1 mb-3 p-2 rounded bg-muted border border-border" />

            <label className="text-xs text-muted-foreground">Email</label>
            <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full mt-1 mb-3 p-2 rounded bg-muted border border-border" />

            <button className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white">Save</button>
        </div>
    );
}
