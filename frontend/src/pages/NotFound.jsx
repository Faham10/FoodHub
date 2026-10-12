import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <span className="font-display text-8xl font-bold text-ember-500">404</span>
      <h1 className="text-2xl font-semibold mt-4 mb-2">Page Not Found</h1>
      <p className="text-ink-950/55 mb-8 max-w-sm mx-auto">Sorry, we couldn't find the page you're looking for. It may have been moved or doesn't exist.</p>
      <Link to="/" className="btn-primary inline-flex"><Home size={17} /> Back to Home</Link>
    </div>
  )
}
