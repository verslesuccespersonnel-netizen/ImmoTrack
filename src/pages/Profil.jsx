import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Profil({ forcePasswordChange = false }) {
  const { profile, session } = useAuth()
  const navigate = useNavigate()

  const [tab,       setTab]      = useState(forcePasswordChange ? 'password' : 'info')
  const [form,      setForm]     = useState({
    prenom:     profile?.prenom || '',
    nom:        profile?.nom || '',
    telephone:  profile?.telephone || '',
    nom_societe:profile?.nom_societe || '',
    adresse:    profile?.adresse || '',
  })
  const [pwd,       setPwd]      = useState({ new1:'', new2:'' })
  const [saving,    setSaving]   = useState(false)
  const [msg,       setMsg]      = useState({ text:'', type:'' })

  function info(text)    { setMsg({ text, type:'info' }) }
  function success(text) { setMsg({ text, type:'success' }) }
  function error(text)   { setMsg({ text, type:'error' }) }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function saveInfo() {
    setSaving(true); setMsg({text:'',type:''})
    try {
      const { error: e } = await supabase.from('profiles').update({
        prenom:      form.prenom,
        nom:         form.nom,
        telephone:   form.telephone || null,
        nom_societe: form.nom_societe || null,
        adresse:     form.adresse || null,
      }).eq('id', session.user.id)
      if (e) throw e
      success('Profil mis à jour.')
    } catch(e) { error(e.message) }
    finally { setSaving(false) }
  }

  async function changePassword() {
    if (!pwd.new1 || pwd.new1.length < 6) { error('Minimum 6 caractères.'); return }
    if (pwd.new1 !== pwd.new2) { error('Les mots de passe ne correspondent pas.'); return }
    setSaving(true); setMsg({text:'',type:''})
    try {
      const { error: e } = await supabase.auth.updateUser({ password: pwd.new1 })
      if (e) throw e
      success('Mot de passe modifié avec succès !')
      setPwd({ new1:'', new2:'' })
      // Si on était en mode recovery, rediriger vers l'accueil
      if (forcePasswordChange) {
        setTimeout(() => navigate('/'), 1500)
      }
    } catch(e) { error(e.message) }
    finally { setSaving(false) }
  }

  const inputStyle = {
    padding:'9px 12px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8,
    fontFamily:'inherit', fontSize:13, outline:'none', width:'100%',
    transition:'border-color .15s',
  }

  // Mode recovery : page autonome sans Layout
  if (forcePasswordChange) {
    return (
      <div style={{minHeight:'100vh',background:'#F7F5F0',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'#fff',borderRadius:16,padding:'36px 32px',width:'100%',maxWidth:380,boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700}}>
              <span style={{color:'#2D5A3D'}}>Immo</span><span style={{color:'#C8813A'}}>Track</span>
            </div>
            <div style={{fontSize:14,color:'#6B6560',marginTop:6}}>Choisissez votre nouveau mot de passe</div>
          </div>

          <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>
            Vous avez utilisé un lien de réinitialisation. Veuillez définir un nouveau mot de passe pour sécuriser votre compte.
          </div>

          {msg.text && (
            <div className={'alert alert-' + (msg.type==='error'?'error':msg.type==='success'?'success':'info')} style={{marginBottom:14}}>
              {msg.text}
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'#6B6560',textTransform:'uppercase',marginBottom:4}}>Nouveau mot de passe *</div>
              <input style={inputStyle} type="password" value={pwd.new1}
                onChange={e=>setPwd(p=>({...p,new1:e.target.value}))} placeholder="6 caractères minimum"/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'#6B6560',textTransform:'uppercase',marginBottom:4}}>Confirmer *</div>
              <input style={inputStyle} type="password" value={pwd.new2}
                onChange={e=>setPwd(p=>({...p,new2:e.target.value}))} placeholder="Répétez le mot de passe"/>
            </div>
            <button onClick={changePassword} disabled={saving}
              style={{padding:'12px',background:'#2D5A3D',color:'#fff',border:'none',borderRadius:9,fontFamily:'inherit',fontSize:14,fontWeight:600,cursor:'pointer',opacity:saving?.7:1}}>
              {saving ? '...' : 'Enregistrer le mot de passe'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mon profil</h1>
          <p className="page-sub">{profile?.prenom} {profile?.nom} · {profile?.role}</p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',borderBottom:'1px solid rgba(0,0,0,.08)',marginBottom:16}}>
        {[['info','Informations'],['password','Mot de passe']].map(([v,l])=>(
          <div key={v} onClick={()=>{setTab(v);setMsg({text:'',type:''})}}
            style={{padding:'10px 18px',cursor:'pointer',fontSize:13,fontWeight:500,
              color:tab===v?'#2D5A3D':'#6B6560',
              borderBottom:tab===v?'2px solid #2D5A3D':'2px solid transparent'}}>
            {l}
          </div>
        ))}
      </div>

      <div className="card" style={{maxWidth:500}}>
        <div className="modal-body" style={{padding:'20px 24px'}}>
          {msg.text && (
            <div className={'alert alert-'+(msg.type==='error'?'error':msg.type==='success'?'success':'info')}
              style={{marginBottom:14}}>
              {msg.text}
            </div>
          )}

          {tab === 'info' && (
            <div style={{display:'flex',flexDirection:'column',gap:13}}>
              <div className="grid2">
                <div className="fld"><label>Prénom</label><input value={form.prenom} onChange={e=>set('prenom',e.target.value)}/></div>
                <div className="fld"><label>Nom</label><input value={form.nom} onChange={e=>set('nom',e.target.value)}/></div>
              </div>
              <div className="fld"><label>Email (non modifiable)</label>
                <input value={session?.user?.email||''} disabled
                  style={{background:'#F7F5F0',color:'#9E9890'}}/>
              </div>
              <div className="fld"><label>Téléphone</label>
                <input value={form.telephone} onChange={e=>set('telephone',e.target.value)} placeholder="+33 6 ..."/>
              </div>
              {['proprietaire','agence','gestionnaire'].includes(profile?.role) && (
                <>
                  <div className="fld"><label>Société</label>
                    <input value={form.nom_societe} onChange={e=>set('nom_societe',e.target.value)}/>
                  </div>
                  <div className="fld"><label>Adresse</label>
                    <input value={form.adresse} onChange={e=>set('adresse',e.target.value)}/>
                  </div>
                </>
              )}
              <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 14px',background:'#F7F5F0',borderRadius:8,fontSize:12,color:'#6B6560'}}>
                <span style={{fontSize:18}}>🔒</span>
                <div>
                  <div style={{fontWeight:500,color:'#1A1714'}}>Rôle : {profile?.role}</div>
                  <div>Le rôle ne peut être modifié que par un administrateur.</div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer'}
              </button>
            </div>
          )}

          {tab === 'password' && (
            <div style={{display:'flex',flexDirection:'column',gap:13}}>
              <div style={{background:'#EBF2FC',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#2B5EA7'}}>
                Votre mot de passe doit contenir au moins 6 caractères.
              </div>
              <div className="fld"><label>Nouveau mot de passe *</label>
                <input type="password" value={pwd.new1}
                  onChange={e=>setPwd(p=>({...p,new1:e.target.value}))} placeholder="6 caractères minimum"/>
              </div>
              <div className="fld"><label>Confirmer le nouveau mot de passe *</label>
                <input type="password" value={pwd.new2}
                  onChange={e=>setPwd(p=>({...p,new2:e.target.value}))}/>
              </div>
              <button className="btn btn-primary" onClick={changePassword} disabled={saving}>
                {saving ? 'Modification...' : '🔒 Changer le mot de passe'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
