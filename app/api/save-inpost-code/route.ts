import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { orderId, customerShippingReference } = await request.json()

    if (!orderId || !customerShippingReference) {
      return NextResponse.json(
        { error: 'Missing orderId or InPost reference' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        customer_shipping_reference: String(customerShippingReference).trim(),
        customer_shipping_notes: 'Customer provided InPost barcode/reference',
        shipping_paid_by: 'customer',
        carrier: 'InPost',
      })
      .eq('id', orderId)
      .eq('shipping_method', 'Customer InPost')

    if (error) {
      console.error(error)

      return NextResponse.json(
        { error: 'Unable to save InPost reference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unable to save InPost reference' },
      { status: 500 }
    )
  }
}