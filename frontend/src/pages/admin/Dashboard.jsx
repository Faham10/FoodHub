import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Clock, Wallet, Package, ArrowRight, TrendingUp, Bike, Store, UtensilsCrossed } from 'lucide-react'
import api from '../../services/api.js'
import { formatPKR, formatDate, formatOrderNumber } from '../../utils/format.js'
import PageLoader from '../../components/PageLoader.jsx'
import OrderStatusBadge from '../../components/OrderStatusBadge.jsx'
import { useAutoRefresh } from '../../hooks/useAutoRefresh.js'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState('')
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(true)
  const [reportError, setReportError] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - 29)
    return date.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [granularity, setGranularity] = useState('daily')
  const latestRequest = useRef(0)
  const latestReportRequest = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current
    try {
      const res = await api.get('/admin/dashboard')
      if (requestId === latestRequest.current) {
        setData(res.data)
        setRefreshError('')
      }
    } catch {
      if (requestId === latestRequest.current) {
        setRefreshError('Dashboard data could not be refreshed. Retrying automatically...')
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [])

  const loadReport = useCallback(async () => {
    const requestId = ++latestReportRequest.current
    setReportLoading(true)
    setReportError('')
    try {
      const response = await api.get('/admin/reports', {
        params: { start_date: startDate, end_date: endDate, granularity },
      })
      if (requestId === latestReportRequest.current) setReport(response.data)
    } catch (error) {
      if (requestId === latestReportRequest.current) {
        setReportError(error.response?.data?.detail || 'Sales report could not be loaded.')
      }
    } finally {
      if (requestId === latestReportRequest.current) setReportLoading(false)
    }
  }, [startDate, endDate, granularity])

  useAutoRefresh(load)
  useEffect(() => { loadReport() }, [loadReport])

  if (loading || !data) return <PageLoader />

  const maxSale = Math.max(...data.sales_overview.map((s) => s.total), 1)

  const cards = [
    { icon: ShoppingBag, label: 'Total Orders', value: data.total_orders, color: 'bg-ember-50 text-ember-600' },
    { icon: Clock, label: 'Pending Orders', value: data.pending_orders, color: 'bg-marigold-400/20 text-marigold-500' },
    { icon: Wallet, label: 'Total Revenue', value: formatPKR(data.total_revenue), color: 'bg-green-100 text-green-700' },
    { icon: Package, label: 'Total Products', value: data.total_products, color: 'bg-purple-100 text-purple-700' },
  ]
  const orderTypeCards = [
    { icon: Bike, label: 'Delivery Orders', value: 'Delivery', color: 'bg-blue-50 text-blue-600' },
    { icon: Store, label: 'Pick-Up Orders', value: 'Pick-Up', color: 'bg-amber-50 text-amber-700' },
    { icon: UtensilsCrossed, label: 'Dine-In Orders', value: 'Dine-In', color: 'bg-violet-50 text-violet-600' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-ink-950/55 text-sm mt-1">A live overview of your store's performance.</p>
        {refreshError && <p role="status" className="mt-2 text-sm text-red-700">{refreshError}</p>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}><Icon size={18} /></div>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-ink-950/50 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <section aria-label="Orders by type" className="mb-8">
        <div className="mb-3">
          <h2 className="font-semibold">Orders by Type</h2>
          <p className="mt-1 text-xs text-ink-950/50">Counts for this branch only.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {orderTypeCards.map(({ icon: Icon, label, value, color }) => (
            <Link
              key={value}
              to={`/admin/orders?order_type=${encodeURIComponent(value)}`}
              className="card group flex items-center justify-between gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={18} /></span>
                <span className="truncate text-sm font-semibold">{label}</span>
              </div>
              <span className="text-xl font-bold group-hover:text-ember-600">{data.order_type_counts?.[value] ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-ember-600" />
            <h2 className="font-semibold">Sales — Last 7 Days</h2>
          </div>
          <div className="flex items-end gap-3 h-48">
            {data.sales_overview.map((s) => (
              <div key={s.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] font-semibold text-ink-950/60">{s.total > 0 ? formatPKR(s.total) : ''}</span>
                <div
                  className="w-full bg-ember-500 rounded-t-lg min-h-[4px] hover:bg-ember-600 transition-colors"
                  style={{ height: `${Math.max(4, (s.total / maxSale) * 100)}%` }}
                />
                <span className="text-[11px] text-ink-950/45">{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-5">Best Selling Products</h2>
          {data.best_sellers.length === 0 ? (
            <p className="text-sm text-ink-950/45">No sales data yet.</p>
          ) : (
            <div className="space-y-4">
              {data.best_sellers.map((b, idx) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-cream-200 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{b.name}</div>
                    <div className="text-xs text-ink-950/45">{b.quantity_sold} sold</div>
                  </div>
                  <span className="text-sm font-bold shrink-0">{formatPKR(b.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="card mb-6 p-5 sm:p-6" aria-label="Branch sales reports">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold">Branch Sales Report</h2>
            <p className="mt-1 text-xs text-ink-950/50">Branch-only figures. Cancelled orders are excluded from sales and revenue.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-ink-950/60">From<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="input-field mt-1 !py-2" /></label>
            <label className="text-xs font-semibold text-ink-950/60">To<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="input-field mt-1 !py-2" /></label>
            <label className="text-xs font-semibold text-ink-950/60">Group by<select value={granularity} onChange={(event) => setGranularity(event.target.value)} className="input-field mt-1 !py-2"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          </div>
        </div>
        {reportError ? (
          <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{reportError} <button onClick={loadReport} className="ml-1 font-semibold underline">Retry</button></div>
        ) : reportLoading ? (
          <p role="status" className="py-8 text-center text-sm text-ink-950/50">Loading report...</p>
        ) : report ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Total orders', report.total_orders],
                ['Gross sales', formatPKR(report.gross_sales)],
                ['Discounts', formatPKR(report.discounts)],
                ['Delivery fees', formatPKR(report.delivery_fees)],
                ['Net revenue', formatPKR(report.net_revenue)],
                ['Average order value', formatPKR(report.average_order_value)],
              ].map(([label, value]) => <div key={label} className="rounded-xl bg-cream-50 p-4"><p className="text-xs text-ink-950/50">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}
            </div>
            <p className="mb-5 text-[11px] text-ink-950/45">{report.revenue_definition}</p>
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold">Sales by {granularity === 'daily' ? 'day' : granularity === 'weekly' ? 'week' : 'month'}</h3>
                {report.series.length === 0 ? <p className="text-sm text-ink-950/45">No sales in this date range.</p> : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {report.series.map((period) => (
                      <div key={period.period} className="flex items-center gap-3 text-xs">
                        <span className="w-28 shrink-0 text-ink-950/55">{period.period}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-cream-100"><div className="h-full rounded bg-ember-500" style={{ width: `${Math.max(2, period.net_revenue / Math.max(...report.series.map((item) => item.net_revenue), 1) * 100)}%` }} /></div>
                        <span className="w-24 text-right font-semibold">{formatPKR(period.net_revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Orders by status</h3>
                  {Object.keys(report.status_counts).length === 0 ? <p className="text-sm text-ink-950/45">No orders in this date range.</p> : <div className="space-y-2 text-sm">{Object.entries(report.status_counts).map(([status, count]) => <div key={status} className="flex justify-between gap-3"><span className="text-ink-950/60">{status}</span><strong>{count}</strong></div>)}</div>}
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Orders by type</h3>
                  {Object.keys(report.order_type_counts).length === 0 ? <p className="text-sm text-ink-950/45">No orders in this date range.</p> : <div className="space-y-2 text-sm">{Object.entries(report.order_type_counts).map(([type, count]) => <div key={type} className="flex justify-between gap-3"><span className="text-ink-950/60">{type}</span><strong>{count}</strong></div>)}</div>}
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-cream-100 pt-5">
              <h3 className="mb-3 text-sm font-semibold">Best-selling products</h3>
              {report.best_sellers.length === 0 ? <p className="text-sm text-ink-950/45">No sales in this date range.</p> : <div className="grid gap-2 sm:grid-cols-2">{report.best_sellers.map((product) => <div key={product.name} className="flex justify-between gap-3 text-sm"><span className="truncate text-ink-950/60">{product.name} · {product.quantity_sold} sold</span><strong className="shrink-0">{formatPKR(product.gross_sales)}</strong></div>)}</div>}
            </div>
          </>
        ) : null}
      </section>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-ember-600 flex items-center gap-1 hover:gap-2 transition-all">
            View All <ArrowRight size={15} />
          </Link>
        </div>
        {data.recent_orders.length === 0 ? (
          <p className="text-sm text-ink-950/45 py-6 text-center">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-950/45 border-b border-cream-200">
                  <th className="pb-3 font-semibold">Order</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Total</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {data.recent_orders.map((o) => (
                  <tr key={o.id} className="hover:bg-cream-50 cursor-pointer" onClick={() => window.location.assign(`/admin/orders/${o.id}`)}>
                    <td className="py-3 font-semibold">#{formatOrderNumber(o)}</td>
                    <td className="py-3">{o.customer_name}</td>
                    <td className="py-3 font-semibold">{formatPKR(o.total)}</td>
                    <td className="py-3"><OrderStatusBadge status={o.order_status} /></td>
                    <td className="py-3 text-ink-950/50">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
