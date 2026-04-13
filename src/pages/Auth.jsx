import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = [
  { v:'locataire',    l:'Locataire',    icon:'🏠', desc:'Je loue un logement' },
  { v:'proprietaire', l:'Propriétaire', icon:'🏢', desc:'Je gère mes propres biens' },
  { v:'agence',       l:'Agence',       icon:'🏗️', desc:'Je gère des biens pour des propriétaires' },
  { v:'prestataire',  l:'Prestataire',  icon:'🔧', desc:'Artisan / entreprise de maintenance' },
]

export default function Auth() {
  const [mode, setMode]   = useState('login')
  const [form, setForm]   = useState({ email:'', password:'', nom:'', prenom:'', role:'locataire', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk]       = useState('')

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function submit(e) {
    e.preventDefault()
    setError(''); setOk(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (err) throw err
      } else {
        if (!form.nom || !form.prenom) throw new Error('Nom et prénom requis')
        if (form.password !== form.confirm) throw new Error('Les mots de passe ne correspondent pas')
        if (form.password.length < 6) throw new Error('Mot de passe trop court (6 car. min)')
        const { error: err } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { role: form.role, nom: form.nom, prenom: form.prenom } }
        })
        if (err) throw err
        setOk('Compte créé ! Connectez-vous.')
        setMode('login')
      }
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,.08)', padding:'36px 32px', width:'100%', maxWidth:480, boxShadow:'0 4px 24px rgba(0,0,0,.07)' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, textAlign:'center', marginBottom:4 }}>
          <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <p style={{ textAlign:'center', color:'#9E9890', fontSize:13, marginBottom:24 }}>Gestion locative simplifiée</p>

        <div style={{ display:'flex', borderBottom:'1px solid rgba(0,0,0,.08)', marginBottom:20 }}>
          {[['login','Connexion'],['register','Créer un compte']].map(([v,l]) => (
            <button key={v} onClick={() => { setMode(v); setError('') }}
              style={{ flex:1, padding:'9px 0', border:'none', cursor:'pointer', background:'transparent',
                fontFamily:'inherit', fontSize:13, fontWeight:500,
                color: mode===v?'#2D5A3D':'#6B6560',
                borderBottom: mode===v?'2px solid #2D5A3D':'2px solid transparent' }}>
              {l}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:12 }}>{error}</div>}
        {ok    && <div className="alert alert-success" style={{ marginBottom:12 }}>{ok}</div>}

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode === 'register' && (
            <>
              <div className="grid2">
                <div className="fld"><label>Prénom *</label><input value={form.prenom} onChange={e=>set('prenom',e.target.value)} required /></div>
                <div className="fld"><label>Nom *</label><input value={form.nom} onChange={e=>set('nom',e.target.value)} required /></div>
              </div>

              <div className="fld">
                <label>Vous êtes *</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
                  {ROLES.map(r => (
                    <label key={r.v} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, cursor:'pointer',
                      border:`1.5px solid ${form.role===r.v?'#2D5A3D':'rgba(0,0,0,.12)'}`,
                      background: form.role===r.v?'#E8F2EB':'#FAFAF8' }}>
                      <input type="radio" name="role" value={r.v} checked={form.role===r.v} onChange={() => set('role',r.v)} style={{ display:'none' }} />
                      <span style={{ fontSize:20 }}>{r.icon}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:12, color: form.role===r.v?'#2D5A3D':'#1A1714' }}>{r.l}</div>
                        <div style={{ fontSize:10, color:'#9E9890', lineHeight:1.3 }}>{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="fld"><label>Email *</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} required /></div>
          <div className="fld"><label>Mot de passe *</label><input type="password" value={form.password} onChange={e=>set('password',e.target.value)} required /></div>
          {mode==='register' && <div className="fld"><label>Confirmer *</label><input type="password" value={form.confirm} onChange={e=>set('confirm',e.target.value)} required /></div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop:4 }} disabled={loading}>
            {loading ? '…' : mode==='login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}
