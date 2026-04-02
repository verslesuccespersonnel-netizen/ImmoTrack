import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Séquentiel strict : getSession → profil → loading=false
    // Aucune async en parallèle, aucune race condition possible
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (cancelled) return
        if (!s?.user) { setSession(null); setProfile(null); setLoading(false); return }
        setSession(s)
        return supabase.from('profiles').select('*').eq('id', s.user.id).single()
      })
      .then(res => {
        if (cancelled || !res) return
        console.log('Profile:', res.data?.role)
        setProfile(res.data || null)
        setLoading(false)
      })
      .catch(err => {
        console.error('Auth init:', err.message)
        if (!cancelled) setLoading(false)
      })

    // Listener minimal — uniquement SIGNED_OUT et TOKEN_REFRESHED
    // On ignore INITIAL_SESSION et SIGNED_IN pour éviter la double exécution
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT')      { setSession(null); setProfile(null) }
      if (event === 'TOKEN_REFRESHED') { setSession(s) }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
