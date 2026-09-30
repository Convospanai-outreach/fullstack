import { prisma } from "@/lib/prisma";

export interface Message {
    id: string;
    threadId: string;
    sender: "me" | "them";
    content: string;
    createdAt: Date;
}

export class InboxService {

    static async markAsRead(leadId: string) {
        return await prisma.message.updateMany({
            where: {
                leadId,
                isRead: false,
                direction: 'INBOUND'
            },
            data: { isRead: true }
        });
    }

    static async getMessages(leadId: string): Promise<Message[]> {
        const messages = await prisma.message.findMany({
            where: { leadId },
            orderBy: { createdAt: 'asc' }
        });

        return messages.map(msg => ({
            id: msg.id,
            threadId: leadId,
            sender: msg.direction === 'OUTBOUND' ? 'me' : 'them',
            content: msg.content,
            createdAt: msg.createdAt
        }));
    }

    // Save a draft message (upsert if draft already exists? simpler to just create new for now, or update last draft)
    static async saveDraft(leadId: string, content: string, sender: string, teamId: string) {
        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { id: true } });
        if (!lead) throw new Error("LEAD_NOT_FOUND");

        // Check if there is an existing draft for this lead?
        // For simplicity, we'll assume one draft per lead for now
        const existingDraft = await prisma.message.findFirst({
            where: {
                leadId,
                status: 'draft'
            }
        });

        if (existingDraft) {
            return await prisma.message.update({
                where: { id: existingDraft.id },
                data: {
                    content
                }
            });
        } else {
            return await prisma.message.create({
                data: {
                    leadId,
                    content,
                    direction: 'OUTBOUND',
                    platform: 'EMAIL', // default
                    sender,
                    status: 'draft',
                    isRead: true
                }
            });
        }
    }

    static async discardDraft(draftId: string, teamId: string) {
        const draft = await prisma.message.findFirst({
            where: { id: draftId, status: 'draft', lead: { teamId } },
            select: { id: true }
        });
        if (!draft) throw new Error("DRAFT_NOT_FOUND");

        return await prisma.message.delete({
            where: { id: draftId }
        });
    }

    static async sendMessage(leadId: string, content: string, sender: string, teamId: string) {
        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { id: true } });
        if (!lead) throw new Error("LEAD_NOT_FOUND");

        // 1. Create the message record
        const message = await prisma.message.create({
            data: {
                leadId,
                content,
                direction: 'OUTBOUND',
                platform: 'EMAIL',
                sender,
                status: 'sent',
                isRead: true
            }
        });

        // 2. Here we would trigger the actual email/linkedin sending logic
        // e.g., await EmailService.send(...)

        return message;
    }
}
