import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Truck, ShieldCheck, Clock, Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../services/api.js'
import ProductCard from '../components/ProductCard.jsx'
import ProductCardSkeleton from '../components/ProductCardSkeleton.jsx'
import CategoryCard from '../components/CategoryCard.jsx'
import { useBranch } from '../context/BranchContext.jsx'

const reviews = [
  { name: 'Hamza R.', text: 'Fastest delivery I have had in Karachi — the smash burger was still hot and the fries stayed crispy.', rating: 5 },
  { name: 'Ayesha M.', text: 'Ordered the Family Deal for a get-together, everyone loved it. Will definitely order again.', rating: 5 },
  { name: 'Bilal S.', text: 'Great app, easy checkout, and the order tracking actually kept me updated in real time.', rating: 4 },
]

const heroSlides = [
  {
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1000&q=85',
    alt: 'Fresh grilled burger',
  },
  {
    image: 'https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=1000&q=85',
    alt: 'BBQ chicken wings',
  },
  {
    image: 'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=1000&q=85',
    alt: 'Fresh fast food pizza',
  },
]

export default function Home() {
  const { branchId } = useBranch()
  const [featured, setFeatured] = useState([])
  const [popular, setPopular] = useState([])
  const [categories, setCategories] = useState([])
  const [heroSlide, setHeroSlide] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    Promise.all([
      api.get('/products', { params: { featured: true, page_size: 4 } }),
      api.get('/products', { params: { popular: true, page_size: 8 } }),
      api.get('/categories', { params: { active_only: true } }),
    ])
      .then(([f, p, c]) => {
        setFeatured(f.data.items)
        setPopular(p.data.items)
        setCategories(c.data.slice(0, 6))
      })
      .finally(() => setLoading(false))
  }, [branchId])

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide((current) => (current + 1) % heroSlides.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-ink-950 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#F97431,transparent_45%),radial-gradient(circle_at_80%_0%,#F0A500,transparent_40%)]" />
        <div className="container-page relative py-20 lg:py-28 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-white/10 text-ember-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              Now delivering across Karachi
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] mb-6">
              Delicious Food<br /> Delivered To<br /><span className="text-ember-400">Your Door</span>
            </h1>
            <p className="text-cream-100/70 text-lg max-w-md mb-8">
              Burgers, pizza, shawarma and more — cooked fresh and rushed to you, hot and on time, every single time.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/menu" className="btn-primary text-base px-7 py-3.5">
                Order Now <ArrowRight size={18} />
              </Link>
              <Link to="/categories" className="btn text-base px-7 py-3.5 border-2 border-white/30 text-white hover:bg-white/10">
                Explore Menu
              </Link>
            </div>
          </div>
          <div className="relative hero-image-panel">
            <div className="aspect-square rounded-[3rem] overflow-hidden bg-gradient-to-br from-ember-400 to-marigold-500 shadow-lift">
              <img
                src={heroSlides[heroSlide].image}
                alt={heroSlides[heroSlide].alt}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label="Previous hero image"
                onClick={() => setHeroSlide((heroSlide - 1 + heroSlides.length) % heroSlides.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Next hero image"
                onClick={() => setHeroSlide((heroSlide + 1) % heroSlides.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/65 transition-colors"
              >
                <ChevronRight size={22} />
              </button>
              <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    aria-label={`Show hero image ${index + 1}`}
                    onClick={() => setHeroSlide(index)}
                    className={`h-2 rounded-full transition-all ${index === heroSlide ? 'w-7 bg-white' : 'w-2 bg-white/60'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="container-page py-16 grid sm:grid-cols-3 gap-6">
        {[
          { icon: Clock, title: 'Fast Delivery', text: 'Hot food delivered to you in 30 minutes or less.' },
          { icon: ShieldCheck, title: 'Quality Guaranteed', text: 'Fresh ingredients and strict hygiene standards.' },
          { icon: Truck, title: 'Live Order Tracking', text: 'Follow your order from the kitchen to your door.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-ember-50 text-ember-600 flex items-center justify-center shrink-0">
              <Icon size={22} />
            </div>
            <div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-ink-950/55">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="container-page py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-ember-600 font-semibold text-sm uppercase tracking-wide">Browse</span>
            <h2 className="text-3xl font-semibold mt-1">Food Categories</h2>
          </div>
          <Link to="/categories" className="text-sm font-semibold text-ember-600 hidden sm:flex items-center gap-1 hover:gap-2 transition-all">
            View All <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((c) => <CategoryCard key={c.id} category={c} />)}
        </div>
      </section>

      {/* Featured / Special Deals */}
      <section className="bg-ember-50 py-16 mt-10">
        <div className="container-page">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-ember-600 font-semibold text-sm uppercase tracking-wide">Special Deals</span>
              <h2 className="text-3xl font-semibold mt-1">Today's Featured Offers</h2>
            </div>
            <Link to="/menu?category=deals" className="text-sm font-semibold text-ember-600 hidden sm:flex items-center gap-1 hover:gap-2 transition-all">
              See All Deals <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {loading ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />) : featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* Popular products */}
      <section className="container-page py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-ember-600 font-semibold text-sm uppercase tracking-wide">Crowd Favorites</span>
            <h2 className="text-3xl font-semibold mt-1">Popular Right Now</h2>
          </div>
          <Link to="/menu" className="text-sm font-semibold text-ember-600 hidden sm:flex items-center gap-1 hover:gap-2 transition-all">
            View Full Menu <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {loading ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />) : popular.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-ink-950 py-16">
        <div className="container-page">
          <div className="text-center mb-10">
            <span className="text-ember-400 font-semibold text-sm uppercase tracking-wide">Testimonials</span>
            <h2 className="text-3xl font-semibold mt-1 text-white">What Our Customers Say</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <div key={r.name} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Quote className="text-ember-400 mb-3" size={22} />
                <p className="text-cream-100/80 text-sm leading-relaxed mb-4">{r.text}</p>
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{r.name}</span>
                  <div className="flex gap-0.5 text-marigold-400">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-16 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold mb-4">Craving something delicious?</h2>
        <p className="text-ink-950/60 max-w-lg mx-auto mb-8">Browse our full menu and get hot food delivered to your doorstep in minutes.</p>
        <Link to="/menu" className="btn-primary text-base px-8 py-4 inline-flex">
          Order Now <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  )
}
