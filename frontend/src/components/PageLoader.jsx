import { Loader2 } from 'lucide-react'

export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="animate-spin text-ember-500" size={36} />
    </div>
  )
}
