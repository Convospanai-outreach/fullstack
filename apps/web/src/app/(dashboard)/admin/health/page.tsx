"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";

type HealthState = {
  status: "ok" | "error" | "loading";
  message?: string;
};

export default function AdminHealthPage() {
  const [apiHealth, setApiHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/health");
        if (!res.ok) {
          setApiHealth({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = await res.json();
        setApiHealth({ status: "ok", message: data?.status || "OK" });
      } catch (error) {
        setApiHealth({ status: "error", message: "Health check failed" });
      }
    };
    fetchHealth();
  }, []);

  return (
    <main className="p-8 min-h-screen bg-black relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <SectionHeader title="System Health" subtitle="Live status of core services" />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white">API</h3>
            <p className="text-sm text-gray-400 mt-2">/health endpoint</p>
            <div className="mt-4 flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  apiHealth.status === "ok"
                    ? "bg-emerald-400"
                    : apiHealth.status === "error"
                    ? "bg-red-400"
                    : "bg-yellow-400"
                }`}
              />
              <span className="text-sm text-gray-200">
                {apiHealth.status === "loading"
                  ? "Checking..."
                  : apiHealth.message || apiHealth.status.toUpperCase()}
              </span>
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
