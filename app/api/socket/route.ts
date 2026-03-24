import { NextResponse } from 'next/server';
import { initSocket } from '@/lib/socket';

export const dynamic = 'force-dynamic';

export async function GET() {
  // This route is used to initialize the socket server
  // The actual socket handling is done in the server setup
  return NextResponse.json({ success: true });
}
