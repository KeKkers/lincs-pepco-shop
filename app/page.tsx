'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    Telegram?: any
  }
}

type Product = {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string | null
}

type BasketItem = Product & {
  quantity: number
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [telegramUser, setTelegramUser] = useState<any>(null)

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('id')

      if (error) {
        console.error(error)
        return
      }

      setProducts(data || [])
    }

    loadProducts()

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      setTelegramUser(window.Telegram.WebApp.initDataUnsafe.user)
    }

    window.Telegram?.WebApp?.ready()
  }, [])

  function addToBasket(product: Product) {
    setBasket((current) => {
      const existing = current.find((item) => item.id === product.id)

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...current, { ...product, quantity: 1 }]
    })
  }

  function removeFromBasket(productId: number) {
    setBasket((current) =>
      current
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  async function checkout() {
    try {
      setIsCheckingOut(true)

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basket, telegramUser }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
        return
      }

      alert(data.error || 'Checkout failed. Please try again.')
    } catch (error) {
      console.error(error)
      alert('Checkout failed. Please try again.')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const total = basket.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  )

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4 pb-40">
      <h1 className="text-2xl font-bold mb-2">Lincs Pep Co</h1>

      <p className="text-neutral-300 mb-6">
        Custom 3D printed products, personalised items and bespoke designs.
      </p>

      <div className="grid gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
          >
            <h2 className="text-lg font-semibold">{product.name}</h2>

            <p className="text-neutral-400 text-sm mt-1">
              {product.description}
            </p>

            <p className="text-xl font-bold mt-3">
              £{Number(product.price).toFixed(2)}
            </p>

            <button
              onClick={() => addToBasket(product)}
              className="mt-4 w-full rounded-xl bg-white text-black py-3 font-semibold"
            >
              Add to basket
            </button>
          </div>
        ))}
      </div>

      {basket.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4">
          <h2 className="font-bold mb-2">Basket</h2>

          <div className="space-y-2 mb-3">
            {basket.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p>{item.name}</p>
                  <p className="text-neutral-400">
                    £{Number(item.price).toFixed(2)} × {item.quantity}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeFromBasket(item.id)}
                    className="rounded-lg bg-neutral-800 px-3 py-1"
                  >
                    -
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    onClick={() => addToBasket(item)}
                    className="rounded-lg bg-neutral-800 px-3 py-1"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Total</span>
            <span className="font-bold">£{total.toFixed(2)}</span>
          </div>

          <button
            onClick={checkout}
            disabled={isCheckingOut}
            className="w-full rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-50"
          >
            {isCheckingOut ? 'Opening checkout...' : 'Checkout'}
          </button>
        </div>
      )}
    </main>
  )
}