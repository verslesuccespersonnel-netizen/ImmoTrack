import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { VERSION } from '../lib/version'

const NAV = {
  admin: [
    { path:'/', label:'Tableau de bord', icon:'📊' },
    { path:'/biens', label:'Tous les biens', icon:'🏢' },
    { path:'/locataires', label:'Locataires', icon:'👥' },
    { path:'/incidents', label:'Incidents', icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires', icon:'🔧' },
    { path:'/documents',   label:'Documents',  icon:'📄' },
    { path:'/quittances',  label:'Quittances',  icon:'🧾' },
    { path:'/messages', label:'Messages', icon:'💬', badge:true },
    { path:'/catalogue', label:'Catalogue', icon:'📚', sep:true },
    { path:'/admin', label:'Administration', icon:'⚙️' },
    { path:'/demo', label:'Démonstration', icon:'🎯' },
  ],
  agence: [
    { path:'/', label:'Tableau de bord', icon:'📊' },
    { path:'/biens', label:'Portefeuille', icon:'🏢' },
    { path:'/locataires', label:'Locataires', icon:'👥' },
    { path:'/incidents', label:'Incidents', icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires', icon:'🔧' },
    { path:'/documents',   label:'Documents',  icon:'📄' },
    { path:'/quittances',  label:'Quittances',  icon:'🧾' },
    { path:'/messages', label:'Messages', icon:'💬', badge:true },
    { path:'/catalogue', label:'Catalogue', icon:'📚', sep:true },
    { path:'/admin', label:'Administration', icon:'⚙️' },
    { path:'/demo', label:'Démonstration', icon:'🎯' },
  ],
  locataire: [
    { path:'/', label:'Accueil', icon:'🏠' },
    { path:'/incidents', label:'Mes incidents', icon:'⚠️' },
    { path:'/signaler', label:'Signaler', icon:'➕' },
    { path:'/documents',   label:'Documents',  icon:'📄' },
    { path:'/quittances',  label:'Quittances',  icon:'🧾' },
    { path:'/messages', label:'Messages', icon:'💬', badge:true },
    { path:'/demo', label:'Démonstration', icon:'🎯', sep:true },
  ],
  proprietaire: [
    { path:'/', label:'Tableau de bord', icon:'📊' },
    { path:'/biens', label:'Mes biens', icon:'🏢' },
    { path:'/locataires', label:'Locataires', icon:'👥' },
    { path:'/incidents', label:'Incidents', icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires', icon:'🔧' },
    { path:'/documents',   label:'Documents',  icon:'📄' },
    { path:'/quittances',  label:'Quittances',  icon:'🧾' },
    { path:'/messages', label:'Messages', icon:'💬', badge:true },
    { path:'/catalogue', label:'Catalogue', icon:'📚', sep:true },
    { path:'/admin', label:'Administration', icon:'⚙️' },
    { path:'/demo', label:'Démonstration', icon:'🎯' },
  ],
  gestionnaire: [
    { path:'/', label:'Tableau de bord', icon:'📊' },
    { path:'/biens', label:'Portefeuille', icon:'🏢' },
    { path:'/locataires', label:'Locataires', icon:'👥' },
    { path:'/incidents', label:'Incidents', icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires', icon:'🔧' },
    { path:'/documents',   label:'Documents',  icon:'📄' },
    { path:'/quittances',  label:'Quittances',  icon:'🧾' },
    { path:'/messages', label:'Messages', icon:'💬', badge:true },
    { path:'/catalogue', label:'Catalogue', icon:'📚', sep:true },
    { path:'/admin', label:'Administration', icon:'⚙️' },
    { path:'/demo', label:'Démonstration', icon:'🎯' },
  ],
}

const MOBILE_PATHS = {
  locataire:    ['/', '/incidents', '/signaler', '/messages', '/documents'],
  proprietaire: ['/', '/biens', '/incidents', '/messages', '/admin'],
  gestionnaire: ['/', '/biens', '/incidents', '/messages', '/admin'],
  agence:       ['/', '/biens', '/incidents', '/messages', '/admin'],
  admin:        ['/', '/biens', '/incidents', '/messages', '/admin'],
  prestataire:  ['/', '/incidents', '/messages', '/documents', '/demo'],
}

const ROLE_COLOR = { locataire:'#2B5EA7', proprietaire:'#2D5A3D', gestionnaire:'#C8813A', agence:'#C8813A', admin:'#B83232', prestataire:'#6B6560' }
const ROLE_BG    = { locataire:'#EBF2FC', proprietaire:'#E8F2EB', gestionnaire:'#FDF3E7', agence:'#FDF3E7', admin:'#FDEAEA', prestataire:'#F7F5F0' }

export default function Layout({ children }) {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sideOpen, setSide] = useState(false)
  const [ddOpen, setDd]     = useState(false)
  const [unread, setUnread]  = useState(0)
  const [showCl, setShowCl]  = useState(false)
  const ddRef = useRef(null)

  const role = profile?.role || 'locataire'
  const nav  = NAV[role] || NAV.locataire
  const mobilePaths = MOBILE_PATHS[role] || MOBILE_PATHS.locataire
  const mobileNav = mobilePaths.map(p => nav.find(n => n.path === p)).filter(Boolean)
  const initials = `${profile?.prenom?.[0]||''}${profile?.nom?.[0]||''}`.toUpperCase() || '?'

  useEffect(() => { setSide(false); setDd(false) }, [location.pathname])

  useEffect(() => {
    const h = e => { if (ddRef.current && !ddRef.current.contains(e.target)) setDd(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!session?.user) return
    supabase.from('messages').select('id', { count:'exact', head:true })
      .eq('destinataire', session.user.id).eq('lu', false)
      .then(({ count }) => setUnread(count || 0))
  }, [session, location.pathname])

  // Reset bouton urgence index.html
  useEffect(() => { try { window._resetUrgency && window._resetUrgency() } catch {} }, [location.pathname])

  function signOut() {
    setSide(false); setDd(false)
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
      supabase.auth.signOut().catch(() => {})
    } catch {}
    window.location.replace('/connexion')
  }

  function isActive(path) {
    return path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  }

  return (
    <div className="it-app">
      {/* TOP BAR */}
      <header className="it-topbar">
        <button className="it-burger" onClick={() => setSide(s => !s)}>
          <span/><span/><span/>
        </button>
        <div className="it-logo" onClick={() => navigate('/')}>
          <span style={{ color:'#2D5A3D' }}>Immo</span>
          <span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <div className="it-topright">
          <span className="it-badge hide-mobile"
            style={{ background: ROLE_BG[role], color: ROLE_COLOR[role] }}>
            {role}
          </span>
          <span style={{ fontSize:11, color:'#9E9890', cursor:'pointer', fontFamily:'monospace' }}
            onClick={() => setShowCl(true)} className="hide-mobile">
            v{VERSION}
          </span>
          <div style={{ position:'relative' }} ref={ddRef}>
            <div className="it-avatar" onClick={() => setDd(d => !d)}>{initials}</div>
            {ddOpen && (
              <div className="it-dropdown">
                <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,.07)' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{profile?.prenom} {profile?.nom}</div>
                  <div style={{ fontSize:11, color:'#9E9890', marginTop:2 }}>{session?.user?.email}</div>
                </div>
                <div className="it-dropitem" onClick={() => setShowCl(true)}>📋 v{VERSION} — Changelog</div>
                <div style={{ height:1, background:'rgba(0,0,0,.07)' }}/>
                <div className="it-dropitem" style={{ color:'#B83232' }} onClick={signOut}>🚪 Se déconnecter</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="it-body">
        {/* OVERLAY MOBILE */}
        <div className={`it-overlay${sideOpen?' show':''}`} onClick={() => setSide(false)}/>

        {/* SIDEBAR */}
        <aside className={`it-sidebar${sideOpen?' open':''}`}>
          <button className="it-sideclose" onClick={() => setSide(false)}>✕</button>
          <nav className="it-nav">
            {nav.map(item => (
              <React.Fragment key={item.path}>
                {item.sep && <div className="it-navdiv"/>}
                <div className={`it-navitem${isActive(item.path)?' active':''}`}
                  onClick={() => navigate(item.path)}>
                  <span style={{ fontSize:16, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {item.badge && unread > 0 && <span className="it-nbadge">{unread}</span>}
                </div>
              </React.Fragment>
            ))}
          </nav>
          <div className="it-usercard">
            <div className="it-avatar" style={{ width:30, height:30, fontSize:11, flexShrink:0 }}>{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.prenom} {profile?.nom}
              </div>
              <div style={{ fontSize:11, color:'#9E9890', textTransform:'capitalize' }}>{role}</div>
            </div>
            <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:'#9E9890', padding:4 }}>🚪</button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="it-main">{children}</main>
      </div>

      {/* BOTTOM NAV MOBILE */}
      <nav className="it-bottomnav">
        {mobileNav.map(item => (
          <button key={item.path} className={`it-bnitem${isActive(item.path)?' active':''}`}
            onClick={() => navigate(item.path)}>
            <span className="ni">{item.icon}</span>
            <span>{item.label.split(' ')[0]}</span>
            {item.badge && unread > 0 && <span className="it-bnbadge">{unread}</span>}
          </button>
        ))}
      </nav>

      {/* CHANGELOG MODAL */}
      {showCl && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCl(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">ImmoTrack v{VERSION}</span>
              <button className="modal-close" onClick={() => setShowCl(false)}>✕</button>
            </div>
            <div className="modal-body">
              {(CHANGELOG || []).map(r => (
                <div key={r.version}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ background:'#1A1714', color:'#fff', borderRadius:8, padding:'2px 8px', fontSize:11, fontFamily:'monospace' }}>v{r.version}</span>
                    <span style={{ fontWeight:600, fontSize:13 }}>{r.label}</span>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'#9E9890' }}>{r.date}</span>
                  </div>
                  {r.changes.map((c,i) => (
                    <div key={i} style={{ display:'flex', gap:8, padding:'4px 0', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                      <span style={{ padding:'2px 7px', borderRadius:10, fontSize:10, fontWeight:600, flexShrink:0, background: c.type==='new'?'#E8F2EB':c.type==='fix'?'#EBF2FC':'#FDF3E7', color: c.type==='new'?'#2D5A3D':c.type==='fix'?'#2B5EA7':'#C8813A' }}>
                        {c.type==='new'?'Nouveau':c.type==='fix'?'Corrigé':'Amélioré'}
                      </span>
                      <span style={{ fontSize:13, color:'#1A1714' }}>{c.text}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
