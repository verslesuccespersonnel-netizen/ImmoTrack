// src/pages/Auth.jsx
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = [
  { value: 'locataire',     label: '🏠 Locataire',           desc: 'Je loue un logement' },
  { value: 'proprietaire',  label: '🏢 Propriétaire',         desc: 'Je possède des biens' },
  { value: 'gestionnaire',  label: '⚙️ Gestionnaire / Agence', desc: 'Je gère pour des propriétaires' },
]

export default function AuthPage() {
  const [mode, setMode]     = useState('login')
  const [form, setForm]     = useState({ email:'', password:'', nom:'', prenom:'', role:'locataire', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
      } else {
        if (!form.nom || !form.prenom) throw new Error('Nom et prénom obligatoires.')
        if (form.password !== form.confirm) throw new Error('Les mots de passe ne correspondent pas.')
        if (form.password.length < 6) throw new Error('Mot de passe trop court (6 caractères minimum).')

        // On passe le rôle, nom et prénom dans les métadonnées
        // Le trigger Postgres les lira et créera le profil automatiquement
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              role:   form.role,
              nom:    form.nom,
              prenom: form.prenom,
            }
          }
        })
        if (error) throw error
        setSuccess('Compte créé avec succès ! Vous pouvez vous connecter.')
        setMode('login')
      }
    } catch(err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={css.page}>
      <div style={css.card}>
        <div style={css.logo}>
          <span style={{ color:'#2D5A3D' }}>Immo</span>
          <span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <p style={css.tagline}>Gestion locative simplifiée</p>

        {/* TABS */}
        <div style={css.tabs}>
          <button style={tab(mode==='login')}    onClick={() => { setMode('login'); setError('') }}>Connexion</button>
          <button style={tab(mode==='register')} onClick={() => { setMode('register'); setError('') }}>Créer un compte</button>
        </div>

        {error   && <div style={css.errorBox}>{error}</div>}
        {success && <div style={css.successBox}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {mode === 'register' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <F label="Prénom *" value={form.prenom} onChange={v=>set('prenom',v)} />
                <F label="Nom *"    value={form.nom}    onChange={v=>set('nom',v)} />
              </div>

              {/* Sélection du rôle visuelle */}
              <div>
                <label style={css.label}>Je suis *</label>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
                  {ROLES.map(r => (
                    <label key={r.value} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                      borderRadius:8, cursor:'pointer',
                      border:`1.5px solid ${form.role===r.value ? '#2D5A3D' : 'rgba(0,0,0,0.12)'}`,
                      background: form.role===r.value ? '#E8F2EB' : '#fff',
                      transition:'.14s',
                    }}>
                      <input type="radio" name="role" value={r.value}
                        checked={form.role===r.value}
                        onChange={() => set('role', r.value)}
                        style={{ display:'none' }} />
                      <span style={{ fontSize:20 }}>{r.label.split(' ')[0]}</span>
                      <div>
                        <div style={{ fontWeight:500, fontSize:13, color: form.role===r.value?'#2D5A3D':'#1A1714' }}>
                          {r.label.split(' ').slice(1).join(' ')}
                        </div>
                        <div style={{ fontSize:11, color:'#9E9890' }}>{r.desc}</div>
                      </div>
                      {form.role===r.value && <span style={{ marginLeft:'auto', color:'#2D5A3D', fontWeight:700 }}>✓</span>}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <F label="Email *" value={form.email} onChange={v=>set('email',v)} type="email" />
          <F label="Mot de passe *" value={form.password} onChange={v=>set('password',v)} type="password" placeholder="6 caractères minimum" />
          {mode === 'register' && (
            <F label="Confirmer le mot de passe *" value={form.confirm} onChange={v=>set('confirm',v)} type="password" />
          )}

          <button type="submit" style={{ ...css.btnPrimary, opacity: loading ? 0.7 : 1, marginTop:4 }} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        {mode === 'login' && (
          <p style={{ textAlign:'center', marginTop:14, fontSize:12, color:'#9E9890' }}>
            Pas encore de compte ?{' '}
            <span style={{ color:'#2D5A3D', cursor:'pointer', fontWeight:500 }} onClick={() => setMode('register')}>
              Créer un compte
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

function F({ label, value, onChange, type='text', placeholder }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ padding:'9px 12px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' }} />
    </div>
  )
}

function tab(active) {
  return { flex:1, padding:'9px 0', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500,
    borderBottom: active ? '2px solid #2D5A3D' : '2px solid transparent',
    background:'transparent', color: active ? '#2D5A3D' : '#6B6560', transition:'.15s' }
}

const css = {
  page:       { minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  card:       { background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', padding:'36px 32px', width:'100%', maxWidth:460, boxShadow:'0 4px 24px rgba(0,0,0,0.07)' },
  logo:       { fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, textAlign:'center', marginBottom:6 },
  tagline:    { textAlign:'center', color:'#9E9890', fontSize:13, marginBottom:24 },
  tabs:       { display:'flex', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:20 },
  label:      { fontSize:11, fontWeight:600, color:'#6B6560', letterSpacing:'.05em', textTransform:'uppercase' },
  errorBox:   { background:'#FDEAEA', color:'#B83232', border:'1px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:4 },
  successBox: { background:'#E8F2EB', color:'#2D5A3D', border:'1px solid #9FE1CB', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:4 },
  btnPrimary: { padding:'11px 0', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:14, fontWeight:600, cursor:'pointer' },
}
