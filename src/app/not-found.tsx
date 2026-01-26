import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <h1 className="text-9xl font-bold gradient-text">404</h1>
            <h2 className="text-2xl font-semibold text-white">Page Not Found</h2>
            <p className="text-gray-400 max-w-md">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <Link href="/dashboard">
                <Button variant="primary">Return to Dashboard</Button>
            </Link>
        </div>
    );
}
