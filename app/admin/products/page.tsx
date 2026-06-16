'use client'

import { useEffect, useState } from 'react'
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
  active: boolean
  stock_quantity: number | null
  sku: string | null
  sort_order: number | null
  product_images?: ProductImage[]
  product_variants?: ProductVariant[]
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

const blankVariant = {
  variant_name: 'Colour',
  variant_value: '',
  sku: '',
  price_override: '',
  stock_quantity: 0,
  active: true,
}

export default function ProductAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState(blankProduct)
  const [newProductFiles, setNewProductFiles] = useState<File[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
const [newVariantByProduct, setNewVariantByProduct] = useState<
  Record<number, typeof blankVariant>
>({})



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
      } = supabase.storage.from('product-images').getPublicUrl(fileName)

      return publicUrl
    } catch (error) {
      console.error(error)
      alert('Image upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function uploadImagesForProduct(productId: number, files: File[]) {
    if (files.length === 0) return

    for (let index = 0; index < files.length; index++) {
      const url = await uploadImage(files[index])

      if (!url) continue

      const { error } = await supabase.from('product_images').insert({
        product_id: productId,
        image_url: url,
        sort_order: index,
      })

      if (error) {
        console.error(error)
        alert('Image saved to storage but not linked to product')
      }

      if (index === 0) {
        await supabase
          .from('products')
          .update({
            image_url: url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId)
      }
    }
  }

  async function loadProducts() {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })

    if (productError) {
      console.error(productError)
      alert('Unable to load products')
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

    const productsWithImages = (productData || []).map((product) => ({
      ...product,
      product_images: (imageData || []).filter(
        (image) => image.product_id === product.id
      ),
    }))

    setProducts(productsWithImages)
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

    const firstGalleryImage = product.product_images?.[0]?.image_url || null

    const { error } = await supabase
      .from('products')
      .update({
        name: product.name,
        description: product.description || null,
        price: Number(product.price),
        image_url: firstGalleryImage || product.image_url || null,
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

    const { data, error } = await supabase
      .from('products')
      .insert({
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
      .select('id')
      .single()

    if (error || !data) {
      console.error(error)
      alert('Product creation failed')
      return
    }

    await uploadImagesForProduct(data.id, newProductFiles)

    setNewProduct(blankProduct)
    setNewProductFiles([])
    await loadProducts()
  }

  async function addImagesToExistingProduct(productId: number, files: File[]) {
    await uploadImagesForProduct(productId, files)
    await loadProducts()
  }

  async function deleteProductImage(imageId: number) {
    const confirmed = confirm('Remove this image from the product?')
    if (!confirmed) return

    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)

    if (error) {
      console.error(error)
      alert('Unable to remove image')
      return
    }

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
        href="/"
        className="block mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        Back to Shop
      </a>

      <a
        href="/admin"
        className="block mb-4 rounded-xl bg-neutral-800 border border-neutral-700 text-center py-3 font-semibold"
      >
        Back to Orders Admin
      </a>

      <section className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 mb-6">
        <h2 className="text-xl font-bold mb-4">Add New Product</h2>

        <div className="space-y-3">
          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Product Name
            </label>
            <input
              type="text"
              value={newProduct.name}
              onChange={(event) =>
                setNewProduct({ ...newProduct, name: event.target.value })
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Product Description
            </label>
            <textarea
              value={newProduct.description}
              onChange={(event) =>
                setNewProduct({
                  ...newProduct,
                  description: event.target.value,
                })
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 min-h-24"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Price (£)
            </label>
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
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Product Images
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setNewProductFiles(Array.from(event.target.files || []))
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
            <p className="text-xs text-neutral-500 mt-2">
              You can select multiple images. They will upload when you add the
              product.
            </p>
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Category
            </label>
            <input
              type="text"
              value={newProduct.category}
              onChange={(event) =>
                setNewProduct({
                  ...newProduct,
                  category: event.target.value,
                })
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">SKU</label>
            <input
              type="text"
              value={newProduct.sku}
              onChange={(event) =>
                setNewProduct({
                  ...newProduct,
                  sku: event.target.value,
                })
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Stock Quantity
            </label>
            <input
              type="number"
              value={newProduct.stock_quantity}
              onChange={(event) =>
                setNewProduct({
                  ...newProduct,
                  stock_quantity: Number(event.target.value),
                })
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-neutral-400">
              Sort Order
            </label>
            <input
              type="number"
              value={newProduct.sort_order}
              onChange={(event) =>
                setNewProduct({
                  ...newProduct,
                  sort_order: Number(event.target.value),
                })
              }
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
            />
          </div>

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

          {uploading && (
            <p className="text-sm text-neutral-400">Uploading images...</p>
          )}

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

            {product.product_images && product.product_images.length > 0 && (
              <div className="mb-4 flex gap-3 overflow-x-auto">
                {product.product_images.map((image) => (
                  <div key={image.id} className="min-w-48">
                    <img
                      src={image.image_url}
                      alt={product.name}
                      className="h-40 w-48 rounded-xl object-cover bg-neutral-800"
                    />
                    <button
                      onClick={() => deleteProductImage(image.id)}
                      className="mt-2 w-full rounded-lg bg-red-700 text-white py-2 text-sm"
                    >
                      Remove Image
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Product Name
                </label>
                <input
                  type="text"
                  value={product.name}
                  onChange={(event) =>
                    updateLocalProduct(product.id, 'name', event.target.value)
                  }
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Product Description
                </label>
                <textarea
                  value={product.description || ''}
                  onChange={(event) =>
                    updateLocalProduct(
                      product.id,
                      'description',
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 min-h-24"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Price (£)
                </label>
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
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Add More Product Images
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (event) => {
                    const files = Array.from(event.target.files || [])
                    if (files.length === 0) return
                    await addImagesToExistingProduct(product.id, files)
                  }}
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Category
                </label>
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
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  SKU
                </label>
                <input
                  type="text"
                  value={product.sku || ''}
                  onChange={(event) =>
                    updateLocalProduct(product.id, 'sku', event.target.value)
                  }
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Stock Quantity
                </label>
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
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-neutral-400">
                  Sort Order
                </label>
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
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3"
                />
              </div>

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