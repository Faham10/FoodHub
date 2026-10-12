import { useCallback, useRef } from 'react'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatOrderNumber } from '../utils/format.js'
import { useAutoRefresh } from './useAutoRefresh.js'

export function useAdminOrderNotifications() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const lastSeen = useRef({ branchId: null, orderId: null })
  const notificationErrorShown = useRef(false)
  const branchId = user?.branch_id
  const storageKey = branchId ? `foodhub_admin_last_order_id_${branchId}` : null

  const checkForNewOrders = useCallback(async () => {
    if (!branchId || !storageKey) return

    try {
      const response = await api.get('/admin/orders')
      const orders = response.data
      const currentOrderId = orders.reduce((maxId, order) => Math.max(maxId, Number(order.id)), 0)
      const storedOrderId = localStorage.getItem(storageKey)
      const parsedStoredOrderId = Number(storedOrderId)
      const savedOrderId = storedOrderId === null || !Number.isSafeInteger(parsedStoredOrderId)
        ? currentOrderId
        : parsedStoredOrderId
      const previousOrderId = lastSeen.current.branchId === branchId
        ? lastSeen.current.orderId
        : savedOrderId
      const newOrders = orders
        .filter((order) => Number(order.id) > previousOrderId)
        .sort((a, b) => Number(a.id) - Number(b.id))

      newOrders.forEach((order) => {
        showToast(`New ${order.order_type} order #${formatOrderNumber(order)} from ${order.customer_name}`, 'info')
      })

      const latestSeenOrderId = Math.max(previousOrderId, currentOrderId)
      lastSeen.current = { branchId, orderId: latestSeenOrderId }
      localStorage.setItem(storageKey, String(latestSeenOrderId))
      notificationErrorShown.current = false
    } catch {
      if (!notificationErrorShown.current) {
        showToast('New order notifications are temporarily unavailable. Retrying...', 'error')
        notificationErrorShown.current = true
      }
    }
  }, [branchId, showToast, storageKey])

  useAutoRefresh(checkForNewOrders)
}
