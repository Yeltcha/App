import { useState } from 'react'

type StorageKind = 'local' | 'session'

function storage(kind: StorageKind): Storage | null {
  try { return kind === 'local' ? localStorage : sessionStorage } catch { return null }
}

function read(kind: StorageKind, key: string): Set<string> {
  try {
    const value = JSON.parse(storage(kind)?.getItem(key) ?? '[]')
    return new Set(Array.isArray(value) ? value.map(String) : [])
  } catch { return new Set() }
}

/** Éléments repliés (séances d'un programme, exercices d'une séance), gardés dans le navigateur. */
export function useCollapsed(key: string, kind: StorageKind = 'local') {
  const [collapsed, setState] = useState<Set<string>>(() => read(kind, key))
  const save = (next: Set<string>) => {
    setState(next)
    try { storage(kind)?.setItem(key, JSON.stringify([...next])) } catch { /* stockage indisponible */ }
  }
  return {
    isCollapsed: (id: string) => collapsed.has(id),
    toggle: (id: string) => {
      const next = new Set(collapsed)
      if (!next.delete(id)) next.add(id)
      save(next)
    },
    /** Replie tout (ids donnés) ou déplie tout (liste vide) */
    setAll: (ids: string[]) => save(new Set(ids)),
    count: collapsed.size,
  }
}
