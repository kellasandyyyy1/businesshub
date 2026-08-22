import { IconWifiOff } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

/**
 * Says the quiet part out loud when the network drops.
 *
 * Nothing actually stops working — the ledger lives in IndexedDB — so the
 * message reassures rather than warns. Only the assistant and push delivery
 * need the network, and both fail politely on their own.
 */
export default function OfflineBar() {
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // The shell reads this to shift its own chrome down by the bar's height.
  useEffect(() => {
    document.documentElement.dataset.offline = offline ? 'true' : 'false'
    return () => {
      delete document.documentElement.dataset.offline
    }
  }, [offline])

  if (!offline) return null

  return (
    <div className="bfh-offlinebar" role="status">
      <IconWifiOff size={13} stroke={1.5} aria-hidden="true" />
      <span>You&rsquo;re offline. Your data is safe and the app still works.</span>
    </div>
  )
}
