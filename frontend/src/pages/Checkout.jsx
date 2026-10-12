import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Banknote, Bike, Check, Clock3, MapPin, ShieldCheck, ShoppingBag, Store, UtensilsCrossed, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useBranch } from '../context/BranchContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import api, { resolveMediaUrl } from '../services/api.js'
import EmptyState from '../components/EmptyState.jsx'
import { formatPKR } from '../utils/format.js'
import { setActiveGuestOrderToken } from '../utils/guestOrderTracking.js'
import { formatBranchName } from '../utils/branch.js'

export default function Checkout() {
  const { user } = useAuth()
  const { branchId, branchName, orderType } = useBranch()
  const { cart, refreshCart, clearCart } = useCart()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState('')
  const [tableInfo, setTableInfo] = useState('')
  const [instructions, setInstructions] = useState('')
  const [deliveryArea, setDeliveryArea] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [deliverySettings, setDeliverySettings] = useState(null)
  const [promotions, setPromotions] = useState([])
  const [loadingBranchOffers, setLoadingBranchOffers] = useState(false)
  const [branchOffersError, setBranchOffersError] = useState('')
  const [placing, setPlacing] = useState(false)

  const loadBranchOffers = useCallback(async () => {
    setLoadingBranchOffers(true)
    setBranchOffersError('')
    setDeliverySettings(null)
    setPromotions([])
    if (!branchId) {
      setLoadingBranchOffers(false)
      return
    }
    try {
      const [deliveryResult, promotionsResult] = await Promise.allSettled([
        api.get(`/branches/${branchId}/delivery`),
        api.get('/promotions', { params: { branch_id: branchId } }),
      ])
      if (deliveryResult.status === 'rejected') throw deliveryResult.reason
      setDeliverySettings(deliveryResult.value.data)
      if (promotionsResult.status === 'fulfilled') {
        setPromotions(promotionsResult.value.data)
      } else {
        setBranchOffersError('Branch offers could not be loaded. You may still enter a coupon code.')
      }
      setDeliveryArea('')
    } catch (error) {
      setBranchOffersError(error.response?.data?.detail || 'Could not load branch delivery and offer information')
    } finally {
      setLoadingBranchOffers(false)
    }
  }, [branchId])

  useEffect(() => { loadBranchOffers() }, [loadBranchOffers])

  if (cart.items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Add some items to your cart before checking out."
          action={<Link to="/menu" className="btn-primary">Browse Menu</Link>}
        />
      </div>
    )
  }

  const OrderTypeIcon = orderType === 'Delivery' ? Bike : orderType === 'Dine-In' ? UtensilsCrossed : Store
  const getsFreeDelivery = deliverySettings?.free_delivery_threshold != null
    && cart.subtotal >= Number(deliverySettings.free_delivery_threshold)
  const estimatedDeliveryFee = orderType === 'Delivery' && deliverySettings && !getsFreeDelivery
    ? Number(deliverySettings.delivery_fee)
    : 0

  const placeOrder = async (event) => {
    event.preventDefault()
    setPlacing(true)
    try {
      const payload = {
        branch_id: Number(branchId),
        branch_name: branchName,
        order_type: orderType,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        delivery_address: orderType === 'Delivery' ? address.trim() : null,
        delivery_area: orderType === 'Delivery' ? deliveryArea.trim() || null : null,
        coupon_code: couponCode.trim() || null,
        table_info: orderType === 'Dine-In' ? tableInfo.trim() : null,
        instructions: instructions.trim() || null,
        payment_method: 'Cash on Delivery',
        items: cart.items.map((item) => ({
          product_id: item.product_id || item.product.id,
          quantity: item.quantity,
        })),
      }
      const res = await api.post('/orders', payload)
      setActiveGuestOrderToken(res.data.tracking_token, res.data.order_status)
      if (user) await refreshCart()
      else await clearCart()
      showToast('Order placed successfully!')
      navigate(`/order-confirmation/${res.data.id}?token=${encodeURIComponent(res.data.tracking_token)}`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not place order', 'error')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="min-h-[70vh] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-ember-50 via-cream-50 to-white">
      <div className="container-page max-w-6xl py-7 sm:py-10">
        <Link to="/cart" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-950/55 transition hover:text-ember-600">
          <ArrowLeft size={16} /> Back to your cart
        </Link>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-ember-600">One last step</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Let’s make it yours</h1>
            <p className="mt-2 text-sm text-ink-950/55">Share your details and we’ll take care of the rest.</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex" aria-label="Step 2 of 2: checkout">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-500 text-white"><Check size={15} /></span>
            <span className="h-px w-8 bg-ember-300" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">2</span>
            <span className="ml-1 text-xs font-semibold text-ink-950/60">Checkout</span>
          </div>
        </div>

        <form onSubmit={placeOrder} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-8">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[1.75rem] border border-cream-200 bg-white shadow-card">
              <div className="flex items-center gap-4 bg-gradient-to-r from-ink-950 to-ink-800 px-5 py-5 text-white sm:px-7">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-ember-300"><OrderTypeIcon size={22} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Your selected experience</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">{orderType || 'Order'} <span className="font-body text-sm font-medium text-white/50">· {formatBranchName(branchName)}</span></h2>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/80">Step 2 of 2</span>
              </div>
              <div className="space-y-5 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-50 text-ember-600"><UserRound size={17} /></span>
                  <div>
                    <h3 className="font-semibold">Contact details</h3>
                    <p className="text-xs text-ink-950/45">So we can prepare your order and reach you.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="guest-name" className="label-field">Full name</label>
                    <input id="guest-name" required minLength={2} maxLength={120} autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="input-field !rounded-2xl !bg-cream-50/50 !py-3.5 focus:!bg-white" placeholder="e.g. Faham Ahmed" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="guest-phone" className="label-field">Mobile number</label>
                    <input id="guest-phone" required minLength={7} maxLength={30} autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="input-field !rounded-2xl !bg-cream-50/50 !py-3.5 focus:!bg-white" placeholder="03XX XXXXXXX" />
                    <p className="mt-1.5 text-[11px] text-ink-950/40">We’ll use this number for order updates.</p>
                  </div>
                </div>
              </div>
            </section>

            {(orderType === 'Delivery' || orderType === 'Dine-In') && (
              <section className="rounded-[1.75rem] border border-cream-200 bg-white p-5 shadow-card sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-50 text-ember-600"><MapPin size={17} /></span>
                  <div>
                    <h3 className="font-semibold">{orderType === 'Delivery' ? 'Where should we deliver?' : 'Where will you be seated?'}</h3>
                    <p className="text-xs text-ink-950/45">At {formatBranchName(branchName)}</p>
                  </div>
                </div>
                {orderType === 'Delivery' ? (
                  <div className="space-y-4">
                    {branchOffersError && <p role="alert" className="text-sm text-red-700">{branchOffersError} <button type="button" onClick={loadBranchOffers} className="ml-1 font-semibold underline">Retry</button></p>}
                    {deliverySettings && (
                      <>
                        {!deliverySettings.delivery_enabled && <p role="alert" className="text-sm text-red-700">Delivery is unavailable at this branch right now.</p>}
                        {deliverySettings.minimum_order_amount > 0 && <p className="text-xs text-ink-950/50">Delivery minimum: {formatPKR(deliverySettings.minimum_order_amount)}</p>}
                        <div>
                          <label htmlFor="delivery-area" className="label-field">Delivery area</label>
                          {deliverySettings.delivery_areas.length > 0 ? (
                            <select id="delivery-area" required value={deliveryArea} onChange={(event) => setDeliveryArea(event.target.value)} className="input-field">
                              <option value="">Choose a supported area</option>
                              {deliverySettings.delivery_areas.map((area) => <option key={area} value={area}>{area}</option>)}
                            </select>
                          ) : (
                            <input id="delivery-area" maxLength={120} value={deliveryArea} onChange={(event) => setDeliveryArea(event.target.value)} className="input-field" placeholder="Area or neighbourhood" />
                          )}
                        </div>
                      </>
                    )}
                    <div>
                      <label htmlFor="guest-address" className="label-field">Street address</label>
                      <textarea id="guest-address" required maxLength={1000} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} className="input-field min-h-28 resize-y !rounded-2xl !bg-cream-50/50 focus:!bg-white" placeholder="House / flat, street and nearby landmark" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="guest-table" className="label-field">Table or seating information</label>
                    <input id="guest-table" required maxLength={120} value={tableInfo} onChange={(event) => setTableInfo(event.target.value)} className="input-field !rounded-2xl !bg-cream-50/50 !py-3.5 focus:!bg-white" placeholder="Table number or seating preference" />
                  </div>
                )}
              </section>
            )}

            <section className="rounded-[1.75rem] border border-cream-200 bg-white p-5 shadow-card sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-50 text-ember-600"><ShoppingBag size={17} /></span>
                <div>
                  <h3 className="font-semibold">Branch deals & coupon</h3>
                  <p className="text-xs text-ink-950/45">Available offers are checked against your order at checkout.</p>
                </div>
              </div>
              {branchOffersError && orderType !== 'Delivery' && <p role="alert" className="mb-3 text-sm text-red-700">{branchOffersError}</p>}
              {promotions.length > 0 && (
                <div className="mb-4 space-y-2">
                  {promotions.map((promotion) => (
                    <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream-50 px-3 py-2 text-sm">
                      <span><strong>{promotion.name}</strong>{promotion.coupon_code && <span className="ml-2 text-ink-950/50">· {promotion.coupon_code}</span>}</span>
                      <span className="font-semibold text-ember-600">{promotion.discount_type === 'percentage' ? `${promotion.discount_value}% off` : `${formatPKR(promotion.discount_value)} off`}</span>
                      {promotion.coupon_code && <button type="button" onClick={() => setCouponCode(promotion.coupon_code)} className="text-xs font-bold text-ember-600 underline">Use code</button>}
                    </div>
                  ))}
                </div>
              )}
              {loadingBranchOffers && <p className="mb-3 text-xs text-ink-950/45">Loading branch offers...</p>}
              <label htmlFor="coupon-code" className="label-field">Coupon code <span className="font-normal text-ink-950/40">(optional)</span></label>
              <input id="coupon-code" maxLength={40} value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} className="input-field uppercase" placeholder="Enter coupon code" />
              <p className="mt-1.5 text-xs text-ink-950/45">Discounts are validated and calculated securely by the server. The final total may be lower.</p>
            </section>

            <section className="rounded-[1.75rem] border border-cream-200 bg-white p-5 shadow-card sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-50 text-ember-600"><Banknote size={17} /></span>
                <div>
                  <h3 className="font-semibold">Payment & special requests</h3>
                  <p className="text-xs text-ink-950/45">Pay in cash when your order arrives or is ready.</p>
                </div>
              </div>
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-ember-100 bg-ember-50/70 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ember-600 shadow-sm"><Banknote size={20} /></span>
                <div className="flex-1">
                  <p className="text-sm font-bold">Cash on {orderType === 'Delivery' ? 'Delivery' : 'Pickup / at Store'}</p>
                  <p className="mt-0.5 text-xs text-ink-950/50">No online payment needed</p>
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ember-500 text-white"><Check size={13} /></span>
              </div>
              <label htmlFor="guest-instructions" className="label-field">Special instructions <span className="font-normal text-ink-950/40">(optional)</span></label>
              <textarea id="guest-instructions" maxLength={2000} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="input-field min-h-24 resize-y !rounded-2xl !bg-cream-50/50 focus:!bg-white" placeholder="Allergies, spice preference, or anything else we should know?" />
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-[1.75rem] border border-cream-200 bg-white shadow-lift">
              <div className="bg-gradient-to-br from-ink-950 to-ink-800 p-6 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ember-300">Freshly prepared for you</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">Your order</h2>
              </div>
              <div className="max-h-64 divide-y divide-cream-100 overflow-y-auto px-5">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-4">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                      <img src={resolveMediaUrl(item.product.image) || undefined} alt={item.product.name} className="h-full w-full object-cover" />
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-950 px-1 text-[10px] font-bold text-white">{item.quantity}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.product.name}</p>
                      <p className="mt-0.5 text-xs text-ink-950/45">{formatPKR(item.product.effective_price)} each</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">{formatPKR(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-cream-100 p-5">
                <div className="flex justify-between text-sm"><span className="text-ink-950/55">Subtotal</span><span className="font-semibold">{formatPKR(cart.subtotal)}</span></div>
                {orderType === 'Delivery' && <div className="flex justify-between text-sm"><span className="text-ink-950/55">Delivery fee estimate</span><span className="font-semibold">{deliverySettings ? (getsFreeDelivery ? 'Free' : formatPKR(deliverySettings.delivery_fee)) : 'Calculated by branch'}</span></div>}
                <div className="flex items-end justify-between border-t border-dashed border-cream-200 pt-4">
                  <span className="font-semibold">Estimated total</span>
                  <span className="font-display text-2xl font-bold">{formatPKR(cart.subtotal + estimatedDeliveryFee)}</span>
                </div>
                <button type="submit" disabled={placing || !branchId || loadingBranchOffers || (orderType === 'Delivery' && (!deliverySettings || !deliverySettings.delivery_enabled || cart.subtotal < Number(deliverySettings.minimum_order_amount)))} className="btn-primary mt-2 w-full justify-center rounded-2xl py-4 shadow-lift disabled:opacity-50">
                  {placing ? 'Placing your order...' : 'Place my order'} <ArrowLeft className="rotate-180" size={17} />
                </button>
                <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-ink-950/40"><ShieldCheck size={14} className="text-green-600" /> Your details are only used for this order</div>
                {orderType === 'Delivery' && <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-950/40"><Clock3 size={13} /> We’ll bring it fresh to your door</p>}
                <Link to="/cart" className="block pt-1 text-center text-xs font-semibold text-ink-950/50 hover:text-ember-600">← Make changes to your cart</Link>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}
