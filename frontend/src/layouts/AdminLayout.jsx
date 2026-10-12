import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Tags, ShoppingBag, Settings, LogOut, Menu as MenuIcon, ExternalLink, TicketPercent } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useAdminOrderNotifications } from '../hooks/useAdminOrderNotifications.js'
import BrandLogo from '../components/BrandLogo.jsx'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/promotions', label: 'Deals & Coupons', icon: TicketPercent },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  useAdminOrderNotifications()

  const doLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const SidebarContent = () => (
    <>
      <div className="mb-8 flex justify-center">
        <BrandLogo className="brand-logo-on-dark h-16" />
      </div>
      <nav className="flex-1 flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-ember-500 text-white' : 'text-cream-100/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 pt-4 mt-4 space-y-1">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-cream-100/70 hover:bg-white/10 hover:text-white">
          <ExternalLink size={18} /> View Store
        </a>
        <button onClick={doLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ember-400 hover:bg-white/10">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-cream-100 flex">
      <aside className="hidden lg:flex flex-col w-64 bg-ink-950 p-4 fixed h-screen">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-ink-950 p-4 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-cream-200 h-14 flex items-center px-4 justify-between">
          <button onClick={() => setMobileOpen(true)}><MenuIcon size={22} /></button>
          <span className="font-display font-bold">Bismillah Food</span>
          <span className="w-7 h-7 rounded-full bg-ink-950 text-white flex items-center justify-center text-xs font-bold">
            {user?.full_name?.[0]?.toUpperCase()}
          </span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
