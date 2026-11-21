import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Fermer en cliquant à l'extérieur (light dismiss) */
  lightDismiss?: boolean
}

/** Boîte de dialogue modale native (<dialog> + showModal). */
export function Dialog({ open, onClose, title, children, lightDismiss = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !lightDismiss || 'closedBy' in HTMLDialogElement.prototype) return
    // Repli pour Safari : fermer au clic sur le fond (appui et relâchement à l'extérieur)
    const outside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    let pressedOutside = false
    const down = (e: PointerEvent) => { pressedOutside = outside(e) }
    const up = (e: PointerEvent) => { if (pressedOutside && outside(e)) dialog.close() }
    dialog.addEventListener('pointerdown', down)
    dialog.addEventListener('pointerup', up)
    return () => {
      dialog.removeEventListener('pointerdown', down)
      dialog.removeEventListener('pointerup', up)
    }
  }, [lightDismiss])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      closedby={lightDismiss ? 'any' : 'closerequest'}
      onClose={onClose}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Fermer" onClick={() => ref.current?.close()}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      {open && children}
    </dialog>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} lightDismiss={false}>
      <p>{message}</p>
      <div className="row end">
        <button type="button" className="danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" autoFocus onClick={onCancel}>
          Annuler
        </button>
      </div>
    </Dialog>
  )
}
