import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Charger session initiale
    async function boot() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!active) return
        if (s?.user) {
          setSession(s)
          const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single()
          if (active) setProfile(p || null)
        }
      } catch(e) {
        console.error('boot:', e.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    boot()

    // Listener pour SIGNED_IN (login), SIGNED_OUT, TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!active) return
        console.log('Auth:', event)

        if (event === 'SIGNED_OUT') {
          setSession(null); setProfile(null); setLoading(false)
          return
        }

        if (event === 'SIGNED_IN' && s?.user) {
          setSession(s)
          setLoading(true)
          const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single()
          if (active) { setProfile(p || null); setLoading(false) }
          return
        }

        if (event === 'TOKEN_REFRESHED' && s) {
          setSession(s)
        }
      }
    )

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  return <Ctx.Provider value={{ session, profile, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
