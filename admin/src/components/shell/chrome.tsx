import { createContext, useContext, useEffect } from 'react'

export type Chrome = { subtitle?: string; showSearch: boolean }

type ChromeCtx = { chrome: Chrome; setChrome: (c: Chrome) => void }

export const ChromeContext = createContext<ChromeCtx | undefined>(undefined)

const DEFAULT: Chrome = { showSearch: true, subtitle: undefined }

/**
 * Lets a page tune the shared top bar. Sets on mount / when values change and
 * resets to defaults on unmount, so the next route's page owns the chrome
 * cleanly (React runs the outgoing cleanup before the incoming effect).
 */
export function useChrome(chrome: Partial<Chrome>) {
  const ctx = useContext(ChromeContext)
  const subtitle = chrome.subtitle
  const showSearch = chrome.showSearch ?? true
  useEffect(() => {
    ctx?.setChrome({ subtitle, showSearch })
    return () => ctx?.setChrome(DEFAULT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitle, showSearch])
}
