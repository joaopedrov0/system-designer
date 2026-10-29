import { useSyncExternalStore } from 'react'

/** Mesmo ponto de corte do `md` do Tailwind (768 px). */
const QUERY = '(max-width: 767px)'

const query = () => window.matchMedia(QUERY)

function subscribe(onChange: () => void) {
  const q = query()
  q.addEventListener('change', onChange)
  return () => q.removeEventListener('change', onChange)
}

/** Tela estreita (celular): a interface troca as colunas laterais por gavetas. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => query().matches)
}
