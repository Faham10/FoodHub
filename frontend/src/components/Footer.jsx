import { Link } from 'react-router-dom'
import { Facebook, Instagram, Twitter, MapPin, Phone, Mail } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'

export default function Footer() {
  return (
    <footer className="no-print mt-20 w-full min-w-0 bg-ink-950 text-cream-100">
      <div className="container-page py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="mb-4 inline-flex items-center">
            <BrandLogo className="brand-logo-on-dark h-20" />
          </div>
          <p className="text-sm text-cream-100/60 leading-relaxed">
            Hot, fresh fast food delivered straight to your door across the city — burgers, pizza, shawarma and more.
          </p>
          <div className="flex gap-3 mt-5">
            <a href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-ember-500 transition-colors"><Facebook size={15} /></a>
            <a href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-ember-500 transition-colors"><Instagram size={15} /></a>
            <a href="#" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-ember-500 transition-colors"><Twitter size={15} /></a>
          </div>
        </div>

        <div>
          <h4 className="font-display font-semibold text-white mb-4">Quick Links</h4>
          <ul className="space-y-2.5 text-sm text-cream-100/60">
            <li><Link to="/menu" className="hover:text-ember-400">Full Menu</Link></li>
            <li><Link to="/categories" className="hover:text-ember-400">Categories</Link></li>
            <li><Link to="/about" className="hover:text-ember-400">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-ember-400">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-white mb-4">Start Ordering</h4>
          <ul className="space-y-2.5 text-sm text-cream-100/60">
            <li><Link to="/menu" className="hover:text-ember-400">Browse the Menu</Link></li>
            <li><Link to="/cart" className="hover:text-ember-400">View Your Cart</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-white mb-4">Get In Touch</h4>
          <ul className="space-y-3 text-sm text-cream-100/60">
            <li className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-ember-400" /> Shahrah-e-Faisal, Karachi, Pakistan</li>
            <li className="flex items-center gap-2.5"><Phone size={16} className="shrink-0 text-ember-400" /> 0800-36364</li>
            <li className="flex items-center gap-2.5"><Mail size={16} className="shrink-0 text-ember-400" /> support@foodhub.pk</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-cream-100/40">
        © {new Date().getFullYear()} Bismillah Food. All rights reserved.
      </div>
    </footer>
  )
}
