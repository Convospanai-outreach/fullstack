export default function GlassCard({ title, children }: any) {
    return (
        <div className="glass p-6 rounded-2xl neo-shadow">
            {title && (
                <h3 className="text-xl font-semibold mb-2 text-purple-300">{title}</h3>
            )}
            <div className="text-gray-300">{children}</div>
        </div>
    );
}
