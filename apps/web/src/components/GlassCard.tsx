export default function GlassCard({ title, children }: any) {
    return (
        <div className="glass p-6 rounded-2xl neo-shadow">
            {title && (
                <h3 className="text-xl font-semibold mb-2 text-primary">{title}</h3>
            )}
            <div className="text-foreground/80">{children}</div>
        </div>
    );
}
