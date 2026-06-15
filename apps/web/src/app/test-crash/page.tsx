import { notFound } from "next/navigation";
import { TestCrashClient } from "./TestCrashClient";

export default function TestCrashPage() {
    if (process.env["ENABLE_TEST_DIAGNOSTIC_ROUTES"] !== "true") {
        notFound();
    }

    return <TestCrashClient />;
}
