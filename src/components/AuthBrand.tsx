/** Marque Praug et barre chargée, communes aux pages de connexion. */
export function AuthBrand() {
  return (
    <div className="row between">
      <span className="brand auth-brand">
        <span className="brand-mark" aria-hidden="true" />
        Praug
      </span>
      <span className="auth-plates" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
    </div>
  )
}
