import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import api from '../services/api.js'
import { formatPKR, formatDate, formatOrderNumber } from '../utils/format.js'
import { formatBranchName } from '../utils/branch.js'
import PageLoader from '../components/PageLoader.jsx'
import EmptyState from '../components/EmptyState.jsx'
import OrderStatusBadge, { PaymentStatusBadge } from '../components/OrderStatusBadge.jsx'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orders').then((res) => setOrders(res.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-semibold mb-8">My Orders</h1>
      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders yet" message="Once you place an order, it will show up here." action={<Link to="/menu" className="btn-primary">Browse Menu</Link>} />
      ) : (
        <div className="card divide-y divide-cream-200">
          {orders.map((o) => (
            <Link key={o.id} to={`/account/orders/${o.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 hover:bg-cream-50">
              <div>
                <div className="font-semibold">Order #{formatOrderNumber(o)}</div>
                <div className="mt-0.5 text-xs text-ink-950/50">{o.order_type} · {formatBranchName(o.branch_name)} · {formatDate(o.created_at)}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold">{formatPKR(o.total)}</span>
                <PaymentStatusBadge status={o.payment_status} />
                <OrderStatusBadge status={o.order_status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
