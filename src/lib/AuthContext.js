import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchProfile(userId) {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      return data || null
    }

    // Boot : getSession() lit le localStorage — synchrone, fiable, sans WebSocket
    async function boot() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!active) return
        if (s?.user) {
          setSession(s)
          const p = await fetchProfile(s.user.id)
          if (active) setProfile(p)
        }
      } catch(e) {
        console.error('boot error:', e.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    boot()

    // Listener MINIMAL — uniquement pour :
    // 1. SIGNED_IN : login utilisateur (nouveau)
    // 2. SIGNED_OUT : déconnexion
    // 3. TOKEN_REFRESHED : renouvellement silencieux
    //
    // On IGNORE INITIAL_SESSION car boot() s'en charge déjà.
    // On vérifie que loading est terminé avant de traiter SIGNED_IN
    // pour éviter de relancer un fetch si on vient du bfcache.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!active) return
        console.log('Auth:', event)

        if (event === 'SIGNED_OUT' || !s) {
          setSession(null); setProfile(null); setLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED' && s) {
          setSession(s)
          return
        }

        // SIGNED_IN : seulement si on n'est PAS en train de booter
        // et que la session a changé (vrai nouveau login)
        if (event === 'SIGNED_IN' && s?.user) {
          setSession(s)
          // Charger le profil seulement si loading est déjà false
          // (sinon boot() s'en occupe déjà)
          if (!loading) {
            const p = await fetchProfile(s.user.id)
            if (active) setProfile(p)
          }
        }
      }
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line

  return (
    <Ctx.Provider value={{ session, profile, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
