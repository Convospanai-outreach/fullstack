import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { format } from "date-fns";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PaymentHistory() {
    const { data: payments, isLoading } = useSWR(getBrowserApiBase() + "/billing/history", fetcher);

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-4">Payment History</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-foreground/80">
                    <thead className="text-xs uppercase bg-foreground/5 text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Transaction ID</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 rounded-tr-lg">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                                    Loading history...
                                </td>
                            </tr>
                        )}
                        {payments?.map((payment: any) => (
                            <tr key={payment.id} className="border-b border-foreground/5 hover:bg-foreground/5 transition">
                                <td className="px-4 py-3 font-medium text-foreground text-xs">{payment.id}</td>
                                <td className="px-4 py-3 text-xs">
                                    {format(new Date(payment.createdAt), "MMM dd, yyyy")}
                                </td>
                                <td className={`px-4 py-3 font-bold ${payment.amount > 0 ? "text-success" : "text-destructive"}`}>
                                    {payment.amount > 0 ? "+" : ""}{payment.amount} Credits
                                </td>
                                <td className="px-4 py-3 text-xs">{payment.description}</td>
                                <td className="px-4 py-3">
                                    <Badge variant="success">
                                        Confirmed
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                        {!isLoading && (!payments || payments.length === 0) && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                                    No payment history found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}
