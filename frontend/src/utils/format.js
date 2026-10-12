export const formatPKR = (amount) => {
  const value = Number(amount || 0)
  return `Rs. ${value.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatDateTime = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const formatOrderNumber = (order) => order.order_number || String(order.id).padStart(5, '0')

export const discountPercent = (price, salePrice) => {
  if (!salePrice || salePrice >= price) return 0
  return Math.round(((price - salePrice) / price) * 100)
}
