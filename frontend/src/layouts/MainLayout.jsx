import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'

export default function MainLayout() {
  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      <Navbar />
      <main className="w-full min-w-0 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
