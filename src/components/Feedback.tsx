export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <p role="alert" className="error">
      <span aria-hidden="true">⚠ </span>
      {message}
    </p>
  )
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <p role="status" className="muted">
      {label}
    </p>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>
}
