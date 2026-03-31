// src/lib/AuthContext.js — Version robuste avec gestion visibilité onglet
import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const activeRef               = useRef(true)
  const loadingRef              = useRef(true)

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      if (!activeRef.current) return null
      if (error) { console.error('Profile:', error.code); return null }
      console.log('Profile OK:', data.role)
      return data
    } catch(e) {
      console.error('fetchProfile exception:', e)
      return null
    }
  }

  async function refreshSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) return false
      // Forcer un refresh du token si proche de l'expiration
      const exp = session.expires_at
      const now  = Math.floor(Date.now() / 1000)
      if (exp - now < 300) { // < 5 min restantes
        await supabase.auth.refreshSession()
      }
      return true
    } catch(e) {
      console.error('refreshSession error:', e)
      return false
    }
  }

  useEffect(() => {
    activeRef.current = true
    loadingRef.current = true

    // Timeout absolu 8s
    const kill = setTimeout(() => {
      if (loadingRef.current && activeRef.current) {
        console.warn('Auth timeout')
        setLoading(false)
        loadingRef.current = false
      }
    }, 8000)

    // Unique source de vérité
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!activeRef.current) return
        console.log('Auth:', event)

        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null)
          setProfile(null)
          setLoading(false)
          loadingRef.current = false
          return
        }
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession)
          return // Profil déjà chargé
        }

        setSession(newSession)
        const p = await fetchProfile(newSession.user.id)
        if (activeRef.current) {
          setProfile(p)
          setLoading(false)
          loadingRef.current = false
        }
      }
    )

    // ── Gestion changement de visibilité de l'onglet ─────
    // Quand l'utilisateur revient sur l'onglet, on vérifie
    // et rafraîchit la session silencieusement
    async function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      console.log('Tab visible — checking session')
      const ok = await refreshSession()
      if (!ok) {
        // Session vraiment expirée → déconnecter proprement
        console.warn('Session expired on tab return')
        setSession(null)
        setProfile(null)
        setLoading(false)
        loadingRef.current = false
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    // Vérification périodique toutes les 4 minutes
    const interval = setInterval(async () => {
      if (!activeRef.current || loadingRef.current) return
      await refreshSession()
    }, 4 * 60 * 1000)

    return () => {
      activeRef.current = false
      clearTimeout(kill)
      clearInterval(interval)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  async function reloadProfile() {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (!s?.user) return
    const p = await fetchProfile(s.user.id)
    setProfile(p)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
