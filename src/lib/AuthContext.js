// AuthContext.js — architecture séparée : getSession() pour le démarrage,
// onAuthStateChange uniquement pour les changements réels
import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      return data || null
    } catch { return null }
  }

  useEffect(() => {
    mountedRef.current = true

    // ── ÉTAPE 1 : Chargement initial via getSession() ────
    // getSession() est synchrone (lit le localStorage), ne dépend
    // PAS du WebSocket → toujours fiable même si l'onglet revient
    async function init() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!mountedRef.current) return
        if (s?.user) {
          setSession(s)
          const p = await fetchProfile(s.user.id)
          if (mountedRef.current) setProfile(p)
        } else {
          setSession(null)
          setProfile(null)
        }
      } catch(e) {
        console.error('Init error:', e)
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    init()

    // ── ÉTAPE 2 : Listener pour les vrais changements ────
    // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED uniquement
    // On ne l'utilise PLUS pour mettre à jour loading
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mountedRef.current) return
        console.log('Auth event:', event)

        if (event === 'SIGNED_OUT') {
          setSession(null); setProfile(null); return
        }
        if (event === 'TOKEN_REFRESHED' && s) {
          setSession(s); return
        }
        if ((event === 'SIGNED_IN') && s?.user) {
          setSession(s)
          const p = await fetchProfile(s.user.id)
          if (mountedRef.current) setProfile(p)
        }
      }
    )

    // ── ÉTAPE 3 : Retour sur l'onglet ────────────────────
    // On relit getSession() — garanti de lire le localStorage à jour
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (!mountedRef.current) return
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!mountedRef.current) return
        if (!s) {
          // Session vraiment expirée
          setSession(null); setProfile(null)
          setLoading(false)
        } else if (!session) {
          // Session revenue après expiration temp
          setSession(s)
          const p = await fetchProfile(s.user.id)
          if (mountedRef.current) { setProfile(p); setLoading(false) }
        }
      } catch(e) {
        console.warn('visibilitychange check failed:', e.message)
      }
    }

    document.addEventListener('visibilitychange', onVisible)

    // Refresh léger toutes les 3 min pour maintenir le token
    const interval = setInterval(() => {
      if (mountedRef.current) supabase.auth.getSession().catch(() => {})
    }, 3 * 60 * 1000)

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
