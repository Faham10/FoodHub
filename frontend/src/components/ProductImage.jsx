import { ImageOff } from 'lucide-react'
import { resolveMediaUrl } from '../services/api.js'

export default function ProductImage({ src, alt, className = '' }) {
  const url = resolveMediaUrl(src)
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-cream-200 text-ink-950/25 ${className}`}>
        <ImageOff size={32} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
        e.currentTarget.parentElement.classList.add('bg-cream-200')
      }}
    />
  )
}
