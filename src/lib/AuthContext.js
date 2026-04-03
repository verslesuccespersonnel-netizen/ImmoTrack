// AuthContext.js — architecture sans race condition
// Règle d'or : getSession() pour l'init, onAuthStateChange UNIQUEMENT pour SIGNED_OUT
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Étape 1 : lire la session depuis le localStorage (synchrone, sans WebSocket)
    // Étape 2 : charger le profil depuis Supabase
    // Étape 3 : setLoading(false)
    // Séquentiel strict → aucune race condition possible
    async function boot() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!active) return
        if (!s?.user) { setLoading(false); return }

        setSession(s)
        const { data: p } = await supabase
          .from('profiles').select('*').eq('id', s.user.id).single()
        if (!active) return
        setProfile(p || null)
      } catch(e) {
        console.error('Auth boot error:', e.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    boot()

    // Listener minimal : uniquement SIGNED_OUT et TOKEN_REFRESHED
    // On N'écoute PAS SIGNED_IN ni INITIAL_SESSION → évite la double exécution
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return
      if (event === 'SIGNED_OUT') { setSession(null); setProfile(null) }
      if (event === 'TOKEN_REFRESHED' && s) { setSession(s) }
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function reload() {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (!s?.user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single()
    setProfile(p || null)
  }

  return <Ctx.Provider value={{ session, profile, loading, reload }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
