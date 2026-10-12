import { useState } from 'react'
import { X } from 'lucide-react'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

const empty = { full_name: '', phone: '', address_line: '', area: '', city: '', postal_code: '', instructions: '', is_default: false }

export default function AddressFormModal({ address, onClose, onSaved }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(address ? { ...empty, ...address } : empty)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = address
        ? await api.put(`/addresses/${address.id}`, form)
        : await api.post('/addresses', form)
      showToast(address ? 'Address updated' : 'Address added')
      onSaved(res.data)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save address', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lift max-w-lg w-full p-6 relative my-8">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-ink-950/40 hover:text-ink-950">
          <X size={18} />
        </button>
        <h3 className="text-lg font-semibold mb-5">{address ? 'Edit Address' : 'Add New Address'}</h3>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label-field">Full Name</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Phone</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
        </div>

        <div className="mb-4">
          <label className="label-field">Address</label>
          <input required value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} className="input-field" placeholder="House / Street" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label-field">Area</label>
            <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">City</label>
            <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Postal Code</label>
            <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="input-field" />
          </div>
        </div>

        <div className="mb-4">
          <label className="label-field">Additional Instructions</label>
          <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="input-field" rows={2} placeholder="e.g. Ring the doorbell" />
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer mb-6">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4 rounded accent-ember-500" />
          Set as default address
        </label>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-outline flex-1 py-2.5">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">{saving ? 'Saving...' : 'Save Address'}</button>
        </div>
      </form>
    </div>
  )
}
