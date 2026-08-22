import { useEffect, useState } from 'react'

/** Running from the home screen rather than a browser tab. */
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

/**
 * Everything the install controls need to know.
 *
 * Chrome hands over a `beforeinstallprompt` event that can be replayed later;
 * iOS never fires one, so there the only honest option is to explain the manual
 * steps instead of offering a button that cannot work.
 */
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() => standalone())
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (standalone()) {
      setIsInstalled(true)
      return undefined
    }

    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream)

    const onPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const triggerInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    // The event is single-use either way.
    setInstallPrompt(null)
  }

  return { canInstall: Boolean(installPrompt), isInstalled, isIOS, triggerInstall }
}

export default usePWAInstall
