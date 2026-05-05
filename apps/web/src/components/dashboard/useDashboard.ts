"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

export function useCampaigns() {
    const { data, error, mutate } = useSWR(getBrowserApiUrl("/dashboard/campaigns"), fetcher);
    return { data, error, mutate };
}

export function useActivities() {
    const { data, error, mutate } = useSWR(getBrowserApiUrl("/dashboard/activities"), fetcher);
    return { data, error, mutate };
}

export function useAgents() {
    const { data, error, mutate } = useSWR(getBrowserApiUrl("/orchestrator/agents"), fetcher);
    return { data, error, mutate };
}

export function useAnalytics() {
    const { data, error, mutate } = useSWR(getBrowserApiUrl("/dashboard/analytics"), fetcher);
    return { data, error, mutate };
}
