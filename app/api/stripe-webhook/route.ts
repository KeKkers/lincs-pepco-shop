import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function generateOrderReference(sessionId: string) {
  return `LPC-${sessionId.slice(-8).toUpperCase()}`
}

function getExpectedDispatchDate() {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  return date.toISOString().split('T')[0]
}

async function notifyAdmin(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const adminUserId = process.env.ADMIN_TELEGRAM_USER_ID

  if (!botToken || !adminUserId) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: adminUserId,
      text: message,
    }),
  })
}

async function decrementStock(item: any) {
  if (item.variant_id) {
    const { error } = await supabaseAdmin.rpc('decrement_variant_stock', {
      p_variant_id: item.variant_id,
      p_quantity: item.quantity,
    })

    if (error) {
      console.error('Variant stock decrement failed:', error)
    }

    return
  }

  const { error } = await supabaseAdmin.rpc('decrement_stock', {
    p_product_id: item.product_id,
    p_quantity: item.quantity,
  })

  if (error) {
    console.error('Product stock decrement failed:', error)
  }
}

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

    const telegramUserId = Number(
      session.metadata?.telegram_user_id || 0
    )

    const telegramUsername =
      session.metadata?.telegram_username || null

    const telegramFirstName =
      session.metadata?.telegram_first_name || null

    const telegramLastName =
      session.metadata?.telegram_last_name || null

    const customerName =
      [telegramFirstName, telegramLastName]
        .filter(Boolean)
        .join(' ') ||
      session.customer_details?.name ||
      'Stripe customer'

    let customerId: number | null = null

    if (telegramUserId > 0) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .upsert(
          {
            telegram_user_id: telegramUserId,
            telegram_username: telegramUsername,
            telegram_first_name: telegramFirstName,
            telegram_last_name: telegramLastName,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'telegram_user_id',
          }
        )
        .select('id')
        .single()

      if (customerError) {
        console.error('Customer upsert failed:', customerError)

        return NextResponse.json(
          { error: 'Customer upsert failed' },
          { status: 500 }
        )
      }

      customerId = customer.id
    }

    const orderReference = generateOrderReference(session.id)
    const orderTotal = Number(session.metadata?.total || 0)
    const shippingCost = Number(session.metadata?.shipping_cost || 0)
    const shippingMethod = session.metadata?.shipping_method || null
    const shippingService = session.metadata?.shipping_service || null
    const expectedDispatchDate = getExpectedDispatchDate()

const shippingDetails =
  session.collected_information?.shipping_details || null

const shippingAddress = shippingDetails?.address || null

    for (const item of basket) {
      const { error } = await supabaseAdmin
        .from('orders')
        .insert({
          customer_id: customerId,
          telegram_user_id: telegramUserId,
          telegram_username: telegramUsername,
          telegram_first_name: telegramFirstName,
          telegram_last_name: telegramLastName,
          customer_name: customerName,

          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          variant_value: item.variant_value || null,

          quantity: item.quantity,
          total_price: Number(item.price) * Number(item.quantity),
          order_total: orderTotal,
          status: 'Paid',

          stripe_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,

          order_reference: orderReference,
          expected_dispatch_date: expectedDispatchDate,

          shipping_method: shippingMethod,
          shipping_service: shippingService,
          shipping_cost: shippingCost,
          shipping_paid_by:
            shippingMethod === 'Customer InPost' ? 'customer' : 'seller',
          carrier:
            shippingMethod === 'Royal Mail Click & Drop'
              ? 'Royal Mail'
              : shippingMethod === 'Customer InPost'
                ? 'InPost'
                : null,

          shipping_name: shippingDetails?.name || null,
          shipping_address_line1: shippingAddress?.line1 || null,
          shipping_address_line2: shippingAddress?.line2 || null,
          shipping_city: shippingAddress?.city || null,
          shipping_postcode: shippingAddress?.postal_code || null,
          shipping_country: shippingAddress?.country || null,
        })

      if (error) {
        console.error('Supabase order insert failed:', error)

        return NextResponse.json(
          { error: 'Order insert failed' },
          { status: 500 }
        )
      }

      await decrementStock(item)

	
	await notifyAdmin(
  `🛒 NEW SALE

Order: ${orderReference}

Customer: ${customerName}

Product ID: ${item.product_id}

Qty: ${item.quantity}

Total: £${orderTotal.toFixed(2)}

Shipping: ${
    shippingService || shippingMethod || 'Not selected'
  }`
)
    }
  }

  return NextResponse.json({ received: true })
}