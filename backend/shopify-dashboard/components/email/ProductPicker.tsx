'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, Package, Check } from 'lucide-react';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface Product {
  id: string;
  title: string;
  handle: string;
  image: string;
  price: string;
  currency: string;
  variants?: Array<{ id: string; compareAtPrice?: string }>;
}

interface ProductPickerProps {
  onSelect: (products: Product[]) => void;
  onClose: () => void;
}

export function generateProductMjml(product: Product, storeUrl = 'tsg-api.myshopify.com'): string {
  const price = product.price ? `$${parseFloat(product.price).toFixed(2)}` : '';
  const compareAt = product.variants?.[0]?.compareAtPrice;
  return `<mj-section background-color="#ffffff" padding="20px">
  <mj-column width="40%">
    <mj-image src="${product.image || ''}" alt="${product.title}" border-radius="8px" />
  </mj-column>
  <mj-column width="60%">
    <mj-text font-size="18px" font-weight="700" color="#1a1a2e">${product.title}</mj-text>
    <mj-text font-size="16px" color="#3b82f6" font-weight="600">${price}${compareAt ? ` <span style="text-decoration:line-through;color:#999;font-size:14px;">$${parseFloat(compareAt).toFixed(2)}</span>` : ''}</mj-text>
    <mj-button background-color="#3b82f6" color="#ffffff" font-size="14px" border-radius="6px" href="https://${storeUrl}/products/${product.handle}">Shop Now</mj-button>
  </mj-column>
</mj-section>`;
}

export default function ProductPicker({ onSelect, onClose }: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts(query?: string) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '20' });
      if (query) params.set('search', query);
      const res = await fetch(`${EMAIL_API}/shopify/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchProducts(search);
  }

  function toggleProduct(product: Product) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      return [...prev, product];
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-lg">Shopify Product Picker</h3>
            <p className="text-xs text-gray-400">Select products to insert into your email template</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 border-b">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
            </div>
            <Button type="submit" className="bg-gray-900 text-white hover:bg-gray-800">Search</Button>
          </form>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-2" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {products.map((product) => {
                const isSelected = selected.find((p) => p.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product)}
                    className={cn(
                      'border rounded-lg p-3 cursor-pointer transition-all',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    )}
                  >
                    <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden relative">
                      {product.image ? (
                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{product.title}</h4>
                    <p className="text-sm font-semibold text-blue-600 mt-1">
                      ${parseFloat(product.price).toFixed(2)} {product.currency}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-500">{selected.length} product{selected.length !== 1 ? 's' : ''} selected</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSelect(selected)} disabled={selected.length === 0} className="bg-blue-600 text-white hover:bg-blue-700">
              Insert {selected.length > 0 ? `(${selected.length})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
