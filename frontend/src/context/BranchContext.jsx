import { createContext, useContext, useState } from 'react'

const BranchContext = createContext(null)

export function BranchProvider({ children }) {
  const [branchId, setBranchId] = useState(() => localStorage.getItem('foodhub_branch_id') || '')
  const [branchName, setBranchName] = useState(() => localStorage.getItem('foodhub_branch_name') || '')
  const [orderType, setOrderType] = useState(() => localStorage.getItem('foodhub_order_type') || '')

  const selectBranch = (branch, selectedOrderType) => {
    setBranchId(String(branch.id))
    setBranchName(branch.name)
    setOrderType(selectedOrderType)
    localStorage.setItem('foodhub_branch_id', String(branch.id))
    localStorage.setItem('foodhub_branch_name', branch.name)
    localStorage.setItem('foodhub_order_type', selectedOrderType)
  }
  const clearBranch = () => {
    setBranchId('')
    setBranchName('')
    setOrderType('')
    localStorage.removeItem('foodhub_branch_id')
    localStorage.removeItem('foodhub_branch_name')
    localStorage.removeItem('foodhub_order_type')
  }

  return <BranchContext.Provider value={{ branchId, branchName, orderType, selectBranch, clearBranch }}>{children}</BranchContext.Provider>
}

export const useBranch = () => useContext(BranchContext)
