import { Link } from 'react-router-dom'
import {
  Beef,
  CakeSlice,
  Cookie,
  CupSoda,
  Drumstick,
  IceCreamCone,
  Pizza,
  Sandwich,
  Tag,
  UtensilsCrossed,
} from 'lucide-react'

const ICON_MAP = {
  burgers: Beef,
  pizza: Pizza,
  fries: IceCreamCone,
  shawarma: Sandwich,
  chicken: Drumstick,
  sandwiches: Sandwich,
  nuggets: Cookie,
  wings: Drumstick,
  rolls: Sandwich,
  drinks: CupSoda,
  desserts: CakeSlice,
  deals: Tag,
}

export default function CategoryCard({ category }) {
  const IconComp = ICON_MAP[category.slug] || UtensilsCrossed
  return (
    <Link
      to={`/menu?category=${category.slug}`}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white border border-cream-200 hover:border-ember-300 hover:shadow-lift transition-all text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-ember-50 text-ember-600 flex items-center justify-center group-hover:bg-ember-500 group-hover:text-white transition-colors">
        <IconComp size={26} />
      </div>
      <div>
        <div className="font-semibold text-sm text-ink-950">{category.name}</div>
        <div className="text-xs text-ink-950/45">{category.product_count} items</div>
      </div>
    </Link>
  )
}
