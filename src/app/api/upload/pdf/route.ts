import { NextResponse } from 'next/server';
export async function POST(_req: Request) {
  return NextResponse.json({ ok: true, message: 'pdf upload stub - implement multipart parsing' });
}
