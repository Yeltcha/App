import { registerSW } from 'virtual:pwa-register'

const HOUR = 60 * 60 * 1000

/**
 * Enregistre le service worker et vérifie s'il existe une nouvelle version
 * chaque fois que l'app revient au premier plan (et toutes les heures).
 * Sans ça, Safari sur iPhone peut garder l'ancienne version pendant des jours :
 * il ne revérifie qu'au chargement d'une page, et une app rouverte depuis
 * l'arrière-plan ne recharge rien. Avec registerType 'autoUpdate', la page se
 * recharge d'elle-même dès que la nouvelle version est installée.
 */
export function startPwaUpdates() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) return
        registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
      setInterval(check, HOUR)
    },
  })
}
