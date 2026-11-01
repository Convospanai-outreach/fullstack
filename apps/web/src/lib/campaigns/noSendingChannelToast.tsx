import { toast } from "sonner";

// The start routes answer 409 NO_SENDING_CHANNEL when the team has no connected mailbox.
// Returns true when it handled the response, so the caller stops there.
export function handleNoSendingChannel(data: { code?: string; error?: string; connectUrl?: string } | null | undefined): boolean {
    if (data?.code !== "NO_SENDING_CHANNEL") return false;
    toast.error(data.error || "Connect a sending mailbox before starting a campaign.", {
        action: { label: "Connect a mailbox", onClick: () => { window.location.href = data.connectUrl || "/settings/mailboxes"; } },
        duration: 10000,
    });
    return true;
}
