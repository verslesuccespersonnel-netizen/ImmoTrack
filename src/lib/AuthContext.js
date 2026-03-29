// src/lib/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined) // undefined = pas encore vérifié
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const loadingRef              = useRef(false)

  useEffect(() => {
    let mounted = true

    // Timeout de sécurité : si au bout de 8s on n'a pas fini, on libère
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('AuthContext timeout — libération forcée')
        setLoading(false)
      }
    }, 8000)

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id, mounted)
        }
      } catch(e) {
        console.error('Auth init error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        setSession(session)
        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setLoading(false)
          return
        }
        if (session?.user) {
          await fetchProfile(session.user.id, mounted)
        }
        if (mounted) setLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId, mounted = true) {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()  // ne throw pas si 0 résultats

      if (!mounted) return
      if (error) {
        console.error('Profil fetch error:', error.message)
        setProfile(null)
        return
      }
      if (!data) {
        // Profil absent — créer un profil minimal pour ne pas bloquer
        console.warn('Profil absent, création automatique...')
        const { data: created } = await supabase
          .from('profiles')
          .insert({ id: userId, role: 'locataire', nom: 'Utilisateur', prenom: 'Nouveau' })
          .select()
          .maybeSingle()
        if (mounted) setProfile(created || null)
        return
      }
      setProfile(data)
    } catch(e) {
      console.error('fetchProfile exception:', e)
      if (mounted) setProfile(null)
    } finally {
      loadingRef.current = false
    }
  }

  async function reloadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await fetchProfile(session.user.id)
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
