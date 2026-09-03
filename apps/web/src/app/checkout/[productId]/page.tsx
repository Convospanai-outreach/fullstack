"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_BASE = getBrowserApiBase();

interface PublicProduct {
    id: string;
    name: string;
    description: string | null;
    priceAmount: number;
    currency: string;
}

function loadRazorpayScript() {
    return new Promise<boolean>((resolve) => {
        if ((window as any).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function CheckoutPage() {
    const params = useParams<{ productId: string }>();
    const productId = params.productId;

    const [product, setProduct] = useState<PublicProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [gateway, setGateway] = useState<"STRIPE" | "RAZORPAY">("STRIPE");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/checkout/public-products/${productId}`)
            .then(async (res) => {
                if (!res.ok) {
                    setNotFound(true);
                    return;
                }
                setProduct(await res.json());
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [productId]);

    const handlePay = async () => {
        if (!email.trim()) {
            toast.error("Please enter your email");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/checkout/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    gateway,
                    customerEmail: email.trim(),
                    customerName: name.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to start checkout");

            if (gateway === "STRIPE") {
                if (!data.url) throw new Error("Missing checkout URL");
                window.location.href = data.url;
                return;
            }

            const loaded = await loadRazorpayScript();
            if (!loaded) throw new Error("Failed to load payment gateway");

            const rzp = new (window as any).Razorpay({
                key: data.key,
                amount: data.amount,
                currency: data.currency,
                order_id: data.razorpayOrderId,
                name: product?.name,
                prefill: { email, name },
                handler: () => {
                    toast.success("Payment successful!");
                },
                theme: { color: "#7c3aed" },
            });
            rzp.open();
            setSubmitting(false);
        } catch (err: any) {
            toast.error(err?.message || "Failed to start checkout");
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
                Loading...
            </div>
        );
    }

    if (notFound || !product) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-300">
                <div className="text-center space-y-2">
                    <h1 className="text-xl font-semibold">Product not found</h1>
                    <p className="text-sm text-neutral-500">This checkout link is no longer available.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">{product.name}</h1>
                    {product.description && (
                        <p className="text-neutral-400 text-sm mt-1">{product.description}</p>
                    )}
                    <div className="text-3xl font-bold mt-4">
                        {(product.priceAmount / 100).toFixed(2)} {product.currency}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label htmlFor="checkout-name" className="text-sm text-neutral-400">Name</label>
                        <input
                            id="checkout-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="checkout-email" className="text-sm text-neutral-400">Email</label>
                        <input
                            id="checkout-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setGateway("STRIPE")}
                            className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${gateway === "STRIPE" ? "bg-purple-600 border-purple-500" : "bg-neutral-800 border-neutral-700 text-neutral-400"}`}
                        >
                            Card (Stripe)
                        </button>
                        <button
                            type="button"
                            onClick={() => setGateway("RAZORPAY")}
                            className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${gateway === "RAZORPAY" ? "bg-purple-600 border-purple-500" : "bg-neutral-800 border-neutral-700 text-neutral-400"}`}
                        >
                            Razorpay
                        </button>
                    </div>
                </div>

                <button
                    onClick={handlePay}
                    disabled={submitting}
                    className="w-full py-3 rounded-md bg-purple-600 hover:bg-purple-500 font-semibold text-white transition-colors disabled:opacity-50"
                >
                    {submitting ? "Processing..." : `Pay ${(product.priceAmount / 100).toFixed(2)} ${product.currency}`}
                </button>
            </div>
        </div>
    );
}
