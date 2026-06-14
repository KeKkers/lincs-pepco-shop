import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const { basket } = await request.json()

    if (!basket || basket.length === 0) {
      return NextResponse.json(
        { error: 'Basket is empty' },
        { status: 400 }
      )
    }

    const total = basket.reduce(
      (sum: number, item: any) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    )

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: basket.map((item: any) => ({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.name,
            description: item.description || undefined,
          },
          unit_amount: Math.round(Number(item.price) * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        basket: JSON.stringify(
          basket.map((item: any) => ({
            product_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          }))
        ),
        total: total.toFixed(2),
      },
      success_url: `${request.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unable to create checkout session' },
      { status: 500 }
    )
  }
}