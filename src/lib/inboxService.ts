import { prisma } from "@/lib/prisma";

export interface Thread {
    id: string; // This is the leadId
    leadId: string;
    leadName: string;
    leadDetails: {
        email: string | null;
        company: string | null;
        jobTitle: string | null;
    };
    lastMessage: string | null;
    lastMessageAt: Date | null;
    unreadCount: number;
}

export interface Message {
    id: string;
    threadId: string;
    sender: "me" | "them";
    content: string;
    createdAt: Date;
}

export class InboxService {

    // Fetch threads for a specific team (leads with messages)
    static async getThreads(teamId: string, filters: { status?: string, platform?: string, search?: string } = {}): Promise<Thread[]> {
        const where: any = {
            teamId: teamId,
            OR: [
                { status: "replied" },
                { status: "contacted" },
                { messages: { some: {} } }
            ]
        };

        if (filters.platform) {
            if (filters.platform === "LINKEDIN") where.linkedIn = { not: null };
            if (filters.platform === "EMAIL") where.linkedIn = null;
        }

        if (filters.status === "UNREAD") {
            where.messages = { some: { isRead: false, direction: 'INBOUND' } };
        }

        if (filters.search) {
            where.OR = [
                { fullName: { contains: filters.search, mode: 'insensitive' } },
                { company: { contains: filters.search, mode: 'insensitive' } }
            ];
        }

        const leads = await prisma.lead.findMany({
            where,
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                _count: {
                    select: {
                        messages: { where: { isRead: false, direction: 'INBOUND' } }
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Map to Thread interface
        return leads.map(lead => {
            const lastMsg = lead.messages[0];
            return {
                id: lead.id,
                leadId: lead.id,
                leadName: lead.fullName || "Unknown Lead",
                leadDetails: {
                    email: lead.email,
                    company: lead.company,
                    jobTitle: lead.jobTitle
                },
                lastMessage: lastMsg ? lastMsg.content : null,
                lastMessageAt: lastMsg ? lastMsg.createdAt : null,
                unreadCount: lead._count.messages
            };
        });
    }

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
    static async saveDraft(leadId: string, content: string, sender: string) {
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

    static async discardDraft(draftId: string) {
        return await prisma.message.delete({
            where: { id: draftId }
        });
    }

    static async sendMessage(leadId: string, content: string, sender: string) {
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
