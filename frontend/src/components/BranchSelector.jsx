import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useBranch } from '../context/BranchContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import api from '../services/api.js'
import { formatBranchName } from '../utils/branch.js'
import BrandLogo from './BrandLogo.jsx'

const ORDER_TYPES = [
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Pick-Up', label: 'Pick-Up' },
  { value: 'Dine-In', label: 'Dine-In' },
]

export default function BranchSelector() {
  const { branchId, orderType, selectBranch } = useBranch()
  const location = useLocation()
  const { cart, clearCart } = useCart()
  const [branches, setBranches] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState(branchId)
  const [selectedOrderType, setSelectedOrderType] = useState(orderType || 'Delivery')
  const [saving, setSaving] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    let retryTimer
    const loadBranches = async (attempt = 0) => {
      try {
        const res = await api.get('/branches')
        if (!active) return
        setBranches(res.data)
        if (!selectedBranchId && res.data.length === 1) setSelectedBranchId(String(res.data[0].id))
        const activeBranch = res.data.find((branch) => String(branch.id) === String(branchId))
        if (activeBranch && activeBranch.name !== localStorage.getItem('foodhub_branch_name')) {
          selectBranch(activeBranch, orderType || 'Delivery')
        }
        setLoadError('')
      } catch (error) {
        if (!active) return
        if (attempt < 2) {
          retryTimer = setTimeout(() => loadBranches(attempt + 1), 1000 * (attempt + 1))
          return
        }
        console.error('Could not load branches', error)
        setLoadError('Could not connect to locations. Check your connection and try again.')
      }
    }
    loadBranches()
    return () => {
      active = false
      clearTimeout(retryTimer)
    }
  }, [retryCount])

  if (location.pathname.startsWith('/admin')) return null

  const choose = async () => {
    const branch = branches.find((item) => String(item.id) === String(selectedBranchId))
    if (!branch) return

    setSaving(true)
    try {
      if (cart.items.length && String(cart.branch_id) !== String(branch.id)) {
        const confirmed = window.confirm(`Your current cart belongs to ${cart.branch_id ? `Branch ${cart.branch_id}` : 'another branch'}. Clear it and switch to ${formatBranchName(branch.name)}?`)
        if (!confirmed) return
        await clearCart()
      }
      selectBranch(branch, selectedOrderType)
    } finally {
      setSaving(false)
    }
  }

  if (branchId && orderType) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink-950/55 p-4 backdrop-blur-sm sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="order-setup-title" className="my-auto w-full max-w-lg overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
        <div className="flex h-24 items-center justify-center bg-gradient-to-r from-ink-950 via-ink-900 to-ink-950 sm:h-28">
          <BrandLogo className="brand-logo-on-dark h-20" />
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <div className="text-center">
            <h2 id="order-setup-title" className="text-xl font-bold text-ink-950 sm:text-2xl">Select Your Order Type</h2>
            <p className="mt-1 text-sm text-ink-950/55">Choose how you would like to enjoy your meal.</p>
          </div>
          <div className="grid grid-cols-3 rounded-2xl border border-cream-200 bg-cream-100 p-1.5">
            {ORDER_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={selectedOrderType === value}
                onClick={() => setSelectedOrderType(value)}
                className={`rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${selectedOrderType === value ? 'bg-black text-white shadow-md' : 'text-ink-950/55 hover:text-ink-950'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label htmlFor="order-branch" className="flex items-center gap-2 text-sm font-semibold text-ink-950/75">
              <MapPin size={16} className="text-ember-600" /> Please select your location
            </label>
            <select
              id="order-branch"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="input-field bg-white"
            >
              <option value="">Please select your location</option>
              {branches.map((branch) => {
                return (
                  <option key={branch.id} value={branch.id}>
                    {formatBranchName(branch.name)}
                  </option>
                )
              })}
            </select>
          </div>
          {loadError && (
            <div className="flex items-center justify-between gap-3 text-sm text-red-600">
              <p role="alert">{loadError}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="shrink-0 font-bold underline underline-offset-2">
                Retry
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={!selectedBranchId || saving || branches.length === 0}
            onClick={choose}
            className="btn-primary w-full justify-center rounded-2xl py-3.5 disabled:cursor-not-allowed disabled:bg-ink-950/45"
          >
            {saving ? 'Saving...' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  )
}
