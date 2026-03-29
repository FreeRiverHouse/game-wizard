import { NextResponse } from 'next/server';
import { chatWithShopkeeper, getConversationHistory, resetConversation } from '@/services/shopkeeper';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    if (message === '__reset__') {
      resetConversation();
      return NextResponse.json({ ok: true });
    }
    
    const response = await chatWithShopkeeper(message);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { reply: 'Error', emotion: 'neutral' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(getConversationHistory());
}