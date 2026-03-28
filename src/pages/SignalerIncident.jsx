// src/pages/SignalerIncident.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { supabase, createIncident, uploadMedia } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function SignalerIncident() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()

  const [biens, setBiens]     = useState([])
  const [pieces, setPieces]   = useState([])
  const [elements, setElements] = useState([])
  const [files, setFiles]     = useState([]) // { file, commentaire, preview }
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm] = useState({
    bien_id: '', piece_id: '', element_id: '',
    titre: '', description: '', categorie: 'plomberie', gravite: 'moyen'
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Charge les biens du locataire
  useEffect(() => {
    if (!session) return
    supabase
      .from('locations')
      .select('bien:biens(id, adresse, ville)')
      .eq('locataire_id', session.user.id)
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (data) setBiens(data.map(l => l.bien))
      })
  }, [session])

  // Charge les pièces quand un bien est sélectionné
  useEffect(() => {
    if (!form.bien_id) return
    supabase.from('pieces').select('*').eq('bien_id', form.bien_id)
      .then(({ data }) => { if (data) setPieces(data) })
  }, [form.bien_id])

  // Charge les éléments quand une pièce est sélectionnée
  useEffect(() => {
    if (!form.piece_id) return
    supabase.from('elements').select('*').eq('piece_id', form.piece_id)
      .then(({ data }) => { if (data) setElements(data) })
  }, [form.piece_id])

  // Dropzone
  const onDrop = useCallback(accepted => {
    const newFiles = accepted.map(f => ({
      file: f,
      commentaire: '',
      preview: f.type.startsWith('image') ? URL.createObjectURL(f) : null
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'video/*': [], 'audio/*': [], 'application/pdf': [] },
    maxSize: 100 * 1024 * 1024
  })

  function removeFile(i) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
  }
  function setComment(i, v) {
    setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, commentaire: v } : f))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.bien_id || !form.titre) {
      setError('Veuillez renseigner au minimum un bien et un titre.')
      return
    }
    setSending(true); setError('')
    try {
      // 1. Créer l'incident
      const incident = await createIncident({
        ...form,
        signale_par: session.user.id,
        piece_id: form.piece_id || null,
        element_id: form.element_id || null,
      })

      // 2. Upload les médias en parallèle
      await Promise.all(files.map(({ file, commentaire }) =>
        uploadMedia({
          incidentId: incident.id,
          elementId: form.element_id || null,
          file,
          commentaire,
          uploadedBy: session.user.id,
        })
      ))

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (success) return (
    <div style={css.successPage}>
      <div style={{ fontSize: 52 }}>✅</div>
      <h2 style={{ fontFamily: 'Georgia,serif', color: '#2D5A3D' }}>Incident signalé !</h2>
      <p style={{ color: '#6B6560' }}>Votre propriétaire a été notifié. Réponse sous 48h.</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={css.btnSec} onClick={() => navigate('/incidents')}>Mes incidents</button>
        <button style={css.btnPrimary} onClick={() => navigate('/')}>Accueil</button>
      </div>
    </div>
  )

  return (
    <div style={css.page}>
      <h1 style={css.h1}>Signaler un incident</h1>

      {error && <div style={css.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* BLOC 1 : Localisation */}
        <Section title="1. Localisation">
          <Grid2>
            <Select label="Bien concerné" value={form.bien_id} onChange={v => set('bien_id', v)} required>
              <option value="">— Sélectionner —</option>
              {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
            </Select>
            <Select label="Pièce" value={form.piece_id} onChange={v => set('piece_id', v)}>
              <option value="">— Sélectionner —</option>
              {pieces.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </Select>
          </Grid2>
          <Grid2>
            <Select label="Élément concerné" value={form.element_id} onChange={v => set('element_id', v)}>
              <option value="">— Sélectionner —</option>
              {elements.map(el => <option key={el.id} value={el.id}>{el.nom}</option>)}
            </Select>
            <Select label="Catégorie" value={form.categorie} onChange={v => set('categorie', v)}>
              {['plomberie','electricite','chauffage','menuiserie','structure','autre'].map(c =>
                <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
              )}
            </Select>
          </Grid2>
        </Section>

        {/* BLOC 2 : Description */}
        <Section title="2. Description">
          <Input label="Titre de l'incident" value={form.titre}
            onChange={v => set('titre', v)} required placeholder="Ex : Fuite robinet cuisine" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={css.label}>Description détaillée</label>
            <textarea style={{ ...css.input, minHeight: 90, resize: 'vertical' }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Depuis quand ? Symptômes observés ? Tentatives de réparation ?" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={css.label}>Niveau d'urgence</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'faible',  label: '🟢 Faible',  bg: '#E8F2EB', col: '#2D5A3D', border: '#2D5A3D' },
                { v: 'moyen',   label: '🟡 Moyen',   bg: '#FDF6E3', col: '#B87E20', border: '#B87E20' },
                { v: 'urgent',  label: '🔴 Urgent',  bg: '#FDEAEA', col: '#B83232', border: '#B83232' },
              ].map(({ v, label, bg, col, border }) => (
                <button key={v} type="button" onClick={() => set('gravite', v)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                    border: `1.5px solid ${form.gravite === v ? border : 'rgba(0,0,0,0.12)'}`,
                    background: form.gravite === v ? bg : '#fff',
                    color: form.gravite === v ? col : '#6B6560',
                    transition: '0.15s',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* BLOC 3 : Médias */}
        <Section title="3. Photos & documents">
          <div {...getRootProps()} style={{
            ...css.dropzone,
            borderColor: isDragActive ? '#2D5A3D' : 'rgba(0,0,0,0.18)',
            background: isDragActive ? '#E8F2EB' : '#F7F5F0',
          }}>
            <input {...getInputProps()} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={{ fontWeight: 500 }}>
              {isDragActive ? 'Déposez ici...' : 'Glissez ou cliquez pour ajouter des fichiers'}
            </div>
            <div style={{ fontSize: 12, color: '#9E9890', marginTop: 4 }}>
              Photos, vidéos, PDF, audio · max 100 Mo par fichier
            </div>
          </div>

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {files.map((f, i) => (
                <div key={i} style={css.fileRow}>
                  {f.preview
                    ? <img src={f.preview} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover' }} />
                    : <div style={css.fileIcon}>{f.file.type === 'application/pdf' ? '📄' : '🎵'}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.file.name}</div>
                    <input
                      style={{ ...css.input, marginTop: 4, fontSize: 12, padding: '5px 8px' }}
                      placeholder="Commentaire sur ce fichier…"
                      value={f.commentaire}
                      onChange={e => setComment(i, e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={() => removeFile(i)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9E9890' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={css.btnSec} onClick={() => navigate('/')}>Annuler</button>
          <button type="submit" style={{ ...css.btnPrimary, opacity: sending ? 0.7 : 1 }} disabled={sending}>
            {sending ? 'Envoi en cours...' : '✅ Envoyer le signalement'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── HELPERS ─────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)',
                    fontWeight: 600, fontSize: 13 }}>{title}</div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  )
}

function Grid2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Input({ label, value, onChange, required, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={css.label}>{label}</label>
      <input style={css.input} value={value} required={required}
        placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function Select({ label, value, onChange, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={css.label}>{label}</label>
      <select style={css.input} value={value} required={required}
        onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  )
}

const css = {
  page: { maxWidth: 700, margin: '0 auto', padding: '28px 20px' },
  h1: { fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 500,
        color: '#1A1714', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: 600, color: '#6B6560',
           letterSpacing: '0.05em', textTransform: 'uppercase' },
  input: {
    padding: '9px 12px', border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8, fontFamily: 'inherit', fontSize: 14,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  dropzone: {
    border: '2px dashed', borderRadius: 10, padding: '28px 20px',
    textAlign: 'center', cursor: 'pointer', transition: '0.15s',
  },
  fileRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 12px', background: '#F7F5F0',
    borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)',
  },
  fileIcon: {
    width: 52, height: 52, borderRadius: 6,
    background: '#EBF2FC', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 24,
  },
  btnPrimary: {
    padding: '10px 20px', background: '#2D5A3D', color: '#fff',
    border: 'none', borderRadius: 8, fontFamily: 'inherit',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  btnSec: {
    padding: '10px 20px', background: '#fff', color: '#1A1714',
    border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
  },
  errorBox: {
    background: '#FDEAEA', color: '#B83232', border: '1px solid #F7C1C1',
    borderRadius: 8, padding: '10px 14px', fontSize: 13,
  },
  successPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '60vh', gap: 12, textAlign: 'center',
  },
}
