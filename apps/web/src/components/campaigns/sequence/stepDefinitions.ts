import { Mail, MessageSquare, Eye, UserMinus, UserPlus, Phone, LucideIcon } from "lucide-react";

export interface StepDefinition {
    id: string;
    label: string;
    icon: LucideIcon;
    requiresLinkedIn: boolean;
}

export interface StepGroup {
    group: string;
    items: StepDefinition[];
}

export const stepGroups: StepGroup[] = [
    {
        group: "Most used",
        items: [
            { id: "EMAIL", label: "Email", icon: Mail, requiresLinkedIn: false },
            { id: "CHAT_MESSAGE", label: "Chat message", icon: MessageSquare, requiresLinkedIn: true },
            { id: "VISIT_PROFILE", label: "Visit profile", icon: Eye, requiresLinkedIn: true },
        ],
    },
    {
        group: "LinkedIn",
        items: [
            { id: "LI_WITHDRAW", label: "Withdraw invitation", icon: UserMinus, requiresLinkedIn: true },
            { id: "LI_VISIT", label: "Visit profile", icon: Eye, requiresLinkedIn: true },
            { id: "LI_INVITE", label: "Invitation", icon: UserPlus, requiresLinkedIn: true },
            { id: "LI_CHAT", label: "Chat message", icon: MessageSquare, requiresLinkedIn: true },
            { id: "LI_VOICE", label: "Voice message", icon: Phone, requiresLinkedIn: true },
        ],
    },
];

export function findStepDefinition(stepType: string): StepDefinition | undefined {
    for (const group of stepGroups) {
        const found = group.items.find((item) => item.id === stepType);
        if (found) return found;
    }
    return undefined;
}
