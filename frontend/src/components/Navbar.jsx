import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { History, Search, ShoppingCart, Menu as MenuIcon, X } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import api from '../services/api.js'
import ProductImage from './ProductImage.jsx'
import { formatPKR } from '../utils/format.js'
import { useBranch } from '../context/BranchContext.jsx'
import GuestOrderWidget from './GuestOrderWidget.jsx'
import { getGuestOrderTokens, subscribeToActiveGuestOrder } from '../utils/guestOrderTracking.js'
import { formatBranchName } from '../utils/branch.js'
import BrandLogo from './BrandLogo.jsx'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/categories', label: 'Categories' },
  { to: '/menu?category=deals', label: 'Deals' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const { cartCount, clearCart } = useCart()
  const { branchId, branchName, orderType, clearBranch } = useBranch()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [guestOrderCount, setGuestOrderCount] = useState(() => getGuestOrderTokens().length)
  const navigate = useNavigate()

  useEffect(() => {
    const updateOrderCount = () => setGuestOrderCount(getGuestOrderTokens().length)
    return subscribeToActiveGuestOrder(updateOrderCount)
  }, [])

  useEffect(() => {
    const term = searchTerm.trim()
    if (!branchId || term.length < 2) {
      setSuggestions([])
      return undefined
    }

    const timer = setTimeout(() => {
      api.get('/products', { params: { search: term, page_size: 5 } })
        .then((res) => {
          const normalizedTerm = term.toLowerCase()
          const items = (res.data.items || []).filter((product) => {
            const name = product.name?.toLowerCase() || ''
            const category = product.category?.name?.toLowerCase() || ''
            return name.includes(normalizedTerm) || category.includes(normalizedTerm)
          })
          setSuggestions(items.slice(0, 5))
        })
        .catch((err) => {
          console.error('Could not load search suggestions', err)
          setSuggestions([])
        })
    }, 250)

    return () => clearTimeout(timer)
  }, [branchId, searchTerm])

  const submitSearch = (e) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`)
      setSearchOpen(false)
      setSearchTerm('')
      setSuggestions([])
      setMobileOpen(false)
    }
  }

  const changeBranch = async () => {
    if (cartCount && !window.confirm('Your current cart will be cleared when switching branches. Continue?')) return
    if (cartCount) {
      await clearCart()
    }
    clearBranch()
  }

  return (
    <header className="no-print relative sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-cream-200">
      <div className="container-page flex h-auto min-h-[64px] flex-wrap items-center justify-between gap-1 py-2 sm:h-[72px] sm:flex-nowrap sm:gap-2 sm:py-0 xl:gap-4">
        <Link to="/" aria-label="Bismillah Food home" className="-ml-2 flex shrink-0 items-center">
          <BrandLogo className="navbar-brand-logo h-12 sm:h-[60px]" />
        </Link>

        <nav className="hidden lg:flex shrink-0 items-center gap-0.5 xl:gap-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-2 py-2 text-sm font-semibold transition-colors xl:px-2.5 ${
                  isActive && link.to === '/' ? 'text-ember-600' : 'text-ink-950/70 hover:text-ember-600'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex w-full flex-wrap items-center justify-between gap-1 sm:w-auto sm:flex-nowrap sm:shrink-0 xl:gap-1.5">
          <button type="button" onClick={changeBranch} className="order-1 flex w-full justify-center whitespace-nowrap rounded-full px-1.5 py-1 text-[11px] font-bold text-ember-700 transition-colors hover:bg-ember-50 sm:order-none sm:w-auto sm:shrink-0 sm:inline-flex xl:px-2 xl:text-xs">
            {branchName ? `${formatBranchName(branchName)} · ${orderType}` : 'Choose branch'}
          </button>
          <div className="order-2 flex w-full items-center justify-between gap-1 sm:order-none sm:w-auto sm:justify-start sm:gap-1 xl:gap-1.5">
          <div className="relative">
            {searchOpen ? (
              <form onSubmit={submitSearch} className="relative flex items-center">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onBlur={() => setTimeout(() => !searchTerm && setSearchOpen(false), 150)}
                  placeholder="Search for food..."
                  className="w-[min(13rem,calc(100vw-2rem))] rounded-full border border-cream-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember-400 sm:w-52"
                />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-xl border border-cream-200 bg-white p-1.5 shadow-lift">
                    {suggestions.map((product) => (
                      <Link
                        key={product.id}
                        to={`/product/${product.id}`}
                        onClick={() => {
                          setSuggestions([])
                          setSearchOpen(false)
                          setSearchTerm('')
                        }}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-cream-100"
                      >
                        <ProductImage
                          src={product.image}
                          alt=""
                          className="w-11 h-11 shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink-950">{product.name}</span>
                          <span className="block truncate text-xs text-ink-950/50">{formatPKR(product.effective_price)}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </form>
            ) : (
            <button onClick={() => setSearchOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-950 hover:bg-cream-200 sm:h-10 sm:w-10">
                <Search size={19} />
              </button>
            )}
          </div>

          <GuestOrderWidget />

          <Link
            to="/my-orders"
            aria-label={`Order history, ${guestOrderCount} ${guestOrderCount === 1 ? 'order' : 'orders'}`}
            title="Order history"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-950 transition hover:bg-cream-100 hover:text-ember-600 sm:h-10 sm:w-10"
          >
            <History size={19} />
            {guestOrderCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink-950 px-1 text-[10px] font-bold text-white">
                {guestOrderCount > 9 ? '9+' : guestOrderCount}
              </span>
            )}
          </Link>

          <Link to="/cart" className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-950 hover:bg-cream-200 sm:h-10 sm:w-10">
            <ShoppingCart size={19} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-ember-500 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>

          <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-950 hover:bg-cream-200 lg:hidden sm:h-10 sm:w-10">
            <MenuIcon size={20} />
          </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-50 lg:hidden px-4 pt-3">
          <div className="w-full max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-cream-200 bg-white p-5 shadow-lift">
            <div className="flex items-center justify-between mb-6">
              <span className="font-display font-bold text-lg">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-cream-100 flex items-center justify-center"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitSearch} className="mb-4">
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for food..."
                  className="input-field"
                />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-xl border border-cream-200 bg-white p-1.5 shadow-lift">
                    {suggestions.map((product) => (
                      <Link
                        key={product.id}
                        to={`/product/${product.id}`}
                        onClick={() => {
                          setSuggestions([])
                          setMobileOpen(false)
                        }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-cream-100"
                      >
                        <ProductImage
                          src={product.image}
                          alt=""
                          className="w-11 h-11 shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink-950">{product.name}</span>
                          <span className="block truncate text-xs text-ink-950/50">{formatPKR(product.effective_price)}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </form>
            <nav className="flex flex-col gap-1 mb-4">
              <Link to="/my-orders" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg bg-ember-50 px-3 py-2.5 text-sm font-semibold text-ember-700">
                <History size={16} /> My Orders {guestOrderCount > 0 && `(${guestOrderCount})`}
              </Link>
              {navLinks.map((link) => (
                <Link key={link.label} to={link.to} onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-cream-100">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
