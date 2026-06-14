'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    async function getProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)

      if (error) {
        console.error(error)
        return
      }

      setProducts(data || [])
    }

    getProducts()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Lincs Pep Co
      </h1>

      {products.map((product) => (
        <div
          key={product.id}
          className="border rounded-lg p-4 mb-4"
        >
          <h2 className="text-xl font-semibold">
            {product.name}
          </h2>

          <p>{product.description}</p>

          <p className="font-bold mt-2">
            £{product.price}
          </p>
        </div>
      ))}
    </main>
  )
}