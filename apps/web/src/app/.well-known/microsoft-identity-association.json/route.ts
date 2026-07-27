import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      associatedApplications: [
        {
          applicationId: "b4837ab1-3748-46b9-a70e-ffc925974486",
        },
      ],
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
