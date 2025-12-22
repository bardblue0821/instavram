import React from 'react'

export function RepostIcon({ size = 20, filled = false }: { size?: number; filled?: boolean }) {
  const stroke = filled ? 'currentColor' : 'currentColor'
  const fill = filled ? 'currentColor' : 'none'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10l-3-3" />
      <path d="M17 17H7l3 3" />
    </svg>
  )
}
