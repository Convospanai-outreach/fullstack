
interface SectionHeaderProps {
    title: string;
    subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
    return (
        <div className="mb-8">
            <h1 className="text-2xl md:text-3xl text-foreground font-semibold tracking-tight">
                {title}
            </h1>
            {subtitle && (
                <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            )}
        </div>
    );
}
