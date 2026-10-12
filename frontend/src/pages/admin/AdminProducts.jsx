import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react'
import api from '../../services/api.js'
import { formatPKR } from '../../utils/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import PageLoader from '../../components/PageLoader.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import ProductImage from '../../components/ProductImage.jsx'
import { useDebounce } from '../../hooks/useDebounce.js'

export default function AdminProducts() {
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [deleting, setDeleting] = useState(null)
  const debouncedSearch = useDebounce(search, 400)

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data))
  }, [])

  const load = () => {
    setLoading(true)
    const params = { page_size: 100 }
    if (debouncedSearch) params.search = debouncedSearch
    if (categoryFilter) params.category_id = categoryFilter
    api.get('/products', { params }).then((res) => setProducts(res.data.items)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [debouncedSearch, categoryFilter])

  const handleDelete = async () => {
    try {
      await api.delete(`/products/${deleting.id}`)
      showToast('Product deleted')
      load()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not delete product', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const toggleAvailable = async (product) => {
    await api.put(`/products/${product.id}`, { available: !product.available })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link to="/admin/products/new" className="btn-primary !px-5 !py-2.5 text-sm"><Plus size={16} /> Add Product</Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="input-field !pl-12 !py-2.5 bg-white" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field !py-2.5 max-w-[200px] bg-white">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <PageLoader />
      ) : products.length === 0 ? (
        <EmptyState icon={Package} title="No products found" message="Try adjusting your search or add a new product." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-ink-950/45 border-b border-cream-200">
                <th className="p-4 font-semibold">Product</th>
                <th className="p-4 font-semibold">Category</th>
                <th className="p-4 font-semibold">Price</th>
                <th className="p-4 font-semibold">Stock</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-cream-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                        <ProductImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate max-w-[180px]">{p.name}</div>
                        <div className="text-xs text-ink-950/40">{p.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-ink-950/60">{p.category?.name}</td>
                  <td className="p-4">
                    <div className="font-semibold">{formatPKR(p.effective_price)}</div>
                    {p.sale_price && <div className="text-xs text-ink-950/40 line-through">{formatPKR(p.price)}</div>}
                  </td>
                  <td className="p-4">
                    <span className={p.stock === 0 ? 'text-ember-600 font-semibold' : ''}>{p.stock}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleAvailable(p)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.available ? 'bg-green-100 text-green-700' : 'bg-cream-200 text-ink-950/50'}`}>
                      {p.available ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-3">
                      <Link to={`/admin/products/${p.id}/edit`} className="text-ink-950/50 hover:text-ember-600"><Pencil size={16} /></Link>
                      <button onClick={() => setDeleting(p)} className="text-ink-950/50 hover:text-ember-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete "${deleting?.name}"?`}
        message="This will permanently remove the product. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
