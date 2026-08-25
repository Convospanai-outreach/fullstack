"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Coins, Users, Cpu, BarChart3 } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

type UsageUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  enterpriseRole?: string | null;
  createdAt: string;
  credits: number;
  team?: { id: string; name: string; role?: string | null } | null;
  creditsNet: number;
  creditsSpent: number;
  tokensIn: number;
  tokensOut: number;
  tokenCost: number;
};

type UsageTeam = {
  id: string;
  name: string;
  credits: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  creditsSpent: number;
  creditsTopup: number;
  creditsBonus: number;
};

type UsageResponse = {
  range: string;
  totals: { tokensIn: number; tokensOut: number; cost: number; creditsSpent: number };
  users: UsageUser[];
  teams: UsageTeam[];
};

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${getBrowserApiBase()}/admin/usage?range=${range}`
      );
      if (!res.ok) throw new Error("Failed to load usage");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [range]);

  const summary = useMemo(() => {
    if (!data) return null;
    return [
      {
        label: "Total Credits Spent",
        value: data.totals.creditsSpent.toLocaleString(),
        icon: Coins
      },
      {
        label: "Total Tokens In",
        value: data.totals.tokensIn.toLocaleString(),
        icon: Cpu
      },
      {
        label: "Total Tokens Out",
        value: data.totals.tokensOut.toLocaleString(),
        icon: Cpu
      },
      {
        label: "LLM Cost",
        value: `$${data.totals.cost.toFixed(2)}`,
        icon: BarChart3
      }
    ];
  }, [data]);

  return (
    <div className="p-8 min-h-screen bg-black relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SectionHeader title="Usage Dashboard" subtitle="Credits, tokens, and spend by user" />
          <div className="flex items-center gap-2">
            {["7d", "30d", "90d"].map((opt) => (
              <Button
                key={opt}
                variant={range === opt ? "default" : "outline"}
                onClick={() => setRange(opt)}
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>

        {loading && <div className="text-white">Loading usage data...</div>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {summary?.map((card) => (
                <GlassCard key={card.label} className="p-5 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">{card.label}</div>
                    <div className="text-xl font-semibold text-white">{card.value}</div>
                  </div>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-emerald-300" />
                <h3 className="text-lg font-semibold text-white">Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Enterprise Role</th>
                      <th className="py-3 pr-4">Team</th>
                      <th className="py-3 pr-4 text-right">Credits</th>
                      <th className="py-3 pr-4 text-right">Credits Spent</th>
                      <th className="py-3 pr-4 text-right">Tokens In</th>
                      <th className="py-3 pr-4 text-right">Tokens Out</th>
                      <th className="py-3 text-right">Token Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.users.map((user) => (
                      <tr key={user.id} className="text-gray-200">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-white">
                            {user.name || "Unnamed"}
                          </div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </td>
                        <td className="py-3 pr-4">{user.role || "user"}</td>
                        <td className="py-3 pr-4">{user.enterpriseRole || "SALES_USER"}</td>
                        <td className="py-3 pr-4">
                          {user.team?.name || "No team"}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {user.credits.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right text-emerald-200">
                          {user.creditsSpent.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {user.tokensIn.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {user.tokensOut.toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          ${user.tokenCost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-5 h-5 text-cyan-300" />
                <h3 className="text-lg font-semibold text-white">Teams</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="py-3 pr-4">Team</th>
                      <th className="py-3 pr-4 text-right">Credits</th>
                      <th className="py-3 pr-4 text-right">Credits Spent</th>
                      <th className="py-3 pr-4 text-right">Tokens In</th>
                      <th className="py-3 pr-4 text-right">Tokens Out</th>
                      <th className="py-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.teams.map((team) => (
                      <tr key={team.id} className="text-gray-200">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-white">{team.name}</div>
                          <div className="text-xs text-gray-400">{team.id}</div>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {team.credits.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right text-emerald-200">
                          {team.creditsSpent.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {team.tokensIn.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {team.tokensOut.toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          ${team.cost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}
