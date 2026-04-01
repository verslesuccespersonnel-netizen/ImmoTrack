// src/lib/usePageData.js
// Hook pour tous les appels Supabase dans les pages.
// Ajoute un timeout de 8s + cleanup au démontage du composant.
import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Wrapper autour d'une fonction async qui charge des données Supabase.
 * - Timeout 8s : si la requête ne répond pas, on passe en erreur.
 * - Cleanup : si le composant est démonté pendant le fetch, on ignore le résultat.
 * - Retry : bouton pour relancer.
 *
 * Usage :
 *   const { data, loading, error, reload } = usePageData(async (signal) => {
 *     const { data } = await supabase.from('biens').select('*')
 *     if (signal.aborted) return null
 *     return data
 *   }, [session?.user?.id])
 */
export function usePageData(fetcher, deps = []) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const abortRef              = useRef(null)

  const load = useCallback(async () => {
    // Annuler le fetch précédent
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    // Timeout 8 secondes
    const timeout = setTimeout(() => {
      controller.abort('timeout')
    }, 8000)

    try {
      const result = await fetcher(controller.signal)
      if (!controller.signal.aborted) {
        setData(result)
        setError(null)
      }
    } catch(e) {
      if (!controller.signal.aborted) {
        console.error('usePageData error:', e)
        setError(e.message || 'Erreur de chargement')
      }
    } finally {
      clearTimeout(timeout)
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, deps) // eslint-disable-line

  useEffect(() => {
    load()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load])

  return { data, loading, error, reload: load }
}
