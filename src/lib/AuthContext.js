import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const bootDone = useRef(false)
  const active   = useRef(true)

  useEffect(() => {
    active.current   = true
    bootDone.current = false

    // Timeout absolu 6s — quoi qu'il arrive loading devient false
    const killswitch = setTimeout(() => {
      if (!bootDone.current && active.current) {
        console.warn('AuthContext: timeout — forcing loading=false')
        bootDone.current = true
        setLoading(false)
      }
    }, 6000)

    async function boot() {
      try {
        // getSession() lit le localStorage — doit être quasi instantané
        const { data: { session: s }, error: sErr } = await supabase.auth.getSession()
        if (sErr) throw sErr
        if (!active.current) return

        if (!s?.user) {
          // Pas de session → login screen
          setSession(null)
          setProfile(null)
          return
        }

        setSession(s)

        // Charger le profil avec timeout propre
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', s.user.id)
          .single()

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('profile timeout')), 4000)
        )

        const { data: p } = await Promise.race([profilePromise, timeoutPromise])
          .catch(e => { console.warn('Profile load failed:', e.message); return { data: null } })

        if (active.current) setProfile(p || null)

      } catch(e) {
        console.error('boot error:', e.message)
      } finally {
        if (active.current) {
          bootDone.current = true
          clearTimeout(killswitch)
          setLoading(false)
        }
      }
    }

    boot()

    // Listener minimaliste — seulement les vrais changements d'état
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!active.current) return
        console.log('Auth event:', event)

        if (event === 'SIGNED_OUT') {
          setSession(null); setProfile(null); setLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED' && s) {
          setSession(s)
          return
        }

        // SIGNED_IN : seulement après boot (bootDone.current = true)
        if (event === 'SIGNED_IN' && s?.user && bootDone.current) {
          setSession(s)
          try {
            const { data: p } = await supabase
              .from('profiles').select('*').eq('id', s.user.id).single()
            if (active.current) setProfile(p || null)
          } catch(e) {
            console.warn('Profile reload failed:', e.message)
          }
        }
      }
    )

    return () => {
      active.current = false
      clearTimeout(killswitch)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <Ctx.Provider value={{ session, profile, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
