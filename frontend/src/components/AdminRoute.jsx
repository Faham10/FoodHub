import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import PageLoader from './PageLoader.jsx'

export default function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) return <PageLoader />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />
  return children
}
