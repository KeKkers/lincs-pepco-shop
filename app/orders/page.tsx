'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    Telegram?: any
  }
}

type Order = {
  id: number
  order_reference: string | null
  customer_name: string | null
  telegram_user_id: number
  status: string
  quantity: number
  total_price: number
  order_total: number | null
  expected_dispatch_date: string | null
  dispatch_date: string | null
  carrier: string | null
  tracking_number: string | null
  created_at: string
  products?: {
    name: string
  } | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const tg = window.Telegram?.WebApp

      if (!tg?.initDataUnsafe?.user?.id) {
        setLoading(false)
        return
      }

      tg.ready()
      tg.expand()

      const userId = Number(tg.initDataUnsafe.user.id)
      setTelegramUserId(userId)

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products (
            name
          )
        `)
        .eq('telegram_user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      setOrders(data || [])
      setLoading(false)
    }

    init()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        Loading your orders...
      </main>
    )
  }

  if (!telegramUserId) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        <h1 className="text-2xl font-bold mb-3">Orders</h1>
        <p className="text-neutral-300">
          Telegram user not detected.
        </p>
        <p className="text-neutral-400 mt-3">
          Open this page from inside the Telegram shop.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-2">My Orders</h1>

      <p className="text-neutral-400 mb-6">
        View your order status, dispatch information and tracking details.
      </p>

      {orders.length === 0 && (
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p>You do not have any orders yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-bold">
                  {order.order_reference || `Order #${order.id}`}
                </h2>
                <p className="text-sm text-neutral-400">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>

              <span className="text-sm rounded-full bg-neutral-800 px-3 py-1 h-fit">
                {order.status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>Product:</strong>{' '}
                {order.products?.name || `Product #${order.id}`}
              </p>

              <p>
                <strong>Quantity:</strong> {order.quantity}
              </p>

              <p>
                <strong>Total:</strong> £
                {Number(order.order_total || order.total_price).toFixed(2)}
              </p>

              <p>
                <strong>Expected Dispatch:</strong>{' '}
                {order.expected_dispatch_date || 'To be confirmed'}
              </p>

              {order.dispatch_date && (
                <p>
                  <strong>Dispatch Date:</strong> {order.dispatch_date}
                </p>
              )}

              {order.carrier && (
                <p>
                  <strong>Carrier:</strong> {order.carrier}
                </p>
              )}

              {order.tracking_number && (
                <p>
                  <strong>Tracking:</strong> {order.tracking_number}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}