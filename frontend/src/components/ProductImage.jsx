import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { resolveMediaUrl } from '../services/api.js'

const CATEGORY_IMAGE_URLS = {
  Burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=640&q=80',
  Pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=640&q=80',
  Fries: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=640&q=80',
  Shawarma: 'https://images.unsplash.com/photo-1719282431565-3b30bb7d2658?auto=format&fit=crop&w=640&q=80',
  Chicken: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=640&q=80',
  Sandwiches: 'https://images.unsplash.com/photo-1700937244987-92488ab2ada5?auto=format&fit=crop&w=640&q=80',
  Nuggets: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=640&q=80',
  Wings: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=640&q=80',
  Rolls: 'https://images.unsplash.com/photo-1719282431565-3b30bb7d2658?auto=format&fit=crop&w=640&q=80',
  Drinks: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=640&q=80',
  Desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=640&q=80',
  Deals: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=640&q=80',
}

const DEFAULT_IMAGE_URL = CATEGORY_IMAGE_URLS.Burgers

export default function ProductImage({ src, alt, category, className = '' }) {
  const primaryUrl = resolveMediaUrl(src)
  const fallbackUrl = CATEGORY_IMAGE_URLS[category] || DEFAULT_IMAGE_URL
  const [failedUrl, setFailedUrl] = useState(null)
  const url = !primaryUrl || failedUrl === primaryUrl ? fallbackUrl : primaryUrl

  if (failedUrl === fallbackUrl) {
    return (
      <div role="img" aria-label={`${alt} image unavailable`} className={`flex items-center justify-center bg-cream-200 text-ink-950/25 ${className}`}>
        <ImageOff size={32} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailedUrl(url)}
    />
  )
}
