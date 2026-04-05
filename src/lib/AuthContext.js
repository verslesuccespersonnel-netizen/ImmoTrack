import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Ref pour suivre si boot() est terminé — évite la closure stale
  const bootDoneRef = useRef(false)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      return data || null
    } catch { return null }
  }

  useEffect(() => {
    let active = true
    bootDoneRef.current = false

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
        console.error('boot:', e.message)
      } finally {
        if (active) {
          bootDoneRef.current = true  // marquer boot terminé
          setLoading(false)
        }
      }
    }

    boot()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!active) return
        console.log('Auth:', event)

        if (event === 'SIGNED_OUT' || !s) {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED' && s) {
          setSession(s)
          return
        }

        // SIGNED_IN : utiliser le REF (pas la variable) pour vérifier si boot est fait
        if (event === 'SIGNED_IN' && s?.user) {
          setSession(s)
          if (bootDoneRef.current) {
            // Boot déjà terminé → c'est un vrai nouveau login, charger le profil
            const p = await fetchProfile(s.user.id)
            if (active) setProfile(p)
          }
          // Sinon boot() s'en occupe déjà, on ne touche pas à loading
        }
      }
    )

    return () => {
      active = false
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
