export function formatBranchName(name) {
  if (!name) return 'Bismillah Food'

  const displayName = name.trim() === 'Kornagi 2' ? 'Korangi 2' : name.trim()
  return `Bismillah Food (${displayName})`
}
