import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatPKR } from '../utils/format.js'
import ProductImage from '../components/ProductImage.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart } = useCart()
  const { showToast } = useToast()

  const moveToCart = async (item) => {
    try {
      await addToCart(item.product.id, 1)
      await toggleWishlist(item.product.id)
      showToast(`${item.product.name} moved to cart`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not move to cart', 'error')
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-semibold mb-8">My Wishlist</h1>
      {wishlist.length === 0 ? (
        <EmptyState icon={Heart} title="Your wishlist is empty" message="Save items you love here so you can find them easily later." action={<Link to="/menu" className="btn-primary">Browse Menu</Link>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {wishlist.map((item) => (
            <div key={item.id} className="card overflow-hidden flex flex-col">
              <Link to={`/product/${item.product.id}`} className="aspect-[4/3] block">
                <ProductImage src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
              </Link>
              <div className="p-4 flex flex-col flex-1">
                <Link to={`/product/${item.product.id}`} className="font-semibold hover:text-ember-600 line-clamp-1">{item.product.name}</Link>
                <span className="font-bold mt-1 mb-4">{formatPKR(item.product.effective_price)}</span>
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => moveToCart(item)} className="btn-primary flex-1 !py-2 text-sm"><ShoppingCart size={14} /> Add to Cart</button>
                  <button onClick={() => toggleWishlist(item.product.id)} className="w-9 h-9 rounded-full border border-cream-200 flex items-center justify-center text-ember-600 hover:bg-ember-50 shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
