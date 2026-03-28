// src/pages/Documents.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase, getDocuments, uploadDocument, createShareLink } from '../lib/supabase'
import Layout from '../components/Layout'
import { formatDate, formatSize } from '../lib/utils'
import { useDropzone } from 'react-dropzone'

const CATEGORIES = ['bail','etat_des_lieux','quittance','assurance','facture','autre']
const CAT_LABELS  = { bail:'Bail', etat_des_lieux:'État des lieux', quittance:'Quittance',
                       assurance:'Assurance', facture:'Facture', autre:'Autre' }
const CAT_ICONS   = { bail:'📋', etat_des_lieux:'🏠', quittance:'💶',
                       assurance:'🛡️', facture:'🧾', autre:'📄' }

export default function Documents() {
  const { profile, session } = useAuth()
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('all')
  const [showUpload, setUpload] = useState(false)
  const [shareModal, setShare]  = useState(null) // doc object
  const [shareLink, setShareLink] = useState('')
  const [shareHours, setShareHours] = useState(24)

  useEffect(() => { loadDocs() }, [session, profile])

  async function loadDocs() {
    if (!session || !profile) return
    setLoading(true)
    try {
      let query = supabase
        .from('documents')
        .select('*, uploaded_by:profiles(nom, prenom), bien:biens(adresse)')
        .order('created_at', { ascending: false })

      if (profile.role === 'locataire') {
        // Biens liés via locations actives
        const { data: locs } = await supabase
          .from('locations').select('bien_id')
          .eq('locataire_id', session.user.id).eq('statut', 'actif')
        const ids = (locs || []).map(l => l.bien_id)
        if (ids.length) query = query.in('bien_id', ids)
        else { setDocs([]); return }
      } else {
        const { data: biens } = await supabase
          .from('biens').select('id').eq('proprietaire_id', session.user.id)
        const ids = (biens || []).map(b => b.id)
        if (ids.length) query = query.in('bien_id', ids)
        else { setDocs([]); return }
      }

      const { data } = await query
      setDocs(data || [])
    } finally {
      setLoading(false)
    }
  }

  async function toggleFavori(docId, current) {
    await supabase.from('documents').update({ est_favori: !current }).eq('id', docId)
    setDocs(d => d.map(x => x.id === docId ? { ...x, est_favori: !current } : x))
  }

  async function handleShare(doc) {
    setShare(doc)
    setShareLink('')
  }

  async function generateLink() {
    try {
      const url = await createShareLink(shareModal.id, shareHours)
      setShareLink(url)
    } catch (e) {
      alert('Erreur : ' + e.message)
    }
  }

  const filtered = docs
    .filter(d => catFilter === 'all' || d.categorie === catFilter)
    .filter(d => !search ||
      d.nom.toLowerCase().includes(search.toLowerCase()) ||
      CAT_LABELS[d.categorie]?.toLowerCase().includes(search.toLowerCase()))

  const favs = filtered.filter(d => d.est_favori)
  const others = filtered.filter(d => !d.est_favori)

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Mes documents</h1>
          <p style={css.subtitle}>{docs.length} document(s) · {docs.filter(d=>d.est_favori).length} favori(s)</p>
        </div>
        {profile?.role !== 'locataire' && (
          <button style={css.btnPrimary} onClick={() => setUpload(true)}>
            📤 Ajouter un document
          </button>
        )}
      </div>

      {/* SEARCH */}
      <div style={css.searchWrap}>
        <span style={css.searchIcon}>🔍</span>
        <input style={css.searchInput} placeholder="Rechercher un document…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* CATEGORY FILTERS */}
      <div style={css.filterRow}>
        <button style={chipStyle(catFilter === 'all')} onClick={() => setCat('all')}>
          Tous ({docs.length})
        </button>
        {CATEGORIES.map(cat => {
          const n = docs.filter(d => d.categorie === cat).length
          if (!n) return null
          return (
            <button key={cat} style={chipStyle(catFilter === cat)} onClick={() => setCat(cat)}>
              {CAT_ICONS[cat]} {CAT_LABELS[cat]} ({n})
            </button>
          )
        })}
      </div>

      {loading
        ? <div style={css.loading}>Chargement...</div>
        : <>
            {favs.length > 0 && (
              <Section title="⭐ Favoris">
                {favs.map(d => <DocRow key={d.id} doc={d}
                  onFav={() => toggleFavori(d.id, d.est_favori)}
                  onShare={() => handleShare(d)} />)}
              </Section>
            )}
            <Section title="Tous les documents">
              {others.length === 0 && favs.length === 0 && (
                <div style={css.empty}>Aucun document trouvé.</div>
              )}
              {others.map(d => <DocRow key={d.id} doc={d}
                onFav={() => toggleFavori(d.id, d.est_favori)}
                onShare={() => handleShare(d)} />)}
            </Section>
          </>
      }

      {/* MODAL UPLOAD */}
      {showUpload && (
        <UploadModal
          session={session}
          onClose={() => setUpload(false)}
          onUploaded={() => { setUpload(false); loadDocs() }}
        />
      )}

      {/* MODAL PARTAGE */}
      {shareModal && (
        <div style={css.overlay} onClick={() => setShare(null)}>
          <div style={css.modal} onClick={e => e.stopPropagation()}>
            <div style={css.modalHeader}>
              <span style={{ fontFamily: 'Georgia,serif', fontSize: 17 }}>Partager le document</span>
              <button style={css.closeBtn} onClick={() => setShare(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, color: '#6B6560', marginBottom: 14 }}>
                Créez un lien temporaire pour <strong>{shareModal.nom}</strong>
              </p>
              <div style={{ marginBottom: 14 }}>
                <div style={css.label}>Expiration</div>
                <select style={css.select} value={shareHours}
                  onChange={e => setShareHours(Number(e.target.value))}>
                  <option value={24}>24 heures</option>
                  <option value={168}>7 jours</option>
                  <option value={720}>30 jours</option>
                </select>
              </div>
              <button style={css.btnPrimary} onClick={generateLink}>
                🔗 Générer le lien
              </button>
              {shareLink && (
                <div style={{ marginTop: 14 }}>
                  <div style={css.label}>Lien de partage</div>
                  <div style={css.codeBox}>{shareLink}</div>
                  <button style={{ ...css.btnSec, marginTop: 8 }}
                    onClick={() => { navigator.clipboard?.writeText(shareLink); alert('Lien copié !') }}>
                    📋 Copier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ── DOC ROW ──────────────────────────────────────────────
function DocRow({ doc, onFav, onShare }) {
  const icon = CAT_ICONS[doc.categorie] || '📄'
  const label = CAT_LABELS[doc.categorie] || 'Autre'
  return (
    <div style={css.docRow}>
      <div style={css.docIcon}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13.5, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
        <div style={{ fontSize: 12, color: '#6B6560', marginTop: 2 }}>
          {label}
          {doc.taille_bytes ? ` · ${formatSize(doc.taille_bytes)}` : ''}
          {` · ${formatDate(doc.created_at)}`}
          {doc.bien?.adresse ? ` · ${doc.bien.adresse}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <IconBtn title="Favori" onClick={onFav}>{doc.est_favori ? '⭐' : '☆'}</IconBtn>
        <IconBtn title="Partager" onClick={onShare}>🔗</IconBtn>
        <IconBtn title="Télécharger" onClick={() => window.open(doc.url, '_blank')}>⬇️</IconBtn>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#9E9890',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    marginBottom: 8 }}>{title}</div>
      <div style={css.card}>{children}</div>
    </div>
  )
}

function IconBtn({ children, onClick, title }) {
  return (
    <button title={title} onClick={onClick} style={css.iconBtn}>{children}</button>
  )
}

// ── UPLOAD MODAL ─────────────────────────────────────────
function UploadModal({ session, onClose, onUploaded }) {
  const [biens, setBiens]   = useState([])
  const [form, setForm]     = useState({ bien_id: '', categorie: 'bail' })
  const [files, setFiles]   = useState([])
  const [uploading, setUpl] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  useEffect(() => {
    supabase.from('biens').select('id, adresse, ville')
      .eq('proprietaire_id', session.user.id)
      .then(({ data }) => setBiens(data || []))
  }, [])

  const onDrop = useCallback(accepted => setFiles(accepted), [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 10, maxSize: 50 * 1024 * 1024,
  })

  async function handleUpload() {
    if (!form.bien_id || files.length === 0) {
      setError('Sélectionnez un bien et au moins un fichier.')
      return
    }
    setUpl(true); setError('')
    try {
      for (const file of files) {
        await uploadDocument({
          bienId: form.bien_id,
          file,
          categorie: form.categorie,
          uploadedBy: session.user.id,
        })
      }
      onUploaded()
    } catch (e) {
      setError(e.message)
    } finally {
      setUpl(false)
    }
  }

  return (
    <div style={css.overlay} onClick={onClose}>
      <div style={css.modal} onClick={e => e.stopPropagation()}>
        <div style={css.modalHeader}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 17 }}>Ajouter un document</span>
          <button style={css.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={css.errorBox}>{error}</div>}

          <div>
            <div style={css.label}>Bien concerné</div>
            <select style={css.select} value={form.bien_id}
              onChange={e => set('bien_id', e.target.value)}>
              <option value="">— Sélectionner —</option>
              {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
            </select>
          </div>

          <div>
            <div style={css.label}>Catégorie</div>
            <select style={css.select} value={form.categorie}
              onChange={e => set('categorie', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </div>

          <div {...getRootProps()} style={{
            ...css.dropzone,
            borderColor: isDragActive ? '#2D5A3D' : 'rgba(0,0,0,0.18)',
            background: isDragActive ? '#E8F2EB' : '#F7F5F0',
          }}>
            <input {...getInputProps()} />
            <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>
              {isDragActive ? 'Déposez ici…' : 'Glissez ou cliquez pour ajouter'}
            </div>
            <div style={{ fontSize: 11, color: '#9E9890', marginTop: 3 }}>PDF, images · max 50 Mo</div>
          </div>

          {files.length > 0 && (
            <div style={{ fontSize: 13, color: '#2D5A3D' }}>
              {files.length} fichier(s) sélectionné(s) : {files.map(f => f.name).join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={css.btnSec} onClick={onClose}>Annuler</button>
            <button style={{ ...css.btnPrimary, opacity: uploading ? 0.7 : 1 }}
              onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Envoi…' : '📤 Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── STYLES ───────────────────────────────────────────────
function chipStyle(active) {
  return {
    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: `1px solid ${active ? '#2D5A3D' : 'rgba(0,0,0,0.12)'}`,
    background: active ? '#2D5A3D' : '#fff', color: active ? '#fff' : '#6B6560',
    fontFamily: 'inherit', transition: '0.15s',
  }
}

const css = {
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  h1:         { fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 500, color: '#1A1714', margin: 0 },
  subtitle:   { fontSize: 13, color: '#6B6560', margin: '4px 0 0' },
  loading:    { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, color: '#6B6560' },
  searchWrap: { position: 'relative', marginBottom: 12 },
  searchIcon: { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14 },
  searchInput:{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' },
  filterRow:  { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  card:       { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' },
  docRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'default' },
  docIcon:    { width: 36, height: 36, borderRadius: 8, background: '#F7F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  iconBtn:    { width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(0,0,0,0.10)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  empty:      { padding: '32px', textAlign: 'center', color: '#9E9890', fontSize: 13 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:      { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 6px 24px rgba(0,0,0,0.12)' },
  modalHeader:{ padding: '18px 24px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn:   { width: 28, height: 28, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label:      { fontSize: 11, fontWeight: 600, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 },
  select:     { width: '100%', padding: '9px 12px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, background: '#fff', cursor: 'pointer', outline: 'none' },
  dropzone:   { border: '2px dashed', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', transition: '0.15s' },
  codeBox:    { background: '#EBF2FC', borderRadius: 8, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: '#2B5EA7', marginTop: 6 },
  btnPrimary: { padding: '9px 18px', background: '#2D5A3D', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnSec:     { padding: '9px 18px', background: '#fff', color: '#1A1714', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' },
  errorBox:   { background: '#FDEAEA', color: '#B83232', border: '1px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', fontSize: 13 },
}
