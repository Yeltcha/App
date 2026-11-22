import { useId, type ReactNode } from 'react'

interface Props {
  value: number
  max: number
  size?: number
  stroke?: number
  label: string
  children?: ReactNode
}

/** Anneau de progression cuivré, avec un contenu au centre. */
export function ProgressRing({ value, max, size = 56, stroke = 5, label, children }: Props) {
  const id = useId()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <span className="ring" role="img" aria-label={label} style={{ inlineSize: size, blockSize: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--cuivre-clair)" />
            <stop offset="100%" stopColor="var(--cuivre-fonce)" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={`url(#${id})`} strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 300ms ease-out' }} />
      </svg>
      {children !== undefined && <span className="ring-center" aria-hidden="true">{children}</span>}
    </span>
  )
}
