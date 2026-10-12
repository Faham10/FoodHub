import { Link } from 'react-router-dom'
import { Flame, Users, Truck, Award } from 'lucide-react'

const stats = [
  { icon: Users, value: '50,000+', label: 'Happy Customers' },
  { icon: Flame, value: '1,200+', label: 'Orders Every Day' },
  { icon: Truck, value: '25 min', label: 'Average Delivery' },
  { icon: Award, value: '4.8/5', label: 'Average Rating' },
]

export default function About() {
  return (
    <div>
      <section className="bg-ink-950 py-20">
        <div className="container-page text-center">
          <span className="text-ember-400 font-semibold text-sm uppercase tracking-wide">Our Story</span>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white mt-2 mb-4">Serving Karachi's Best Fast Food Since 2019</h1>
          <p className="text-cream-100/70 max-w-2xl mx-auto text-lg">
            Bismillah Food started with one simple idea: everyone deserves great food delivered fast, hot, and exactly as ordered.
          </p>
        </div>
      </section>

      <section className="container-page py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="card p-6 text-center">
            <Icon className="text-ember-500 mx-auto mb-3" size={28} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-ink-950/55">{label}</div>
          </div>
        ))}
      </section>

      <section className="container-page pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-semibold mb-4">Fresh Ingredients, Real Recipes</h2>
          <p className="text-ink-950/60 leading-relaxed mb-4">
            Every burger, pizza and shawarma on our menu is made from scratch in our kitchens using fresh, locally
            sourced ingredients. No shortcuts, no compromises — just honest fast food made the right way.
          </p>
          <p className="text-ink-950/60 leading-relaxed mb-6">
            Our riders are trained to get your order to you quickly while keeping it hot and fresh, and our kitchen
            team follows strict hygiene standards on every single order.
          </p>
          <Link to="/menu" className="btn-primary">Explore Our Menu</Link>
        </div>
        <div className="aspect-square rounded-[2.5rem] bg-gradient-to-br from-ember-100 to-marigold-400/40 flex items-center justify-center">
          <img
            src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&q=85"
            alt="Freshly prepared fast food pizza"
            className="w-full h-full object-cover rounded-[2.5rem]"
          />
        </div>
      </section>
    </div>
  )
}
