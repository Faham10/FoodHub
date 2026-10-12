import { useEffect, useState } from 'react'
import api from '../services/api.js'
import CategoryCard from '../components/CategoryCard.jsx'
import PageLoader from '../components/PageLoader.jsx'
import { useBranch } from '../context/BranchContext.jsx'

export default function Categories() {
  const { branchId } = useBranch()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    api.get('/categories', { params: { active_only: true } })
      .then((res) => setCategories(res.data))
      .finally(() => setLoading(false))
  }, [branchId])

  if (loading) return <PageLoader />

  return (
    <div className="container-page py-12">
      <div className="text-center mb-10">
        <span className="text-ember-600 font-semibold text-sm uppercase tracking-wide">Browse</span>
        <h1 className="text-3xl sm:text-4xl font-semibold mt-1">All Food Categories</h1>
        <p className="text-ink-950/55 mt-2 max-w-md mx-auto">Pick a category to explore everything we have to offer.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {categories.map((c) => <CategoryCard key={c.id} category={c} />)}
      </div>
    </div>
  )
}
