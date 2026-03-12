import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, subject, message } = body;

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        // In a real app, we would send an email via SendGrid/AWS SES here.
        // For now, we'll just log it and simulate a delay.
        console.log("Support Ticket Received:", { name, email, subject, message });

        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

        return NextResponse.json({ success: true, message: "Ticket submitted successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
