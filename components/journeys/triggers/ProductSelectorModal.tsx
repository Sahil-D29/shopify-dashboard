"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check, Loader2, Search, X } from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ProductSelectionConfig } from "@/lib/types/trigger-config";
import { cn } from "@/lib/utils";

interface ShopifyProductSummary {
  id: string;
  title: string;
  handle?: string;
  status?: string;
  productType?: string;
  vendor?: string;
  imageSrc?: string;
  tags?: string[];
  price?: number | null;
}

interface ShopifyCollectionSummary {
  id: string;
  title: string;
  handle?: string;
  description?: string | null;
}

interface ProductSelectorModalProps {
  open: boolean;
  initialSelection?: ProductSelectionConfig | null;
  onClose: () => void;
  onSave: (selection: ProductSelectionConfig) => void;
}

type SelectionMode = ProductSelectionConfig["mode"];

type FetchState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetched?: number | null;
};

const defaultSelection: ProductSelectionConfig = {
  mode: "any",
  productIds: [],
  collectionIds: [],
};

export function ProductSelectorModal({ open, initialSelection, onClose, onSave }: ProductSelectorModalProps) {
  const [selection, setSelection] = useState<ProductSelectionConfig>(initialSelection ?? defaultSelection);
  const [searchTerm, setSearchTerm] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<SelectionMode>(initialSelection?.mode ?? "any");
  const [productsState, setProductsState] = useState<FetchState<ShopifyProductSummary[]>>({
    data: [],
    loading: false,
    error: null,
  });
  const [collectionsState, setCollectionsState] = useState<FetchState<ShopifyCollectionSummary[]>>({
    data: [],
    loading: false,
    error: null,
  });
  const [debounceHandle, setDebounceHandle] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialSelection?.mode ?? "any");
    setSelection(initialSelection ?? defaultSelection);
    setSearchTerm("");
    setCollectionFilter(null);
  }, [initialSelection, open]);

  const fetchCatalog = useCallback(async () => {
    setProductsState(prev => ({ ...prev, loading: true, error: null }));
    setCollectionsState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch("/api/shopify/catalog?limit=200", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load catalog");
      }
      const payload = await response.json();
      const products: ShopifyProductSummary[] = Array.isArray(payload?.products)
        ? payload.products.map((product: Record<string, any>) => ({
            id: String(product.id ?? ""),
            title: product.title ?? "Untitled product",
            handle: product.handle ?? undefined,
            status: product.status ?? undefined,
            productType: product.productType ?? product.product_type ?? undefined,
            vendor: product.vendor ?? undefined,
            imageSrc: product.imageSrc ?? product.image?.src ?? product.images?.[0]?.src,
            tags: Array.isArray(product.tags) ? product.tags : undefined,
            price:
              typeof product.price === "number"
                ? product.price
                : product.variants?.[0]?.price
                  ? Number(product.variants[0].price)
                  : null,
          }))
        : [];
      const collections: ShopifyCollectionSummary[] = Array.isArray(payload?.collections)
        ? payload.collections.map((collection: Record<string, any>) => ({
            id: String(collection.id ?? ""),
            title: collection.title ?? "Untitled collection",
            handle: collection.handle ?? undefined,
            description: collection.description ?? collection.body_html ?? null,
          }))
        : [];

      setProductsState({ data: products, loading: false, error: null, lastFetched: Date.now() });
      setCollectionsState({ data: collections, loading: false, error: null, lastFetched: Date.now() });
    } catch (error: any) {
      const message = error?.message || "Unable to load catalog";
      setProductsState(prev => ({ ...prev, loading: false, error: message }));
      setCollectionsState(prev => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchCatalog();
  }, [fetchCatalog, open]);

  useEffect(
    () => () => {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }
    },
    [debounceHandle],
  );

  const filteredProducts = useMemo(() => {
    if (!productsState.data.length) return [];
    const query = searchTerm.trim().toLowerCase();
    const shouldFilterCollection = mode === "specific" && collectionFilter && collectionFilter !== "all";

    return productsState.data.filter(product => {
      if (mode !== "specific") return true;
      let matchesQuery = true;
      if (query.length >= 2) {
        matchesQuery =
          product.title.toLowerCase().includes(query) ||
          product.handle?.toLowerCase().includes(query) ||
          product.tags?.some(tag => tag.toLowerCase().includes(query)) ||
          false;
      }
      let matchesCollection = true;
      if (shouldFilterCollection) {
        matchesCollection = selection.collectionIds.includes(collectionFilter);
      }
      return matchesQuery && matchesCollection;
    });
  }, [collectionFilter, mode, productsState.data, searchTerm, selection.collectionIds]);

  const selectedProductIds = selection.productIds;
  const selectedCollectionIds = selection.collectionIds;

  const handleToggleProduct = (productId: string) => {
    setSelection(prev => {
      const set = new Set(prev.productIds);
      if (set.has(productId)) set.delete(productId);
      else set.add(productId);
      return {
        ...prev,
        mode: "specific",
        productIds: Array.from(set),
        collectionIds: prev.collectionIds,
      };
    });
    setMode("specific");
  };

  const handleToggleCollection = (collectionId: string) => {
    setSelection(prev => {
      const set = new Set(prev.collectionIds);
      if (set.has(collectionId)) set.delete(collectionId);
      else set.add(collectionId);
      return {
        ...prev,
        mode: "collections",
        collectionIds: Array.from(set),
        productIds: prev.productIds,
      };
    });
    setMode("collections");
  };

  const handleModeChange = (nextMode: SelectionMode) => {
    setMode(nextMode);
    setSelection(prev => ({
      ...prev,
      mode: nextMode,
      productIds: nextMode === "specific" ? prev.productIds : [],
      collectionIds: nextMode === "collections" ? prev.collectionIds : [],
    }));
  };

  const handleConfirm = () => {
    onSave({
      ...selection,
      mode,
    });
  };

  const isLoading = productsState.loading || collectionsState.loading;
  const hasError = productsState.error || collectionsState.error;

  const selectedProducts = selectedProductIds
    .map(id => productsState.data.find(product => product.id === id))
    .filter(Boolean) as ShopifyProductSummary[];
  const selectedCollections = selectedCollectionIds
    .map(id => collectionsState.data.find(collection => collection.id === id))
    .filter(Boolean) as ShopifyCollectionSummary[];

  const canSave =
    mode === "any" ||
    (mode === "specific" && selectedProductIds.length > 0) ||
    (mode === "collections" && selectedCollectionIds.length > 0);

  const handleSearchChange = (value: string) => {
    if (debounceHandle) {
      clearTimeout(debounceHandle);
    }
    setSearchTerm(value);
    const handle = window.setTimeout(() => {
      setSearchTerm(value);
    }, 250);
    setDebounceHandle(handle);
  };

  return (
    <Modal
      isOpen={open}
      title="Select Products"
      subtitle="Choose which products or collections should trigger this journey."
      onClose={onClose}
      size="xl"
      showCloseButton
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#B9AA9F]">Scope</p>
            <div className="space-y-2 text-sm text-[#4A4139]">
              <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2">
                <input
                  type="radio"
                  name="product-scope"
                  value="any"
                  checked={mode === "any"}
                  onChange={() => handleModeChange("any")}
                />
                Any product
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2">
                <input
                  type="radio"
                  name="product-scope"
                  value="specific"
                  checked={mode === "specific"}
                  onChange={() => handleModeChange("specific")}
                />
                Specific products
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2">
                <input
                  type="radio"
                  name="product-scope"
                  value="collections"
                  checked={mode === "collections"}
                  onChange={() => handleModeChange("collections")}
                />
                Collections
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#B9AA9F]">Selected</p>
            {mode === "any" ? (
              <p className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/70 px-4 py-3 text-xs text-[#8B7F76]">
                Journey will trigger for any product view.
              </p>
            ) : null}

            {mode === "specific" && selectedProducts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/70 px-4 py-3 text-xs text-[#8B7F76]">
                Select one or more products to include.
              </p>
            ) : null}

            {mode === "collections" && selectedCollections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E8E4DE] bg-white/70 px-4 py-3 text-xs text-[#8B7F76]">
                Select a collection to include its products.
              </p>
            ) : null}

            {mode === "specific" && selectedProducts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedProducts.map(product => (
                  <Badge key={product.id} className="flex items-center gap-2 bg-white text-[#4A4139]" variant="secondary">
                    {product.title}
                    <button
                      type="button"
                      className="rounded-full bg-[#F5E5E2] p-1 text-[#B45151]"
                      onClick={() => handleToggleProduct(product.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}

            {mode === "collections" && selectedCollections.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedCollections.map(collection => (
                  <Badge
                    key={collection.id}
                    className="flex items-center gap-2 bg-[#F5F3EE] text-[#4A4139]"
                    variant="secondary"
                  >
                    {collection.title}
                    <button
                      type="button"
                      className="rounded-full bg-[#F5E5E2] p-1 text-[#B45151]"
                      onClick={() => handleToggleCollection(collection.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#B9AA9F]" />
              <Input
                placeholder="Search products by name, handle, or tag"
                className="pl-9"
                value={searchTerm}
                onChange={event => handleSearchChange(event.target.value)}
                disabled={mode !== "specific"}
              />
            </div>
            {mode === "specific" && collectionsState.data.length > 0 ? (
              <select
                className="w-48 rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
                value={collectionFilter ?? "all"}
                onChange={event => setCollectionFilter(event.target.value === "all" ? null : event.target.value)}
              >
                <option value="all">All collections</option>
                {collectionsState.data.map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {hasError ? (
            <div className="rounded-xl border border-[#E7B8A4] bg-[#FEF3EF] px-4 py-6 text-center text-sm text-[#9C5837]">
              {hasError}
              <div className="mt-3">
                <Button variant="outline" onClick={() => void fetchCatalog()} className="border-[#E8E4DE]">
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6]">
              <Loader2 className="h-5 w-5 animate-spin text-[#D4A574]" />
            </div>
          ) : null}

          {mode === "collections" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {collectionsState.data.map(collection => {
                const selected = selectedCollectionIds.includes(collection.id);
                return (
                  <button
                    key={collection.id}
                    type="button"
                    className={cn(
                      "flex h-full flex-col gap-2 rounded-2xl border bg-white p-4 text-left transition hover:border-[#D4A574]",
                      selected ? "border-[#D4A574] shadow-lg ring-1 ring-[#D4A574]/30" : "border-[#E8E4DE]",
                    )}
                    onClick={() => handleToggleCollection(collection.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-[#3A3028]">{collection.title}</h4>
                      {selected ? <Check className="h-4 w-4 text-[#4CAF83]" /> : null}
                    </div>
                    {collection.description ? (
                      <p className="line-clamp-3 text-xs text-[#8B7F76]">{collection.description.replace(/<[^>]+>/g, "")}</p>
                    ) : (
                      <p className="text-xs text-[#B9AA9F]">No description</p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {mode === "specific" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredProducts.length === 0 ? (
                <p className="col-span-full rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-4 py-6 text-center text-sm text-[#8B7F76]">
                  {searchTerm
                    ? "No products matched your search query. Try a different keyword."
                    : "No products available. Sync your catalog from Shopify."}
                </p>
              ) : null}
              {filteredProducts.map(product => {
                const selected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleToggleProduct(product.id)}
                    className={cn(
                      "flex h-full gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-[#D4A574]",
                      selected ? "border-[#D4A574] shadow-lg ring-1 ring-[#D4A574]/30" : "border-[#E8E4DE]",
                    )}
                  >
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#FAF3E7]">
                      {product.imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageSrc}
                          alt={product.title}
                          className="h-16 w-16 rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-[#B9AA9F]">No image</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-[#3A3028]">{product.title}</h4>
                          {selected ? <Check className="h-4 w-4 text-[#4CAF83]" /> : null}
                        </div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#B9AA9F]">
                          {product.productType ?? "Product"}
                        </p>
                        {product.vendor ? (
                          <p className="text-xs text-[#8B7F76]">Vendor: {product.vendor}</p>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-[#8B7F76]">
                        <span>
                          Price:{" "}
                          <span className="font-medium text-[#4A4139]">
                            {product.price != null ? `$${product.price.toFixed(2)}` : "—"}
                          </span>
                        </span>
                        <span className="uppercase tracking-[0.2em] text-[#B9AA9F]">{product.status ?? "active"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-[#8B7F76]">
          {mode === "specific"
            ? `${selectedProductIds.length} product${selectedProductIds.length === 1 ? "" : "s"} selected`
            : mode === "collections"
              ? `${selectedCollectionIds.length} collection${selectedCollectionIds.length === 1 ? "" : "s"} selected`
              : "Includes all products"}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-[#D4A574] text-white hover:bg-[#B8835D]"
            onClick={handleConfirm}
            disabled={!canSave || isLoading}
          >
            Save selection
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ProductSelectorModal;


