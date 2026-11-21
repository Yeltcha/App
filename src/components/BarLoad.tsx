import { loadBar, plateColor, type Plate } from '../lib/plates'
import { formatNumber } from '../lib/numbers'

// Proportions approchées des disques calibrés : les 25 à 10 kg ont le même diamètre
const HEIGHT: Record<Plate, number> = { 25: 44, 20: 44, 15: 44, 10: 44, 5: 30, 2.5: 24, 2: 22, 1.5: 20, 1: 18, 0.5: 14 }
const WIDTH: Record<Plate, number> = { 25: 10, 20: 9, 15: 8, 10: 7, 5: 6, 2.5: 5, 2: 5, 1.5: 4, 1: 4, 0.5: 3 }
const GAP = 1.5
const H = 48

interface Props {
  weightKg: number
  /** Affiche le détail « 25 + 15 par côté » à côté du schéma. */
  showLabel?: boolean
}

/** Schéma d'un côté de la barre chargée, avec les couleurs des disques calibrés. */
export function BarLoad({ weightKg, showLabel = true }: Props) {
  const load = loadBar(weightKg)
  if (!load) return null
  const { perSide, remainder } = load

  // Position de chaque disque, en partant de la butée intérieure
  const positions = perSide.reduce<number[]>((acc, _plate, i) => {
    acc.push(i === 0 ? 10 : acc[i - 1] + WIDTH[perSide[i - 1]] + GAP)
    return acc
  }, [])
  const x = perSide.length ? positions.at(-1)! + WIDTH[perSide.at(-1)!] + GAP : 10
  const plates = perSide.map((plate, i) => (
    <rect key={i} x={positions[i]} y={(H - HEIGHT[plate]) / 2} width={WIDTH[plate]} height={HEIGHT[plate]} rx={1.5}
      fill={plateColor(plate)} />
  ))
  const collarX = x + 1
  const width = Math.max(collarX + 22, 40)

  const text = perSide.length === 0
    ? 'Barre seule'
    : `${perSide.map((p) => formatNumber(p)).join(' + ')} par côté`
  const extra = remainder > 0 ? ` (+${formatNumber(remainder * 2)} kg à ajuster)` : ''

  return (
    <span className="bar-load">
      <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img"
        aria-label={`Chargement de la barre : ${text}${extra}`}>
        {/* manchon */}
        <rect x={0} y={H / 2 - 3} width={width} height={6} rx={2} fill="var(--manchon)" />
        {/* butée intérieure */}
        <rect x={4} y={H / 2 - 11} width={4} height={22} rx={1} fill="var(--manchon)" />
        {plates}
        {/* collier */}
        {perSide.length > 0 && <rect x={collarX} y={H / 2 - 8} width={5} height={16} rx={1} fill="var(--manchon)" />}
      </svg>
      {showLabel && <span className="bar-load-text" aria-hidden="true">{text}{extra}</span>}
    </span>
  )
}
