import { prisma } from "@/lib/db";

// Sequence and draft sends all go out through a connected mailbox (Gmail, Microsoft, Resend or SMTP),
// so a team with none has nothing that can send. Starting a campaign then only fills the queue with
// work that can never be delivered.
export const NO_SENDING_CHANNEL_BODY = {
    error: "Connect a sending mailbox before starting a campaign.",
    code: "NO_SENDING_CHANNEL",
    connectUrl: "/settings/mailboxes",
} as const;

export async function hasSendingChannel(teamId: string): Promise<boolean> {
    return (await prisma.connectedMailbox.count({ where: { teamId, status: "CONNECTED" } })) > 0;
}
