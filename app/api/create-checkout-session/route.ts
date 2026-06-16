import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const { basket, telegramUser, shipping } = await request.json()

    if (!basket || basket.length === 0) {
      return NextResponse.json(
        { error: 'Basket is empty' },
        { status: 400 }
      )
    }

    const basketTotal = basket.reduce(
      (sum: number, item: any) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    )

    const shippingCost = Number(shipping?.cost || 0)
    const grandTotal = basketTotal + shippingCost

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      basket.map((item: any) => {
        const variantText =
          item.selected_variant_name && item.selected_variant_value
            ? `${item.selected_variant_name}: ${item.selected_variant_value}`
            : undefined

        return {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: item.name,
              description: variantText || item.description || undefined,
            },
            unit_amount: Math.round(Number(item.price) * 100),
          },
          quantity: item.quantity,
        }
      })

    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: shipping.service || 'Shipping',
            description: shipping.method || 'Shipping',
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({

shipping_address_collection:
  shipping?.method === 'Royal Mail Click & Drop'
    ? {
        allowed_countries: ['GB'],
      }
    : undefined,      

	mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      metadata: {
        basket: JSON.stringify(
          basket.map((item: any) => ({
            product_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            variant_id: item.selected_variant_id || null,
            variant_name: item.selected_variant_name || null,
            variant_value: item.selected_variant_value || null,
          }))
        ),
        basket_total: basketTotal.toFixed(2),
        shipping_method: shipping?.method || '',
        shipping_service: shipping?.service || '',
        shipping_cost: shippingCost.toFixed(2),
        total: grandTotal.toFixed(2),
        telegram_user_id: telegramUser?.id?.toString() || '',
        telegram_username: telegramUser?.username || '',
        telegram_first_name: telegramUser?.first_name || '',
        telegram_last_name: telegramUser?.last_name || '',
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