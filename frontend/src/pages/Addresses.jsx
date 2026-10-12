import { useEffect, useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, Star } from 'lucide-react'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PageLoader from '../components/PageLoader.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import AddressFormModal from '../components/AddressFormModal.jsx'

export default function Addresses() {
  const { showToast } = useToast()
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = () => {
    api.get('/addresses').then((res) => setAddresses(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    try {
      await api.delete(`/addresses/${deleting.id}`)
      showToast('Address deleted')
      load()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not delete address', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const setDefault = async (addr) => {
    await api.put(`/addresses/${addr.id}`, { is_default: true })
    load()
    showToast('Default address updated')
  }

  if (loading) return <PageLoader />

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">My Addresses</h1>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary !px-5 !py-2.5 text-sm"><Plus size={16} /> Add Address</button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="No saved addresses" message="Add a delivery address to make checkout faster." action={<button onClick={() => setShowForm(true)} className="btn-primary">Add Address</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {addresses.map((addr) => (
            <div key={addr.id} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{addr.full_name}</span>
                {addr.is_default && <span className="text-[10px] font-bold bg-ink-950 text-white px-2 py-0.5 rounded-full">DEFAULT</span>}
              </div>
              <p className="text-sm text-ink-950/60 mb-1">{addr.address_line}, {addr.area}, {addr.city} {addr.postal_code}</p>
              <p className="text-sm text-ink-950/50 mb-4">{addr.phone}</p>
              {addr.instructions && <p className="text-xs text-ink-950/40 mb-4">Note: {addr.instructions}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                {!addr.is_default && (
                  <button onClick={() => setDefault(addr)} className="text-xs font-semibold text-ember-600 flex items-center gap-1 hover:underline">
                    <Star size={12} /> Set Default
                  </button>
                )}
                <button onClick={() => { setEditing(addr); setShowForm(true) }} className="ml-auto text-ink-950/50 hover:text-ember-600"><Pencil size={15} /></button>
                <button onClick={() => setDeleting(addr)} className="text-ink-950/50 hover:text-ember-600"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AddressFormModal
          address={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this address?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
