import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const DEMOS = {
  proprietaire: {
    color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢', label:'Propriétaire',
    steps:[
      { title:'Ajouter un bien', icon:'🏠', path:'/biens', desc:'Allez dans "Mes biens" → "+ Ajouter un bien". Renseignez adresse, type et surface.', tip:'Créez un bien par logement : appartement, maison, garage… Vous pouvez gérer plusieurs biens.' },
      { title:'Dessiner le plan', icon:'🗺️', path:'/biens', desc:'Dans la fiche d\'un bien, cliquez "🗺️ Plan". Glissez des pièces depuis la palette gauche, puis ajoutez les équipements.', tip:'Sélectionnez une pièce (clic) puis ↘ pour redimensionner. Double-clic pour éditer nom et couleur.' },
      { title:'Ajouter un locataire', icon:'👥', path:'/locataires', desc:'Menu "Locataires" → "+ Ajouter". Renseignez nom, bien, loyer et date d\'entrée. Ajoutez garants et occupants.', tip:'Si le locataire n\'a pas encore de compte ImmoTrack, laissez l\'UUID vide : une invitation sera créée.' },
      { title:'Attribuer depuis les biens', icon:'🔗', path:'/biens', desc:'Dans la fiche d\'un bien, cliquez "+ Locataire" pour attribuer directement un locataire existant.', tip:'Les locataires sans attribution apparaissent en premier dans la liste.' },
      { title:'Suivre les incidents', icon:'⚠️', path:'/incidents', desc:'Menu "Incidents" → filtrez par urgence ou statut. Cliquez un incident pour changer son statut.', tip:'Les incidents urgents apparaissent en rouge sur le tableau de bord.' },
      { title:'Gérer les prestataires', icon:'🔧', path:'/prestataires', desc:'Menu "Prestataires" → ajoutez artisans et entreprises avec spécialité et contact.', tip:'14 spécialités prédéfinies. Vous pouvez en ajouter de personnalisées.' },
      { title:'Documents', icon:'📄', path:'/documents', desc:'Uploadez baux, quittances et diagnostics. Mettez en favori pour accès rapide.', tip:'Nécessite un bucket "documents" dans Supabase Storage.' },
    ]
  },
  agence: {
    color:'#C8813A', bg:'#FDF3E7', icon:'🏗️', label:'Agence',
    steps:[
      { title:'Lier des propriétaires', icon:'🔗', path:'/admin', desc:'Administration → demandez l\'UUID de chaque propriétaire et liez-les à votre agence.', tip:'Le propriétaire trouve son UUID dans Administration → son profil.' },
      { title:'Voir le portefeuille', icon:'📊', path:'/', desc:'Le tableau de bord centralise tous les biens de vos propriétaires liés avec leurs incidents et loyers.', tip:'Les incidents urgents sont mis en avant pour action immédiate.' },
      { title:'Gérer les biens', icon:'🏢', path:'/biens', desc:'Accédez à tous les biens de vos propriétaires, avec plans, locataires et incidents.', tip:'Seuls les biens des propriétaires que vous avez liés sont visibles.' },
      { title:'Catalogue pannes', icon:'📚', path:'/catalogue', desc:'Personnalisez le catalogue zones → pièces → équipements → types de pannes.', tip:'Le catalogue est partagé avec tous les propriétaires liés à votre agence.' },
    ]
  },
  locataire: {
    color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠', label:'Locataire',
    steps:[
      { title:'Mon logement', icon:'🏠', path:'/', desc:'Le tableau de bord affiche votre logement avec ses incidents en cours et vos messages non lus.', tip:'Si votre logement n\'apparaît pas, votre propriétaire doit vous associer au bien.' },
      { title:'Signaler un incident', icon:'➕', path:'/signaler', desc:'Menu "Signaler" → choisissez le bien, l\'équipement concerné, décrivez le problème et la gravité.', tip:'Soyez précis : depuis quand, fréquence, bruit ou visuel. Ça accélère la résolution.' },
      { title:'Suivre mes incidents', icon:'⚠️', path:'/incidents', desc:'Consultez l\'état de chaque demande. Le statut change quand le propriétaire prend en charge.', tip:'Urgents = 🔴, En cours = 🟡, Résolu = 🟢.' },
      { title:'Messagerie', icon:'💬', path:'/messages', desc:'Échangez directement avec votre propriétaire ou gestionnaire. Tout est archivé et horodaté.', tip:'✓✓ = message lu. Un badge rouge sur le menu indique des messages non lus.' },
      { title:'Documents', icon:'📄', path:'/documents', desc:'Accédez à vos documents partagés : bail, quittances, états des lieux, diagnostics.', tip:'Vous pouvez télécharger n\'importe quel document à tout moment.' },
    ]
  },
  admin: {
    color:'#B83232', bg:'#FDEAEA', icon:'⚙️', label:'Administrateur',
    steps:[
      { title:'Vue globale', icon:'📊', path:'/', desc:'Le tableau de bord admin centralise tous les biens, incidents et locataires de la plateforme.', tip:'Vous voyez tout, y compris les données de tous les propriétaires et agences.' },
      { title:'Gérer les comptes', icon:'👥', path:'/admin', desc:'Administration → Comptes. Changez les rôles directement via le sélecteur inline.', tip:'Passez un compte en "admin" pour donner l\'accès complet à la plateforme.' },
      { title:'Outils développement', icon:'🛠️', path:'/admin', desc:'Onglet "Outils" → suppression sélective (plans, incidents, locations) ou tout supprimer.', tip:'⚠️ Ces actions sont irréversibles. Exportez vos données en JSON avant.' },
      { title:'Export JSON', icon:'⬇️', path:'/admin', desc:'Bouton "Exporter JSON" en haut → télécharge toutes les données de la plateforme.', tip:'Utile pour sauvegardes ou migration.' },
    ]
  },
}

export default function Demo() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const defaultRole = profile?.role && DEMOS[profile.role] ? profile.role : 'proprietaire'
  const [role, setRole] = useState(defaultRole)
  const [step, setStep] = useState(0)
  const demo = DEMOS[role]
  const cur  = demo.steps[step]

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Démonstration</h1><p className="page-sub">Guide interactif par rôle</p></div>
      </div>

      {/* Sélecteur de rôle */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {Object.entries(DEMOS).map(([r,d]) => (
          <div key={r} onClick={() => { setRole(r); setStep(0) }}
            style={{ flex:1, minWidth:130, padding:14, borderRadius:12, cursor:'pointer', textAlign:'center',
              border: `2px solid ${role===r ? d.color : 'rgba(0,0,0,.08)'}`,
              background: role===r ? d.bg : '#fff' }}>
            <div style={{ fontSize:28 }}>{d.icon}</div>
            <div style={{ fontWeight:600, fontSize:13, color: role===r ? d.color : '#1A1714', marginTop:4 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {/* Étape courante */}
      <div className="card" style={{ marginBottom:16, borderTop: `4px solid ${demo.color}` }}>
        <div className="card-body" style={{ padding:'20px 24px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
            Étape {step+1} / {demo.steps.length} · {demo.label}
          </div>
          <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ width:52, height:52, borderRadius:12, background:demo.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
              {cur.icon}
            </div>
            <div>
              <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:'0 0 6px' }}>{cur.title}</h2>
              <p style={{ fontSize:14, color:'#6B6560', lineHeight:1.6, margin:0 }}>{cur.desc}</p>
            </div>
          </div>
          <div style={{ background:demo.bg, borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', marginBottom:4 }}>💡 Conseil</div>
            <div style={{ fontSize:13, color:'#1A1714', lineHeight:1.6 }}>{cur.tip}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setStep(s => Math.max(0,s-1))} disabled={step===0}>← Précédent</button>
            <button className="btn btn-primary" style={{ background:demo.color }} onClick={() => navigate(cur.path)}>Essayer →</button>
            {step < demo.steps.length-1
              ? <button className="btn btn-primary" style={{ background:demo.color }} onClick={() => setStep(s => s+1)}>Suivant →</button>
              : <button className="btn btn-primary" style={{ background:'#1A1714' }} onClick={() => navigate('/')}>🎉 Terminer</button>
            }
          </div>
        </div>
      </div>

      {/* Navigation entre étapes */}
      <div className="grid3" style={{ gap:8 }}>
        {demo.steps.map((s,i) => (
          <div key={i} onClick={() => setStep(i)}
            style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer',
              border: `1px solid ${i===step ? demo.color : 'rgba(0,0,0,.08)'}`,
              background: i===step ? demo.bg : '#fff' }}>
            <div style={{ fontSize:18, marginBottom:3 }}>{s.icon}</div>
            <div style={{ fontSize:12, fontWeight: i===step?600:400, color: i===step?demo.color:'#1A1714' }}>{s.title}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
