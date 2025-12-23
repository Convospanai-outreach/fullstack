import { cn } from "@/lib/utils";

interface BadgeProps {
    children: React.ReactNode;
    variant?: "neutral" | "success" | "warning" | "error";
    size?: "sm" | "md";
    className?: string;
}

export function Badge({ children, variant = "neutral", size = "md", className }: BadgeProps) {
    const variants = {
        neutral: "bg-white/10 text-gray-200 border-white/20",
        success: "bg-green-500/10 text-green-400 border-green-500/20",
        warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        error: "bg-red-500/10 text-red-400 border-red-500/20"
    };

    const sizes = {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-3 py-1 text-xs"
    };

    return (
        <span className={cn(
            "rounded-full font-medium border",
            variants[variant],
            sizes[size],
            className
        )}>
            {children}
        </span>
    );
}
