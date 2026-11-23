interface StatusBadgeProps {
    status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const colors: Record<string, string> = {
        draft: "bg-secondary text-foreground border-border",
        active: "bg-success/10 text-success border-success/30",
        paused: "bg-warning/10 text-warning border-warning/30",
        completed: "bg-primary/10 text-primary border-primary/30",
    };

    const color = colors[status] || colors['draft'];

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
        >
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}
