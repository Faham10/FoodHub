import { useEffect, useState } from 'react'
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import api from '../../services/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import PageLoader from '../../components/PageLoader.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { formatPKR } from '../../utils/format.js'

const blankForm = {
  name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  coupon_code: '',
  minimum_order_amount: '0',
  maximum_discount: '',
  usage_limit: '',
  per_customer_limit: '',
  applicable_product_ids: [],
  applicable_category_ids: [],
  starts_at: '',
  ends_at: '',
  is_active: true,
}

function dateTimeInput(value) {
  if (!value) return ''
  const utcValue = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return new Date(utcValue).toISOString().slice(0, 16)
}

function formFromPromotion(promotion) {
  return {
    ...promotion,
    discount_value: String(promotion.discount_value),
    minimum_order_amount: String(promotion.minimum_order_amount),
    maximum_discount: promotion.maximum_discount == null ? '' : String(promotion.maximum_discount),
    usage_limit: promotion.usage_limit == null ? '' : String(promotion.usage_limit),
    per_customer_limit: promotion.per_customer_limit == null ? '' : String(promotion.per_customer_limit),
    applicable_product_ids: promotion.applicable_product_ids || [],
    applicable_category_ids: promotion.applicable_category_ids || [],
    starts_at: dateTimeInput(promotion.starts_at),
    ends_at: dateTimeInput(promotion.ends_at),
  }
}

function payloadFromForm(form) {
  return {
    ...form,
    discount_value: Number(form.discount_value),
    minimum_order_amount: Number(form.minimum_order_amount || 0),
    maximum_discount: form.maximum_discount ? Number(form.maximum_discount) : null,
    usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
    per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : null,
    coupon_code: form.coupon_code.trim() || null,
    applicable_product_ids: form.applicable_product_ids.map(Number),
    applicable_category_ids: form.applicable_category_ids.map(Number),
    starts_at: form.starts_at ? `${form.starts_at}:00Z` : null,
    ends_at: form.ends_at ? `${form.ends_at}:00Z` : null,
  }
}

export default function AdminPromotions() {
  const { showToast } = useToast()
  const [promotions, setPromotions] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(null)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [promotionResponse, productResponse, categoryResponse] = await Promise.all([
        api.get('/admin/promotions'),
        api.get('/admin/products'),
        api.get('/categories'),
      ])
      setPromotions(promotionResponse.data)
      setProducts(productResponse.data)
      setCategories(categoryResponse.data)
    } catch (error) {
      const message = error.response?.data?.detail || 'Could not load promotions'
      setLoadError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ ...blankForm })
    setShowForm(true)
  }

  const openEdit = (promotion) => {
    setEditing(promotion)
    setForm(formFromPromotion(promotion))
    setShowForm(true)
  }

  const updateMultiSelect = (field, event) => {
    setForm((current) => ({
      ...current,
      [field]: Array.from(event.target.selectedOptions, (option) => Number(option.value)),
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = payloadFromForm(form)
      if (editing) {
        await api.put(`/admin/promotions/${editing.id}`, payload)
      } else {
        await api.post('/admin/promotions', payload)
      }
      showToast(editing ? 'Promotion updated' : 'Promotion created')
      setEditing(null)
      setShowForm(false)
      setForm(blankForm)
      await load()
    } catch (error) {
      showToast(error.response?.data?.detail || 'Could not save promotion', 'error')
    } finally {
      setSaving(false)
    }
  }

  const archive = async () => {
    try {
      await api.delete(`/admin/promotions/${archiving.id}`)
      showToast('Promotion deactivated')
      setArchiving(null)
      await load()
    } catch (error) {
      showToast(error.response?.data?.detail || 'Could not deactivate promotion', 'error')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Deals & Coupons</h1>
          <p className="mt-1 text-sm text-ink-950/50">These offers are limited to your branch.</p>
        </div>
        <button onClick={openNew} className="btn-primary !px-5 !py-2.5 text-sm"><Plus size={16} /> Add promotion</button>
      </div>

      {loadError ? (
        <EmptyState icon={TicketPercent} title="Could not load promotions" message={loadError} action={<button onClick={load} className="btn-outline px-4 py-2">Try again</button>} />
      ) : promotions.length === 0 ? (
        <EmptyState icon={TicketPercent} title="No promotions yet" message="Create an automatic deal or a coupon code for your customers." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {promotions.map((promotion) => (
            <article key={promotion.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{promotion.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${promotion.is_active ? 'bg-green-100 text-green-700' : 'bg-cream-200 text-ink-950/50'}`}>
                      {promotion.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-950/55">{promotion.description || (promotion.coupon_code ? `Coupon: ${promotion.coupon_code}` : 'Automatic deal')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-ember-600">{promotion.discount_type === 'percentage' ? `${promotion.discount_value}% off` : `${formatPKR(promotion.discount_value)} off`}</p>
                  {promotion.coupon_code && <p className="mt-1 text-xs font-semibold tracking-wide">{promotion.coupon_code}</p>}
                </div>
              </div>
              <p className="mt-4 text-xs text-ink-950/50">
                Used {promotion.usage_count}{promotion.usage_limit ? ` / ${promotion.usage_limit}` : ''} times
                {promotion.minimum_order_amount > 0 ? ` · Min. order ${formatPKR(promotion.minimum_order_amount)}` : ''}
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-cream-100 pt-4">
                <button onClick={() => openEdit(promotion)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-950/60 hover:text-ember-600"><Pencil size={15} /> Edit</button>
                {promotion.is_active && <button onClick={() => setArchiving(promotion)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-950/60 hover:text-red-600"><Trash2 size={15} /> Deactivate</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="card mt-6 space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editing ? 'Edit promotion' : 'New promotion'}</h2>
            <button type="button" onClick={() => { setEditing(null); setForm(blankForm); setShowForm(false) }} className="text-sm font-semibold text-ink-950/50 hover:text-ink-950">Close</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label-field">Name</label><input required minLength={2} maxLength={120} className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><label className="label-field">Coupon code <span className="font-normal text-ink-950/40">(blank = automatic deal)</span></label><input maxLength={40} className="input-field uppercase" value={form.coupon_code || ''} onChange={(event) => setForm({ ...form, coupon_code: event.target.value.toUpperCase() })} /></div>
            <div><label className="label-field">Discount type</label><select className="input-field" value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></div>
            <div><label className="label-field">Discount value</label><input required type="number" min="0.01" max={form.discount_type === 'percentage' ? 100 : undefined} step="0.01" className="input-field" value={form.discount_value} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} /></div>
            <div><label className="label-field">Minimum order amount</label><input type="number" min="0" step="0.01" className="input-field" value={form.minimum_order_amount} onChange={(event) => setForm({ ...form, minimum_order_amount: event.target.value })} /></div>
            <div><label className="label-field">Maximum discount <span className="font-normal text-ink-950/40">(optional)</span></label><input type="number" min="0.01" step="0.01" className="input-field" value={form.maximum_discount} onChange={(event) => setForm({ ...form, maximum_discount: event.target.value })} /></div>
            <div><label className="label-field">Total usage limit <span className="font-normal text-ink-950/40">(optional)</span></label><input type="number" min="1" step="1" className="input-field" value={form.usage_limit} onChange={(event) => setForm({ ...form, usage_limit: event.target.value })} /></div>
            <div><label className="label-field">Uses per customer <span className="font-normal text-ink-950/40">(optional)</span></label><input type="number" min="1" step="1" className="input-field" value={form.per_customer_limit} onChange={(event) => setForm({ ...form, per_customer_limit: event.target.value })} /></div>
            <div><label className="label-field">Starts (UTC, optional)</label><input type="datetime-local" className="input-field" value={form.starts_at || ''} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></div>
            <div><label className="label-field">Ends (UTC, optional)</label><input type="datetime-local" className="input-field" value={form.ends_at || ''} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label-field">Description</label><textarea maxLength={2000} className="input-field min-h-20" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div><label className="label-field">Products <span className="font-normal text-ink-950/40">(none = all products)</span></label><select multiple className="input-field min-h-28" value={form.applicable_product_ids.map(String)} onChange={(event) => updateMultiSelect('applicable_product_ids', event)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
            <div><label className="label-field">Categories <span className="font-normal text-ink-950/40">(none = all categories)</span></label><select multiple className="input-field min-h-28" value={form.applicable_category_ids.map(String)} onChange={(event) => updateMultiSelect('applicable_category_ids', event)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active immediately</label>
          </div>
          <button disabled={saving} className="btn-primary !px-6 !py-2.5">{saving ? 'Saving...' : editing ? 'Save changes' : 'Create promotion'}</button>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Deactivate promotion?"
        message={archiving ? `${archiving.name} will no longer apply to new orders. Existing order records will be kept.` : ''}
        confirmLabel="Deactivate"
        onConfirm={archive}
        onCancel={() => setArchiving(null)}
      />
    </div>
  )
}
