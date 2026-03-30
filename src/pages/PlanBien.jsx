// src/pages/PlanBien.jsx — Constructeur de plan interactif v2
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

// Grille double taille
const CELL = 48
const GRID_W = 28
const GRID_H = 20

const ETAGES_BASE = [
  { val:-2, label:'Sous-sol 2' },
  { val:-1, label:'Sous-sol / Cave' },
  { val:0,  label:'Rez-de-chaussée' },
  { val:1,  label:'Étage 1' },
  { val:2,  label:'Étage 2' },
  { val:3,  label:'Étage 3' },
  { val:10, label:'Jardin' },
  { val:11, label:'Cour' },
  { val:12, label:'Patio' },
  { val:13, label:'Garage' },
  { val:14, label:'Terrasse extérieure' },
]

const TEMPLATES = [
  { nom:'Entrée',       icone:'🚪', couleur:'#F0EDE6', w:2, h:2 },
  { nom:'Salon',        icone:'🛋️', couleur:'#E8F2EB', w:5, h:4 },
  { nom:'Séjour',       icone:'🪑', couleur:'#E8F2EB', w:4, h:3 },
  { nom:'Cuisine',      icone:'🍳', couleur:'#FDF3E7', w:3, h:3 },
  { nom:'Chambre',      icone:'🛏️', couleur:'#EBF2FC', w:4, h:3 },
  { nom:'Salle de bain',icone:'🛁', couleur:'#F3ECFC', w:3, h:3 },
  { nom:'Salle d\'eau', icone:'🚿', couleur:'#F3ECFC', w:2, h:3 },
  { nom:'WC',           icone:'🚽', couleur:'#F7F5F0', w:1, h:2 },
  { nom:'Couloir',      icone:'↔️', couleur:'#F7F5F0', w:5, h:1 },
  { nom:'Bureau',       icone:'💼', couleur:'#EBF2FC', w:3, h:3 },
  { nom:'Escalier',     icone:'🪜', couleur:'#F0EDE6', w:2, h:3 },
  { nom:'Débarras',     icone:'📦', couleur:'#F0EDE6', w:2, h:2 },
  { nom:'Dressing',     icone:'👔', couleur:'#F3ECFC', w:2, h:2 },
  { nom:'Buanderie',    icone:'🧺', couleur:'#F7F5F0', w:2, h:2 },
  { nom:'Garage',       icone:'🚗', couleur:'#F0EDE6', w:5, h:4 },
  { nom:'Jardin',       icone:'🌿', couleur:'#E8F2EB', w:7, h:5 },
  { nom:'Terrasse',     icone:'☀️', couleur:'#FDF3E7', w:4, h:3 },
  { nom:'Balcon',       icone:'🌅', couleur:'#FDF3E7', w:3, h:1 },
  { nom:'Dépendance',   icone:'🏚️', couleur:'#F0EDE6', w:3, h:3 },
  { nom:'Personnalisée',icone:'✏️', couleur:'#F7F5F0', w:3, h:3, custom:true },
]

const COLORS = ['#E8F2EB','#EBF2FC','#FDF3E7','#F3ECFC','#FDEAEA','#F0EDE6','#FDF6E3','#E8F8F5','#FCF3E6','#EFF7E8']

export default function PlanBien() {
  const { id: bienId } = useParams()
  const { session }    = useAuth()
  const navigate       = useNavigate()

  const [bien, setBien]         = useState(null)
  const [plan, setPlan]         = useState([])
  const [equips, setEquips]     = useState([])   // équipements Supabase
  const [etage, setEtage]       = useState(0)
  const [etages, setEtages]     = useState(ETAGES_BASE)
  const [loading, setLoading]   = useState(true)
  const [selected, setSel]      = useState(null)
  const [dragging, setDragging] = useState(null)
  const [modal, setModal]       = useState(null) // 'edit' | 'equip' | 'etage'
  const [form, setForm]         = useState({})
  const [customNomPiece, setCustomNom] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const svgRef = useRef(null)

  const load = useCallback(async () => {
    if (!session || !bienId) return
    setLoading(true)
    const [bRes, pRes] = await Promise.all([
      supabase.from('biens').select('*').eq('id', bienId).single(),
      supabase.from('plan_pieces').select('*').eq('bien_id', bienId).eq('etage', etage),
    ])
    if (bRes.error) { console.error('Bien error:', bRes.error); setLoading(false); return }
    setBien(bRes.data)
    setPlan(pRes.data || [])
    setLoading(false)
  }, [session, bienId, etage])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function addPiece(tpl) {
    if (tpl.custom) { setAddingCustom(true); return }
    let x = 0, y = 0
    outer: for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        if (col + tpl.w > GRID_W || row + tpl.h > GRID_H) continue
        const ok = !plan.some(p =>
          col < p.x + p.w && col + tpl.w > p.x && row < p.y + p.h && row + tpl.h > p.y)
        if (ok) { x = col; y = row; break outer }
      }
    }
    const { data } = await supabase.from('plan_pieces').insert({
      bien_id: bienId, etage, nom: tpl.nom, icone: tpl.icone,
      couleur: tpl.couleur, x, y, w: tpl.w, h: tpl.h
    }).select().single()
    if (data) setPlan(p => [...p, data])
  }

  async function addCustomPiece() {
    if (!customNomPiece.trim()) return
    const nom = customNomPiece.trim()
    const { data } = await supabase.from('plan_pieces').insert({
      bien_id: bienId, etage, nom, icone: '✏️',
      couleur: '#F7F5F0', x: 0, y: 0, w: 3, h: 3
    }).select().single()
    if (data) setPlan(p => [...p, data])
    setCustomNom('')
    setAddingCustom(false)
  }

  async function updatePiece(id, updates) {
    setPlan(p => p.map(x => x.id === id ? { ...x, ...updates } : x))
    await supabase.from('plan_pieces').update(updates).eq('id', id)
  }

  async function deletePiece(id) {
    if (!window.confirm('Supprimer cette pièce ?')) return
    await supabase.from('plan_pieces').delete().eq('id', id)
    setPlan(p => p.filter(x => x.id !== id))
    if (selected === id) setSel(null)
  }

  function getCell(e) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { col: 0, row: 0 }
    return {
      col: Math.max(0, Math.floor((e.clientX - rect.left) / CELL)),
      row: Math.max(0, Math.floor((e.clientY - rect.top) / CELL)),
    }
  }

  function onMouseDown(e, piece) {
    e.stopPropagation()
    setSel(piece.id)
    const rect = svgRef.current?.getBoundingClientRect()
    setDragging({
      id: piece.id,
      offX: Math.floor((e.clientX - rect.left) / CELL) - piece.x,
      offY: Math.floor((e.clientY - rect.top) / CELL) - piece.y,
    })
  }

  function onMouseMove(e) {
    if (!dragging) return
    const { col, row } = getCell(e)
    const piece = plan.find(p => p.id === dragging.id)
    if (!piece) return
    const nx = Math.max(0, Math.min(GRID_W - piece.w, col - dragging.offX))
    const ny = Math.max(0, Math.min(GRID_H - piece.h, row - dragging.offY))
    setPlan(p => p.map(x => x.id === dragging.id ? { ...x, x: nx, y: ny } : x))
  }

  async function onMouseUp() {
    if (dragging) {
      const piece = plan.find(p => p.id === dragging.id)
      if (piece) await supabase.from('plan_pieces').update({ x: piece.x, y: piece.y }).eq('id', piece.id)
      setDragging(null)
    }
  }

  function addEtageCustom() {
    const nom = prompt('Nom du niveau (ex: Combles, Mezzanine…)')
    if (!nom) return
    const val = 100 + etages.length
    setEtages(e => [...e, { val, label: nom }])
    setEtage(val)
  }

  const selPiece = plan.find(p => p.id === selected)
  const etageLabel = etages.find(e => e.val === etage)?.label || 'Niveau'

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button style={css.backBtn} onClick={() => navigate('/biens')}>← Retour</button>
          <div>
            <h1 style={css.h1}>Plan — {bien?.adresse}</h1>
            <p style={css.sub}>{plan.length} pièce(s) · {etageLabel}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select style={css.sel} value={etage} onChange={e => { setEtage(Number(e.target.value)); setSel(null) }}>
            {etages.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
          </select>
          <button style={css.btnXs} onClick={addEtageCustom}>+ Niveau</button>
        </div>
      </div>

      {/* Ajout pièce personnalisée */}
      {addingCustom && (
        <div style={css.customBox}>
          <input style={css.customInput} value={customNomPiece} placeholder="Nom de la pièce…"
            onChange={e => setCustomNom(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addCustomPiece()}
            autoFocus />
          <button style={css.btnPrimary} onClick={addCustomPiece}>Ajouter</button>
          <button style={css.btnSec} onClick={() => setAddingCustom(false)}>Annuler</button>
        </div>
      )}

      <div style={css.workspace}>
        {/* PALETTE */}
        <div style={css.palette}>
          <div style={css.palTitle}>Pièces</div>
          {TEMPLATES.map(tpl => (
            <div key={tpl.nom} style={css.palItem} onClick={() => addPiece(tpl)}>
              <span style={{ fontSize:16 }}>{tpl.icone}</span>
              <span style={{ fontSize:12 }}>{tpl.nom}</span>
            </div>
          ))}
        </div>

        {/* SVG GRID */}
        <div style={{ flex:1, overflow:'auto', background:'#F0EDE6', borderRadius:12, border:'1px solid rgba(0,0,0,0.08)', position:'relative' }}>
          <svg
            ref={svgRef}
            width={GRID_W * CELL}
            height={GRID_H * CELL}
            style={{ display:'block', cursor: dragging ? 'grabbing' : 'default', userSelect:'none', minWidth: GRID_W * CELL }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={() => setSel(null)}
          >
            <defs>
              <pattern id="g" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#FAFAF8"/>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <text x={8} y={18} fontSize="11" fill="rgba(0,0,0,0.2)" fontFamily="sans-serif">{etageLabel}</text>

            {plan.map(piece => {
              const px = piece.x * CELL, py = piece.y * CELL
              const pw = piece.w * CELL, ph = piece.h * CELL
              const isSel = selected === piece.id
              return (
                <g key={piece.id} style={{ cursor: dragging?.id===piece.id?'grabbing':'grab' }}
                   onMouseDown={e => onMouseDown(e, piece)}
                   onDoubleClick={e => { e.stopPropagation(); setForm({ nom:piece.nom, icone:piece.icone, couleur:piece.couleur, w:piece.w, h:piece.h }); setModal('edit') }}>
                  <rect x={px+1} y={py+1} width={pw-2} height={ph-2} rx="6"
                    fill={piece.couleur||'#E8F2EB'}
                    stroke={isSel?'#2D5A3D':'rgba(0,0,0,0.18)'}
                    strokeWidth={isSel?2.5:1} opacity="0.93"/>
                  <text x={px+pw/2} y={py+ph/2-(ph>80?14:4)} textAnchor="middle" dominantBaseline="middle"
                    fontSize={ph>80?22:14}>{piece.icone}</text>
                  {ph > 52 && (
                    <text x={px+pw/2} y={py+ph/2+(ph>80?12:8)} textAnchor="middle"
                      fontSize="11" fontWeight="500" fill="#1A1714" fontFamily="sans-serif"
                      style={{ pointerEvents:'none' }}>{piece.nom}</text>
                  )}
                  {isSel && <>
                    {/* Supprimer */}
                    <g onClick={e=>{e.stopPropagation();deletePiece(piece.id)}} style={{cursor:'pointer'}}>
                      <circle cx={px+pw-9} cy={py+9} r="9" fill="#B83232" opacity=".85"/>
                      <text x={px+pw-9} y={py+9} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="white">✕</text>
                    </g>
                    {/* Redimensionner */}
                    <rect x={px+pw-13} y={py+ph-13} width="11" height="11" rx="2" fill="#2D5A3D" opacity=".7"
                      style={{cursor:'se-resize'}}
                      onMouseDown={e => {
                        e.stopPropagation()
                        const startX=e.clientX, startY=e.clientY
                        const sw=piece.w, sh=piece.h
                        function mv(ev) {
                          const dw=Math.round((ev.clientX-startX)/CELL), dh=Math.round((ev.clientY-startY)/CELL)
                          setPlan(p=>p.map(x=>x.id===piece.id?{...x,w:Math.max(1,Math.min(GRID_W-piece.x,sw+dw)),h:Math.max(1,Math.min(GRID_H-piece.y,sh+dh))}:x))
                        }
                        async function mu() {
                          document.removeEventListener('mousemove',mv)
                          document.removeEventListener('mouseup',mu)
                          const p=plan.find(x=>x.id===piece.id)
                          if(p) await supabase.from('plan_pieces').update({w:p.w,h:p.h}).eq('id',p.id)
                        }
                        document.addEventListener('mousemove',mv)
                        document.addEventListener('mouseup',mu)
                      }}/>
                    <text x={px+4} y={py+ph-5} fontSize="9" fill="#9E9890" fontFamily="sans-serif"
                      style={{pointerEvents:'none'}}>{piece.w}×{piece.h}</text>
                  </>}
                </g>
              )
            })}
            {plan.length===0 && (
              <text x={GRID_W*CELL/2} y={GRID_H*CELL/2} textAnchor="middle"
                fontSize="14" fill="rgba(0,0,0,0.2)" fontFamily="sans-serif">
                Cliquez sur une pièce à gauche pour commencer
              </text>
            )}
          </svg>
        </div>

        {/* PANNEAU DROIT */}
        <div style={css.detail}>
          {selPiece ? (
            <>
              <div style={css.palTitle}>Pièce sélectionnée</div>
              <div style={{ fontSize:30, margin:'6px 0' }}>{selPiece.icone}</div>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{selPiece.nom}</div>
              <div style={{ fontSize:11, color:'#6B6560', marginBottom:10, lineHeight:1.6 }}>
                Position : {selPiece.x}, {selPiece.y}<br/>
                Taille : {selPiece.w}×{selPiece.h}
              </div>
              <button style={css.btnEdit} onClick={() => { setForm({ nom:selPiece.nom, icone:selPiece.icone, couleur:selPiece.couleur, w:selPiece.w, h:selPiece.h }); setModal('edit') }}>
                ✏️ Modifier
              </button>
              <button style={css.btnDel} onClick={() => deletePiece(selPiece.id)}>🗑️ Supprimer</button>
              <div style={{ marginTop:12 }}>
                <div style={css.palTitle}>Mode d'emploi</div>
                <div style={{ fontSize:11, color:'#9E9890', lineHeight:1.7 }}>
                  • Glisser pour déplacer<br/>
                  • ↘ coin pour redimensionner<br/>
                  • Double-clic pour éditer<br/>
                  • ✕ rouge pour supprimer
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={css.palTitle}>Légende</div>
              {plan.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 6px', borderRadius:6,
                  cursor:'pointer', background: selected===p.id?'#E8F2EB':'transparent', marginBottom:2 }}
                  onClick={() => setSel(p.id)}>
                  <div style={{ width:12, height:12, borderRadius:3, background:p.couleur, border:'1px solid rgba(0,0,0,0.12)', flexShrink:0 }}/>
                  <span style={{ fontSize:11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.icone} {p.nom}</span>
                </div>
              ))}
              {plan.length===0 && <div style={{ fontSize:11, color:'#9E9890' }}>Aucune pièce</div>}
            </>
          )}
        </div>
      </div>

      {/* MODAL ÉDITION */}
      {modal==='edit' && selPiece && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modBox}>
            <div style={css.modH}>
              <span style={{ fontFamily:'Georgia,serif', fontSize:16 }}>Modifier la pièce</span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:11 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 60px', gap:10 }}>
                <Fld label="Nom" val={form.nom||''} set={v=>set('nom',v)} />
                <Fld label="Icône" val={form.icone||''} set={v=>set('icone',v)} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Fld label="Largeur (cellules)" val={form.w||''} set={v=>set('w',v)} type="number" />
                <Fld label="Hauteur (cellules)" val={form.h||''} set={v=>set('h',v)} type="number" />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={css.lbl}>Couleur</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {COLORS.map(c=>(
                    <div key={c} onClick={()=>set('couleur',c)}
                      style={{ width:26, height:26, borderRadius:5, background:c, cursor:'pointer',
                        border:`2.5px solid ${form.couleur===c?'#2D5A3D':'rgba(0,0,0,0.12)'}` }}/>
                  ))}
                </div>
              </div>
              <button style={css.btnPrimary} onClick={async () => {
                const updates = { nom:form.nom, icone:form.icone, couleur:form.couleur, w:Number(form.w)||selPiece.w, h:Number(form.h)||selPiece.h }
                await updatePiece(selPiece.id, updates)
                setModal(null)
              }}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Fld({ label, val, set, type='text' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={css.lbl}>{label}</label>
      <input style={css.inp} type={type} value={val} onChange={e=>set(e.target.value)} />
    </div>
  )
}

const css = {
  center:    { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:   { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:16, flexWrap:'wrap' },
  h1:        { fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, color:'#1A1714', margin:0 },
  sub:       { fontSize:12, color:'#6B6560', margin:'3px 0 0' },
  backBtn:   { padding:'6px 14px', background:'#fff', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13 },
  sel:       { padding:'7px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, background:'#fff', outline:'none' },
  btnXs:     { padding:'6px 12px', background:'#fff', color:'#2D5A3D', border:'1px solid #2D5A3D', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
  customBox: { display:'flex', gap:8, marginBottom:10, alignItems:'center', padding:'10px 14px', background:'#EBF2FC', borderRadius:8 },
  customInput:{ flex:1, padding:'8px 12px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13, outline:'none' },
  workspace: { display:'flex', gap:10, height:'calc(100vh - 190px)', minHeight:480 },
  palette:   { width:152, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'10px 8px', overflowY:'auto', flexShrink:0 },
  palTitle:  { fontSize:9.5, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6, paddingLeft:2 },
  palItem:   { display:'flex', alignItems:'center', gap:7, padding:'6px 8px', borderRadius:7, cursor:'pointer', border:'1px solid rgba(0,0,0,0.06)', marginBottom:4, background:'#FAFAF8', fontSize:12, transition:'.1s' },
  detail:    { width:155, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'12px', overflowY:'auto', flexShrink:0, display:'flex', flexDirection:'column' },
  btnEdit:   { width:'100%', padding:'8px', background:'#E8F2EB', color:'#2D5A3D', border:'none', borderRadius:7, fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer', marginBottom:6 },
  btnDel:    { width:'100%', padding:'8px', background:'#FDEAEA', color:'#B83232', border:'none', borderRadius:7, fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer' },
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modBox:    { background:'#fff', borderRadius:12, width:'100%', maxWidth:360, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', overflow:'hidden' },
  modH:      { padding:'14px 20px 10px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  closeBtn:  { width:26, height:26, border:'1px solid rgba(0,0,0,0.12)', borderRadius:5, background:'none', cursor:'pointer', fontSize:13 },
  lbl:       { fontSize:10, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  inp:       { padding:'8px 10px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  btnPrimary:{ padding:'9px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSec:    { padding:'9px 16px', background:'#fff', color:'#6B6560', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, cursor:'pointer' },
}
