import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Minus, Plus, ShoppingCart, ChevronRight, PackageCheck, PackageX, Sparkles } from 'lucide-react'
import api from '../services/api.js'
import { formatPKR, discountPercent } from '../utils/format.js'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import ProductImage from '../components/ProductImage.jsx'
import ProductCard from '../components/ProductCard.jsx'
import PageLoader from '../components/PageLoader.jsx'
import NotFound from './NotFound.jsx'
import { useBranch } from '../context/BranchContext.jsx'

export default function ProductDetails() {
  const { id } = useParams()
  const { branchId } = useBranch()
  const { addToCart } = useCart()
  const { showToast } = useToast()

  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    setNotFound(false)
    setQuantity(1)
    api.get(`/products/${id}`)
      .then((res) => {
        setProduct(res.data)
        return api.get(`/products/${id}/related`)
      })
      .then((res) => setRelated(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, branchId])

  if (loading) return <PageLoader />
  if (notFound || !product) return <NotFound />

  const discount = discountPercent(product.price, product.sale_price)
  const outOfStock = !product.available || product.stock <= 0
  const handleAddToCart = async () => {
    setAdding(true)
    try {
      await addToCart(product.id, quantity)
      showToast(`${quantity} × ${product.name} added to cart`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not add to cart', 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-h-[70vh] bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-ember-50 via-cream-50 to-white">
      <div className="container-page py-7 sm:py-10">
      <div className="mb-7 flex items-center gap-1.5 text-xs font-medium text-ink-950/45 sm:text-sm">
        <Link to="/" className="hover:text-ember-600">Home</Link>
        <ChevronRight size={14} />
        <Link to="/menu" className="hover:text-ember-600">Menu</Link>
        <ChevronRight size={14} />
        <span className="text-ink-950">{product.name}</span>
      </div>

      <div className="mb-16 grid items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="group relative min-h-[320px] overflow-hidden rounded-[2rem] bg-ink-950 shadow-lift sm:min-h-[460px] lg:min-h-[560px]">
          <ProductImage src={product.image} alt={product.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-ink-950/10" />
          {discount > 0 && <span className="absolute left-5 top-5 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold text-ember-600 shadow-card">SAVE {discount}%</span>}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-ember-300">{product.category?.name || 'Bismillah Food favourite'}</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">{product.name}</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">{product.description}</p>
          </div>
        </div>

        <div className="flex flex-col rounded-[2rem] border border-cream-200 bg-white p-5 shadow-card sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ember-600">Fresh from our kitchen</p>
              <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{product.name}</h1>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ember-50 text-ember-500"><Sparkles size={20} /></span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <span className="font-display text-3xl font-bold">{formatPKR(product.effective_price)}</span>
            {discount > 0 && <span className="pb-1 text-sm text-ink-950/35 line-through">{formatPKR(product.price)}</span>}
            {discount > 0 && <span className="mb-1 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">-{discount}%</span>}
          </div>

          <p className="mt-5 text-sm leading-7 text-ink-950/55">{product.description || 'A Bismillah Food favourite, thoughtfully prepared with fresh ingredients and served with care.'}</p>

          <div className="mt-6 flex items-center gap-2 border-y border-cream-100 py-4">
            {outOfStock ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600"><PackageX size={15} /> Currently unavailable</span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700"><PackageCheck size={15} /> Fresh & available</span>
            )}
            <span className="text-xs text-ink-950/35">·</span>
            <span className="text-xs text-ink-950/45">Made to order</span>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-950/45">Quantity</p>
              <div className="flex items-center rounded-full border border-cream-200 bg-cream-50 p-1">
                <button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white hover:text-ember-600 disabled:opacity-30"><Minus size={15} /></button>
                <span className="w-9 text-center text-sm font-bold">{quantity}</span>
                <button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-white hover:bg-ember-500 disabled:opacity-40"><Plus size={15} /></button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-950/40">Your total</p>
              <p className="font-display text-xl font-bold">{formatPKR(product.effective_price * quantity)}</p>
            </div>
          </div>

          <button onClick={handleAddToCart} disabled={outOfStock || adding} className="btn-primary mt-6 w-full justify-center rounded-2xl py-4 shadow-lift disabled:opacity-50">
            <ShoppingCart size={18} /> {adding ? 'Adding to your cart...' : 'Add to Cart'} <span className="ml-auto">{formatPKR(product.effective_price * quantity)}</span>
          </button>
          <p className="mt-3 text-center text-[11px] text-ink-950/40">Freshly prepared · Secure checkout · Branch-specific ordering</p>
        </div>
      </div>

      {related.length > 0 && (
        <div className="pb-6">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ember-600">Complete the feast</p>
          <h2 className="mb-6 font-display text-2xl font-semibold">You might also love</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
