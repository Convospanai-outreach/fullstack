

type Point = number;
type Props = { values: Point[]; width?: number; height?: number };

export default function Sparkline({ values, width = 120, height = 36 }: Props) {
    if (!values || values.length === 0) {
        return <svg width={width} height={height} />;
    }

    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;

    const step = width / (values.length - 1 || 1);

    const points = values.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / span) * height;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <polyline fill="none" stroke="#0ea5e9" strokeWidth={2} points={points} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
