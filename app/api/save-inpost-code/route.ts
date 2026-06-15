import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { orderId, inpostCode } = await request.json()

    if (!orderId || !inpostCode) {
      return NextResponse.json(
        { error: 'Missing orderId or inpostCode' },
        { status: 400 }
      )
    }

    if (!/^\d{9}$/.test(String(inpostCode))) {
      return NextResponse.json(
        { error: 'Invalid InPost code' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        customer_shipping_reference: String(inpostCode),
        customer_shipping_notes: 'Customer provided InPost code after checkout',
        shipping_paid_by: 'customer',
        carrier: 'InPost',
        dropoff_status: 'Ready for Drop-off',
      })
      .eq('id', orderId)
      .eq('shipping_method', 'Customer InPost')

    if (error) {
      console.error(error)

      return NextResponse.json(
        { error: 'Unable to save InPost code' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unable to save InPost code' },
      { status: 500 }
    )
  }
}