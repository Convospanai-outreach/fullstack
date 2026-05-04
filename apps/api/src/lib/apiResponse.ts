import { NextResponse } from "next/server";

export class APIError extends Error {
    statusCode: number;
    code?: string;

    constructor(message: string, statusCode: number = 500, code?: string) {
        super(message);
        this.statusCode = statusCode;
        if (code !== undefined) {
            this.code = code;
        }
    }
}

export function handleAPIError(error: any) {
    console.error("API Error:", error);

    if (error instanceof APIError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
        );
    }

    // Prisma specific errors (simplified)
    if (error.code === 'P2002') {
        return NextResponse.json(
            { error: "Duplicate entry found", code: "DUPLICATE_ENTRY" },
            { status: 409 }
        );
    }

    const message = error?.message || "Internal Server Error";
    if (message.includes("Insufficient credits")) {
        return NextResponse.json(
            { error: message, code: "INSUFFICIENT_CREDITS" },
            { status: 402 }
        );
    }

    if (message.includes("prompt") || message.includes("not allowed") || message.includes("exceeds")) {
        return NextResponse.json(
            { error: message, code: "AI_INPUT_BLOCKED" },
            { status: 400 }
        );
    }

    return NextResponse.json(
        { error: "Internal Server Error", code: "INTERNAL_ERROR" },
        { status: 500 }
    );
}

export function successResponse(data: any, status: number = 200) {
    return NextResponse.json(data, { status });
}
