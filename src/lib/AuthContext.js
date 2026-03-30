import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => { if(active) setLoading(false) }, 10000)

    supabase.auth.getSession().then(async ({ data: { session }}) => {
      if (!active) return
      setSession(session)
      if (session?.user) {
        const p = await loadProfile(session.user.id)
        if (active) setProfile(p)
      }
      if (active) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return
      setSession(session)
      if (event === 'SIGNED_OUT') { setProfile(null); setLoading(false); return }
      if (session?.user) {
        setLoading(true)
        const p = await loadProfile(session.user.id)
        if (active) { setProfile(p); setLoading(false) }
      }
    })

    return () => { active = false; clearTimeout(timer); subscription.unsubscribe() }
  }, [])

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  if (error) { console.error('Profile error:', error.code, error.message); return null }
  console.log('Profile OK:', data.role)
  return data
}

export function useAuth() { return useContext(AuthContext) }
