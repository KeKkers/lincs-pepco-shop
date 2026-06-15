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
  active: boolean
  stock_quantity: number | null
  sku: string | null
  sort_order: number | null
}

const blankProduct = {
  name: '',
  description: '',
  price: 0,
  image_url: '',
  category: '',
  active: true,
  stock_quantity: 0,
  sku: '',
  sort_order: 0,
}

export default function ProductAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState(blankProduct)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
const [uploading, setUploading] = useState(false)

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
      await loadProducts()
      setLoading(false)
    }

    init()
  }, [])

async function uploadImage(file: File) {
  try {
    setUploading(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) {
      console.error(uploadError)
      alert('Image upload failed')
      return null
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    console.error(error)
    alert('Image upload failed')
    return null
  } finally {
    setUploading(false)
  }
}

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      console.error(error)
      alert('Unable to load products')
      return
    }

    setProducts(data || [])
  }

  function updateLocalProduct(
    productId: number,
    field: keyof Product,
    value: string | number | boolean
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]: value,
            }
          : product
      )
    )
  }

  async function saveProduct(product: Product) {
    setSavingId(product.id)

    const { error } = await supabase
      .from('products')
      .update({
        name: product.name,
        description: product.description || null,
        price: Number(product.price),
        image_url: product.image_url || null,
        category: product.category || null,
        active: product.active,
        stock_quantity: Number(product.stock_quantity || 0),
        sku: product.sku || null,
        sort_order: Number(product.sort_order || 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)

    setSavingId(null)

    if (error) {
      console.error(error)
      alert('Product update failed')
      return
    }

    await loadProducts()
  }

  async function addProduct() {
    if (!newProduct.name.trim()) {
      alert('Product name is required')
      return
    }

    if (Number(newProduct.price) <= 0) {
      alert('Price must be greater than 0')
      return
    }

    const { error } = await supabase.from('products').insert({
      name: newProduct.name.trim(),
      description: newProduct.description || null,
      price: Number(newProduct.price),
      image_url: newProduct.image_url || null,
      category: newProduct.category || null,
      active: newProduct.active,
      stock_quantity: Number(newProduct.stock_quantity || 0),
      sku: newProduct.sku || null,
      sort_order: Number(newProduct.sort_order || 0),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error(error)
      alert('Product creation failed')
      return
    }

    setNewProduct(blankProduct)
    await loadProducts()
  }

  async function removeProduct(productId: number) {
    const confirmed = confirm(
      'Remove this product from the shop? This will set it inactive, not permanently delete it.'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('products')
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)

    if (error) {
      console.error(error)
      alert('Unable to remove product')
      return
    }

    await loadProducts()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        Loading product admin...
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
      <h1 className="text-2xl font-bold mb-2">Product Admin</h1>

      <p className="text-neutral-400 mb-6">
        Add, edit, remove and control stock levels for your shop products.
      </p>

      <a
        href="/admin"
        className="block mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        Back to Orders Admin
      </a>

      <section className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 mb-6">
        <h2 className="text-xl font-bold mb-4">Add New Product</h2>

        <div className="space-y-3">
          <input
            type="text"
            value={newProduct.name}
            onChange={(event) =>
              setNewProduct({ ...newProduct, name: event.target.value })
            }
            placeholder="Product name"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
          />

          <textarea
            value={newProduct.description}
            onChange={(event) =>
              setNewProduct({
                ...newProduct,
                description: event.target.value,
              })
            }
            placeholder="Product description"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 min-h-24"
          />

          <input
            type="number"
            step="0.01"
            value={newProduct.price}
            onChange={(event) =>
              setNewProduct({
                ...newProduct,
                price: Number(event.target.value),
              })
            }
            placeholder="Price"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
          />

<div>
  <label className="block mb-2 text-sm">
    Product Image
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={async (event) => {
      const file = event.target.files?.[0]

      if (!file) return

      const url = await uploadImage(file)

      if (url) {
        setNewProduct({
          ...newProduct,
          image_url: url,
        })
      }
    }}
    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
  />

  {uploading && (
    <p className="text-sm text-neutral-400 mt-2">
      Uploading image...
    </p>
  )}

  {newProduct.image_url && (
    <img
      src={newProduct.image_url}
      alt="Preview"
      className="mt-3 h-40 w-full rounded-xl object-cover bg-neutral-800"
    />
  )}
</div>

          <input
            type="text"
            value={newProduct.category}
            onChange={(event) =>
              setNewProduct({
                ...newProduct,
                category: event.target.value,
              })
            }
            placeholder="Category"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
          />

          <input
            type="text"
            value={newProduct.sku}
            onChange={(event) =>
              setNewProduct({
                ...newProduct,
                sku: event.target.value,
              })
            }
            placeholder="SKU"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
          />

          <input
            type="number"
            value={newProduct.stock_quantity}
            onChange={(event) =>
              setNewProduct({
                ...newProduct,
                stock_quantity: Number(event.target.value),
              })
            }
            placeholder="Stock quantity"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
          />

          <input
            type="number"
            value={newProduct.sort_order}
            onChange={(event) =>
              setNewProduct({
                ...newProduct,
                sort_order: Number(event.target.value),
              })
            }
            placeholder="Sort order"
            className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
          />

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={newProduct.active}
              onChange={(event) =>
                setNewProduct({
                  ...newProduct,
                  active: event.target.checked,
                })
              }
            />
            Active product
          </label>

          <button
            onClick={addProduct}
            className="w-full rounded-xl bg-white text-black py-3 font-semibold"
          >
            Add Product
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Existing Products</h2>

        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4"
          >
            <div className="flex justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold">
                  {product.name || `Product #${product.id}`}
                </h3>
                <p className="text-sm text-neutral-400">
                  {product.active ? 'Active' : 'Inactive'} · Stock:{' '}
                  {product.stock_quantity ?? 0}
                </p>
              </div>

              <span className="text-sm rounded-full bg-neutral-800 px-3 py-1 h-fit">
                #{product.id}
              </span>
            </div>

            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="mb-4 h-48 w-full rounded-xl object-cover bg-neutral-800"
              />
            )}

            <div className="space-y-3">
              <input
                type="text"
                value={product.name}
                onChange={(event) =>
                  updateLocalProduct(product.id, 'name', event.target.value)
                }
                placeholder="Product name"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              />

              <textarea
                value={product.description || ''}
                onChange={(event) =>
                  updateLocalProduct(
                    product.id,
                    'description',
                    event.target.value
                  )
                }
                placeholder="Product description"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 min-h-24"
              />

              <input
                type="number"
                step="0.01"
                value={product.price}
                onChange={(event) =>
                  updateLocalProduct(
                    product.id,
                    'price',
                    Number(event.target.value)
                  )
                }
                placeholder="Price"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              />

<div>
  <label className="block mb-2 text-sm">
    Product Image
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={async (event) => {
      const file = event.target.files?.[0]

      if (!file) return

      const url = await uploadImage(file)

      if (url) {
        updateLocalProduct(
          product.id,
          'image_url',
          url
        )
      }
    }}
    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
  />

  {product.image_url && (
    <img
      src={product.image_url}
      alt={product.name}
      className="mt-3 h-40 w-full rounded-xl object-cover bg-neutral-800"
    />
  )}
</div>

              <input
                type="text"
                value={product.category || ''}
                onChange={(event) =>
                  updateLocalProduct(
                    product.id,
                    'category',
                    event.target.value
                  )
                }
                placeholder="Category"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              />

              <input
                type="text"
                value={product.sku || ''}
                onChange={(event) =>
                  updateLocalProduct(product.id, 'sku', event.target.value)
                }
                placeholder="SKU"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              />

              <input
                type="number"
                value={product.stock_quantity || 0}
                onChange={(event) =>
                  updateLocalProduct(
                    product.id,
                    'stock_quantity',
                    Number(event.target.value)
                  )
                }
                placeholder="Stock quantity"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              />

              <input
                type="number"
                value={product.sort_order || 0}
                onChange={(event) =>
                  updateLocalProduct(
                    product.id,
                    'sort_order',
                    Number(event.target.value)
                  )
                }
                placeholder="Sort order"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
              />

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={product.active}
                  onChange={(event) =>
                    updateLocalProduct(
                      product.id,
                      'active',
                      event.target.checked
                    )
                  }
                />
                Active product
              </label>

              <button
                onClick={() => saveProduct(product)}
                disabled={savingId === product.id}
                className="w-full rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-50"
              >
                {savingId === product.id ? 'Saving...' : 'Save Product'}
              </button>

              <button
                onClick={() => removeProduct(product.id)}
                className="w-full rounded-xl bg-red-700 text-white py-3 font-semibold"
              >
                Remove from Shop
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}