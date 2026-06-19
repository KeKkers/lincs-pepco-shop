import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { orderId, inpostPhone, inpostCode } = await request.json()

    if (!orderId || !inpostPhone || !inpostCode) {
      return NextResponse.json(
        { error: 'Missing orderId, phone or code' },
        { status: 400 }
      )
    }

    if (!/^\d{9}$/.test(String(inpostPhone))) {
      return NextResponse.json(
        { error: 'Phone number must be 9 digits' },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(String(inpostCode))) {
      return NextResponse.json(
        { error: 'InPost code must be 6 digits' },
        { status: 400 }
      )
    }

    const qrPayload = `P|${inpostPhone}|${inpostCode}`

    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        inpost_phone: String(inpostPhone),
        inpost_code: String(inpostCode),
        customer_shipping_reference: qrPayload,
        customer_shipping_notes: 'Customer provided InPost phone and code',
        shipping_paid_by: 'customer',
        carrier: 'InPost',
      })
      .eq('id', orderId)
      .eq('shipping_method', 'Customer InPost')

    if (error) {
      console.error(error)
      return NextResponse.json(
        { error: 'Unable to save InPost details' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Unable to save InPost details' },
      { status: 500 }
    )
  }
}