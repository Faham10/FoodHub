import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, ClipboardList, Heart, MapPin, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import api from '../services/api.js'
import { formatPKR, formatDate, formatOrderNumber } from '../utils/format.js'
import { formatBranchName } from '../utils/branch.js'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'

export default function Account() {
  const { user } = useAuth()
  const { wishlist } = useCart()
  const [orders, setOrders] = useState([])
  const [addressCount, setAddressCount] = useState(0)

  useEffect(() => {
    api.get('/orders').then((res) => setOrders(res.data))
    api.get('/addresses').then((res) => setAddressCount(res.data.length))
  }, [])

  const links = [
    { to: '/account/profile', icon: User, label: 'Profile', desc: 'Update your personal details' },
    { to: '/account/orders', icon: ClipboardList, label: 'My Orders', desc: `${orders.length} orders placed` },
    { to: '/account/wishlist', icon: Heart, label: 'Wishlist', desc: `${wishlist.length} saved items` },
    { to: '/account/addresses', icon: MapPin, label: 'Addresses', desc: `${addressCount} saved addresses` },
  ]

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Welcome back, {user.full_name.split(' ')[0]}!</h1>
        <p className="text-ink-950/55 mt-1">Manage your orders, wishlist and account details.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {links.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} className="card p-5 hover:shadow-lift transition-shadow flex flex-col gap-3">
            <div className="w-11 h-11 rounded-xl bg-ember-50 text-ember-600 flex items-center justify-center"><Icon size={20} /></div>
            <div>
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-ink-950/50">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-lg">Recent Orders</h2>
          <Link to="/account/orders" className="text-sm font-semibold text-ember-600 flex items-center gap-1 hover:gap-2 transition-all">
            View All <ChevronRight size={15} />
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-950/50 py-6 text-center">You haven't placed any orders yet.</p>
        ) : (
          <div className="divide-y divide-cream-200">
            {orders.slice(0, 5).map((o) => (
              <Link key={o.id} to={`/account/orders/${o.id}`} className="flex items-center justify-between py-3.5 hover:bg-cream-50 -mx-2 px-2 rounded-lg">
                <div>
                  <div className="font-semibold text-sm">Order #{formatOrderNumber(o)}</div>
                  <div className="text-xs text-ink-950/50">{o.order_type} · {formatBranchName(o.branch_name)} · {formatDate(o.created_at)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-sm">{formatPKR(o.total)}</span>
                  <OrderStatusBadge status={o.order_status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
