"use client";

import { useState } from "react";

export default function PricingPage() {
    const [loading, setLoading] = useState(false);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
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
    };

    const handleSubscribe = async (planId: string) => {
        setLoading(true);
        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                alert("Failed to load payment gateway");
                return;
            }

            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to start checkout");

            const options = {
                key: json.key,
                amount: json.amount,
                currency: json.currency,
                name: "CraftMyFunnel AI",
                description: `${planId} Plan Subscription`,
                order_id: json.orderId,
                handler: function (_response: any) {
                    alert("Payment successful!");
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (e) {
            alert("Error starting checkout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 40, maxWidth: 1000, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
                <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Simple, Transparent Pricing</h1>
                <p style={{ color: "#6b7280", fontSize: 18 }}>Choose the plan that fits your growth needs.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 30 }}>
                {/* Starter Plan */}
                <div style={{ background: "#fff", padding: 32, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Starter</h3>
                    <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 24 }}>$29<span style={{ fontSize: 16, fontWeight: 400, color: "#6b7280" }}>/mo</span></div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ 1,000 Leads / mo</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Basic Email Sequences</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Email Support</li>
                    </ul>
                    <button
                        onClick={() => handleSubscribe("starter")}
                        disabled={loading}
                        style={{ width: "100%", padding: "12px", background: "#f3f4f6", color: "#111827", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                    >
                        Get Started
                    </button>
                </div>

                {/* Pro Plan */}
                <div style={{ background: "#111827", padding: 32, borderRadius: 16, border: "1px solid #1f2937", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", color: "#fff", position: "relative" }}>
                    <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#3b82f6", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>MOST POPULAR</div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Pro</h3>
                    <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 24 }}>$79<span style={{ fontSize: 16, fontWeight: 400, color: "#9ca3af" }}>/mo</span></div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ 5,000 Leads / mo</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Advanced A/B Testing</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Priority Support</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ CRM Integrations</li>
                    </ul>
                    <button
                        onClick={() => handleSubscribe("pro")}
                        disabled={loading}
                        style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                    >
                        Upgrade to Pro
                    </button>
                </div>

                {/* Enterprise Plan */}
                <div style={{ background: "#fff", padding: 32, borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Enterprise</h3>
                    <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 24 }}>Custom</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Unlimited Leads</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Dedicated Account Manager</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 8 }}>✅ Custom Integrations</li>
                    </ul>
                    <button
                        onClick={() => alert("Contact sales")}
                        style={{ width: "100%", padding: "12px", background: "#f3f4f6", color: "#111827", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                    >
                        Contact Sales
                    </button>
                </div>
            </div>
        </div>
    );
}
