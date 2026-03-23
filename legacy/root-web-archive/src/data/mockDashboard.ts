export default function mock() {
    const stats = [
        { id: "s1", title: "New Leads", value: "1,248", change: 12, icon: "🔍" },
        { id: "s2", title: "Qualified", value: "382", change: 6, icon: "✅" },
        { id: "s3", title: "Meetings", value: "74", change: -2, icon: "📅" },
    ];

    const revenueSeries = Array.from({ length: 30 }).map((_, i) => ({
        day: `D${i + 1}`,
        value: Math.round(200 + Math.sin(i / 3) * 80 + Math.random() * 50),
    }));

    const campaigns = [
        { id: 1, name: "Manufacturing - Q1", audience: "Manufacturing C-suite", leads: 432, status: "Running" },
        { id: 2, name: "Healthcare - Outreach", audience: "Hospital Ops", leads: 120, status: "Paused" },
        { id: 3, name: "SaaS Trial Nudge", audience: "Product Managers", leads: 98, status: "Draft" },
    ];

    const activities = [
        { agent: "Agent-Alpha", action: "sent 42 messages", time: "5m ago" },
        { agent: "Agent-Beta", action: "replied to Jane Doe", time: "12m ago" },
        { agent: "Agent-Zeta", action: "opened campaign 'SaaS Trial Nudge'", time: "2h ago" },
    ];

    const profile = { name: "Siddharth", email: "sid@example.com" };

    return { stats, revenueSeries, campaigns, activities, profile };
}
