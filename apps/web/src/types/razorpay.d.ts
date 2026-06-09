type RazorpayCheckoutOptions = {
    key?: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    handler?: (response: unknown) => void;
    prefill?: {
        email?: string;
    };
    theme?: {
        color?: string;
    };
};

interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => {
        open: () => void;
        on: (event: string, handler: (response: unknown) => void) => void;
    };
}
