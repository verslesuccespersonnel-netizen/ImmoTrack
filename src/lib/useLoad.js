import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'

export function useLoad(fetcher, deps) {
  const { loading: authLoading } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const ctrlRef    = useRef(null)
  const fetcherRef = useRef(fetcher)
  const depsKey    = JSON.stringify(deps || [])
  fetcherRef.current = fetcher

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setError(null)
    const t = setTimeout(() => ctrl.abort('timeout'), 10000)
    fetcherRef.current(ctrl.signal)
      .then(result => { if (!ctrl.signal.aborted) setData(result) })
      .catch(e => { if (!ctrl.signal.aborted) setError(e.message) })
      .finally(() => { clearTimeout(t); if (!ctrl.signal.aborted) setLoading(false) })
    return () => { ctrl.abort() }
  }, [authLoading, depsKey]) // depsKey = JSON stable, pas de spread

  function reload() {
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setLoading(true)
    setError(null)
    fetcherRef.current(ctrl.signal)
      .then(result => { if (!ctrl.signal.aborted) setData(result) })
      .catch(e => { if (!ctrl.signal.aborted) setError(e.message) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
  }

  return { data, loading, error, reload }
}
