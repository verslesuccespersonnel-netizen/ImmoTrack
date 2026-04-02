// src/components/Layout.jsx — responsive avec vraies classes CSS
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import VersionBadge from './VersionBadge'

const NAV = {
  locataire: [
    { path:'/',          label:'Accueil',       icon:'🏠' },
    { path:'/incidents', label:'Incidents',     icon:'⚠️' },
    { path:'/signaler',  label:'Signaler',      icon:'➕' },
    { path:'/documents', label:'Documents',     icon:'📄' },
    { path:'/messages',  label:'Messages',      icon:'💬', badge:true },
    { path:'/demo',      label:'Démo',          icon:'🎯', divider:true },
  ],
  proprietaire: [
    { path:'/',             label:'Tableau de bord', icon:'📊' },
    { path:'/biens',        label:'Mes biens',       icon:'🏢' },
    { path:'/locataires',   label:'Locataires',      icon:'👥' },
    { path:'/incidents',    label:'Incidents',       icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires',    icon:'🔧' },
    { path:'/documents',    label:'Documents',       icon:'📄' },
    { path:'/messages',     label:'Messages',        icon:'💬', badge:true },
    { path:'/catalogue',    label:'Catalogue',       icon:'📚', divider:true },
    { path:'/admin',        label:'Administration',  icon:'⚙️' },
    { path:'/demo',         label:'Démo',            icon:'🎯' },
  ],
  gestionnaire: [
    { path:'/',             label:'Tableau de bord', icon:'📊' },
    { path:'/biens',        label:'Portefeuille',    icon:'🏢' },
    { path:'/locataires',   label:'Locataires',      icon:'👥' },
    { path:'/incidents',    label:'Incidents',       icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires',    icon:'🔧' },
    { path:'/documents',    label:'Documents',       icon:'📄' },
    { path:'/messages',     label:'Messages',        icon:'💬', badge:true },
    { path:'/catalogue',    label:'Catalogue',       icon:'📚', divider:true },
    { path:'/admin',        label:'Administration',  icon:'⚙️' },
    { path:'/demo',         label:'Démo',            icon:'🎯' },
  ],
}

// 5 items principaux pour la barre mobile
const MOBILE_NAV = {
  locataire:    ['/', '/incidents', '/signaler', '/documents', '/messages'],
  proprietaire: ['/', '/biens', '/incidents', '/messages', '/admin'],
  gestionnaire: ['/', '/biens', '/incidents', '/messages', '/admin'],
}

export default function Layout({ children }) {
  const { profile, session } = useAuth()
  const navigate             = useNavigate()
  const location             = useLocation()
  const [sideOpen, setSide]  = useState(false)
  const [menuOpen, setMenu]  = useState(false)
  const [unread, setUnread]  = useState(0)
  const menuRef              = useRef(null)

  const role = profile?.role || 'locataire'
  const nav  = NAV[role] || NAV.locataire
  const mobileKeys = MOBILE_NAV[role] || MOBILE_NAV.locataire
  const mobileNav  = mobileKeys.map(p => nav.find(n => n.path === p)).filter(Boolean)

  const initials = profile
    ? `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase()
    : '?'

  // Fermer sidebar au changement de page
  useEffect(() => { setSide(false); setMenu(false) }, [location.pathname])

  // Fermer dropdown si clic dehors
  useEffect(() => {
    function h(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Messages non lus
  useEffect(() => {
    if (!session?.user) return
    supabase.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire', session.user.id).eq('lu', false)
      .then(({ count }) => setUnread(count || 0))
  }, [session, location.pathname])

  function signOut() {
    setSide(false); setMenu(false)
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
      supabase.auth.signOut().catch(() => {})
    } catch {}
    window.location.replace('/connexion')
  }

  const ROLE_COLOR = { locataire:'#2B5EA7', proprietaire:'#2D5A3D', gestionnaire:'#C8813A' }
  const ROLE_BG    = { locataire:'#EBF2FC', proprietaire:'#E8F2EB', gestionnaire:'#FDF3E7' }

  function isActive(path) {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="it-shell">
      {/* TOP BAR */}
      <header className="it-topbar">
        <button className="it-hamburger" onClick={() => setSide(s => !s)} aria-label="Ouvrir le menu">
          <span/><span/><span/>
        </button>

        <div className="it-logo" onClick={() => navigate('/')}>
          <span style={{ color:'#2D5A3D' }}>Immo</span>
          <span style={{ color:'#C8813A' }}>Track</span>
        </div>

        <div className="it-topright" ref={menuRef}>
          <VersionBadge />
          <div style={{
            padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600,
            textTransform:'capitalize', background: ROLE_BG[role], color: ROLE_COLOR[role],
            display:'none' // caché sur mobile, visible sur desktop via CSS si besoin
          }}>
            {role}
          </div>

          <div style={{ position:'relative' }}>
            <div style={{
              width:32, height:32, borderRadius:'50%', background:'#2D5A3D',
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:600, cursor:'pointer', userSelect:'none', flexShrink:0
            }} onClick={() => setMenu(m => !m)}>
              {initials}
            </div>

            {menuOpen && (
              <div style={{
                position:'absolute', top:40, right:0, background:'#fff',
                border:'1px solid rgba(0,0,0,0.10)', borderRadius:12, width:220,
                boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:300, overflow:'hidden'
              }}>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{profile?.prenom} {profile?.nom}</div>
                  <div style={{ fontSize:11, color:'#9E9890', marginTop:2 }}>{session?.user?.email}</div>
                  <div style={{ fontSize:10, marginTop:4, background: ROLE_BG[role], color: ROLE_COLOR[role], display:'inline-block', padding:'2px 8px', borderRadius:10, fontWeight:600 }}>
                    {role}
                  </div>
                </div>
                {(role==='proprietaire'||role==='gestionnaire') && (
                  <div style={{ padding:'11px 16px', cursor:'pointer', fontSize:13 }}
                    onClick={() => navigate('/admin')}>⚙️ Administration</div>
                )}
                <div style={{ height:1, background:'rgba(0,0,0,0.07)' }}/>
                <div style={{ padding:'11px 16px', cursor:'pointer', fontSize:13, color:'#B83232' }}
                  onClick={signOut}>🚪 Se déconnecter</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="it-body">
        {/* OVERLAY MOBILE */}
        <div className={`it-overlay${sideOpen ? ' visible' : ''}`} onClick={() => setSide(false)}/>

        {/* SIDEBAR */}
        <aside className={`it-sidebar${sideOpen ? ' open' : ''}`}>
          <button className="it-sideclose" onClick={() => setSide(false)}>✕</button>

          <nav className="it-nav">
            {nav.map((item, idx) => (
              <React.Fragment key={item.path}>
                {item.divider && <div className="it-divider"/>}
                <div
                  className={`it-navitem${isActive(item.path) ? ' active' : ''}`}
                  onClick={() => navigate(item.path)}>
                  <span style={{ fontSize:16, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  <span style={{ flex:1, fontSize:13.5 }}>{item.label}</span>
                  {item.badge && unread > 0 && <span className="it-navbadge">{unread}</span>}
                </div>
              </React.Fragment>
            ))}
          </nav>

          <div className="it-usercard">
            <div style={{
              width:30, height:30, borderRadius:'50%', background:'#2D5A3D',
              color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:600, flexShrink:0
            }}>{initials}</div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.prenom} {profile?.nom}
              </div>
              <div style={{ fontSize:11, color:'#9E9890', textTransform:'capitalize' }}>{role}</div>
            </div>
            <button onClick={signOut} title="Se déconnecter"
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, color:'#9E9890' }}>
              🚪
            </button>
          </div>
        </aside>

        {/* CONTENU PRINCIPAL */}
        <main className="it-main">
          {children}
        </main>
      </div>

      {/* BARRE BAS MOBILE */}
      <nav className="it-bottomnav">
        {mobileNav.map(item => (
          <button key={item.path}
            className={`it-bottomnav-item${isActive(item.path) ? ' active' : ''}`}
            onClick={() => navigate(item.path)}>
            <span className="icon">{item.icon}</span>
            <span>{item.label.split(' ')[0]}</span>
            {item.badge && unread > 0 && (
              <span style={{
                position:'absolute', top:4, right:'calc(50% - 18px)',
                background:'#B83232', color:'#fff', borderRadius:10,
                fontSize:9, fontWeight:700, padding:'1px 4px'
              }}>{unread}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
