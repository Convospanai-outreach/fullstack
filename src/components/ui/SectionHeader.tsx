
interface SectionHeaderProps {
    title: string;
    subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
    return (
        <div className="mb-10 text-center">
            <h1 className="text-4xl md:text-5xl gradient-text font-extrabold">
                {title}
            </h1>
            {subtitle && (
                <p className="text-gray-300 text-lg mt-3">{subtitle}</p>
            )}
        </div>
    );
}
