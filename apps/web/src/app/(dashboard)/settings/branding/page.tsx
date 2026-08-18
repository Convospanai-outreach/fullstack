"use client";

import { useEffect, useRef, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Palette, Globe, Upload } from 'lucide-react';

// logoUrl is free text a team admin can set to anything, so before handing it
// to <img src> rebuild it through URL parsing and only keep the result if the
// scheme is http(s) — returns a freshly-constructed string, not the original
// tainted input, so it's never a raw pass-through of untrusted text.
function getSafeImageUrl(url: string): string | null {
    const trimmed = url.trim();
    if (/^data:image\//i.test(trimmed)) return trimmed;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch {
        return null;
    }
}

export default function BrandingSettingsPage() {
    const [logoUrl, setLogoUrl] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#3B82F6");
    const [portalTitle, setPortalTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/settings/branding")
            .then((res) => res.json())
            .then((data) => {
                const branding = data?.branding;
                if (!branding) return;
                if (branding.logoUrl) setLogoUrl(branding.logoUrl);
                if (branding.primaryColor) setPrimaryColor(branding.primaryColor);
                if (branding.portalTitle) setPortalTitle(branding.portalTitle);
            })
            .catch(() => {});
    }, []);

    const handleLogoUpload = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/settings/branding/logo", {
                method: "POST",
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.url) {
                setLogoUrl(data.url);
                toast.success("Logo uploaded — click Save Changes to apply it");
            } else {
                toast.error(data?.error || "Failed to upload logo");
            }
        } catch (e) {
            toast.error("Error uploading logo");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings/branding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoUrl, primaryColor, portalTitle })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.gated) {
                toast.info(data.message || "Branding customization is not enabled for this workspace yet.");
            } else if (res.ok) {
                toast.success("Branding updated");
            } else {
                toast.error(data?.error || "Failed to update branding");
            }
        } catch (e) {
            toast.error("Error updating branding");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mr-auto">
            <SectionHeader title="Branding & Whitelabeling" subtitle="Customize the look and feel of your portal" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-6 space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Palette className="w-5 h-5 text-blue-400" /> Appearance
                    </h3>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Portal Title</label>
                        <input
                            type="text"
                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white"
                            placeholder="My Agency Portal"
                            value={portalTitle}
                            onChange={e => setPortalTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Primary Color</label>
                        <div className="flex gap-4 items-center">
                            <input
                                type="color"
                                className="h-10 w-20 rounded bg-transparent cursor-pointer"
                                value={primaryColor}
                                onChange={e => setPrimaryColor(e.target.value)}
                            />
                            <span className="text-gray-400 font-mono">{primaryColor}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Logo</label>
                        <div className="flex items-center gap-4">
                            {logoUrl && getSafeImageUrl(logoUrl) ? (
                                <img
                                    src={getSafeImageUrl(logoUrl)!}
                                    alt="Logo preview"
                                    className="h-12 w-12 rounded bg-white/5 object-contain"
                                />
                            ) : (
                                <div className="h-12 w-12 rounded bg-white/5 flex items-center justify-center text-gray-600">
                                    <Palette className="w-5 h-5" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                {uploading ? "Uploading..." : "Upload Logo"}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleLogoUpload(file);
                                    e.target.value = "";
                                }}
                            />
                        </div>
                        <input
                            type="text"
                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white"
                            placeholder="https://agency.com/logo.png"
                            value={logoUrl}
                            onChange={e => setLogoUrl(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">Upload a PNG, JPEG, WebP, or SVG (max 2MB), or paste a public URL directly.</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium w-full"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </GlassCard>

                <GlassCard className="p-6 space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-purple-400" /> Custom Domain
                    </h3>
                    <p className="text-sm text-gray-400">Connect your own domain (e.g., portable.agency.com).</p>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm">
                        This feature requires CNAME verification. Please contact support to enable custom domains for your account.
                    </div>

                    <button className="px-6 py-2 bg-white/10 text-gray-400 rounded-lg font-medium w-full cursor-not-allowed">
                        Manage Domains (Locked)
                    </button>
                </GlassCard>
            </div>
        </div>
    );
}
