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
  telegram_username: string | null
  status: string
  quantity: number
  total_price: number
  order_total: number | null
  expected_dispatch_date: string | null
  carrier: string | null
  tracking_number: string | null
  created_at: string
  products?: {
    name: string
  } | null
}

const statuses = [
  'Paid',
  'Printing',
  'Quality Check',
  'Packed',
  'Dispatched',
  'Delivered',
  'Cancelled',
  'Refunded',
]

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)

  useEffect(() => {
    async function initAdmin() {
      const tg = window.Telegram?.WebApp

      if (!tg?.initDataUnsafe?.user?.id) {
        setLoading(false)
        return
      }

      tg.ready()
      tg.expand()

      const userId = Number(tg.initDataUnsafe.user.id)
      setTelegramUserId(userId)

      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('telegram_user_id', userId)
        .single()

      if (adminError || !adminData) {
        setLoading(false)
        return
      }

      setIsAdmin(true)
      await loadOrders()
      setLoading(false)
    }

    initAdmin()
  }, [])

  async function loadOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        products (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setOrders(data || [])
  }

  async function updateStatus(orderId: number, status: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (error) {
      alert('Status update failed')
      console.error(error)
      return
    }

    await loadOrders()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        Loading admin dashboard...
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        <h1 className="text-2xl font-bold mb-3">Admin Access Denied</h1>
        <p className="text-neutral-300">
          Telegram user ID: {telegramUserId || 'Not detected'}
        </p>
        <p className="text-neutral-400 mt-3">
          Open this page from inside Telegram using your bot.
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4">
      <h1 className="text-2xl font-bold mb-2">Lincs Pep Co Admin</h1>

      <p className="text-neutral-400 mb-6">
        Manage paid orders and production status.
      </p>

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

            <div className="mt-4 space-y-1 text-sm">
              <p>
                <strong>Customer:</strong> {order.customer_name || 'Unknown'}
              </p>
              <p>
                <strong>Telegram:</strong>{' '}
                {order.telegram_username
                  ? `@${order.telegram_username}`
                  : 'Not captured'}
              </p>
              <p>
                <strong>Product:</strong>{' '}
                {order.products?.name || `Product #${order.id}`}
              </p>
              <p>
                <strong>Quantity:</strong> {order.quantity}
              </p>
              <p>
                <strong>Line Total:</strong> £
                {Number(order.total_price).toFixed(2)}
              </p>
              <p>
                <strong>Order Total:</strong> £
                {Number(order.order_total || order.total_price).toFixed(2)}
              </p>
              <p>
                <strong>Expected Dispatch:</strong>{' '}
                {order.expected_dispatch_date || 'Not set'}
              </p>
            </div>

            <div className="mt-4">
              <label className="text-sm text-neutral-400">
                Update status
              </label>

              <select
                value={order.status}
                onChange={(event) =>
                  updateStatus(order.id, event.target.value)
                }
                className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}