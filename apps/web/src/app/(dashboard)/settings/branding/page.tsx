"use client";

import { useEffect, useRef, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { Palette, Globe, Upload } from 'lucide-react';

interface CustomDomainRecord {
    id: string;
    domain: string;
    status: "pending" | "active" | "invalid";
    ownershipVerificationName?: string | null;
    ownershipVerificationValue?: string | null;
}

// logoUrl is free text a team admin can set to anything, so before handing it
// to <img src> rebuild it through URL parsing and only keep the result if the
// scheme is http(s) — returns a freshly-constructed string, not the original
// tainted input, so it's never a raw pass-through of untrusted text.
function getSafeImageUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
        return trimmed;
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            return parsed.href;
        }
        return null;
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
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [domains, setDomains] = useState<CustomDomainRecord[]>([]);
    const [newDomain, setNewDomain] = useState("");
    const [connecting, setConnecting] = useState(false);

    const loadDomains = () => {
        fetch("/api/settings/branding/domains")
            .then((res) => res.json())
            .then((data) => setDomains(data?.domains || []))
            .catch(() => {});
    };

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
        loadDomains();
    }, []);

    const handleConnectDomain = async () => {
        const domain = newDomain.trim().toLowerCase();
        if (!domain) return;
        setConnecting(true);
        try {
            const res = await fetch("/api/settings/branding/domains", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success("Domain added — add the TXT record shown below to verify it");
                setNewDomain("");
                loadDomains();
            } else {
                toast.error(data?.error || "Failed to connect domain");
            }
        } catch (e) {
            toast.error("Error connecting domain");
        } finally {
            setConnecting(false);
        }
    };

    // Resolved separately (not inline at the <img> sink) so the preview only
    // ever renders a value this effect itself validated and produced.
    useEffect(() => {
        setPreviewSrc(logoUrl ? getSafeImageUrl(logoUrl) : null);
    }, [logoUrl]);

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
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Palette className="w-5 h-5 text-primary" aria-hidden="true" /> Appearance
                    </h3>

                    <div className="space-y-2">
                        <label htmlFor="portal-title" className="text-sm font-medium text-foreground">Portal Title</label>
                        <input
                            id="portal-title"
                            type="text"
                            className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-colors"
                            placeholder="My Agency Portal"
                            value={portalTitle}
                            onChange={e => setPortalTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="primary-color" className="text-sm font-medium text-foreground">Primary Color</label>
                        <div className="flex gap-4 items-center">
                            <input
                                id="primary-color"
                                type="color"
                                className="h-10 w-20 rounded border border-border bg-transparent cursor-pointer"
                                value={primaryColor}
                                onChange={e => setPrimaryColor(e.target.value)}
                            />
                            <span className="text-muted-foreground font-mono text-sm">{primaryColor}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="logo-url" className="text-sm font-medium text-foreground">Logo</label>
                        <div className="flex items-center gap-4">
                            {previewSrc ? (
                                <img
                                    src={previewSrc}
                                    alt="Logo preview"
                                    className="h-12 w-12 rounded-md bg-muted/50 border border-border object-contain p-1"
                                />
                            ) : (
                                <div className="h-12 w-12 rounded-md bg-muted/50 border border-border flex items-center justify-center text-muted-foreground">
                                    <Palette className="w-5 h-5" aria-hidden="true" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-md text-sm font-medium disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <Upload className="w-4 h-4" aria-hidden="true" />
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
                            id="logo-url"
                            type="text"
                            className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-colors"
                            placeholder="https://agency.com/logo.png"
                            value={logoUrl}
                            onChange={e => setLogoUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Upload a PNG, JPEG, WebP, or SVG (max 2MB), or paste a public URL directly.</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-sm w-full shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </GlassCard>

                <GlassCard className="p-6 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" aria-hidden="true" /> Custom Domain
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Connect a domain you already own to host your landing pages under your own brand
                            (e.g., go.yourdomain.com). Your domain stays with your current DNS provider — you
                            just add one verification record.
                        </p>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-muted/40 border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-colors"
                                placeholder="go.yourdomain.com"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                            />
                            <button
                                onClick={handleConnectDomain}
                                disabled={connecting || !newDomain.trim()}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
                            >
                                {connecting ? "Connecting..." : "Connect"}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {domains.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No domains connected yet.</p>
                        ) : (
                            domains.map((d) => (
                                <div key={d.id} className="p-4 bg-muted/40 border border-border rounded-xl space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground">{d.domain}</span>
                                        <span
                                            className={
                                                "text-xs font-bold px-2 py-1 rounded-full " +
                                                (d.status === "active"
                                                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                                    : d.status === "invalid"
                                                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400")
                                            }
                                        >
                                            {d.status === "active" ? "Active" : d.status === "invalid" ? "Verification failed" : "Pending verification"}
                                        </span>
                                    </div>
                                    {d.status === "pending" && d.ownershipVerificationName && (
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>Add this TXT record at your DNS provider to verify ownership:</p>
                                            <code className="block bg-background/60 border border-border rounded px-2 py-1 break-all">
                                                {d.ownershipVerificationName} → {d.ownershipVerificationValue}
                                            </code>
                                            <p>This can take a few minutes to propagate after you add it.</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

