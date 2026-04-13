import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const DEMOS = {
  locataire: {
    color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠', label:'Locataire',
    steps:[
      { title:'Mon tableau de bord', icon:'📊', path:'/',
        desc:'Le tableau de bord affiche votre logement, les incidents en cours et vos messages non lus.',
        tip:'Si votre logement ne s\'affiche pas, votre propriétaire doit vous rattacher depuis Biens.' },
      { title:'Signaler un incident', icon:'➕', path:'/signaler',
        desc:'Allez dans Signaler, choisissez le logement et l\'équipement, décrivez le problème et la gravité.',
        tip:'Plus vous êtes précis, plus le propriétaire peut agir rapidement.' },
      { title:'Suivre mes incidents', icon:'⚠️', path:'/incidents',
        desc:'Consultez le statut de vos demandes : Nouveau, En cours, Résolu.',
        tip:'Rouge = urgent, Jaune = moyen, Vert = faible. Cliquez pour le détail.' },
      { title:'Messagerie', icon:'💬', path:'/messages',
        desc:'Échangez avec votre propriétaire. Tout est archivé et horodaté.',
        tip:'Le double check confirme que votre message a été lu.' },
      { title:'Mes documents', icon:'📄', path:'/documents',
        desc:'Accédez à vos quittances, bail, états des lieux et diagnostics.',
        tip:'Une notification vous prévient à chaque nouvelle quittance reçue.' },
    ]
  },
  proprietaire: {
    color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢', label:'Propriétaire',
    steps:[
      { title:'Tableau de bord', icon:'📊', path:'/',
        desc:'Centralisez biens, incidents ouverts et taux d\'occupation sur 6 mois.',
        tip:'Les incidents urgents (rouge) sont mis en avant pour action immédiate.' },
      { title:'Ajouter un bien', icon:'🏠', path:'/biens',
        desc:'Biens > + Ajouter un bien. Renseignez adresse, type, surface. Cliquez sur la fiche pour l\'étendre.',
        tip:'Cliquez sur la fiche bien pour voir toutes les infos : locataire, loyer, historique.' },
      { title:'Attribuer un locataire', icon:'👥', path:'/biens',
        desc:'Sur la fiche bien, cliquez + Locataire. Choisissez un compte existant ou créez un locataire directement.',
        tip:'Sans email ? Utilisez l\'onglet Nouveau locataire — le locataire sera visible par son nom.' },
      { title:'Gérer les locataires', icon:'📋', path:'/locataires',
        desc:'Voir toutes les locations actives et les comptes sans logement attribué.',
        tip:'Les locataires créés sans compte apparaissent dans la section Comptes sans logement.' },
      { title:'Générer une quittance', icon:'🧾', path:'/quittances',
        desc:'Quittances > cliquez sur une location > renseignez le mois > Générer. Le locataire est notifié.',
        tip:'La quittance est archivée dans Documents et le locataire reçoit un message automatique.' },
      { title:'Suivre les incidents', icon:'⚠️', path:'/incidents',
        desc:'Filtrez par urgence ou statut. Cliquez pour changer le statut d\'une demande.',
        tip:'Assignez vos prestataires depuis le menu dédié.' },
      { title:'Dessiner le plan', icon:'🗺️', path:'/biens',
        desc:'Sur la fiche bien > Plan. Glissez des pièces, ajoutez équipements. Cliquez une pièce puis ↘ pour redimensionner.',
        tip:'Double-clic pour modifier le nom, l\'icône ou la couleur d\'une pièce.' },
    ]
  },
  agence: {
    color:'#C8813A', bg:'#FDF3E7', icon:'🏗️', label:'Agence',
    steps:[
      { title:'Tableau de bord agence', icon:'📊', path:'/',
        desc:'Vue centralisée de tous les biens gérés, incidents prioritaires et occupation globale.',
        tip:'Vous voyez uniquement les biens des propriétaires que vous avez liés.' },
      { title:'Lier des propriétaires', icon:'🔗', path:'/admin',
        desc:'Administration > Outils > Lier un propriétaire en entrant son UUID.',
        tip:'Le propriétaire trouve son UUID dans Administration, à côté de son nom.' },
      { title:'Gérer le portefeuille', icon:'🏢', path:'/biens',
        desc:'Accédez à tous les biens liés : plans, locataires, historique des locations.',
        tip:'Cliquez sur une fiche bien pour voir loyer, locataire, durée du bail.' },
      { title:'Quittances et incidents', icon:'🧾', path:'/quittances',
        desc:'Générez des quittances pour toutes les locations actives de votre portefeuille.',
        tip:'Les locataires sont notifiés automatiquement par message interne.' },
      { title:'Catalogue personnalisé', icon:'📚', path:'/catalogue',
        desc:'Zones > pièces > équipements > pannes — personnalisez pour votre agence.',
        tip:'Partagé avec tous les propriétaires liés à votre agence.' },
    ]
  },
  admin: {
    color:'#B83232', bg:'#FDEAEA', icon:'⚙️', label:'Administrateur',
    steps:[
      { title:'Vue globale', icon:'📊', path:'/',
        desc:'Accès complet : tous les biens, propriétaires, agences, locataires et incidents.',
        tip:'Rôle réservé au développement et à la maintenance.' },
      { title:'Gérer les comptes', icon:'👥', path:'/admin',
        desc:'Administration > Comptes. Changez les rôles inline. Copiez les UUID pour les attributions.',
        tip:'Pour supprimer un compte : profil supprimé ici, compte auth à supprimer dans Supabase > Auth > Users.' },
      { title:'Tous les biens', icon:'🏢', path:'/biens',
        desc:'Accès à 100% des biens de la plateforme, tous propriétaires confondus.',
        tip:'La fiche expandable montre toutes les infos : locataire, loyer, historique.' },
      { title:'Outils développement', icon:'🛠️', path:'/admin',
        desc:'Administration > Outils. Suppression sélective : plans, incidents, locations, tout.',
        tip:'Irréversible. Exportez en JSON avant toute suppression.' },
      { title:'Export JSON', icon:'⬇️', path:'/admin',
        desc:'Bouton Exporter JSON en haut de l\'Administration.',
        tip:'Contient profils, biens, locations et incidents. Utile pour sauvegardes.' },
    ]
  },
}

export default function Demo() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const role        = profile?.role || 'locataire'
  const isMgr       = ['proprietaire','gestionnaire','agence','admin'].includes(role)
  const isAdmin     = role === 'admin'

  const availableRoles = isAdmin
    ? ['proprietaire','agence','locataire','admin']
    : isMgr ? [role === 'gestionnaire' ? 'proprietaire' : role, 'locataire']
    : ['locataire']

  const [selRole, setSelRole] = useState(availableRoles.includes(role) ? role : availableRoles[0])
  const [step, setStep]       = useState(0)

  const demo = DEMOS[selRole] || DEMOS.locataire
  const cur  = demo.steps[step]

  function changeRole(r) { setSelRole(r); setStep(0) }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Démonstration</h1>
          <p className="page-sub">Guide interactif ImmoTrack v2.3</p>
        </div>
      </div>

      {availableRoles.length > 1 && (
        <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
          {availableRoles.map(r => {
            const d = DEMOS[r]
            return (
              <div key={r} onClick={() => changeRole(r)} style={{
                flex:1, minWidth:110, padding:12, borderRadius:12, cursor:'pointer', textAlign:'center',
                border: `2px solid ${selRole===r ? d.color : 'rgba(0,0,0,.08)'}`,
                background: selRole===r ? d.bg : '#fff',
              }}>
                <div style={{fontSize:26}}>{d.icon}</div>
                <div style={{fontWeight:600, fontSize:12, color:selRole===r?d.color:'#1A1714', marginTop:3}}>{d.label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card" style={{marginBottom:16, borderTop:`4px solid ${demo.color}`}}>
        <div className="card-body" style={{padding:'20px 24px'}}>
          <div style={{fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8}}>
            Étape {step+1} / {demo.steps.length} — {demo.label}
          </div>
          <div style={{display:'flex', gap:14, alignItems:'flex-start', marginBottom:16}}>
            <div style={{width:52, height:52, borderRadius:12, background:demo.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0}}>
              {cur.icon}
            </div>
            <div>
              <h2 style={{fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:'0 0 6px'}}>{cur.title}</h2>
              <p style={{fontSize:14, color:'#6B6560', lineHeight:1.6, margin:0}}>{cur.desc}</p>
            </div>
          </div>
          <div style={{background:demo.bg, borderRadius:10, padding:'12px 16px', marginBottom:16}}>
            <div style={{fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', marginBottom:4}}>Conseil</div>
            <div style={{fontSize:13, color:'#1A1714', lineHeight:1.6}}>{cur.tip}</div>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-secondary" onClick={() => setStep(s => Math.max(0,s-1))} disabled={step===0}>
              Précédent
            </button>
            <button className="btn btn-primary" style={{background:demo.color}} onClick={() => navigate(cur.path)}>
              Essayer maintenant
            </button>
            {step < demo.steps.length-1
              ? <button className="btn btn-primary" style={{background:demo.color}} onClick={() => setStep(s=>s+1)}>
                  Étape suivante
                </button>
              : <button className="btn btn-primary" style={{background:'#1A1714'}} onClick={() => navigate('/')}>
                  Terminer la démo
                </button>
            }
          </div>
        </div>
      </div>

      <div className="grid3" style={{gap:8}}>
        {demo.steps.map((s,i) => (
          <div key={i} onClick={() => setStep(i)} style={{
            padding:'10px 12px', borderRadius:10, cursor:'pointer',
            border:`1px solid ${i===step ? demo.color : 'rgba(0,0,0,.08)'}`,
            background: i===step ? demo.bg : '#fff',
          }}>
            <div style={{fontSize:18, marginBottom:3}}>{s.icon}</div>
            <div style={{fontSize:12, fontWeight:i===step?600:400, color:i===step?demo.color:'#1A1714'}}>{s.title}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
