import { Mail, MessageSquare, Eye, UserMinus, UserPlus, Phone, GitBranch, LucideIcon } from "lucide-react";

export interface StepDefinition {
    id: string;
    label: string;
    icon: LucideIcon;
    requiresLinkedIn: boolean;
    /** Which fields the step editor should show for this step type. */
    hasSubject?: boolean;
    hasMessageBody?: boolean;
    isCondition?: boolean;
}

export interface StepGroup {
    group: string;
    items: StepDefinition[];
}

export const stepGroups: StepGroup[] = [
    {
        group: "Most used",
        items: [
            { id: "EMAIL", label: "Email", icon: Mail, requiresLinkedIn: false, hasSubject: true, hasMessageBody: true },
            { id: "CHAT_MESSAGE", label: "Chat message", icon: MessageSquare, requiresLinkedIn: true, hasMessageBody: true },
            { id: "VISIT_PROFILE", label: "Visit profile", icon: Eye, requiresLinkedIn: true },
        ],
    },
    {
        group: "LinkedIn",
        items: [
            { id: "LI_WITHDRAW", label: "Withdraw invitation", icon: UserMinus, requiresLinkedIn: true },
            { id: "LI_VISIT", label: "Visit profile", icon: Eye, requiresLinkedIn: true },
            { id: "LI_INVITE", label: "Invitation", icon: UserPlus, requiresLinkedIn: true, hasMessageBody: true },
            { id: "LI_CHAT", label: "Chat message", icon: MessageSquare, requiresLinkedIn: true, hasMessageBody: true },
            { id: "LI_VOICE", label: "Voice message", icon: Phone, requiresLinkedIn: true, hasMessageBody: true },
        ],
    },
];

export const conditionGroups: StepGroup[] = [
    {
        group: "Conditions",
        items: [
            { id: "CONDITION", label: "Lead condition", icon: GitBranch, requiresLinkedIn: false, isCondition: true },
        ],
    },
];

const allGroups = [...stepGroups, ...conditionGroups];

export function findStepDefinition(stepType: string): StepDefinition | undefined {
    for (const group of allGroups) {
        const found = group.items.find((item) => item.id === stepType);
        if (found) return found;
    }
    return undefined;
}
