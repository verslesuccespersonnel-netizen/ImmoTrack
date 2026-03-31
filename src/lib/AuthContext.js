import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const doneRef = useRef(false)
  const mountedRef = useRef(true)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      return data || null
    } catch { return null }
  }

  function finalize(sess, prof) {
    if (!mountedRef.current || doneRef.current) return
    doneRef.current = true
    setSession(sess)
    setProfile(prof)
    setLoading(false)
  }

  useEffect(() => {
    mountedRef.current = true
    doneRef.current = false

    // Timeout absolu 6s
    const kill = setTimeout(() => {
      if (!doneRef.current) {
        console.warn('Auth timeout — forcing unlock')
        finalize(null, null)
      }
    }, 6000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!mountedRef.current) return
        console.log('Auth:', event)

        if (event === 'SIGNED_OUT' || !sess) {
          finalize(null, null); return
        }
        if (event === 'TOKEN_REFRESHED') {
          // Session rafraîchie silencieusement — juste mettre à jour session
          setSession(sess); return
        }
        // INITIAL_SESSION ou SIGNED_IN — charger le profil
        const p = await fetchProfile(sess.user.id)
        if (mountedRef.current) finalize(sess, p)
      }
    )

    // Retour sur l'onglet → vérifier la session
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession()
        if (error || !s) {
          // Session réellement perdue
          if (mountedRef.current) {
            setSession(null); setProfile(null)
            setLoading(false); doneRef.current = true
          }
        }
        // Si session valide, TOKEN_REFRESHED se déclenchera si besoin
      } catch(e) {
        console.warn('onVisible check failed:', e.message)
      }
    }

    // Refresh périodique pour éviter l'expiration silencieuse
    const interval = setInterval(async () => {
      if (!mountedRef.current) return
      try { await supabase.auth.getSession() } catch {}
    }, 2 * 60 * 1000) // toutes les 2 minutes

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      mountedRef.current = false
      clearTimeout(kill)
      clearInterval(interval)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
