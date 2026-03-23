import Link from "next/link";

export default function GlowButton({ href, children }: any) {
    return (
        <Link
            href={href}
            className="px-6 py-3 rounded-xl text-lg font-semibold bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg hover:opacity-90 transition glow"
        >
            {children}
        </Link>
    );
}
