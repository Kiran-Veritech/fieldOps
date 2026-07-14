import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Chrome = { subtitle?: string; showSearch: boolean }

export type SearchHit = {
  id: string
  title: string
  subtitle?: string
  kind: 'operator' | 'project'
}

type ChromeCtx = {
  chrome: Chrome
  setChrome: (c: Chrome) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchHits: SearchHit[]
  setSearchHits: (hits: SearchHit[]) => void
  onSearchSelect: ((hit: SearchHit) => void) | null
  setOnSearchSelect: (fn: ((hit: SearchHit) => void) | null) => void
  clearSearch: () => void
}

export const ChromeContext = createContext<ChromeCtx | undefined>(undefined)

const DEFAULT: Chrome = { showSearch: true, subtitle: undefined }

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<Chrome>(DEFAULT)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [onSearchSelect, setOnSearchSelect] = useState<((hit: SearchHit) => void) | null>(null)

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchHits([])
  }, [])

  // Wrap so consumers can pass a bare function without it being treated as a
  // setState updater.
  const setSelectHandler = useCallback((fn: ((hit: SearchHit) => void) | null) => {
    setOnSearchSelect(() => fn)
  }, [])

  return (
    <ChromeContext.Provider
      value={{
        chrome,
        setChrome,
        searchQuery,
        setSearchQuery,
        searchHits,
        setSearchHits,
        onSearchSelect,
        setOnSearchSelect: setSelectHandler,
        clearSearch,
      }}
    >
      {children}
    </ChromeContext.Provider>
  )
}

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
    return () => {
      ctx?.setChrome(DEFAULT)
      ctx?.clearSearch()
      ctx?.setSearchHits([])
      ctx?.setOnSearchSelect(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitle, showSearch])
}

export function useGlobalSearch() {
  const ctx = useContext(ChromeContext)
  if (!ctx) {
    return {
      searchQuery: '',
      setSearchQuery: (_q: string) => {},
      searchHits: [] as SearchHit[],
      setSearchHits: (_h: SearchHit[]) => {},
      onSearchSelect: null as ((hit: SearchHit) => void) | null,
      setOnSearchSelect: (_fn: ((hit: SearchHit) => void) | null) => {},
      clearSearch: () => {},
    }
  }
  return {
    searchQuery: ctx.searchQuery,
    setSearchQuery: ctx.setSearchQuery,
    searchHits: ctx.searchHits,
    setSearchHits: ctx.setSearchHits,
    onSearchSelect: ctx.onSearchSelect,
    setOnSearchSelect: ctx.setOnSearchSelect,
    clearSearch: ctx.clearSearch,
  }
}

export function useChromeState() {
  const ctx = useContext(ChromeContext)
  if (!ctx) return { chrome: DEFAULT }
  return { chrome: ctx.chrome }
}
