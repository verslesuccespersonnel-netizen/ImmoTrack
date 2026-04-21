import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const DEMOS = {
  locataire: {
    color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠', label:'Locataire',
    steps:[
      { title:'Tableau de bord', icon:'📊', path:'/',
        desc:'Votre accueil affiche votre logement, les incidents en cours, vos messages non lus et le plan de votre logement.',
        tip:'Le plan de logement est accessible directement depuis l\'accueil. Cliquez dessus pour voir toutes les pièces et équipements.' },
      { title:'Plan de mon logement', icon:'🏠', path:'/',
        desc:'Le plan interactif de votre logement vous permet de cliquer sur n\'importe quelle pièce ou équipement pour signaler un problème directement.',
        tip:'Cliquez sur un équipement (ex: baie vitrée du salon) → le système sait exactement de quel équipement il s\'agit. Choisissez la panne dans la liste ou décrivez en texte libre.' },
      { title:'Signaler un incident', icon:'➕', path:'/signaler',
        desc:'Vous pouvez aussi signaler via le formulaire : choisissez le logement, l\'équipement optionnel, décrivez le problème et la gravité.',
        tip:'Plus vous êtes précis, plus le propriétaire peut agir rapidement. La gravité "Urgent" remonte en priorité.' },
      { title:'Suivre mes incidents', icon:'⚠️', path:'/incidents',
        desc:'Consultez l\'état de vos demandes : Nouveau, En cours, Résolu. Chaque changement de statut vous est notifié.',
        tip:'Rouge = urgent, Jaune = moyen, Vert = faible.' },
      { title:'Messagerie', icon:'💬', path:'/messages',
        desc:'Échangez avec votre propriétaire ou gestionnaire. Les quittances génèrent une notification automatique.',
        tip:'Tous les messages sont archivés et horodatés.' },
      { title:'Mes documents', icon:'📄', path:'/documents',
        desc:'Accédez à vos quittances, bail, états des lieux et diagnostics. Chaque quittance est imprimable en PDF.',
        tip:'Cliquez "Imprimer / PDF" sur une quittance pour l\'enregistrer sur votre appareil.' },
      { title:'Mon profil', icon:'👤', path:'/profil',
        desc:'Modifiez vos informations et changez votre mot de passe depuis votre avatar en haut à droite.',
        tip:'Minimum 6 caractères pour le mot de passe. L\'email ne peut être modifié que par un administrateur.' },
    ]
  },
  proprietaire: {
    color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢', label:'Propriétaire',
    steps:[
      { title:'Tableau de bord', icon:'📊', path:'/',
        desc:'Centralisez biens, taux d\'occupation, incidents urgents et loyers mensuels.',
        tip:'Les incidents urgents (rouge) sont mis en avant pour action immédiate.' },
      { title:'Ajouter un bien', icon:'🏠', path:'/biens',
        desc:'Biens > + Ajouter. Renseignez adresse, type, surface. Cliquez sur la fiche pour l\'étendre et voir les détails.',
        tip:'La fiche expandable affiche locataire, loyer, durée du bail et historique des locations.' },
      { title:'Attribuer un locataire', icon:'👥', path:'/biens',
        desc:'Fiche bien > + Locataire. Deux modes : locataire existant (avec compte) ou nouveau sans compte.',
        tip:'Un locataire sans compte reste visible par son nom. Il pourra créer un compte plus tard via invitation.' },
      { title:'Plan 2D et équipements', icon:'🗺️', path:'/biens',
        desc:'Fiche bien > Plan. Dessinez les pièces, ajoutez les équipements. Ajoutez des notes sur chaque équipement (instructions pour le locataire en cas de panne).',
        tip:'Les notes sur les équipements s\'affichent quand le locataire signale un incident depuis le plan. Indiquez aussi les actions à faire avant d\'appeler le prestataire.' },
      { title:'Prestataires', icon:'🔧', path:'/prestataires',
        desc:'Enregistrez vos artisans et associez-les à vos biens. Le locataire verra leurs coordonnées lors d\'un incident sur l\'équipement correspondant.',
        tip:'Associez le bon prestataire à chaque bien : plombier pour les Plomberie, électricien pour Électricité, etc.' },
      { title:'Quittances', icon:'🧾', path:'/quittances',
        desc:'Générez, archivez et envoyez les quittances en un clic. Le locataire reçoit une notification et peut imprimer en PDF.',
        tip:'"Générer et envoyer" envoie un message détaillé au locataire avec les instructions pour récupérer la quittance.' },
      { title:'Incidents', icon:'⚠️', path:'/incidents',
        desc:'Consultez et gérez tous les incidents de vos biens. Changez le statut pour notifier le locataire.',
        tip:'Les incidents déclarés depuis le plan arrivent avec la pièce et l\'équipement déjà identifiés.' },
    ]
  },
  agence: {
    color:'#C8813A', bg:'#FDF3E7', icon:'🏗️', label:'Agence',
    steps:[
      { title:'Tableau de bord', icon:'📊', path:'/',
        desc:'Vue d\'ensemble de tous les biens gérés, taux d\'occupation global et incidents prioritaires.',
        tip:'Vous voyez uniquement les biens des propriétaires que vous avez liés à votre agence.' },
      { title:'Lier des propriétaires', icon:'🔗', path:'/admin',
        desc:'Administration > Associations > Assigner propriétaire → agence.',
        tip:'Une fois lié, vous accédez à tous les biens et locataires de ce propriétaire.' },
      { title:'Gestion du portefeuille', icon:'🏢', path:'/biens',
        desc:'Accédez à tous les biens liés : plans, locataires, historique, quittances.',
        tip:'Cliquez sur la fiche bien pour voir loyer, locataire et durée du bail.' },
      { title:'Inviter des utilisateurs', icon:'✉️', path:'/admin',
        desc:'Administration > Inviter. Envoyez des invitations aux locataires ou propriétaires avec le rôle prédéfini.',
        tip:'L\'utilisateur recevra un email pour créer son compte avec le bon rôle déjà assigné.' },
      { title:'Quittances en masse', icon:'🧾', path:'/quittances',
        desc:'Générez des quittances pour toutes vos locations actives. Notification automatique aux locataires.',
        tip:'Les quittances sont archivées dans Documents et accessibles par le locataire en PDF.' },
    ]
  },
  admin: {
    color:'#B83232', bg:'#FDEAEA', icon:'⚙️', label:'Administrateur',
    steps:[
      { title:'Vue globale', icon:'📊', path:'/',
        desc:'Accès complet : tous les biens, propriétaires, agences, locataires et incidents de la plateforme.',
        tip:'Rôle réservé à la gestion de la plateforme. Toutes les données sont visibles sans filtre.' },
      { title:'Gérer les comptes', icon:'👥', path:'/admin',
        desc:'Administration > Comptes. Changez les rôles, copiez les UUID, créez des comptes directement.',
        tip:'Créer un compte directement = mot de passe provisoire ImmoTrack2024! à communiquer. L\'utilisateur devra le changer depuis Mon Profil.' },
      { title:'Associations', icon:'🔗', path:'/admin',
        desc:'Administration > Associations. Assignez locataire→bien (crée une location) et propriétaire→agence.',
        tip:'La liste des locataires sans logement s\'affiche avec un bouton d\'assignation direct.' },
      { title:'Tous les biens', icon:'🏢', path:'/biens',
        desc:'Accès à 100% des biens. Lors de la création, choisissez le propriétaire dans la liste.',
        tip:'La fiche expandable montre toutes les infos : locataire, loyer, historique des locations.' },
      { title:'Outils', icon:'🛠️', path:'/admin',
        desc:'Administration > Outils. Suppression sélective, export JSON complet.',
        tip:'La suppression d\'un compte retire le profil. Le compte auth.users reste dans Supabase et doit être supprimé manuellement.' },
    ]
  },
}

export default function Demo() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role || 'locataire'
  const isAdmin = role === 'admin'
  const isMgr = ['proprietaire','gestionnaire','agence','admin'].includes(role)

  const availableRoles = isAdmin
    ? ['locataire','proprietaire','agence','admin']
    : isMgr ? ['proprietaire','locataire']
    : ['locataire']

  const defaultRole = availableRoles.includes(role === 'gestionnaire' ? 'proprietaire' : role)
    ? (role === 'gestionnaire' ? 'proprietaire' : role)
    : availableRoles[0]

  const [selRole, setSelRole] = useState(defaultRole)
  const [step, setStep]       = useState(0)

  const demo = DEMOS[selRole] || DEMOS.locataire
  const cur  = demo.steps[step]

  function changeRole(r) { setSelRole(r); setStep(0) }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Démonstration</h1>
          <p className="page-sub">Guide interactif ImmoTrack v2.5</p>
        </div>
      </div>

      {availableRoles.length > 1 && (
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
          {availableRoles.map(r => {
            const d = DEMOS[r]
            return (
              <div key={r} onClick={() => changeRole(r)} style={{
                flex:1, minWidth:110, padding:12, borderRadius:12, cursor:'pointer', textAlign:'center',
                border:`2px solid ${selRole===r ? d.color : 'rgba(0,0,0,.08)'}`,
                background: selRole===r ? d.bg : '#fff',
                transition:'all .15s',
              }}>
                <div style={{fontSize:26}}>{d.icon}</div>
                <div style={{fontWeight:600,fontSize:12,color:selRole===r?d.color:'#1A1714',marginTop:3}}>{d.label}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card" style={{marginBottom:16,borderTop:`4px solid ${demo.color}`}}>
        <div className="card-body" style={{padding:'20px 24px'}}>
          <div style={{fontSize:10,fontWeight:700,color:demo.color,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>
            Étape {step+1} / {demo.steps.length} — {demo.label}
          </div>
          <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:14}}>
            <div style={{width:52,height:52,borderRadius:12,background:demo.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>
              {cur.icon}
            </div>
            <div>
              <h2 style={{fontFamily:'Georgia,serif',fontSize:19,fontWeight:500,margin:'0 0 6px'}}>{cur.title}</h2>
              <p style={{fontSize:13,color:'#6B6560',lineHeight:1.6,margin:0}}>{cur.desc}</p>
            </div>
          </div>
          <div style={{background:demo.bg,borderRadius:10,padding:'10px 14px',marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,color:demo.color,textTransform:'uppercase',marginBottom:3}}>Conseil</div>
            <div style={{fontSize:12,color:'#1A1714',lineHeight:1.6}}>{cur.tip}</div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn btn-secondary" onClick={() => setStep(s=>Math.max(0,s-1))} disabled={step===0}>
              Précédent
            </button>
            <button className="btn btn-primary" style={{background:demo.color}} onClick={() => navigate(cur.path)}>
              Essayer →
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
            border:`1px solid ${i===step?demo.color:'rgba(0,0,0,.08)'}`,
            background:i===step?demo.bg:'#fff',
            transition:'all .12s',
          }}>
            <div style={{fontSize:17,marginBottom:3}}>{s.icon}</div>
            <div style={{fontSize:11,fontWeight:i===step?600:400,color:i===step?demo.color:'#1A1714'}}>{s.title}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
