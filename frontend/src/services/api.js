import axios from 'axios'

const API_URL = import.meta.env.DEV
  ? '/api'
  : import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('foodhub_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const branchId = localStorage.getItem('foodhub_branch_id')
  if (branchId) {
    config.params = { ...(config.params || {}), branch_id: branchId }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('foodhub_token')
      localStorage.removeItem('foodhub_user')
    }
    return Promise.reject(error)
  }
)

// Resolve a possibly-relative backend URL (e.g. /uploads/products/x.jpg) into an absolute URL
export const resolveMediaUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  const origin = API_URL.replace(/\/api\/?$/, '')
  return `${origin}${path}`
}

export default api
