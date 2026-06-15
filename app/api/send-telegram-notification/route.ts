import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { telegramUserId, message } = await request.json()

    if (!telegramUserId || !message) {
      return NextResponse.json(
        { error: 'Missing telegramUserId or message' },
        { status: 400 }
      )
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return NextResponse.json(
        { error: 'Missing TELEGRAM_BOT_TOKEN' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Telegram send failed:', data)

      return NextResponse.json(
        { error: 'Telegram send failed', details: data },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Notification failed' },
      { status: 500 }
    )
  }
}