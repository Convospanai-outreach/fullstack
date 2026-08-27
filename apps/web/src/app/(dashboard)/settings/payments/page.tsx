"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Plus, Trash2 } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_BASE = getBrowserApiBase();

interface PaymentAccountStatus {
    gateway: "STRIPE" | "RAZORPAY";
    status: string;
    connected: boolean;
    createdAt: string;
}

interface Product {
    id: string;
    name: string;
    description: string | null;
    priceAmount: number;
    currency: string;
    isActive: boolean;
}

export default function PaymentsSettingsPage() {
    const [accounts, setAccounts] = useState<PaymentAccountStatus[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [showRazorpayModal, setShowRazorpayModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [accountsRes, productsRes] = await Promise.all([
                fetch(`${API_BASE}/checkout/accounts`),
                fetch(`${API_BASE}/checkout/products`),
            ]);
            setAccounts(accountsRes.ok ? await accountsRes.json() : []);
            setProducts(productsRes.ok ? await productsRes.json() : []);
        } catch (err) {
            console.error(err);
            toast.error("Couldn't load payment settings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const params = new URLSearchParams(window.location.search);
        if (params.get("stripe") === "connected") toast.success("Stripe account connected");
        if (params.get("stripe") === "error") toast.error("Stripe connection failed — try again");
    }, []);

    const stripeAccount = accounts.find((a) => a.gateway === "STRIPE");
    const razorpayAccount = accounts.find((a) => a.gateway === "RAZORPAY");

    const connectStripe = async () => {
        setConnectingStripe(true);
        try {
            const res = await fetch(`${API_BASE}/checkout/accounts/stripe/connect`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.url) throw new Error(data?.error || "Failed to start Stripe connection");
            window.location.href = data.url;
        } catch (err: any) {
            toast.error(err?.message || "Failed to start Stripe connection");
            setConnectingStripe(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <SectionHeader
                title="Payments"
                subtitle="Connect a payment account and create products your funnels can sell. Money settles directly into your own connected account — CraftMyFunnel never holds it."
            />

            {loading ? (
                <GlassCard className="p-8 text-center text-sm text-muted-foreground">Loading...</GlassCard>
            ) : (
                <>
                    <GlassCard className="p-6 space-y-4">
                        <h3 className="text-lg font-bold text-foreground">Connected Accounts</h3>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-[#635bff] flex items-center justify-center text-white text-xs font-bold">S</div>
                                <div>
                                    <div className="font-medium text-foreground">Stripe</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        {stripeAccount?.connected ? (
                                            <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Connected</>
                                        ) : (
                                            <><XCircle className="w-3 h-3" /> Not connected</>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {!stripeAccount?.connected && (
                                <Button size="sm" onClick={connectStripe} disabled={connectingStripe}>
                                    {connectingStripe ? "Redirecting..." : "Connect Stripe"}
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-[#0f6fff] flex items-center justify-center text-white text-xs font-bold">R</div>
                                <div>
                                    <div className="font-medium text-foreground">Razorpay</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        {razorpayAccount?.connected ? (
                                            <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {razorpayAccount.status === "ACTIVE" ? "Connected" : "Pending activation with Razorpay"}</>
                                        ) : (
                                            <><XCircle className="w-3 h-3" /> Not connected</>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {!razorpayAccount?.connected && (
                                <Button size="sm" onClick={() => setShowRazorpayModal(true)}>Connect Razorpay</Button>
                            )}
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground">Products</h3>
                            <Button size="sm" onClick={() => setShowProductModal(true)}>
                                <Plus className="w-4 h-4 mr-1" /> New Product
                            </Button>
                        </div>

                        {products.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                                No products yet. Create one to link it into a funnel checkout.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {products.map((p) => (
                                    <ProductRow key={p.id} product={p} onChanged={load} />
                                ))}
                            </div>
                        )}
                    </GlassCard>
                </>
            )}

            <RazorpayConnectModal
                open={showRazorpayModal}
                onClose={() => setShowRazorpayModal(false)}
                onConnected={() => { setShowRazorpayModal(false); load(); }}
            />
            <ProductModal
                open={showProductModal}
                onClose={() => setShowProductModal(false)}
                onSaved={() => { setShowProductModal(false); load(); }}
            />
        </div>
    );
}

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE}/checkout/products/${product.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete product");
            toast.success("Product deleted");
            onChanged();
        } catch (err: any) {
            toast.error(err?.message || "Failed to delete product");
            setDeleting(false);
        }
    };

    return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
                <div className="font-medium text-foreground text-sm">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                    {(product.priceAmount / 100).toFixed(2)} {product.currency}
                    {!product.isActive && " — inactive"}
                </div>
            </div>
            <button
                onClick={handleDelete}
                disabled={deleting}
                aria-label={`Delete ${product.name}`}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}

function ProductModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const priceNumber = Number(price);
        if (!name.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0) {
            toast.error("Name and a positive price are required");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/checkout/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    priceAmount: Math.round(priceNumber * 100),
                    currency,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Failed to create product");
            }
            toast.success("Product created");
            setName(""); setDescription(""); setPrice("");
            onSaved();
        } catch (err: any) {
            toast.error(err?.message || "Failed to create product");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="New Product"
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="space-y-1">
                    <label htmlFor="product-name" className="text-sm text-text-secondary">Name</label>
                    <input id="product-name" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                    <label htmlFor="product-description" className="text-sm text-text-secondary">Description (optional)</label>
                    <textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                        className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label htmlFor="product-price" className="text-sm text-text-secondary">Price</label>
                        <input id="product-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                            className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="product-currency" className="text-sm text-text-secondary">Currency</label>
                        <select id="product-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
                            className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="USD">USD</option>
                            <option value="INR">INR</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                        </select>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function RazorpayConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [legalBusinessName, setLegalBusinessName] = useState("");
    const [businessType, setBusinessType] = useState("individual");
    const [category, setCategory] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim() || !phone.trim() || !legalBusinessName.trim()) {
            toast.error("Email, phone, and legal business name are required");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/checkout/accounts/razorpay/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    phone: phone.trim(),
                    type: "route",
                    legal_business_name: legalBusinessName.trim(),
                    business_type: businessType,
                    contact_name: legalBusinessName.trim(),
                    profile: {
                        category: category.trim() || "ecommerce",
                        subcategory: "online_gaming",
                    },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to connect Razorpay account");
            toast.success(
                data?.status === "ACTIVE"
                    ? "Razorpay account connected"
                    : "Razorpay account created — activation with Razorpay may take a little longer"
            );
            onConnected();
        } catch (err: any) {
            toast.error(err?.message || "Failed to connect Razorpay account");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Connect Razorpay"
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>{saving ? "Connecting..." : "Connect"}</Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-xs text-text-secondary">
                    This creates a Razorpay Route linked account under your business. Razorpay may require
                    additional document verification before it can receive live payments.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label htmlFor="rzp-email" className="text-sm text-text-secondary">Email</label>
                        <input id="rzp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="rzp-phone" className="text-sm text-text-secondary">Phone</label>
                        <input id="rzp-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label htmlFor="rzp-business-name" className="text-sm text-text-secondary">Legal Business Name</label>
                    <input id="rzp-business-name" value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)}
                        className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label htmlFor="rzp-business-type" className="text-sm text-text-secondary">Business Type</label>
                        <select id="rzp-business-type" value={businessType} onChange={(e) => setBusinessType(e.target.value)}
                            className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="individual">Individual</option>
                            <option value="proprietorship">Proprietorship</option>
                            <option value="partnership">Partnership</option>
                            <option value="private_limited">Private Limited</option>
                            <option value="llp">LLP</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="rzp-category" className="text-sm text-text-secondary">Category (optional)</label>
                        <input id="rzp-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ecommerce"
                            className="w-full bg-white/5 border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
