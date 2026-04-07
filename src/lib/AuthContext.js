import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'
const Ctx = createContext(null)
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const bootDone = useRef(false)
  useEffect(() => {
    let active = true
    bootDone.current = false
    const kill = setTimeout(() => { if(!bootDone.current&&active){bootDone.current=true;setLoading(false)} }, 6000)
    async function boot() {
      try {
        const {data:{session:s}} = await supabase.auth.getSession()
        if(!active) return
        if(s?.user) {
          setSession(s)
          const {data:p} = await supabase.from('profiles').select('*').eq('id',s.user.id).single()
          if(active) setProfile(p||null)
        }
      } catch(e) { console.error('boot:',e.message) }
      finally { if(active){bootDone.current=true;clearTimeout(kill);setLoading(false)} }
    }
    boot()
    const {data:{subscription}} = supabase.auth.onAuthStateChange(async(event,s)=>{
      if(!active) return
      if(event==='SIGNED_OUT'||!s){setSession(null);setProfile(null);setLoading(false);return}
      if(event==='TOKEN_REFRESHED'&&s){setSession(s);return}
      if(event==='SIGNED_IN'&&s?.user&&bootDone.current){
        setSession(s)
        const {data:p}=await supabase.from('profiles').select('*').eq('id',s.user.id).single()
        if(active)setProfile(p||null)
      }
    })
    return ()=>{active=false;clearTimeout(kill);subscription.unsubscribe()}
  }, [])
  return <Ctx.Provider value={{session,profile,loading}}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
