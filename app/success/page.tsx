'use client'

import { useEffect, useState } from 'react'

type Order = {
  id: number
  order_reference: string | null
  shipping_method: string | null
  shipping_service: string | null
  customer_shipping_reference: string | null
}

export default function SuccessPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [inpostReference, setInpostReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadOrder() {
      const params = new URLSearchParams(window.location.search)
      const sessionId = params.get('session_id')

      if (!sessionId) {
        setLoading(false)
        return
      }

      const response = await fetch(`/api/order-by-session?session_id=${sessionId}`)
      const data = await response.json()

      if (data.order) {
        setOrder(data.order)
        setInpostReference(data.order.customer_shipping_reference || '')
      }

      setLoading(false)
    }

    loadOrder()
  }, [])

  async function saveInpostCode() {
    if (!order) return

    const reference = inpostReference.trim()

    if (!reference) {
      alert('Please enter your InPost barcode/reference number.')
      return
    }

    setSaving(true)

    const response = await fetch('/api/save-inpost-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        customerShippingReference: reference,
      }),
    })

    setSaving(false)

    if (!response.ok) {
      alert('Unable to save InPost reference.')
      return
    }

    setMessage('InPost reference saved successfully.')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        Loading order...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-3">Payment successful</h1>

      <p className="text-neutral-300 mb-6">
        Thank you. Your order has been received.
      </p>

      <a
        href="/"
        className="block mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        Back to Shop
      </a>

      {order && (
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 mb-6">
          <p>
            <strong>Order:</strong>{' '}
            {order.order_reference || `Order #${order.id}`}
          </p>

          <p>
            <strong>Shipping:</strong>{' '}
            {order.shipping_service || order.shipping_method || 'Not selected'}
          </p>
        </div>
      )}

      {order?.shipping_method === 'Customer InPost' && (
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <h2 className="text-xl font-bold mb-2">
            Add your InPost barcode/reference
          </h2>

          <p className="text-neutral-400 mb-4">
            Enter the InPost barcode/reference number from your InPost app.
          </p>

          <input
            type="text"
            inputMode="numeric"
            value={inpostReference}
            onChange={(event) => setInpostReference(event.target.value)}
            placeholder="e.g. 505387796"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 mb-4"
          />

          <button
            onClick={saveInpostCode}
            disabled={saving}
            className="w-full rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save InPost Reference'}
          </button>

          {message && (
            <p className="text-green-400 mt-4">
              {message}
            </p>
          )}
        </div>
      )}
    </main>
  )
}