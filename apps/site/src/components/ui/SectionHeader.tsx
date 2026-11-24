
interface SectionHeaderProps {
    title: string;
    subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
    return (
        <div className="mb-6">
            <h1 className="text-[32px] md:text-[40px] leading-[1.15] text-foreground font-semibold tracking-[-0.01em] mb-1">
                {title}
            </h1>
            {subtitle && (
                <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            )}
        </div>
    );
}
