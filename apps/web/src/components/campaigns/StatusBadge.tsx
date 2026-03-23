interface StatusBadgeProps {
    status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const colors: Record<string, string> = {
        draft: "bg-gray-100 text-gray-800 border-gray-300",
        active: "bg-green-100 text-green-800 border-green-300",
        paused: "bg-yellow-100 text-yellow-800 border-yellow-300",
        completed: "bg-blue-100 text-blue-800 border-blue-300",
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
