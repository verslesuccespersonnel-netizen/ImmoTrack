// src/lib/useLoad.js
// Hook partagé pour TOUS les chargements de données Supabase.
// Gère : AbortController, timeout 8s, visibilitychange → rechargement.
import { useState, useEffect, useCallback, useRef } from 'react'

export function useLoad(fetcher, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const ctrlRef               = useRef(null)

  const run = useCallback(async () => {
    // Annuler le fetch précédent s'il est encore en cours
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl

    setLoading(true)
    setError(null)

    // Timeout 8s
    const timeout = setTimeout(() => {
      if (!ctrl.signal.aborted) ctrl.abort('timeout')
    }, 8000)

    try {
      const result = await fetcher(ctrl.signal)
      if (ctrl.signal.aborted) return
      setData(result)
      setError(null)
    } catch(e) {
      if (ctrl.signal.aborted) return // ignoré si annulé
      console.error('useLoad error:', e.message)
      setError(e.message)
    } finally {
      clearTimeout(timeout)
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, deps) // eslint-disable-line

  // Lancer au montage et quand les deps changent
  useEffect(() => {
    run()
    return () => { if (ctrlRef.current) ctrlRef.current.abort() }
  }, [run])

  // Recharger quand l'onglet redevient visible
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [run])

  return { data, loading, error, reload: run }
}
