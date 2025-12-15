"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        image: "",
        address: ""
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/user/profile");
            const data = await res.json();
            setProfile(data);
            setFormData({
                name: data.name || "",
                image: data.image || "",
                address: data.address || ""
            });
        } catch (error) {
            console.error("Failed to fetch profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setEditing(false);
                fetchProfile();
            } else {
                alert("Failed to update profile");
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading profile...</div>;

    return (
        <main className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto">
                <SectionHeader title="My Profile" subtitle="Manage your account details" />

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Profile Card */}
                    <div className="md:col-span-2 glass p-8 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">Personal Info</h3>
                            <button
                                onClick={() => setEditing(!editing)}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                {editing ? "Cancel" : "Edit"}
                            </button>
                        </div>

                        {editing ? (
                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Avatar URL</label>
                                    <input
                                        type="text"
                                        value={formData.image}
                                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Address</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                        rows={3}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                                >
                                    Save Changes
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden relative">
                                        {profile.image ? (
                                            <Image
                                                src={profile.image}
                                                alt={profile.name}
                                                width={80}
                                                height={80}
                                                className="object-cover w-full h-full"
                                            />
                                        ) : (
                                            <span className="text-2xl font-bold text-white">{profile.name?.charAt(0) || "U"}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
                                        <p className="text-gray-400">{profile.email}</p>
                                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/10 text-xs text-gray-300 border border-white/10">
                                            {profile.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10">
                                    <h4 className="text-sm font-medium text-gray-400 mb-2">Address</h4>
                                    <p className="text-white">{profile.address || "No address set"}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats Card */}
                    <div className="glass p-6 rounded-xl border border-white/10 h-fit">
                        <h3 className="text-lg font-bold text-white mb-4">Usage Stats</h3>
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <div className="text-sm text-gray-400 mb-1">AI Credits</div>
                                <div className="text-2xl font-bold text-green-400">{profile.credits}</div>
                                <div className="text-xs text-gray-500 mt-1">Available for use</div>
                            </div>
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <div className="text-sm text-gray-400 mb-1">Member Since</div>
                                <div className="text-lg font-medium text-white">
                                    {new Date(profile.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
