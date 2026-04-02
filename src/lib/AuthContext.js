// AuthContext.js — version minimale sans race condition
// Principe : getSession() pour init, onAuthStateChange pour SIGNED_OUT seulement
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = pas encore vérifié
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // ── Init : getSession() lit le localStorage directement ──
    // Ne dépend PAS du WebSocket → toujours fiable
    async function init() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (cancelled) return

        if (s?.user) {
          setSession(s)
          // Charger le profil
          const { data } = await supabase
            .from('profiles').select('*').eq('id', s.user.id).single()
          if (!cancelled) {
            setProfile(data || null)
            console.log('Profile:', data?.role)
          }
        } else {
          setSession(null)
          setProfile(null)
        }
      } catch(e) {
        console.error('Auth init error:', e.message)
        if (!cancelled) { setSession(null); setProfile(null) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    // ── Listener minimal : SIGNED_OUT et TOKEN_REFRESHED seulement ──
    // On NE gère PAS INITIAL_SESSION ni SIGNED_IN ici
    // pour éviter la double exécution vue dans la console
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (cancelled) return
        console.log('Auth event:', event)

        if (event === 'SIGNED_OUT' || !s) {
          setSession(null); setProfile(null); setLoading(false)
          return
        }
        if (event === 'TOKEN_REFRESHED' && s) {
          setSession(s)
          return
        }
        // SIGNED_IN après le premier load : recharger le profil silencieusement
        // SANS toucher à loading (déjà false)
        if (event === 'SIGNED_IN' && s?.user && !loading) {
          const { data } = await supabase
            .from('profiles').select('*').eq('id', s.user.id).single()
          if (!cancelled) {
            setSession(s)
            setProfile(data || null)
          }
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
