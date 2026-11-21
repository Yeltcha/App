import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate } from '../lib/dates'
import { formatNumber } from '../lib/numbers'

export interface Point {
  date: string // AAAA-MM-JJ
  value: number
}

interface Props {
  title: string
  unit: string
  points: Point[]
  target?: { value: number; label: string }
}

/** Courbe d'une seule série, avec tableau accessible et ligne d'objectif facultative. */
export function LineChartCard({ title, unit, points, target }: Props) {
  if (points.length === 0) return <p className="empty">Pas encore de données pour {title.toLowerCase()}.</p>
  const values = points.map((p) => p.value).concat(target ? [target.value] : [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(1, (max - min) * 0.1)
  return (
    <figure className="chart">
      <figcaption>{title} ({unit})</figcaption>
      <div className="chart-plot">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="var(--text-muted)" tickLine={false}
              axisLine={{ stroke: 'var(--chart-axis)' }} minTickGap={24} fontSize={12} />
            <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} stroke="var(--text-muted)" tickLine={false}
              axisLine={false} width={44} fontSize={12} tickFormatter={(v: number) => formatNumber(v)} />
            <Tooltip
              cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
              contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
              labelFormatter={(d) => formatShortDate(String(d))}
              formatter={(v) => [`${formatNumber(Number(v))} ${unit}`, title]} />
            {target && (
              <ReferenceLine y={target.value} stroke="var(--text-muted)" strokeDasharray="4 4"
                label={{ value: target.label, position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 12 }} />
            )}
            <Line type="monotone" dataKey="value" stroke="var(--series-1)" strokeWidth={2}
              dot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>Voir les valeurs</summary>
        <div className="table-scroll" role="region" aria-label={`Valeurs : ${title}`} tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Date</th><th scope="col">{title} ({unit})</th></tr></thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={`${p.date}-${i}`}><td>{formatShortDate(p.date)}</td><td>{formatNumber(p.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
