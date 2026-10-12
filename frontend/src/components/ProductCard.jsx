import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { formatPKR, discountPercent } from '../utils/format.js'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import ProductImage from './ProductImage.jsx'

export default function ProductCard({ product }) {
  const { addToCart } = useCart()
  const { showToast } = useToast()

  const discount = discountPercent(product.price, product.sale_price)
  const outOfStock = !product.available || product.stock <= 0

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await addToCart(product.id, 1)
      showToast(`${product.name} added to cart`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not add to cart', 'error')
    }
  }

  return (
    <Link to={`/product/${product.id}`} className="group card overflow-hidden flex flex-col h-full hover:shadow-lift transition-shadow">
      <div className="relative aspect-[4/3] overflow-hidden">
        <ProductImage src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-ember-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            -{discount}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 bg-ink-950/50 flex items-center justify-center text-white font-semibold text-sm">
            Out of Stock
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-xs font-semibold text-ember-600 uppercase tracking-wide">{product.category?.name}</span>
        <h3 className="font-semibold text-ink-950 mt-1 mb-2 line-clamp-1">{product.name}</h3>
        <p className="text-sm text-ink-950/55 line-clamp-2 mb-3 flex-1">{product.description}</p>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-ink-950">{formatPKR(product.effective_price)}</span>
            {discount > 0 && <span className="text-xs text-ink-950/40 line-through">{formatPKR(product.price)}</span>}
          </div>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className="w-9 h-9 rounded-full bg-ink-950 text-white flex items-center justify-center hover:bg-ember-500 transition-colors disabled:opacity-40"
            title="Add to cart"
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </Link>
  )
}
