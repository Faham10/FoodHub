import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../services/api.js'
import { useAuth } from './AuthContext.jsx'
import { useBranch } from './BranchContext.jsx'

const CartContext = createContext(null)

const emptyCart = { items: [], subtotal: 0, delivery_fee: 0, discount: 0, total: 0 }
const GUEST_CART_KEY = 'foodhub_guest_cart'

function readGuestItems() {
  try {
    const items = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function buildGuestCart(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.effective_price || item.product.price) * item.quantity,
    0,
  )
  return {
    items: items.map((item) => ({
      ...item,
      line_total: Number(item.product.effective_price || item.product.price) * item.quantity,
    })),
    branch_id: items[0]?.branch_id || null,
    subtotal,
    delivery_fee: 0,
    discount: 0,
    total: subtotal,
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth()
  const { branchId } = useBranch()
  const [cart, setCart] = useState(emptyCart)
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshCart = useCallback(async () => {
    if (!user) {
      const guestItems = readGuestItems().filter((item) => String(item.branch_id) === String(branchId))
      setCart(buildGuestCart(guestItems))
      return
    }
    try {
      const res = await api.get('/cart')
      setCart(res.data)
    } catch {
      setCart(emptyCart)
    }
  }, [user, branchId])

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setWishlist([])
      return
    }
    try {
      const res = await api.get('/wishlist')
      setWishlist(res.data)
    } catch {
      setWishlist([])
    }
  }, [user])

  useEffect(() => {
    refreshCart()
    refreshWishlist()
  }, [refreshCart, refreshWishlist])

  const addToCart = async (productId, quantity = 1) => {
    if (!user) {
      if (!branchId) throw new Error('Select a branch before adding items')
      const items = readGuestItems().filter((item) => String(item.branch_id) === String(branchId))
      const existing = items.find((item) => item.product.id === productId)
      if (existing) {
        existing.quantity += quantity
      } else {
        const res = await api.get(`/products/${productId}`, { params: { branch_id: branchId } })
        items.push({
          id: productId,
          product: res.data,
          product_id: productId,
          quantity,
          branch_id: Number(branchId),
        })
      }
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
      setCart(buildGuestCart(items))
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/cart/items', { product_id: productId, quantity, branch_id: Number(branchId) })
      setCart(res.data)
    } finally {
      setLoading(false)
    }
  }

  const updateCartItem = async (itemId, quantity) => {
    if (!user) {
      const items = readGuestItems()
        .filter((item) => String(item.branch_id) === String(branchId))
        .map((item) => item.id === itemId ? { ...item, quantity } : item)
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
      setCart(buildGuestCart(items))
      return
    }
    const res = await api.put(`/cart/items/${itemId}`, { quantity })
    setCart(res.data)
  }

  const removeCartItem = async (itemId) => {
    if (!user) {
      const items = readGuestItems().filter(
        (item) => String(item.branch_id) === String(branchId) && item.id !== itemId,
      )
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
      setCart(buildGuestCart(items))
      return
    }
    const res = await api.delete(`/cart/items/${itemId}`)
    setCart(res.data)
  }

  const clearCart = async () => {
    if (!user) {
      const items = readGuestItems().filter((item) => String(item.branch_id) !== String(branchId))
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
      setCart(buildGuestCart([]))
      return
    }
    const res = await api.delete('/cart')
    setCart(res.data)
  }

  const toggleWishlist = async (productId) => {
    const inWishlist = wishlist.some((w) => w.product.id === productId)
    if (inWishlist) {
      await api.delete(`/wishlist/${productId}`)
      setWishlist((prev) => prev.filter((w) => w.product.id !== productId))
    } else {
      const res = await api.post('/wishlist', { product_id: productId })
      setWishlist((prev) => [...prev, res.data])
    }
  }

  const isWishlisted = (productId) => wishlist.some((w) => w.product.id === productId)

  const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        wishlist,
        loading,
        addToCart,
        updateCartItem,
        removeCartItem,
        clearCart,
        toggleWishlist,
        isWishlisted,
        refreshCart,
        refreshWishlist,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
