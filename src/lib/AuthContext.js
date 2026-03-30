import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    if (error) { console.error('Profile:', error.code, error.message); return null }
    console.log('Profile OK:', data.role, data.nom)
    return data
  }, [])

  useEffect(() => {
    let mounted = true
    const kill = setTimeout(() => { if (mounted) setLoading(false) }, 10000)

    // Unique source de vérité : onAuthStateChange
    // Supabase déclenche INITIAL_SESSION dès le montage avec la session existante
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.log('Auth:', event)

        if (event === 'SIGNED_OUT' || !session) {
          setSession(null); setProfile(null); setLoading(false); return
        }

        // TOKEN_REFRESHED = session renouvelée silencieusement, on garde le profil
        if (event === 'TOKEN_REFRESHED' && profile) {
          setSession(session); return
        }

        setSession(session)

        // Charger/recharger le profil
        const p = await fetchProfile(session.user.id)
        if (mounted) { setProfile(p); setLoading(false) }
      }
    )

    // Activer le refresh automatique des tokens
    supabase.auth.startAutoRefresh()

    return () => {
      mounted = false
      clearTimeout(kill)
      subscription.unsubscribe()
      supabase.auth.stopAutoRefresh()
    }
  }, [fetchProfile])

  async function reloadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const p = await fetchProfile(session.user.id)
    setProfile(p)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
