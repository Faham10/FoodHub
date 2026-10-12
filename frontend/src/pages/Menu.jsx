import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../services/api.js'
import ProductCard from '../components/ProductCard.jsx'
import ProductCardSkeleton from '../components/ProductCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { PackageSearch } from 'lucide-react'
import { useBranch } from '../context/BranchContext.jsx'

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
]

export default function Menu() {
  const { branchId } = useBranch()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const categorySlug = searchParams.get('category') || ''
  const sort = searchParams.get('sort') || ''
  const minPrice = searchParams.get('min_price') || ''
  const maxPrice = searchParams.get('max_price') || ''
  const availableOnly = searchParams.get('available_only') === 'true'
  const page = parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    if (!branchId) return
    api.get('/categories', { params: { active_only: true } }).then((res) => setCategories(res.data))
  }, [branchId])

  const load = useCallback(() => {
    if (!branchId) return
    setLoading(true)
    const params = { page, page_size: 12, sort: sort || undefined }
    if (categorySlug) params.category_slug = categorySlug
    if (minPrice) params.min_price = minPrice
    if (maxPrice) params.max_price = maxPrice
    if (availableOnly) params.available_only = true

    api
      .get('/products', { params })
      .then((res) => {
        setProducts(res.data.items)
        setMeta(res.data)
      })
      .finally(() => setLoading(false))
  }, [branchId, categorySlug, sort, minPrice, maxPrice, availableOnly, page])

  useEffect(() => { load() }, [load])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value === '' || value === undefined || value === false) next.delete(key)
    else next.set(key, value)
    next.delete('page')
    setSearchParams(next)
  }

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', p)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeCategory = categories.find((c) => c.slug === categorySlug)

  const FiltersPanel = (
    <div className="space-y-7">
      <div>
        <h4 className="font-semibold text-sm mb-3">Category</h4>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => updateParam('category', '')}
            className={`text-left px-3 py-2 rounded-lg text-sm ${!categorySlug ? 'bg-ember-500 text-white font-semibold' : 'hover:bg-cream-100'}`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => updateParam('category', c.slug)}
              className={`text-left px-3 py-2 rounded-lg text-sm flex justify-between ${categorySlug === c.slug ? 'bg-ember-500 text-white font-semibold' : 'hover:bg-cream-100'}`}
            >
              <span>{c.name}</span>
              <span className={categorySlug === c.slug ? 'text-white/70' : 'text-ink-950/40'}>{c.product_count}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-3">Price Range (PKR)</h4>
        <div className="flex items-center gap-2">
          <input type="number" placeholder="Min" defaultValue={minPrice} onBlur={(e) => updateParam('min_price', e.target.value)} className="input-field !py-2 text-sm" />
          <span className="text-ink-950/40">—</span>
          <input type="number" placeholder="Max" defaultValue={maxPrice} onBlur={(e) => updateParam('max_price', e.target.value)} className="input-field !py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={availableOnly} onChange={(e) => updateParam('available_only', e.target.checked)} className="w-4 h-4 rounded accent-ember-500" />
          In Stock Only
        </label>
      </div>

      {(categorySlug || minPrice || maxPrice || availableOnly) && (
        <button onClick={() => setSearchParams({})} className="text-sm font-semibold text-ember-600 hover:underline">
          Clear All Filters
        </button>
      )}
    </div>
  )

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{activeCategory ? activeCategory.name : 'Our Full Menu'}</h1>
        <p className="text-ink-950/55 mt-1">{meta.total} items available</p>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden lg:block">{FiltersPanel}</aside>

        <div>
          <div className="flex items-center justify-between mb-6 gap-3">
            <button onClick={() => setFiltersOpen(true)} className="lg:hidden btn-outline !px-4 !py-2 text-sm">
              <SlidersHorizontal size={15} /> Filters
            </button>
            <select value={sort} onChange={(e) => updateParam('sort', e.target.value)} className="input-field !py-2 text-sm max-w-[200px] ml-auto">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No products found" message="Try adjusting your filters or check back later." />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {meta.total_pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button disabled={page <= 1} onClick={() => goToPage(page - 1)} className="w-9 h-9 rounded-full border border-cream-200 flex items-center justify-center disabled:opacity-30 hover:bg-cream-100">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: meta.total_pages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToPage(i + 1)}
                      className={`w-9 h-9 rounded-full text-sm font-semibold ${page === i + 1 ? 'bg-ember-500 text-white' : 'border border-cream-200 hover:bg-cream-100'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button disabled={page >= meta.total_pages} onClick={() => goToPage(page + 1)} className="w-9 h-9 rounded-full border border-cream-200 flex items-center justify-center disabled:opacity-30 hover:bg-cream-100">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="font-display font-bold text-lg">Filters</span>
              <button onClick={() => setFiltersOpen(false)}><X size={20} /></button>
            </div>
            {FiltersPanel}
          </div>
        </div>
      )}
    </div>
  )
}
