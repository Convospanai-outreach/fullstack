export default function FeatureGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="section grid grid-cols-1 md:grid-cols-3 gap-8">
            {children}
        </div>
    );
}
