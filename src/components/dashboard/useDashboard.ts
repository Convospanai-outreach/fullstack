"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export function useCampaigns() {
    const { data, error, mutate } = useSWR(process.env.NEXT_PUBLIC_API_URL + "/dashboard/campaigns", fetcher);
    return { data, error, mutate };
}

export function useActivities() {
    const { data, error, mutate } = useSWR(process.env.NEXT_PUBLIC_API_URL + "/dashboard/activities", fetcher);
    return { data, error, mutate };
}

export function useAgents() {
    const { data, error, mutate } = useSWR(process.env.NEXT_PUBLIC_API_URL + "/orchestrator/agents", fetcher);
    return { data, error, mutate };
}

export function useAnalytics() {
    const { data, error, mutate } = useSWR(process.env.NEXT_PUBLIC_API_URL + "/dashboard/analytics", fetcher);
    return { data, error, mutate };
}
