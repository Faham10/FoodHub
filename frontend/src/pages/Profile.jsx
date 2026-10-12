import { useState } from 'react'
import { User, Phone, Mail, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(form)
      showToast('Profile updated successfully')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-page py-10 max-w-xl">
      <h1 className="text-3xl font-semibold mb-8">Profile Settings</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label-field">Full Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={17} />
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field !pl-12" />
          </div>
        </div>
        <div>
          <label className="label-field">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={17} />
            <input disabled value={user.email} className="input-field !pl-12 bg-cream-100 text-ink-950/50 cursor-not-allowed" />
          </div>
          <p className="text-xs text-ink-950/40 mt-1.5">Email address cannot be changed.</p>
        </div>
        <div>
          <label className="label-field">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={17} />
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field !pl-12" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary py-3 px-8"><Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}</button>
      </form>
    </div>
  )
}
