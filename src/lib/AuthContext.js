import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const mountedRef               = useRef(true)
  const fetchingRef              = useRef(false)

  async function fetchProfile(userId) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      if (!mountedRef.current) return
      if (error) { console.error('Profile error:', error.code); setProfile(null) }
      else { console.log('Profile OK:', data.role); setProfile(data) }
    } catch(e) {
      console.error('Profile exception:', e)
      if (mountedRef.current) setProfile(null)
    } finally {
      fetchingRef.current = false
    }
  }

  useEffect(() => {
    mountedRef.current = true
    // Timeout 8s absolu
    const kill = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn('Auth timeout - forcing unlock')
        setLoading(false)
      }
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mountedRef.current) return
        console.log('Auth event:', event)

        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null); setProfile(null); setLoading(false)
          return
        }
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession); return
        }
        // INITIAL_SESSION ou SIGNED_IN
        setSession(newSession)
        await fetchProfile(newSession.user.id)
        if (mountedRef.current) setLoading(false)
      }
    )

    return () => {
      mountedRef.current = false
      clearTimeout(kill)
      subscription.unsubscribe()
    }
  }, [])

  async function reloadProfile() {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s?.user) await fetchProfile(s.user.id)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
