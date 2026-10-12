import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import api from '../services/api.js'
import ProductCard from '../components/ProductCard.jsx'
import ProductCardSkeleton from '../components/ProductCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useBranch } from '../context/BranchContext.jsx'

export default function SearchPage() {
  const { branchId } = useBranch()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [inputValue, setInputValue] = useState(query)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    setInputValue(query)
    if (!branchId || !query) return
    setLoading(true)
    api.get('/products', { params: { search: query, page_size: 24 } })
      .then((res) => setResults(res.data.items))
      .finally(() => { setLoading(false); setSearched(true) })
  }, [branchId, query])

  const submit = (e) => {
    e.preventDefault()
    if (inputValue.trim()) setSearchParams({ q: inputValue.trim() })
  }

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-semibold mb-6">Search Menu</h1>
      <form onSubmit={submit} className="max-w-xl mb-10">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-950/40" size={18} />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search for burgers, pizza, deals..."
            className="input-field !pl-12 !py-3.5"
          />
        </div>
      </form>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : searched && results.length === 0 ? (
        <EmptyState icon={SearchIcon} title={`No results for "${query}"`} message="Try a different search term or browse our full menu." action={<Link to="/menu" className="btn-primary">Browse Menu</Link>} />
      ) : results.length > 0 ? (
        <>
          <p className="text-ink-950/55 mb-5">{results.length} results for "{query}"</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {results.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      ) : (
        <p className="text-ink-950/50">Start typing to search our menu.</p>
      )}
    </div>
  )
}
