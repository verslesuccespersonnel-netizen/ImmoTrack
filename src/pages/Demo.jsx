import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

const DEMOS = {
  proprietaire: {
    color:'#2D5A3D', bg:'#E8F2EB', label:'Propriétaire', icon:'🏢',
    steps:[
      {title:'Ajouter un bien',icon:'🏠',path:'/biens',desc:'Menu "Mes biens" → + Ajouter un bien → remplir adresse, type, surface.',tip:'Créez un bien pour chaque propriété : appartement, maison, local commercial…'},
      {title:'Dessiner le plan',icon:'🗺️',path:'/biens',desc:'Fiche bien → bouton "🗺️ Plan" → glissez les pièces et équipements sur la grille.',tip:'Ajoutez volets, radiateurs, robinets et tous les équipements pour les incidents.'},
      {title:'Ajouter un locataire',icon:'👥',path:'/locataires',desc:'Menu "Locataires" → + Ajouter → remplir le bail, les occupants et garants.',tip:'Si le locataire n\'a pas encore de compte, une invitation est créée.'},
      {title:'Suivre les incidents',icon:'⚠️',path:'/incidents',desc:'Menu "Incidents" → filtrer par urgence ou statut → traiter chaque demande.',tip:'Assignez un prestataire et changez le statut depuis la fiche incident.'},
      {title:'Gérer le catalogue',icon:'📚',path:'/catalogue',desc:'Menu "Catalogue" → zones → pièces → équipements → types de pannes.',tip:'Le catalogue prérempli couvre 200+ types de pannes pour maisons et locaux.'},
    ]
  },
  locataire: {
    color:'#2B5EA7', bg:'#EBF2FC', label:'Locataire', icon:'🏠',
    steps:[
      {title:'Signaler un incident',icon:'➕',path:'/signaler',desc:'Menu "Signaler" → choisir le bien → l\'équipement → décrire le problème.',tip:'Soyez précis : depuis quand, fréquence, bruit ou visuel. Ça accélère la résolution.'},
      {title:'Suivre mes incidents',icon:'⚠️',path:'/incidents',desc:'Menu "Incidents" → consultez l\'état de chaque demande.',tip:'L\'onglet historique montre toutes les actions du propriétaire.'},
      {title:'Mes documents',icon:'📄',path:'/documents',desc:'Menu "Documents" → accédez aux bail, quittances, états des lieux.',tip:'Vous pouvez télécharger vos documents à tout moment.'},
      {title:'Messagerie',icon:'💬',path:'/messages',desc:'Menu "Messages" → échangez directement avec votre propriétaire.',tip:'Tout est archivé et horodaté.'},
    ]
  },
  gestionnaire: {
    color:'#C8813A', bg:'#FDF3E7', label:'Gestionnaire', icon:'🏗️',
    steps:[
      {title:'Vue portefeuille',icon:'📊',path:'/',desc:'Le tableau de bord centralise tous les biens, incidents et loyers.',tip:'Les incidents urgents sont mis en avant pour action immédiate.'},
      {title:'Gérer le catalogue',icon:'📚',path:'/catalogue',desc:'Personnalisez zones, pièces, équipements et types de pannes.',tip:'Le catalogue est partagé avec tous les propriétaires du compte.'},
      {title:'Administration',icon:'⚙️',path:'/admin',desc:'Gérez tous les comptes, changez les rôles, consultez tous les incidents.',tip:'Le changement de rôle est immédiat via le sélecteur inline.'},
    ]
  }
}

export default function Demo() {
  const navigate = useNavigate()
  const [role, setRole] = useState('proprietaire')
  const [step, setStep] = useState(0)
  const demo = DEMOS[role]
  const cur  = demo.steps[step]

  return (
    <Layout>
      <div className="page-header"><div><h1 className="page-title">Mode démonstration</h1><p className="page-sub">Découvrez toutes les fonctionnalités selon votre rôle</p></div></div>

      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {Object.entries(DEMOS).map(([r,d])=>(
          <div key={r} onClick={()=>{setRole(r);setStep(0)}} style={{ flex:1, minWidth:140, padding:'14px', borderRadius:12, cursor:'pointer', border:`2px solid ${role===r?d.color:'rgba(0,0,0,.08)'}`, background:role===r?d.bg:'#fff', textAlign:'center' }}>
            <div style={{ fontSize:28 }}>{d.icon}</div>
            <div style={{ fontWeight:600, fontSize:13, color:role===r?d.color:'#1A1714', marginTop:4 }}>{d.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', border:`1px solid rgba(0,0,0,.08)`, borderRadius:14, overflow:'hidden', borderTop:`4px solid ${demo.color}` }}>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Étape {step+1}/{demo.steps.length} · {demo.label}</div>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ width:52, height:52, borderRadius:12, background:demo.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{cur.icon}</div>
            <div><h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:'0 0 6px' }}>{cur.title}</h2><p style={{ fontSize:14, color:'#6B6560', lineHeight:1.6, margin:0 }}>{cur.desc}</p></div>
          </div>
          <div style={{ background:'#E8F2EB', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#2D5A3D', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>💡 Conseil</div>
            <div style={{ fontSize:13, color:'#1A1714', lineHeight:1.6 }}>{cur.tip}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-secondary" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}>← Précédent</button>
            <button className="btn btn-primary" style={{ background:demo.color }} onClick={()=>navigate(cur.path)}>Essayer →</button>
            {step<demo.steps.length-1
              ? <button className="btn btn-primary" style={{ background:demo.color }} onClick={()=>setStep(s=>s+1)}>Suivant →</button>
              : <button className="btn btn-primary" style={{ background:'#1A1714' }} onClick={()=>navigate('/')}>🎉 Terminer</button>
            }
          </div>
        </div>
      </div>

      <div style={{ marginTop:16, display:'flex', gap:8, flexWrap:'wrap' }}>
        {demo.steps.map((s,i)=>(
          <div key={i} onClick={()=>setStep(i)} style={{ flex:1, minWidth:120, padding:'10px 12px', background:'#fff', border:`1px solid ${i===step?demo.color:'rgba(0,0,0,.08)'}`, borderRadius:10, cursor:'pointer', background:i===step?demo.bg:'#fff' }}>
            <div style={{ fontSize:18 }}>{s.icon}</div>
            <div style={{ fontSize:12, fontWeight:500, color:i===step?demo.color:'#1A1714', marginTop:4 }}>{s.title}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
