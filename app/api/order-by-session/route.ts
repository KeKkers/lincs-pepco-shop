import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing session_id' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_reference,
      shipping_method,
      shipping_service,
      customer_shipping_reference
    `)
    .eq('stripe_session_id', sessionId)
    .limit(1)
    .single()

  if (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Order not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ order: data })
}