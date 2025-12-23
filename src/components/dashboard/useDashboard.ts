"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export function useCampaigns() {
    const { data, error, mutate } = useSWR("/api/dashboard/campaigns", fetcher);
    return { data, error, mutate };
}

export function useActivities() {
    const { data, error, mutate } = useSWR("/api/dashboard/activities", fetcher);
    return { data, error, mutate };
}

export function useAgents() {
    const { data, error, mutate } = useSWR("/api/orchestrator/agents", fetcher);
    return { data, error, mutate };
}

export function useAnalytics() {
    const { data, error, mutate } = useSWR("/api/dashboard/analytics", fetcher);
    return { data, error, mutate };
}
