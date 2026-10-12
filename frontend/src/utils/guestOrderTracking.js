const STORAGE_KEY = 'foodhub_active_guest_order_token'
const HISTORY_KEY = 'foodhub_guest_order_tokens'
const CHANGE_EVENT = 'foodhub:active-guest-order-changed'
const STATUS_KEY_PREFIX = 'foodhub_guest_order_status_'

export function getGuestOrderTokens() {
  const storedHistory = localStorage.getItem(HISTORY_KEY)
  let tokens = []

  if (storedHistory) {
    try {
      const parsed = JSON.parse(storedHistory)
      if (Array.isArray(parsed)) tokens = parsed.filter((token) => typeof token === 'string' && token)
    } catch (error) {
      console.error('Could not read guest order history from this browser', error)
      localStorage.removeItem(HISTORY_KEY)
    }
  }

  const activeToken = localStorage.getItem(STORAGE_KEY)
  if (activeToken && !tokens.includes(activeToken)) tokens.unshift(activeToken)
  return [...new Set(tokens)]
}

export function getActiveGuestOrderToken() {
  return localStorage.getItem(STORAGE_KEY)
}

export function setActiveGuestOrderToken(token, initialStatus) {
  if (!token) throw new Error('A guest order tracking token is required')
  const history = getGuestOrderTokens().filter((savedToken) => savedToken !== token)
  localStorage.setItem(HISTORY_KEY, JSON.stringify([...history, token]))
  localStorage.setItem(STORAGE_KEY, token)
  if (initialStatus && localStorage.getItem(`${STATUS_KEY_PREFIX}${token}`) === null) {
    localStorage.setItem(`${STATUS_KEY_PREFIX}${token}`, initialStatus)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function notifyGuestOrderStatusChange(token, order, showToast) {
  if (!token || !order?.order_status) return

  const statusKey = `${STATUS_KEY_PREFIX}${token}`
  const previousStatus = localStorage.getItem(statusKey)
  localStorage.setItem(statusKey, order.order_status)
  if (previousStatus && previousStatus !== order.order_status) {
    showToast(`Order #${order.order_number} is now ${order.order_status}.`, 'info')
  }
}

export function removeGuestOrderToken(token) {
  const history = getGuestOrderTokens().filter((savedToken) => savedToken !== token)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  localStorage.removeItem(`${STATUS_KEY_PREFIX}${token}`)
  if (getActiveGuestOrderToken() === token) localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearActiveGuestOrderToken() {
  const activeToken = getActiveGuestOrderToken()
  localStorage.removeItem(STORAGE_KEY)
  if (activeToken) {
    const history = getGuestOrderTokens().filter((token) => token !== activeToken)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToActiveGuestOrder(callback) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
