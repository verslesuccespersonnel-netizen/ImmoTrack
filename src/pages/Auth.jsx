// src/pages/Auth.jsx
import React, { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({
    email: '', password: '', nom: '', prenom: '',
    role: 'locataire', confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signIn({ email: form.email, password: form.password })
        // La redirection se fait via AuthContext dans App.jsx
      } else {
        if (form.password !== form.confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas.')
        }
        await signUp({
          email: form.email, password: form.password,
          nom: form.nom, prenom: form.prenom, role: form.role
        })
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={css.page}>
      <div style={css.card}>
        {/* LOGO */}
        <div style={css.logo}>
          <span style={{ color: '#2D5A3D' }}>Immo</span>
          <span style={{ color: '#C8813A' }}>Track</span>
        </div>
        <p style={css.tagline}>Gestion locative simplifiée</p>

        {/* TABS */}
        <div style={css.tabs}>
          <button style={tabStyle(mode === 'login')} onClick={() => { setMode('login'); setError('') }}>
            Connexion
          </button>
          <button style={tabStyle(mode === 'register')} onClick={() => { setMode('register'); setError('') }}>
            Créer un compte
          </button>
        </div>

        {/* MESSAGES */}
        {error   && <div style={css.errorBox}>{error}</div>}
        {success && <div style={css.successBox}>{success}</div>}

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <>
              <div style={css.row}>
                <Field label="Prénom" value={form.prenom} onChange={v => set('prenom', v)} required />
                <Field label="Nom" value={form.nom} onChange={v => set('nom', v)} required />
              </div>
              <div style={css.group}>
                <label style={css.label}>Je suis</label>
                <select style={css.select} value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="locataire">Locataire</option>
                  <option value="proprietaire">Propriétaire</option>
                  <option value="gestionnaire">Gestionnaire / Agence</option>
                </select>
              </div>
            </>
          )}

          <Field label="Email" type="email" value={form.email} onChange={v => set('email', v)} required />
          <Field label="Mot de passe" type="password" value={form.password} onChange={v => set('password', v)} required />

          {mode === 'register' && (
            <Field label="Confirmer le mot de passe" type="password"
              value={form.confirmPassword} onChange={v => set('confirmPassword', v)} required />
          )}

          <button type="submit" style={{ ...css.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        {mode === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6B6560' }}>
            <span style={{ color: '#2D5A3D', cursor: 'pointer' }}>Mot de passe oublié ?</span>
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      <label style={css.label}>{label}</label>
      <input
        type={type} value={value} required={required}
        onChange={e => onChange(e.target.value)}
        style={css.input}
      />
    </div>
  )
}

function tabStyle(active) {
  return {
    flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
    borderBottom: active ? '2px solid #2D5A3D' : '2px solid transparent',
    background: 'transparent',
    color: active ? '#2D5A3D' : '#6B6560',
    transition: '0.15s',
  }
}

const css = {
  page: {
    minHeight: '100vh', background: '#F7F5F0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#fff', borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '36px 32px', width: '100%', maxWidth: 440,
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
  },
  logo: {
    fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700,
    textAlign: 'center', marginBottom: 6,
  },
  tagline: { textAlign: 'center', color: '#9E9890', fontSize: 13, marginBottom: 24 },
  tabs: {
    display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)',
    marginBottom: 20,
  },
  group: { display: 'flex', flexDirection: 'column', gap: 5 },
  row: { display: 'flex', gap: 10 },
  label: { fontSize: 11, fontWeight: 600, color: '#6B6560',
           letterSpacing: '0.05em', textTransform: 'uppercase' },
  input: {
    padding: '9px 12px', border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8, fontFamily: 'inherit', fontSize: 14,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '9px 12px', border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8, fontFamily: 'inherit', fontSize: 14,
    background: '#fff', cursor: 'pointer',
  },
  btn: {
    padding: '11px 0', background: '#2D5A3D', color: '#fff',
    border: 'none', borderRadius: 8, fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    marginTop: 4,
  },
  errorBox: {
    background: '#FDEAEA', color: '#B83232', border: '1px solid #F7C1C1',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 4,
  },
  successBox: {
    background: '#E8F2EB', color: '#2D5A3D', border: '1px solid #9FE1CB',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 4,
  },
}
