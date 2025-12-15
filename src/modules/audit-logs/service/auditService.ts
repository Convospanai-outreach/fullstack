import { prisma } from "@/lib/db";

export enum AuditAction {
    USER_LOGIN = "USER_LOGIN",
    CAMPAIGN_CREATED = "CAMPAIGN_CREATED",
    MEMBER_INVITED = "MEMBER_INVITED",
    LEAD_SYNCED = "LEAD_SYNCED",
    USER_CREATED = "USER_CREATED",
    PROFILE_UPDATED = "PROFILE_UPDATED"
}

class AuditService {
    async logAction(userId: string, action: string, resource: string, details?: any) {
        // console.log(`[Audit] ${action} by ${userId}`, details); // Optional debug log

        try {
            await prisma.activityLog.create({
                data: {
                    action: action, // Store raw action key
                    meta: {
                        userId,
                        resource,
                        details,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        } catch (e) {
            console.error("Failed to persist audit log", e);
        }
    }

    async logLogin(userId: string, email: string) {
        await this.logAction(userId, AuditAction.USER_LOGIN, "Auth", { email });
    }

    async logPayment(userId: string, amount: number, orderId: string, description: string) {
        await this.logAction(userId, "PAYMENT_SUCCESS", "Billing", { amount, orderId, description });
    }

    async logTeamAction(userId: string, action: string, teamId: string, targetMemberId?: string) {
        await this.logAction(userId, action, `Team:${teamId}`, { targetMemberId });
    }

    async getLogs(limit = 100, offset = 0) {
        return await prisma.activityLog.findMany({
            orderBy: {
                createdAt: "desc"
            },
            take: limit,
            skip: offset
        });
    }
}

export const auditService = new AuditService();
