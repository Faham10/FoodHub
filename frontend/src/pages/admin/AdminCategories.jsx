import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tags, X } from 'lucide-react'
import api from '../../services/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import PageLoader from '../../components/PageLoader.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

export default function AdminCategories() {
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', is_active: true })
  const [deleting, setDeleting] = useState(null)
  const [replacementCategoryId, setReplacementCategoryId] = useState('')
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(null)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await api.get('/categories')
      setCategories(res.data)
    } catch (err) {
      const message = err.response?.data?.detail || 'Could not load categories'
      setLoadError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ name: '', is_active: true }); setShowForm(true) }
  const openEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, is_active: cat.is_active }); setShowForm(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, form)
        showToast('Category updated')
      } else {
        await api.post('/categories', form)
        showToast('Category created')
      }
      setShowForm(false)
      load()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save category', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (category) => {
    setDeleting(category)
    setReplacementCategoryId('')
  }

  const handleDelete = async () => {
    if (deleting?.product_count > 0 && !replacementCategoryId) {
      showToast('Choose another category for these products first', 'error')
      return
    }

    setDeletingCategory(true)
    try {
      await api.delete(`/categories/${deleting.id}`, {
        params: replacementCategoryId
          ? { replacement_category_id: Number(replacementCategoryId) }
          : undefined,
      })
      showToast('Category deleted')
      setDeleting(null)
      await load()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not delete category', 'error')
    } finally {
      setDeletingCategory(false)
    }
  }

  const toggleActive = async (cat) => {
    setUpdatingStatus(cat.id)
    try {
      const res = await api.put(`/categories/${cat.id}`, { is_active: !cat.is_active })
      setCategories((current) => current.map((category) => category.id === cat.id ? res.data : category))
      showToast(`Category ${res.data.is_active ? 'activated' : 'deactivated'}`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update category status', 'error')
    } finally {
      setUpdatingStatus(null)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <button onClick={openNew} className="btn-primary !px-5 !py-2.5 text-sm"><Plus size={16} /> Add Category</button>
      </div>

      {loadError ? (
        <EmptyState icon={Tags} title="Could not load categories" message={loadError} action={<button onClick={load} className="btn-outline px-4 py-2">Try again</button>} />
      ) : categories.length === 0 ? (
        <EmptyState icon={Tags} title="No categories yet" message="Add your first category to start organizing products." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold" title={cat.branch_id === null ? 'Changes apply to both branches' : undefined}>{cat.name}{cat.branch_id === null && <span className="ml-2 text-xs font-medium text-ink-950/45">Shared</span>}</span>
                <button onClick={() => toggleActive(cat)} disabled={updatingStatus === cat.id} aria-label={`${cat.is_active ? 'Deactivate' : 'Activate'} ${cat.name}`} className={`text-xs font-bold px-2.5 py-1 rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-cream-200 text-ink-950/50'} disabled:cursor-wait disabled:opacity-60`}>
                  {updatingStatus === cat.id ? 'Saving...' : cat.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <p className="text-sm text-ink-950/50 mb-4">{cat.product_count} products</p>
              <div className="flex items-center gap-3">
                <button onClick={() => openEdit(cat)} aria-label={`Edit ${cat.name}`} title="Edit category" className="text-ink-950/50 hover:text-ember-600"><Pencil size={16} /></button>
                <button onClick={() => openDelete(cat)} aria-label={`Delete ${cat.name}`} title="Delete category" className="text-ink-950/50 hover:text-ember-600"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lift max-w-sm w-full p-6 relative">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-950/40 hover:text-ink-950"><X size={18} /></button>
            <h3 className="text-lg font-semibold mb-5">{editing ? 'Edit Category' : 'Add Category'}</h3>
            <label className="label-field">Category Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field mb-4" />
            <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer mb-6">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-ember-500" />
              Active
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1 py-2.5">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {deleting?.product_count > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-lift max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Move products before deleting?</h3>
            <p className="text-sm text-ink-950/60 mb-4">
              Choose a category for these {deleting.product_count} products. They will be moved before "{deleting.name}" is deleted.
            </p>
            <label className="label-field" htmlFor="replacement-category">Move products to</label>
            <select
              id="replacement-category"
              value={replacementCategoryId}
              onChange={(event) => setReplacementCategoryId(event.target.value)}
              className="input-field mb-5"
            >
              <option value="">Select a category</option>
              {categories.filter((category) => category.id !== deleting.id).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {categories.filter((category) => category.id !== deleting.id).length === 0 && (
              <p className="text-sm text-red-600 mb-4">Create another category first, then move these products.</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleting(null)} disabled={deletingCategory} className="btn-outline flex-1 py-2.5">Cancel</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingCategory || !replacementCategoryId}
                className="btn-primary flex-1 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingCategory ? 'Deleting...' : 'Move & Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmDialog
          open={!!deleting}
          title={`Delete "${deleting?.name}"?`}
          message="This category has no products and can be safely deleted."
          confirmLabel={deletingCategory ? 'Deleting...' : 'Delete'}
          busy={deletingCategory}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
