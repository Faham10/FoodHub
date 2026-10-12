import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bike, Clock3, MapPin, Minus, Plus, ShoppingBag, Sparkles, Store, Trash2, UtensilsCrossed } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatPKR } from '../utils/format.js'
import { useBranch } from '../context/BranchContext.jsx'
import ProductImage from '../components/ProductImage.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { formatBranchName } from '../utils/branch.js'

export default function Cart() {
  const { cart, updateCartItem, removeCartItem, clearCart } = useCart()
  const { branchName, orderType } = useBranch()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [confirmClear, setConfirmClear] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const changeQty = async (item, delta) => {
    const next = item.quantity + delta
    if (next < 1) return
    setBusyId(item.id)
    try {
      await updateCartItem(item.id, next)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update quantity', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const removeItem = async (item) => {
    setBusyId(item.id)
    try {
      await removeCartItem(item.id)
      showToast(`${item.product.name} removed from cart`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not remove item', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleClear = async () => {
    try {
      await clearCart()
      setConfirmClear(false)
      showToast('Cart cleared')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not clear cart', 'error')
    }
  }

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  if (cart.items.length === 0) {
    return (
      <div className="container-page py-12 sm:py-20">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-white bg-gradient-to-br from-white via-cream-50 to-ember-50 px-6 py-12 text-center shadow-lift sm:px-12">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-ember-100 text-ember-600"><ShoppingBag size={28} /></span>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-ember-600">A little something delicious?</p>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Your cart is waiting</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-950/55">Explore the menu and add your favourites. We’ll have them freshly prepared for you.</p>
          <Link to="/menu" className="btn-primary mt-7 px-7 py-3.5">Explore the Menu <ArrowRight size={17} /></Link>
        </div>
      </div>
    )
  }

  const serviceIcon = orderType === 'Delivery' ? Bike : orderType === 'Dine-In' ? UtensilsCrossed : Store

  return (
    <div className="min-h-[70vh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-ember-50 via-cream-50 to-white">
      <div className="container-page py-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-ember-600">Made fresh, just for you</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your Cart <span className="font-body text-base font-medium text-ink-950/40">({totalItems} {totalItems === 1 ? 'item' : 'items'})</span></h1>
          </div>
          <Link to="/menu" className="btn-ghost text-sm"><Sparkles size={16} className="text-ember-500" /> Add more favourites</Link>
        </div>

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-8">
          <section className="min-w-0 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-ember-100 bg-white/80 p-4 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-50 text-ember-600"><MapPin size={19} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-950/40">Your order from</p>
                <p className="mt-0.5 truncate font-semibold">{formatBranchName(branchName)}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-bold text-ink-950/70">
                {orderType === 'Delivery' ? <Bike size={14} /> : orderType === 'Dine-In' ? <UtensilsCrossed size={14} /> : <Store size={14} />}
                {orderType || 'Order'}
              </span>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-cream-200 bg-white shadow-card">
              <div className="divide-y divide-cream-100">
                {cart.items.map((item) => (
                  <article key={item.id} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 p-3 sm:flex sm:gap-5 sm:p-5">
                    <Link to={`/product/${item.product.id}`} className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-cream-100 ring-1 ring-black/5 sm:h-28 sm:w-28">
                      <ProductImage src={item.product.image} alt={item.product.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                    </Link>
                    <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-1 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ember-600">{item.product.category?.name || 'Bismillah Food favourite'}</p>
                        <Link to={`/product/${item.product.id}`} className="mt-1 block break-words font-display text-base font-semibold leading-snug hover:text-ember-600 sm:truncate sm:text-lg">{item.product.name}</Link>
                        <p className="mt-1 text-sm text-ink-950/50">{formatPKR(item.product.effective_price)} <span className="text-xs">each</span></p>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
                        <div className="flex items-center rounded-full border border-cream-200 bg-cream-50 p-1">
                          <button aria-label={`Decrease ${item.product.name} quantity`} disabled={busyId === item.id || item.quantity <= 1} onClick={() => changeQty(item, -1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-950/60 transition hover:bg-white hover:text-ember-600 disabled:opacity-30"><Minus size={14} /></button>
                          <span className="min-w-8 text-center text-sm font-bold">{item.quantity}</span>
                          <button aria-label={`Increase ${item.product.name} quantity`} disabled={busyId === item.id} onClick={() => changeQty(item, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-white transition hover:bg-ember-500 disabled:opacity-40"><Plus size={14} /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold sm:text-base">{formatPKR(item.line_total)}</span>
                          <button aria-label={`Remove ${item.product.name}`} disabled={busyId === item.id} onClick={() => removeItem(item)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-950/35 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-100 bg-cream-50/70 px-4 py-4 sm:px-5">
                <p className="text-xs text-ink-950/45">Good food is always worth sharing.</p>
                <button onClick={() => setConfirmClear(true)} className="text-xs font-bold text-ink-950/45 transition hover:text-red-600">Clear cart</button>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-ink-950 px-5 py-4 text-white shadow-card">
              <Clock3 size={19} className="shrink-0 text-ember-300" />
              <p className="text-xs leading-5 text-white/75">Freshly prepared with care. {orderType === 'Delivery' ? 'We’ll bring your order right to your door.' : 'Your branch will have your order ready shortly.'}</p>
            </div>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-[1.75rem] border border-cream-200 bg-white shadow-lift">
              <div className="bg-gradient-to-br from-ink-950 to-ink-800 p-4 text-white sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ember-300">Almost there</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">Order summary</h2>
                <p className="mt-1 text-xs text-white/50">{totalItems} delicious {totalItems === 1 ? 'item' : 'items'}</p>
              </div>
              <div className="min-w-0 space-y-4 p-4 sm:p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex min-w-0 justify-between gap-3"><span className="text-ink-950/55">Subtotal</span><span className="shrink-0 font-semibold">{formatPKR(cart.subtotal)}</span></div>
                  {orderType === 'Delivery' && <div className="flex min-w-0 justify-between gap-3"><span className="text-ink-950/55">Delivery fee</span><span className="shrink-0 font-semibold">Calculated at checkout</span></div>}
                </div>
                <div className="border-t border-dashed border-cream-200 pt-4">
                  <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold">Items subtotal</span>
                    <span className="font-display text-xl font-bold sm:text-2xl">{formatPKR(cart.total)}</span>
                  </div>
                  <p className="mt-1 break-words text-right text-[11px] text-ink-950/40">Inclusive of applicable charges</p>
                </div>
                <button onClick={() => navigate('/checkout')} className="btn-primary w-full min-w-0 justify-center rounded-2xl px-3 py-4 text-center shadow-lift sm:px-6">
                  <span>Continue to checkout</span> <ArrowRight className="shrink-0" size={17} />
                </button>
                <p className="break-words text-center text-[11px] text-ink-950/40">{orderType === 'Delivery' ? 'Branch delivery charges and offers are confirmed at checkout.' : `Serving ${formatBranchName(branchName)}`}</p>
                <Link to="/menu" className="block text-center text-xs font-semibold text-ink-950/55 transition hover:text-ember-600">← Continue browsing</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear your cart?"
        message="This will remove all items from your cart. This action cannot be undone."
        confirmLabel="Clear Cart"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
