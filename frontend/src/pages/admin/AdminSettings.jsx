import { useCallback, useEffect, useState } from 'react'
import { Save, ShieldCheck, Truck } from 'lucide-react'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function AdminSettings() {
  const { user, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone })
  const [saving, setSaving] = useState(false)
  const [delivery, setDelivery] = useState(null)
  const [deliveryAreas, setDeliveryAreas] = useState('')
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [deliveryLoadError, setDeliveryLoadError] = useState('')

  const loadDelivery = useCallback(async () => {
    setDeliveryLoadError('')
    try {
      const response = await api.get('/admin/delivery-settings')
      setDelivery(response.data)
      setDeliveryAreas(response.data.delivery_areas.join(', '))
    } catch (error) {
      const message = error.response?.data?.detail || 'Could not load delivery settings'
      setDeliveryLoadError(message)
      showToast(message, 'error')
    }
  }, [showToast])

  useEffect(() => { loadDelivery() }, [loadDelivery])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(form)
      showToast('Admin profile updated')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveDelivery = async (event) => {
    event.preventDefault()
    setSavingDelivery(true)
    try {
      const areas = deliveryAreas.split(',').map((area) => area.trim()).filter(Boolean)
      const response = await api.put('/admin/delivery-settings', {
        ...delivery,
        delivery_fee: Number(delivery.delivery_fee),
        minimum_order_amount: Number(delivery.minimum_order_amount),
        free_delivery_threshold: delivery.free_delivery_threshold === '' || delivery.free_delivery_threshold == null
          ? null
          : Number(delivery.free_delivery_threshold),
        delivery_areas: areas,
      })
      setDelivery(response.data)
      setDeliveryAreas(response.data.delivery_areas.join(', '))
      showToast('Branch delivery settings saved')
    } catch (error) {
      showToast(error.response?.data?.detail || 'Could not save delivery settings', 'error')
    } finally {
      setSavingDelivery(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <ShieldCheck className="text-ember-600" size={20} />
          <h2 className="font-semibold">Admin Profile</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Full Name</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Email</label>
            <input disabled value={user.email} className="input-field bg-cream-100 text-ink-950/50" />
          </div>
          <div>
            <label className="label-field">Phone</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6"><Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Truck className="text-ember-600" size={20} />
          <div>
            <h2 className="font-semibold">Delivery for your branch only</h2>
            <p className="text-xs text-ink-950/45 mt-0.5">Changes do not affect the other branch.</p>
          </div>
        </div>
        {delivery ? (
          <form onSubmit={saveDelivery} className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={delivery.delivery_enabled} onChange={(event) => setDelivery({ ...delivery, delivery_enabled: event.target.checked })} />
              Accept delivery orders
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label-field">Delivery charge (PKR)</label><input required type="number" min="0" step="0.01" className="input-field" value={delivery.delivery_fee} onChange={(event) => setDelivery({ ...delivery, delivery_fee: event.target.value })} /></div>
              <div><label className="label-field">Free delivery above (PKR)</label><input type="number" min="0" step="0.01" className="input-field" placeholder="No free delivery" value={delivery.free_delivery_threshold ?? ''} onChange={(event) => setDelivery({ ...delivery, free_delivery_threshold: event.target.value })} /></div>
              <div><label className="label-field">Minimum order (PKR)</label><input required type="number" min="0" step="0.01" className="input-field" value={delivery.minimum_order_amount} onChange={(event) => setDelivery({ ...delivery, minimum_order_amount: event.target.value })} /></div>
            </div>
            <div>
              <label className="label-field">Delivery areas</label>
              <input className="input-field" value={deliveryAreas} onChange={(event) => setDeliveryAreas(event.target.value)} placeholder="Korangi, Landhi, Shah Faisal" />
              <p className="mt-1 text-xs text-ink-950/45">Separate areas with commas. Leave blank to accept addresses from any area.</p>
            </div>
            <button type="submit" disabled={savingDelivery} className="btn-primary py-2.5 px-6"><Save size={15} /> {savingDelivery ? 'Saving...' : 'Save delivery settings'}</button>
          </form>
        ) : deliveryLoadError ? (
          <p role="alert" className="text-sm text-red-700">{deliveryLoadError} <button type="button" onClick={loadDelivery} className="ml-1 font-semibold underline">Retry</button></p>
        ) : (
          <p role="status" className="text-sm text-ink-950/50">Loading branch delivery settings...</p>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">About This Panel</h2>
        <p className="text-sm text-ink-950/55 leading-relaxed">
          Bismillah Food Admin Panel v1.0 — manage products, categories, and orders from one place.
          All data is stored securely in PostgreSQL and every action is protected by role-based authentication.
        </p>
      </div>
    </div>
  )
}
