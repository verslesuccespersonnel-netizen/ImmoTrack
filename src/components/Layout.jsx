// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import VersionBadge from './VersionBadge'
import { supabase } from '../lib/supabase'

const NAV = {
  locataire: [
    { path:'/',          label:'Accueil',        icon:'🏠' },
    { path:'/incidents', label:'Mes incidents',  icon:'⚠️' },
    { path:'/signaler',  label:'Signaler',       icon:'➕' },
    { path:'/documents', label:'Documents',      icon:'📄' },
    { path:'/messages',  label:'Messages',       icon:'💬', badge:true },
    { path:'/demo',      label:'Démonstration',  icon:'🎯', divider:true },
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
    { path:'/demo',         label:'Démonstration',   icon:'🎯' },
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
    { path:'/demo',         label:'Démonstration',   icon:'🎯' },
  ],
}

export default function Layout({ children }) {
  const { profile, session } = useAuth()
  const navigate             = useNavigate()
  const location             = useLocation()
  const [menuOpen, setMenu]  = useState(false)
  const [unread, setUnread]  = useState(0)
  const menuRef              = useRef(null)

  const role = profile?.role || 'locataire'
  const nav  = NAV[role] || NAV.locataire
  const initials = profile
    ? `${profile.prenom?.[0]||''}${profile.nom?.[0]||''}`.toUpperCase()
    : '?'

  useEffect(() => {
    function outside(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  useEffect(() => {
    if (!session?.user) return
    supabase.from('messages').select('id', { count:'exact', head:true })
      .eq('destinataire', session.user.id).eq('lu', false)
      .then(({ count }) => setUnread(count || 0))
  }, [session, location.pathname])

  async function signOut() {
    setMenu(false)
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k)
    })
    sessionStorage.clear()
    try { await supabase.auth.signOut() } catch(e) {}
    window.location.replace('/connexion')
  }

  return (
    <div style={css.shell}>
      {/* TOP BAR */}
      <header style={css.topbar}>
        <div style={css.logo} onClick={() => navigate('/')}>
          <span style={{ color:'#2D5A3D' }}>Immo</span>
          <span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <div style={css.topRight} ref={menuRef}>
          <div style={{ ...css.roleChip,
            background: role==='gestionnaire' ? '#FDF3E7' : role==='proprietaire' ? '#E8F2EB' : '#EBF2FC',
            color: role==='gestionnaire' ? '#8a570e' : role==='proprietaire' ? '#2D5A3D' : '#2B5EA7',
          }}>
            {role}
          </div>
          <div style={{ position:'relative' }}>
            <div style={css.avatarBtn} onClick={() => setMenu(m=>!m)}>
              {initials}
            </div>
            {menuOpen && (
              <div style={css.dropMenu}>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{profile?.prenom} {profile?.nom}</div>
                  <div style={{ fontSize:11, color:'#9E9890', marginTop:2 }}>{session?.user?.email}</div>
                </div>
                <div style={css.dropItem} onClick={() => { setMenu(false); navigate('/') }}>🏠 Accueil</div>
                {(role==='proprietaire'||role==='gestionnaire') && (
                  <div style={css.dropItem} onClick={() => { setMenu(false); navigate('/admin') }}>⚙️ Administration</div>
                )}
                <div style={{ height:1, background:'rgba(0,0,0,0.07)' }} />
                <div style={{ ...css.dropItem, color:'#B83232' }} onClick={signOut}>🚪 Se déconnecter</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={css.body}>
        {/* SIDEBAR */}
        <aside style={css.sidebar}>
          <nav style={{ padding:'12px 10px', flex:1 }}>
            {nav.map(item => {
              if (item.divider) return (
                <React.Fragment key={item.path}>
                  <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'8px 10px' }} />
                  <NavItem item={item} active={location.pathname===item.path} unread={item.badge?unread:0} onClick={() => navigate(item.path)} />
                </React.Fragment>
              )
              const active = location.pathname===item.path ||
                (item.path!=='/' && location.pathname.startsWith(item.path))
              return <NavItem key={item.path} item={item} active={active} unread={item.badge?unread:0} onClick={() => navigate(item.path)} />
            })}
          </nav>
          {/* Bas de sidebar */}
          <div style={css.userCard}>
            <div style={{ ...css.avatarBtn, width:30, height:30, fontSize:11, flexShrink:0 }}>{initials}</div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.prenom} {profile?.nom}
              </div>
              <div style={{ fontSize:11, color:'#9E9890', textTransform:'capitalize' }}>{role}</div>
            </div>
            <button onClick={signOut} title="Se déconnecter" style={css.signOutBtn}>🚪</button>
          </div>
        </aside>

        {/* CONTENU */}
        <main style={css.main}>{children}</main>
      </div>
    </div>
  )
}

function NavItem({ item, active, unread, onClick }) {
  return (
    <div style={{ ...css.navItem, ...(active ? css.navActive : {}) }} onClick={onClick}>
      <span style={{ fontSize:16, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
      <span style={{ flex:1 }}>{item.label}</span>
      {unread > 0 && <span style={css.badge}>{unread}</span>}
    </div>
  )
}

const css = {
  shell:      { display:'flex', flexDirection:'column', minHeight:'100vh', background:'#F7F5F0', fontFamily:"'DM Sans',sans-serif" },
  topbar:     { height:54, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', padding:'0 20px', display:'flex', alignItems:'center', position:'sticky', top:0, zIndex:100, gap:12 },
  logo:       { fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, cursor:'pointer', userSelect:'none', flexShrink:0 },
  topRight:   { marginLeft:'auto', display:'flex', alignItems:'center', gap:10 },
  roleChip:   { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, textTransform:'capitalize' },
  avatarBtn:  { width:32, height:32, borderRadius:'50%', background:'#2D5A3D', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, cursor:'pointer', userSelect:'none' },
  dropMenu:   { position:'absolute', top:40, right:0, background:'#fff', border:'1px solid rgba(0,0,0,0.10)', borderRadius:12, width:220, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:300, overflow:'hidden' },
  dropItem:   { padding:'11px 16px', cursor:'pointer', fontSize:13, transition:'.12s' },
  body:       { display:'flex', flex:1, minHeight:0 },
  sidebar:    { width:210, background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', flexShrink:0 },
  navItem:    { display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8, cursor:'pointer', fontSize:13.5, color:'#6B6560', marginBottom:2, transition:'.14s', border:'1px solid transparent', userSelect:'none' },
  navActive:  { background:'#E8F2EB', color:'#2D5A3D', fontWeight:500, borderColor:'rgba(45,90,61,.10)' },
  badge:      { background:'#B83232', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 6px', minWidth:18, textAlign:'center' },
  userCard:   { padding:'12px', borderTop:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', gap:8 },
  signOutBtn: { background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, color:'#9E9890', flexShrink:0 },
  main:       { flex:1, overflow:'auto', padding:'28px 32px', minWidth:0 },
}
