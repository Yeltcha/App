import { percentOf1RM, RPE_VALUES, rirFor, TABLE_REPS, formatRpe } from '../lib/rpe'
import { formatNumber } from '../lib/numbers'

interface Props {
  /** Case à mettre en avant */
  reps?: number
  rpe?: number | null
  /** Si connu, la charge s'affiche sous le pourcentage de la case choisie */
  oneRepMaxKg?: number
}

/** Table d'équivalence RPE / RIR / % du 1RM selon le nombre de répétitions. */
export function RpeTable({ reps, rpe, oneRepMaxKg }: Props) {
  const columns = [...RPE_VALUES].reverse()
  return (
    <div className="rpe-table-wrap" tabIndex={0} role="region" aria-label="Table RPE, défilable">
      <table className="rpe-table">
        <caption className="visually-hidden">Pourcentage du 1RM selon les répétitions et le RPE</caption>
        <thead>
          <tr>
            <th scope="col">Reps</th>
            {columns.map((r) => (
              <th key={r} scope="col" className={r === rpe ? 'on' : undefined}>
                <span className="rpe-head">RPE {formatRpe(r)}</span>
                <span className="rir-head">RIR {formatRpe(rirFor(r))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_REPS.map((n) => (
            <tr key={n} className={n === reps ? 'on' : undefined}>
              <th scope="row">{n}</th>
              {columns.map((r) => {
                const percent = percentOf1RM(n, r)!
                const picked = n === reps && r === rpe
                return (
                  <td key={r} className={picked ? 'picked' : undefined} aria-current={picked ? 'true' : undefined}>
                    {formatNumber(percent)}
                    {picked && oneRepMaxKg ? <span className="rpe-kg">{formatNumber(oneRepMaxKg * percent / 100)} kg</span> : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
