import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft, UploadCloud, Loader2 } from 'lucide-react'
import api, { resolveMediaUrl } from '../../services/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import PageLoader from '../../components/PageLoader.jsx'

const empty = {
  name: '', description: '', price: '', sale_price: '', category_id: '', sku: '',
  stock: 0, featured: false, popular: false, available: true, image: '',
}

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [form, setForm] = useState(empty)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api.get(`/products/${id}`).then((res) => {
      const p = res.data
      setForm({
        name: p.name, description: p.description || '', price: p.price, sale_price: p.sale_price || '',
        category_id: p.category_id, sku: p.sku, stock: p.stock, featured: p.featured, popular: p.popular,
        available: p.available, image: p.image || '',
      })
    }).finally(() => setLoading(false))
  }, [id, isEdit])

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)
    try {
      const res = await api.post('/uploads/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm((f) => ({ ...f, image: res.data.url }))
      showToast('Image uploaded')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Image upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      ...form,
      price: parseFloat(form.price),
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      category_id: parseInt(form.category_id, 10),
      stock: parseInt(form.stock, 10),
    }
    try {
      if (isEdit) {
        await api.put(`/products/${id}`, payload)
        showToast('Product updated')
      } else {
        await api.post('/products', payload)
        showToast('Product created')
      }
      navigate('/admin/products')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="max-w-2xl">
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-950/60 hover:text-ember-600 mb-6">
        <ChevronLeft size={16} /> Back to Products
      </Link>
      <h1 className="text-2xl font-semibold mb-6">{isEdit ? 'Edit Product' : 'Add New Product'}</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && <div className="bg-ember-50 text-ember-700 text-sm font-medium rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="label-field">Product Image</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-cream-100 overflow-hidden shrink-0 flex items-center justify-center">
              {form.image ? <img src={resolveMediaUrl(form.image)} alt="" className="w-full h-full object-cover" /> : <UploadCloud className="text-ink-950/30" size={24} />}
            </div>
            <label className="btn-outline !py-2 cursor-pointer text-sm">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {uploading ? 'Uploading...' : 'Upload Image'}
              <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        <div>
          <label className="label-field">Product Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
        </div>

        <div>
          <label className="label-field">Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Price (PKR)</label>
            <input type="number" required min="1" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Sale Price (optional)</label>
            <input type="number" min="0" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input-field" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Category</label>
            <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input-field">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">SKU</label>
            <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field">Stock Quantity</label>
          <input type="number" required min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-field" />
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4 rounded accent-ember-500" /> Featured
          </label>
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={form.popular} onChange={(e) => setForm({ ...form, popular: e.target.checked })} className="w-4 h-4 rounded accent-ember-500" /> Popular
          </label>
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} className="w-4 h-4 rounded accent-ember-500" /> Available
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Link to="/admin/products" className="btn-outline flex-1 py-3 text-center">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary flex-1 py-3">{saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}</button>
        </div>
      </form>
    </div>
  )
}
