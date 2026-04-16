import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MODES = { login:'login', register:'register', forgot:'forgot' }

export default function Auth() {
  const navigate  = useNavigate()
  const [mode, setMode]     = useState(MODES.login)
  const [email, setEmail]   = useState('')
  const [pass,  setPass]    = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom,   setNom]     = useState('')
  const [loading, setLoading] = useState(false)
  const [msg,   setMsg]     = useState({ text:'', type:'' })

  function info(text)  { setMsg({ text, type:'info' }) }
  function error(text) { setMsg({ text, type:'error' }) }
  function ok(text)    { setMsg({ text, type:'success' }) }

  async function login(e) {
    e.preventDefault()
    setLoading(true); setMsg({ text:'', type:'' })
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
    if (err) { error(err.message); setLoading(false); return }
    navigate('/')
  }

  async function register(e) {
    e.preventDefault()
    if (!prenom || !nom) { error('Prénom et nom requis'); return }
    if (pass.length < 6) { error('Mot de passe : 6 caractères minimum'); return }
    setLoading(true); setMsg({ text:'', type:'' })
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: { data: { prenom: prenom.trim(), nom: nom.trim() } },
    })
    if (err) { error(err.message); setLoading(false); return }
    if (data.user && !data.session) {
      ok('Compte créé ! Vérifiez votre email pour confirmer.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  async function forgot(e) {
    e.preventDefault()
    setLoading(true); setMsg({ text:'', type:'' })
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/connexion',
    })
    setLoading(false)
    if (err) { error(err.message); return }
    ok('Email envoyé ! Vérifiez votre boîte mail pour réinitialiser votre mot de passe.')
  }

  const inputStyle = {
    padding:'10px 13px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8,
    fontFamily:'inherit', fontSize:14, outline:'none', width:'100%',
    transition:'border-color .15s',
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'36px 32px', width:'100%', maxWidth:380, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>

        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, marginBottom:6 }}>
            <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
          </div>
          <div style={{ fontSize:13, color:'#9E9890' }}>
            {mode === MODES.login    ? 'Connexion à votre espace'
             : mode === MODES.register ? 'Créer un compte'
             : 'Réinitialiser le mot de passe'}
          </div>
        </div>

        {msg.text && (
          <div className={'alert alert-' + (msg.type === 'error' ? 'error' : msg.type === 'success' ? 'success' : 'info')}
            style={{ marginBottom:16 }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={mode === MODES.forgot ? forgot : mode === MODES.register ? register : login}
          style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {mode === MODES.register && (
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', marginBottom:4 }}>Prénom *</div>
                <input style={inputStyle} value={prenom} onChange={e=>setPrenom(e.target.value)} autoComplete="given-name" required/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', marginBottom:4 }}>Nom *</div>
                <input style={inputStyle} value={nom} onChange={e=>setNom(e.target.value)} autoComplete="family-name" required/>
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', marginBottom:4 }}>Email *</div>
            <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/>
          </div>

          {mode !== MODES.forgot && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', marginBottom:4 }}>Mot de passe *</div>
              <input style={inputStyle} type="password" value={pass} onChange={e=>setPass(e.target.value)} autoComplete={mode === MODES.register ? 'new-password' : 'current-password'} required/>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ padding:'12px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:9, fontFamily:'inherit', fontSize:14, fontWeight:600, cursor:'pointer', transition:'background .15s', opacity:loading?.7:1 }}>
            {loading ? '...' : mode === MODES.login ? 'Se connecter' : mode === MODES.register ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
          {mode === MODES.login && <>
            <button onClick={() => { setMode(MODES.forgot); setMsg({text:'',type:''}) }}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#2D5A3D', fontFamily:'inherit' }}>
              Mot de passe oublié ?
            </button>
            <div style={{ fontSize:13, color:'#9E9890' }}>
              Pas de compte ?{' '}
              <button onClick={() => { setMode(MODES.register); setMsg({text:'',type:''}) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#2D5A3D', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
                Créer un compte
              </button>
            </div>
          </>}
          {mode !== MODES.login && (
            <button onClick={() => { setMode(MODES.login); setMsg({text:'',type:''}) }}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#2D5A3D', fontFamily:'inherit' }}>
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
