import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'

// Hook générique pour charger des données en attendant que l'auth soit prête
export function useLoad(fetcher, deps = []) {
  const { loading: authLoading } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const ctrlRef = useRef(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    // Ne pas charger tant que l'auth n'est pas prête
    if (authLoading) return
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true); setError(null)
    const t = setTimeout(() => ctrl.abort('timeout'), 10000)
    try {
      const result = await fetcher(ctrl.signal)
      if (ctrl.signal.aborted) return
      setData(result)
    } catch(e) {
      if (ctrl.signal.aborted) return
      setError(e.message)
    } finally {
      clearTimeout(t)
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [authLoading, ...deps]) // authLoading dans les deps = retry quand auth prêt

  useEffect(() => {
    run()
    return () => { if (ctrlRef.current) ctrlRef.current.abort() }
  }, [run])

  return { data, loading, error, reload: run }
}
