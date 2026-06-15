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
  product_id: number
  telegram_user_id: number
  order_reference: string | null
  customer_name: string | null
  telegram_username: string | null
  status: string
  quantity: number
  total_price: number
  order_total: number | null
  expected_dispatch_date: string | null
  dispatch_date: string | null
  carrier: string | null
  tracking_number: string | null
  notes: string | null
  shipping_method: string | null
  customer_shipping_reference: string | null
  customer_shipping_notes: string | null
  shipping_paid_by: string | null
  dropoff_status: string | null
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

const shippingMethods = [
  '',
  'Customer InPost',
  'Royal Mail Click & Drop',
  'Collection',
  'Other',
]

const shippingPaidByOptions = [
  'seller',
  'customer',
]

const dropoffStatuses = [
  'Not Ready',
  'Ready for Drop-off',
  'Dropped Off',
  'In Transit',
  'Delivered',
]

const carriers = [
  '',
  'Royal Mail',
  'InPost',
  'Evri',
  'DPD',
  'Yodel',
  'ParcelForce',
  'Collection',
  'Other',
]

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null)

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

  function updateLocalOrder(
    orderId: number,
    field: keyof Order,
    value: string
  ) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              [field]: value,
            }
          : order
      )
    )
  }

  function buildCustomerMessage(order: Order) {
    let message = `Order update: ${
      order.order_reference || `Order #${order.id}`
    }\n\n`

    message += `Status: ${order.status}\n`

    if (order.expected_dispatch_date) {
      message += `Expected dispatch: ${order.expected_dispatch_date}\n`
    }

    if (order.shipping_method) {
      message += `Shipping method: ${order.shipping_method}\n`
    }

    if (order.shipping_paid_by) {
      message += `Shipping paid by: ${order.shipping_paid_by}\n`
    }

    if (order.dropoff_status) {
      message += `Drop-off status: ${order.dropoff_status}\n`
    }

    if (order.dispatch_date) {
      message += `Dispatch date: ${order.dispatch_date}\n`
    }

    if (order.carrier) {
      message += `Carrier: ${order.carrier}\n`
    }

    if (order.tracking_number) {
      message += `Tracking: ${order.tracking_number}\n`
    }

    if (order.customer_shipping_reference) {
      message += `Customer shipping reference: ${order.customer_shipping_reference}\n`
    }

    message += `\nThank you for shopping with Lincs Pep Co.`

    return message
  }

  async function sendTelegramNotification(order: Order) {
    const response = await fetch('/api/send-telegram-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramUserId: order.telegram_user_id,
        message: buildCustomerMessage(order),
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      console.error(data)
      alert('Order saved, but Telegram notification failed.')
    }
  }

  async function saveOrder(order: Order) {
    setSavingOrderId(order.id)

    const { error } = await supabase
      .from('orders')
      .update({
        status: order.status,
        carrier: order.carrier || null,
        tracking_number: order.tracking_number || null,
        dispatch_date: order.dispatch_date || null,
        expected_dispatch_date: order.expected_dispatch_date || null,
        notes: order.notes || null,
        shipping_method: order.shipping_method || null,
        customer_shipping_reference:
          order.customer_shipping_reference || null,
        customer_shipping_notes:
          order.customer_shipping_notes || null,
        shipping_paid_by: order.shipping_paid_by || null,
        dropoff_status: order.dropoff_status || null,
      })
      .eq('id', order.id)

    setSavingOrderId(null)

    if (error) {
      alert('Order update failed')
      console.error(error)
      return
    }

    await sendTelegramNotification(order)
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
        Manage orders, production status, customer shipping and dispatch
        details.
      </p>

      <button
        onClick={loadOrders}
        className="mb-4 w-full rounded-xl bg-white text-black py-3 font-semibold"
      >
        Refresh Orders
      </button>

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
                {order.products?.name || `Product #${order.product_id}`}
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
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-neutral-400">
                  Order Status
                </label>

                <select
                  value={order.status}
                  onChange={(event) =>
                    updateLocalOrder(order.id, 'status', event.target.value)
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

              <div>
                <label className="text-sm text-neutral-400">
                  Expected Dispatch Date
                </label>

                <input
                  type="date"
                  value={order.expected_dispatch_date || ''}
                  onChange={(event) =>
                    updateLocalOrder(
                      order.id,
                      'expected_dispatch_date',
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div className="rounded-xl border border-neutral-800 p-3">
                <h3 className="font-semibold mb-3">Shipping</h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-neutral-400">
                      Shipping Method
                    </label>

                    <select
                      value={order.shipping_method || ''}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'shipping_method',
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    >
                      {shippingMethods.map((method) => (
                        <option key={method || 'blank'} value={method}>
                          {method || 'Not selected'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Shipping Paid By
                    </label>

                    <select
                      value={order.shipping_paid_by || 'seller'}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'shipping_paid_by',
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    >
                      {shippingPaidByOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Drop-off Status
                    </label>

                    <select
                      value={order.dropoff_status || 'Not Ready'}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'dropoff_status',
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    >
                      {dropoffStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Carrier
                    </label>

                    <select
                      value={order.carrier || ''}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'carrier',
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    >
                      {carriers.map((carrier) => (
                        <option key={carrier || 'blank'} value={carrier}>
                          {carrier || 'Not selected'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Tracking Number
                    </label>

                    <input
                      type="text"
                      value={order.tracking_number || ''}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'tracking_number',
                          event.target.value
                        )
                      }
                      placeholder="e.g. RM123456789GB"
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Customer InPost Reference / QR Notes
                    </label>

                    <input
                      type="text"
                      value={order.customer_shipping_reference || ''}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'customer_shipping_reference',
                          event.target.value
                        )
                      }
                      placeholder="Customer-provided InPost reference or QR note"
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Customer Shipping Notes
                    </label>

                    <textarea
                      value={order.customer_shipping_notes || ''}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'customer_shipping_notes',
                          event.target.value
                        )
                      }
                      placeholder="Any customer-supplied shipping instructions..."
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 min-h-20"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400">
                      Dispatch Date
                    </label>

                    <input
                      type="date"
                      value={order.dispatch_date || ''}
                      onChange={(event) =>
                        updateLocalOrder(
                          order.id,
                          'dispatch_date',
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-neutral-400">
                  Internal Notes
                </label>

                <textarea
                  value={order.notes || ''}
                  onChange={(event) =>
                    updateLocalOrder(order.id, 'notes', event.target.value)
                  }
                  placeholder="Production notes, customer requests, packing notes..."
                  className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 min-h-24"
                />
              </div>

              <button
                onClick={() => saveOrder(order)}
                disabled={savingOrderId === order.id}
                className="w-full rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-50"
              >
                {savingOrderId === order.id
                  ? 'Saving...'
                  : 'Save & Notify Customer'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}