// src/lib/AuthContext.js — version définitive sans race condition
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Timeout absolu 12s
    const kill = setTimeout(() => {
      if (active) { console.warn('Auth timeout'); setLoading(false) }
    }, 12000)

    async function getProfile(userId) {
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (error) { console.error('Profile error:', error); break }
        if (data)  { return data }
        // Profil pas encore créé, on attend
        await new Promise(r => setTimeout(r, 800))
      }
      return null
    }

    // UN SEUL point d'entrée : onAuthStateChange
    // Il se déclenche immédiatement avec la session existante (INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return
        console.log('Auth event:', event, session?.user?.id)

        setSession(session)

        if (!session?.user) {
          setProfile(null)
          setLoading(false)
          return
        }

        // Toujours lire le profil FRAIS depuis la base
        const p = await getProfile(session.user.id)
        if (!active) return

        console.log('Profile loaded:', p)
        setProfile(p)
        setLoading(false)
      }
    )

    return () => {
      active = false
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
