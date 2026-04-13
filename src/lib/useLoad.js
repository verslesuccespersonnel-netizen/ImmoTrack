// src/lib/useLoad.js
// Hook de chargement avec AbortController + timeout.
// NE gère PAS le visibilitychange — c'est géré par index.html (pageshow reload).
import { useState, useEffect, useCallback, useRef } from 'react'

export function useLoad(fetcher, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const ctrlRef               = useRef(null)

  const run = useCallback(async () => {
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => ctrl.abort('timeout'), 8000)
    try {
      const result = await fetcher(ctrl.signal)
      if (ctrl.signal.aborted) return
      setData(result)
    } catch(e) {
      if (ctrl.signal.aborted) return
      setError(e.message)
    } finally {
      clearTimeout(timeout)
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, deps) // eslint-disable-line

  useEffect(() => {
    run()
    return () => { if (ctrlRef.current) ctrlRef.current.abort() }
  }, [run])

  return { data, loading, error, reload: run }
}
