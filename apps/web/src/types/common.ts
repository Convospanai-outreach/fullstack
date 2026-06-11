// Common types used across the application

export interface Campaign {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    teamId: string;
    completedCount: number;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
        leads?: number;
    };
}

export interface Lead {
    id: string;
    email: string;
    fullName?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    linkedIn?: string | null;
    status: string;
    channelStatuses?: Array<{ channel: string; status: string; lastActivityAt?: Date | string | null }>;
    isEnriched: boolean;
    teamId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Thread {
    id: string;
    leadId: string;
    leadName: string;
    leadDetails?: {
        company?: string;
        jobTitle?: string;
    };
    platform: 'EMAIL' | 'LINKEDIN';
    status: string;
    unreadCount: number;
    lastMessage: string;
    lastMessageAt: Date;
}

export interface Message {
    id: string | number;
    content: string;
    sender: 'me' | 'them';
    createdAt: string;
}

export interface DashboardStats {
    activeCampaigns: number;
    totalLeads: number;
    creditsUsed: number;
    roi: number;
}

export interface SubscriptionData {
    active: boolean;
    plan: string;
    currentPeriodEnd: Date | null;
    credits: number;
    email?: string;
}

export interface ApiResponse<T> {
    ok: boolean;
    data?: T;
    error?: string;
    message?: string;
}
