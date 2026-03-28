// src/lib/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // 1. Session initiale — une seule source de vérité via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    // 2. Forcer la récupération de la session existante au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      // onAuthStateChange le gère déjà, mais si pas de session on stop le loading
      if (!session) setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Profil pas encore créé (race condition post-inscription)
        // On retente une fois après 1 seconde
        setTimeout(async () => {
          const { data: data2 } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          setProfile(data2 || null)
          setLoading(false)
        }, 1000)
        return
      }
      setProfile(data)
    } catch (e) {
      console.error('Erreur chargement profil:', e)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, reloadProfile: () => session && loadProfile(session.user.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
