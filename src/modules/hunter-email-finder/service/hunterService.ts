import { hunterClient } from "./hunterClient";
import { prisma } from "@/lib/db";
import { cacheService } from "./cacheService";

type EmailFindRequest = {
    firstName: string;
    lastName: string;
    domain: string;
    leadId?: string;
};

class HunterService {
    /**
     * Find email and optionally update lead record
     */
    async findAndStoreEmail(request: EmailFindRequest) {
        const cacheKey = `hunter:email:${request.firstName}:${request.lastName}:${request.domain}`;

        // Check cache
        const cached = cacheService.get(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit for ${cacheKey}`);
            return cached;
        }

        const result = await hunterClient.findEmail(
            request.firstName,
            request.lastName,
            request.domain
        );

        // Cache result (24 hours)
        if (result.email) {
            cacheService.set(cacheKey, result, 86400);
        }

        // If leadId provided, update the lead
        if (request.leadId && result.email) {
            await prisma.lead.update({
                where: { id: request.leadId },
                data: { email: result.email },
            });
        }

        // Log activity
        await prisma.activity.create({
            data: {
                type: "email_found",
                meta: {
                    email: result.email,
                    score: result.score,
                    leadId: request.leadId,
                },
            },
        });

        return result;
    }

    /**
     * Verify email and update lead status
     */
    async verifyAndUpdateEmail(email: string, leadId?: string) {
        const result = await hunterClient.verifyEmail(email);

        // Update lead if provided
        if (leadId) {
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    status: result.status === "valid" ? "verified" : "invalid",
                },
            });
        }

        // Log activity
        await prisma.activity.create({
            data: {
                type: "email_verified",
                meta: {
                    email: result.email,
                    status: result.status,
                    score: result.score,
                    leadId,
                },
            },
        });

        return result;
    }

    /**
     * Bulk find emails for multiple leads
     */
    async bulkFindEmails(leads: Array<{ id: string; firstName: string; lastName: string; domain: string }>) {
        const results = [];

        for (const lead of leads) {
            try {
                const result = await this.findAndStoreEmail({
                    firstName: lead.firstName,
                    lastName: lead.lastName,
                    domain: lead.domain,
                    leadId: lead.id,
                });
                results.push({ leadId: lead.id, success: true, email: result.email });

                // Rate limiting: wait 1 second between requests
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error: any) {
                results.push({ leadId: lead.id, success: false, error: error.message });
            }
        }

        return results;
    }
}

export const hunterService = new HunterService();
