import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Stripe signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)

    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const basket = JSON.parse(session.metadata?.basket || '[]')
    const total = Number(session.metadata?.total || 0)

    for (const item of basket) {
      const { error } = await supabaseAdmin.from('orders').insert({
        telegram_user_id: 0,
        customer_name: session.customer_details?.name || 'Stripe customer',
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: Number(item.price) * Number(item.quantity),
        status: 'Paid',
      })

      if (error) {
        console.error('Supabase order insert failed:', error)
        return NextResponse.json(
          { error: 'Order insert failed' },
          { status: 500 }
        )
      }
    }

    console.log(`Order paid successfully. Total: £${total}`)
  }

  return NextResponse.json({ received: true })
}