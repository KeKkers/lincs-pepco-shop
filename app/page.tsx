'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    Telegram?: any
  }
}

type ProductImage = {
  id: number
  product_id: number
  image_url: string
  sort_order: number | null
}

type ProductVariant = {
  id: number
  product_id: number
  variant_name: string
  variant_value: string
  sku: string | null
  price_override: number | null
  stock_quantity: number | null
  active: boolean
}

type Product = {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string | null
  product_images?: ProductImage[]
  product_variants?: ProductVariant[]
}

type BasketItem = Product & {
  quantity: number
  selected_variant_id?: number | null
  selected_variant_name?: string | null
  selected_variant_value?: string | null
  selected_variant_price?: number | null
}

type ShippingOption = {
  method: string
  service: string
  cost: number
}

const shippingOptions: ShippingOption[] = [
  { method: 'Customer InPost', service: 'Customer provides InPost code', cost: 0 },
  { method: 'Royal Mail Click & Drop', service: 'Royal Mail Tracked 48', cost: 3.95 },
  { method: 'Royal Mail Click & Drop', service: 'Royal Mail Tracked 24', cost: 4.95 },
  { method: 'Royal Mail Click & Drop', service: 'Royal Mail Tracked 72', cost: 0.01 },
]

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({})
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [telegramUser, setTelegramUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [shipping, setShipping] = useState<ShippingOption>(shippingOptions[0])

  useEffect(() => {
    async function loadProducts() {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })

      if (productError) {
        console.error(productError)
        return
      }

      const productIds = (productData || []).map((product) => product.id)

      if (productIds.length === 0) {
        setProducts([])
        return
      }

      const { data: imageData, error: imageError } = await supabase
        .from('product_images')
        .select('*')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })

      if (imageError) {
        console.error(imageError)
      }

      const { data: variantData, error: variantError } = await supabase
        .from('product_variants')
        .select('*')
        .in('product_id', productIds)
        .eq('active', true)
        .gt('stock_quantity', 0)
        .order('id', { ascending: true })

      if (variantError) {
        console.error(variantError)
      }

      const productsWithImagesAndVariants = (productData || [])
        .map((product) => {
          const variants = (variantData || []).filter(
            (variant) => variant.product_id === product.id
          )

          return {
            ...product,
            product_images: (imageData || []).filter(
              (image) => image.product_id === product.id
            ),
            product_variants: variants,
          }
        })
        .filter((product) => {
          if (product.product_variants && product.product_variants.length > 0) {
            return true
          }

          return Number(product.stock_quantity || 0) > 0
        })

      setProducts(productsWithImagesAndVariants)

      const defaultVariants: Record<number, number> = {}

      productsWithImagesAndVariants.forEach((product) => {
        if (product.product_variants && product.product_variants.length > 0) {
          defaultVariants[product.id] = product.product_variants[0].id
        }
      })

      setSelectedVariants(defaultVariants)
    }

    async function checkAdmin(userId: number) {
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('telegram_user_id', userId)
        .single()

      if (data) {
        setIsAdmin(true)
      }
    }

    loadProducts()

    const tg = window.Telegram?.WebApp

    if (tg) {
      tg.ready()
      tg.expand()

      if (tg.initDataUnsafe?.user) {
        setTelegramUser(tg.initDataUnsafe.user)
        checkAdmin(Number(tg.initDataUnsafe.user.id))
      }
    }
  }, [])

  const categories = useMemo(() => {
    const uniqueCategories = products
      .map((product) => product.category)
      .filter((category): category is string => Boolean(category))

    return ['All', ...Array.from(new Set(uniqueCategories))]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') {
      return products
    }

    return products.filter((product) => product.category === selectedCategory)
  }, [products, selectedCategory])

  function getImages(product: Product) {
    const uploadedImages = product.product_images || []

    if (uploadedImages.length > 0) {
      return uploadedImages.map((image) => image.image_url)
    }

    return product.image_url ? [product.image_url] : []
  }

  function getSelectedVariant(product: Product) {
    const variants = product.product_variants || []

    if (variants.length === 0) {
      return null
    }

    const selectedVariantId = selectedVariants[product.id]

    return (
      variants.find((variant) => variant.id === selectedVariantId) ||
      variants[0]
    )
  }

  function getDisplayPrice(product: Product) {
    const selectedVariant = getSelectedVariant(product)

    if (
      selectedVariant &&
      selectedVariant.price_override !== null &&
      selectedVariant.price_override !== undefined
    ) {
      return Number(selectedVariant.price_override)
    }

    return Number(product.price)
  }

  function addToBasket(product: Product) {
    const selectedVariant = getSelectedVariant(product)
    const price = getDisplayPrice(product)

    setBasket((current) => {
      const existing = current.find(
        (item) =>
          item.id === product.id &&
          (item.selected_variant_id || null) ===
            (selectedVariant?.id || null)
      )

      if (existing) {
        return current.map((item) =>
          item.id === product.id &&
          (item.selected_variant_id || null) ===
            (selectedVariant?.id || null)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
          price,
          selected_variant_id: selectedVariant?.id || null,
          selected_variant_name: selectedVariant?.variant_name || null,
          selected_variant_value: selectedVariant?.variant_value || null,
          selected_variant_price: selectedVariant?.price_override || null,
        },
      ]
    })
  }

  function removeFromBasket(productId: number, selectedVariantId?: number | null) {
    setBasket((current) =>
      current
        .map((item) =>
          item.id === productId &&
          (item.selected_variant_id || null) === (selectedVariantId || null)
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
        body: JSON.stringify({ basket, telegramUser, shipping }),
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

  const basketTotal = basket.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  )

  const grandTotal = basketTotal + shipping.cost

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4 pb-72">
      <h1 className="text-2xl font-bold mb-2">Lincs Pep Co</h1>

      <p className="text-neutral-300 mb-4">
        Custom 3D printed products, personalised items and bespoke designs.
      </p>

      <a
        href="/orders"
        className="block mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        My Orders
      </a>

      {isAdmin && (
        <a
          href="/admin"
          className="block mb-6 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
        >
          Admin Dashboard
        </a>
      )}

      {categories.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                selectedCategory === category
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 text-white border-neutral-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4">
        {filteredProducts.map((product) => {
          const images = getImages(product)
          const selectedVariant = getSelectedVariant(product)
          const displayPrice = getDisplayPrice(product)
          const variants = product.product_variants || []

          return (
            <div
              key={product.id}
              className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
            >
              {images.length > 0 && (
                <div className="mb-4 flex gap-3 overflow-x-auto snap-x snap-mandatory">
                  {images.map((imageUrl, index) => (
                    <img
                      key={`${product.id}-${imageUrl}-${index}`}
                      src={imageUrl}
                      alt={`${product.name} image ${index + 1}`}
                      className="h-56 min-w-full snap-center rounded-xl object-cover bg-neutral-800"
                    />
                  ))}
                </div>
              )}

              <h2 className="text-lg font-semibold">{product.name}</h2>

              <p className="text-neutral-400 text-sm mt-1">
                {product.description}
              </p>

              {variants.length > 0 && (
                <div className="mt-4">
                  <label className="text-sm text-neutral-400">
                    {variants[0].variant_name}
                  </label>

                  <select
                    value={selectedVariant?.id || ''}
                    onChange={(event) =>
                      setSelectedVariants({
                        ...selectedVariants,
                        [product.id]: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                  >
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.variant_value}
                        {variant.price_override !== null &&
                        variant.price_override !== undefined
                          ? ` - £${Number(variant.price_override).toFixed(2)}`
                          : ''}
                        {variant.stock_quantity !== null &&
                        Number(variant.stock_quantity) <= 3
                          ? ` (${variant.stock_quantity} left)`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="text-xl font-bold mt-3">
                £{displayPrice.toFixed(2)}
              </p>

              {product.category && (
                <p className="text-xs text-neutral-500 mt-1">
                  {product.category}
                </p>
              )}

              <button
                onClick={() => addToBasket(product)}
                className="mt-4 w-full rounded-xl bg-white text-black py-3 font-semibold"
              >
                Add to basket
              </button>
            </div>
          )
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 text-neutral-300">
          No products found in this category.
        </div>
      )}

      {basket.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 max-h-[70vh] overflow-y-auto">
          <h2 className="font-bold mb-2">Basket</h2>

          <div className="space-y-2 mb-3">
            {basket.map((item) => (
              <div
                key={`${item.id}-${item.selected_variant_id || 'base'}`}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p>{item.name}</p>

                  {item.selected_variant_name && item.selected_variant_value && (
                    <p className="text-neutral-400">
                      {item.selected_variant_name}: {item.selected_variant_value}
                    </p>
                  )}

                  <p className="text-neutral-400">
                    £{Number(item.price).toFixed(2)} × {item.quantity}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      removeFromBasket(item.id, item.selected_variant_id)
                    }
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

          <div className="mb-3">
            <label className="text-sm text-neutral-400">Shipping</label>

            <select
              value={`${shipping.method}|${shipping.service}`}
              onChange={(event) => {
                const selected = shippingOptions.find(
                  (option) =>
                    `${option.method}|${option.service}` === event.target.value
                )

                if (selected) setShipping(selected)
              }}
              className="mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            >
              {shippingOptions.map((option) => (
                <option
                  key={`${option.method}|${option.service}`}
                  value={`${option.method}|${option.service}`}
                >
                  {option.service} - £{option.cost.toFixed(2)}
                </option>
              ))}
            </select>

            {shipping.method === 'Customer InPost' && (
              <p className="text-xs text-neutral-400 mt-2">
                You will need to provide your own valid InPost code/QR details
                after ordering.
              </p>
            )}
          </div>

          <div className="space-y-1 mb-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Items</span>
              <span>£{basketTotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>£{shipping.cost.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span>£{grandTotal.toFixed(2)}</span>
            </div>
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