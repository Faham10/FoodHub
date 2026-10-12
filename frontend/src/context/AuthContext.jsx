import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('foodhub_user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('foodhub_token')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data)
        localStorage.setItem('foodhub_user', JSON.stringify(res.data))
      })
      .catch(() => {
        localStorage.removeItem('foodhub_token')
        localStorage.removeItem('foodhub_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const persistSession = (data) => {
    localStorage.setItem('foodhub_token', data.access_token)
    localStorage.setItem('foodhub_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    persistSession(res.data)
    return res.data.user
  }

  const updateProfile = async (payload) => {
    const res = await api.put('/auth/me', payload)
    setUser(res.data)
    localStorage.setItem('foodhub_user', JSON.stringify(res.data))
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('foodhub_token')
    localStorage.removeItem('foodhub_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, isAdmin: user?.role === 'branch_admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
