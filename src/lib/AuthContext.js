// src/lib/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Timeout absolu : 10s max, jamais bloqué
    const kill = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 10000)

    async function fetchProfile(userId) {
      // Essai 1
      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      // Si pas encore créé par le trigger, on attend 1.5s et on retente
      if (!data) {
        await new Promise(r => setTimeout(r, 1500))
        const r2 = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
        data = r2.data
      }

      // On retourne ce qu'on a — sans jamais créer de profil par défaut
      // (c'est le rôle du trigger SQL handle_new_user)
      return data || null
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      setSession(session)
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        if (!cancelled) setProfile(p)
      }
      if (!cancelled) setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        setSession(session)

        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setLoading(true)
          const p = await fetchProfile(session.user.id)
          if (!cancelled) {
            setProfile(p)
            setLoading(false)
          }
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      cancelled = true
      clearTimeout(kill)
      subscription.unsubscribe()
    }
  }, [])

  async function reloadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    setProfile(data || null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
