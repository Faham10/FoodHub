import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import BrandLogo from '../../components/BrandLogo.jsx'

export default function AdminLogin() {
  const { login, user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user && isAdmin) return <Navigate to="/admin" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedInUser = await login(form.email, form.password)
      if (loggedInUser.role !== 'branch_admin') {
        setError('This account does not have admin access.')
        return
      }
      showToast('Welcome back, Admin!')
      navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="mx-auto mb-4 inline-flex">
            <BrandLogo className="brand-logo-on-dark h-20" />
          </span>
          <h1 className="text-2xl font-semibold text-white">Bismillah Food Admin</h1>
          <p className="text-cream-100/50 text-sm mt-1">Sign in to manage your store</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-7 space-y-5">
          {error && <div className="bg-ember-50 text-ember-700 text-sm font-medium rounded-lg px-4 py-3">{error}</div>}
          <div>
            <label className="label-field">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={17} />
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field !pl-12" placeholder="Admin email address" />
            </div>
          </div>
          <div>
            <label className="label-field">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/35" size={17} />
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field !pl-12" placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  )
}
