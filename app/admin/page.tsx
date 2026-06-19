'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
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
  shipping_cost: number | null
  shipping_service: string | null
  shipping_name: string | null
  shipping_address_line1: string | null
  shipping_address_line2: string | null
  shipping_city: string | null
  shipping_postcode: string | null
  shipping_country: string | null
  inpost_phone: string | null
inpost_code: string | null
  created_at: string
  products?: {
    name: string
  } | null
}

type Product = {
  id: number
  name: string
  stock_quantity: number | null
  active: boolean
}

type DashboardStats = {
  todayRevenue: number
  paidOrders: number
  awaitingDispatch: number
  inProduction: number
  lowStock: number
  outOfStock: number
}

const statuses = [
  'Paid',
  'Printing',
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

const shippingPaidByOptions = ['seller', 'customer']

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
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    paidOrders: 0,
    awaitingDispatch: 0,
    inProduction: 0,
    lowStock: 0,
    outOfStock: 0,
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)

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
      await loadDashboard()
      setLoading(false)
    }

    initAdmin()
  }, [])

  async function loadDashboard() {
    await Promise.all([loadOrders(), loadProducts()])
  }

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

    const loadedOrders = data || []
    setOrders(loadedOrders)
    calculateStats(loadedOrders, products)
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, active')
      .eq('active', true)

    if (error) {
      console.error(error)
      return
    }

    const loadedProducts = data || []
    setProducts(loadedProducts)
    calculateStats(orders, loadedProducts)
  }

  function calculateStats(orderData: Order[], productData: Product[]) {
    const today = new Date().toISOString().split('T')[0]

    const todayRevenue = orderData
      .filter((order) => order.created_at?.startsWith(today))
      .filter((order) => !['Cancelled', 'Refunded'].includes(order.status))
      .reduce(
        (sum, order) =>
          sum + Number(order.order_total || order.total_price || 0),
        0
      )

    const paidOrders = orderData.filter((order) => order.status === 'Paid').length

    const awaitingDispatch = orderData.filter((order) =>
      ['Paid', 'Packed'].includes(order.status)
    ).length

    const inProduction = orderData.filter((order) =>
      ['Printing'].includes(order.status)
    ).length

    const lowStock = productData.filter((product) => {
      const stock = Number(product.stock_quantity || 0)
      return stock > 0 && stock <= 3
    }).length

    const outOfStock = productData.filter(
      (product) => Number(product.stock_quantity || 0) === 0
    ).length

    setStats({
      todayRevenue,
      paidOrders,
      awaitingDispatch,
      inProduction,
      lowStock,
      outOfStock,
    })
  }

  const filteredOrders =
    statusFilter === 'All'
      ? orders
      : orders.filter((order) => order.status === statusFilter)

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

  function formatDate(date: string) {
    return new Date(date).toLocaleString()
  }

  function formatShippingAddress(order: Order) {
    return [
      order.shipping_name,
      order.shipping_address_line1,
      order.shipping_address_line2,
      order.shipping_city,
      order.shipping_postcode,
      order.shipping_country,
    ]
      .filter(Boolean)
      .join('\n')
  }

  async function copyShippingAddress(order: Order) {
    const address = formatShippingAddress(order)

    if (!address) {
      alert('No shipping address available to copy.')
      return
    }

    try {
      await navigator.clipboard.writeText(address)
      alert('Shipping address copied.')
    } catch (error) {
      console.error(error)
      alert('Unable to copy address. You may need to copy it manually.')
    }
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

    if (order.shipping_service) {
      message += `Shipping service: ${order.shipping_service}\n`
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
        customer_shipping_reference: order.customer_shipping_reference || null,
        customer_shipping_notes: order.customer_shipping_notes || null,
        shipping_paid_by: order.shipping_paid_by || null,
      })
      .eq('id', order.id)

    setSavingOrderId(null)

    if (error) {
      alert('Order update failed')
      console.error(error)
      return
    }

    await sendTelegramNotification(order)
    await loadDashboard()
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
        Manage orders, production status, customer shipping and dispatch details.
      </p>

      <a
        href="/"
        className="block mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        Back to Shop
      </a>

      <a
        href="/admin/products"
        className="block mb-4 w-full rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        Manage Products
      </a>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-sm text-neutral-400">Today's Revenue</p>
          <p className="text-2xl font-bold">
            £{stats.todayRevenue.toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-sm text-neutral-400">Paid Orders</p>
          <p className="text-2xl font-bold">{stats.paidOrders}</p>
        </div>

        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-sm text-neutral-400">Awaiting Dispatch</p>
          <p className="text-2xl font-bold">{stats.awaitingDispatch}</p>
        </div>

        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-sm text-neutral-400">In Production</p>
          <p className="text-2xl font-bold">{stats.inProduction}</p>
        </div>

        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-sm text-neutral-400">Low Stock</p>
          <p className="text-2xl font-bold">{stats.lowStock}</p>
        </div>

        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-sm text-neutral-400">Out of Stock</p>
          <p className="text-2xl font-bold">{stats.outOfStock}</p>
        </div>
      </section>

      <button
        onClick={loadDashboard}
        className="mb-4 w-full rounded-xl bg-white text-black py-3 font-semibold"
      >
        Refresh Dashboard
      </button>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {['All', ...statuses].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
              statusFilter === status
                ? 'bg-white text-black border-white'
                : 'bg-neutral-900 text-white border-neutral-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <p className="text-sm text-neutral-400 mb-4">
        Showing {filteredOrders.length} orders
      </p>

      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const isExpanded = expandedOrderId === order.id

          return (
            <div
              key={order.id}
              className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
            >
              <button
                onClick={() =>
                  setExpandedOrderId(isExpanded ? null : order.id)
                }
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-neutral-400">
                      {formatDate(order.created_at)}
                    </p>

                    <h2 className="font-bold mt-1">
                      {order.order_reference || `Order #${order.id}`}
                    </h2>
                  </div>

                  <span className="text-sm rounded-full bg-neutral-800 px-3 py-1 h-fit">
                    {order.status}
                  </span>
                </div>

                <p className="text-xs text-neutral-500 mt-3">
                  {isExpanded ? 'Tap to collapse' : 'Tap to view / edit order'}
                </p>
              </button>

              {isExpanded && (
                <div className="mt-4 border-t border-neutral-800 pt-4">
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Customer:</strong>{' '}
                      {order.customer_name || 'Unknown'}
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

                    <p>
                      <strong>Shipping Service:</strong>{' '}
                      {order.shipping_service || 'Not selected'}
                    </p>

                    <p>
                      <strong>Shipping Cost:</strong> £
                      {Number(order.shipping_cost || 0).toFixed(2)}
                    </p>
                  </div>

                  {(order.shipping_name ||
                    order.shipping_address_line1 ||
                    order.shipping_postcode) && (
                    <div className="mt-4 rounded-xl bg-neutral-800 border border-neutral-700 p-3 text-sm">
                      <p className="font-semibold mb-2">Shipping Address</p>

                      {order.shipping_name && <p>{order.shipping_name}</p>}
                      {order.shipping_address_line1 && (
                        <p>{order.shipping_address_line1}</p>
                      )}
                      {order.shipping_address_line2 && (
                        <p>{order.shipping_address_line2}</p>
                      )}
                      {order.shipping_city && <p>{order.shipping_city}</p>}
                      {order.shipping_postcode && (
                        <p>{order.shipping_postcode}</p>
                      )}
                      {order.shipping_country && (
                        <p>{order.shipping_country}</p>
                      )}

                      <button
                        onClick={() => copyShippingAddress(order)}
                        className="mt-3 w-full rounded-xl bg-white text-black py-2 font-semibold"
                      >
                        Copy Address
                      </button>
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-sm text-neutral-400">
                        Order Status
                      </label>

                      <select
                        value={order.status}
                        onChange={(event) =>
                          updateLocalOrder(
                            order.id,
                            'status',
                            event.target.value
                          )
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
                              <option
                                key={carrier || 'blank'}
                                value={carrier}
                              >
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
{order.inpost_phone && order.inpost_code && (
  <div className="mt-4">
    <p className="text-sm text-neutral-400 mb-2">
      InPost QR Code
    </p>

    <div className="rounded-xl bg-white p-4 inline-block">
      <QRCodeSVG
        value={`P|${order.inpost_phone}|${order.inpost_code}`}
        size={180}
      />
    </div>

    <p className="text-xs text-neutral-400 mt-2">
      Phone: {order.inpost_phone}
    </p>

    <p className="text-xs text-neutral-400">
      Code: {order.inpost_code}
    </p>
  </div>
)}
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
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}