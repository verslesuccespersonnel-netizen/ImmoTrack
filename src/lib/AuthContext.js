// src/lib/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    let active = true
    const kill = setTimeout(() => { if (active) setLoading(false) }, 12000)

    async function fetchProfile(userId) {
      setDebugInfo(`Lecture profil pour ${userId.slice(0,8)}...`)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        setDebugInfo(`ERREUR RLS: ${error.message}`)
        console.error('Profile RLS error:', error)
        return null
      }

      if (!data) {
        setDebugInfo(`Profil introuvable — attente trigger...`)
        await new Promise(r => setTimeout(r, 1500))
        const { data: d2, error: e2 } = await supabase
          .from('profiles').select('*').eq('id', userId).maybeSingle()
        if (e2) { setDebugInfo(`ERREUR 2: ${e2.message}`); return null }
        setDebugInfo(d2 ? `Profil OK: ${d2.role}` : 'Profil absent après 2 essais')
        return d2 || null
      }

      setDebugInfo(`Profil chargé: role=${data.role}`)
      console.log('Profile loaded:', data)
      return data
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return
        console.log('Auth event:', event, 'user:', session?.user?.id)
        setSession(session)

        if (!session?.user) {
          setProfile(null)
          setLoading(false)
          return
        }

        const p = await fetchProfile(session.user.id)
        if (!active) return
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
      .from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setProfile(data || null)
  }

  // debugInfo exposé pour affichage dans l'UI si besoin
  return (
    <AuthContext.Provider value={{ session, profile, loading, reloadProfile, debugInfo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
