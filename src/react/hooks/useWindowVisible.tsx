import uiStore from '@/react/stores/uiStore'
import { log } from '@/utils/logger'
import { useEffect } from 'react'

export default function useWindowVisible() {
  useEffect(() => {
    const handleVisibilityChange = () => {
      log('windowVisible', !document.hidden)
      uiStore.windowVisible.set(!document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
