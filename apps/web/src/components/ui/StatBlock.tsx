
interface StatBlockProps {
    label: string;
    value: string | number;
}

export function StatBlock({ label, value }: StatBlockProps) {
    return (
        <div className="glass p-6 text-center">
            <p className="text-muted-foreground">{label}</p>
            <p className="text-4xl font-bold gradient-text mt-2">{value}</p>
        </div>
    );
}
