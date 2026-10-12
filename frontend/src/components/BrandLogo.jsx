import logo from '../assets/bismillah-food-logo-transparent.png'

export default function BrandLogo({ className = '' }) {
  return (
    <span className={`brand-logo ${className}`} aria-label="Bismillah Food">
      <img src={logo} alt="" className="brand-logo__image" />
      <span className="brand-logo__name">Bismillah Food</span>
    </span>
  )
}
