import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null)
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [recovery, setRecovery] = useState(false) // true = l'user doit changer son mdp
  const bootDone = useRef(false)

  async function fetchProfile(userId) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single()
    return p || null
  }

  useEffect(() => {
    let active = true
    bootDone.current = false

    const kill = setTimeout(() => {
      if (!bootDone.current && active) { bootDone.current = true; setLoading(false) }
    }, 8000)

    async function boot() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (!active) return
        if (s?.user) {
          setSession(s)
          const p = await fetchProfile(s.user.id)
          if (active) setProfile(p)
        }
      } catch(e) {
        console.error('AuthContext boot:', e.message)
      } finally {
        if (active) { bootDone.current = true; clearTimeout(kill); setLoading(false) }
      }
    }

    boot()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!active) return

      if (event === 'PASSWORD_RECOVERY') {
        // L'utilisateur a cliqué le lien de réinitialisation
        // On le connecte MAIS on le force à changer son mdp avant de continuer
        if (s?.user) {
          setSession(s)
          const p = await fetchProfile(s.user.id)
          if (active) { setProfile(p); setRecovery(true); setLoading(false) }
        }
        return
      }

      if (event === 'SIGNED_OUT' || !s) {
        setSession(null); setProfile(null); setRecovery(false); setLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED' && s) {
        setSession(s)
        return
      }

      if (event === 'USER_UPDATED' && s) {
        // Mot de passe changé avec succès → sortir du mode recovery
        setSession(s)
        setRecovery(false)
        return
      }

      if (event === 'SIGNED_IN' && s?.user && bootDone.current) {
        setSession(s)
        const p = await fetchProfile(s.user.id)
        if (active) setProfile(p)
      }
    })

    return () => { active = false; clearTimeout(kill); subscription.unsubscribe() }
  }, [])

  return (
    <Ctx.Provider value={{ session, profile, loading, recovery }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
