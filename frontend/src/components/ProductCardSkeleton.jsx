export default function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-full" />
        <div className="flex justify-between items-center pt-1">
          <div className="skeleton h-5 w-16" />
          <div className="skeleton h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  )
}
