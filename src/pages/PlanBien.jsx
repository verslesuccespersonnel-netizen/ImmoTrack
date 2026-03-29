// src/pages/PlanBien.jsx — Constructeur de plan interactif
import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ETAGES = [
  { val:-1, label:'Sous-sol / Cave' },
  { val:0,  label:'Rez-de-chaussée' },
  { val:1,  label:'Étage 1' },
  { val:2,  label:'Étage 2' },
  { val:3,  label:'Étage 3' },
]

const PIECE_TEMPLATES = [
  { nom:'Entrée', icone:'🚪', couleur:'#F0EDE6', w:2, h:2 },
  { nom:'Salon', icone:'🛋️', couleur:'#E8F2EB', w:4, h:3 },
  { nom:'Cuisine', icone:'🍳', couleur:'#FDF3E7', w:3, h:3 },
  { nom:'Chambre', icone:'🛏️', couleur:'#EBF2FC', w:3, h:3 },
  { nom:'Salle de bain', icone:'🛁', couleur:'#F3ECFC', w:2, h:2 },
  { nom:'WC', icone:'🚽', couleur:'#F7F5F0', w:1, h:2 },
  { nom:'Couloir', icone:'↔️', couleur:'#F7F5F0', w:4, h:1 },
  { nom:'Bureau', icone:'💼', couleur:'#EBF2FC', w:3, h:2 },
  { nom:'Garage', icone:'🚗', couleur:'#F0EDE6', w:4, h:3 },
  { nom:'Jardin', icone:'🌿', couleur:'#E8F2EB', w:5, h:4 },
  { nom:'Terrasse', icone:'☀️', couleur:'#FDF3E7', w:3, h:2 },
  { nom:'Balcon', icone:'🌅', couleur:'#FDF3E7', w:2, h:1 },
]

const CELL = 48 // px par cellule
const GRID_W = 16
const GRID_H = 12

export default function PlanBien() {
  const { id: bienId } = useParams()
  const { session }    = useAuth()
  const navigate       = useNavigate()

  const [bien, setBien]       = useState(null)
  const [plan, setPlan]       = useState([])
  const [etage, setEtage]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSel]    = useState(null)
  const [dragging, setDragging] = useState(null)  // { id, offX, offY }
  const [resizing, setResizing] = useState(null)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const svgRef = useRef(null)

  useEffect(() => { load() }, [bienId, etage])

  async function load() {
    setLoading(true)
    const [b, p] = await Promise.all([
      supabase.from('biens').select('*').eq('id', bienId).single(),
      supabase.from('plan_pieces').select('*').eq('bien_id', bienId).eq('etage', etage),
    ])
    setBien(b.data)
    setPlan(p.data || [])
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function addPiece(tpl) {
    // Trouver une position libre
    let x=0, y=0, placed=false
    outer: for (let row=0; row<GRID_H; row++) {
      for (let col=0; col<GRID_W; col++) {
        if (col+tpl.w <= GRID_W && row+tpl.h <= GRID_H) {
          const overlap = plan.some(p =>
            col < p.x+p.w && col+tpl.w > p.x &&
            row < p.y+p.h && row+tpl.h > p.y
          )
          if (!overlap) { x=col; y=row; placed=true; break outer }
        }
      }
    }
    const { data } = await supabase.from('plan_pieces').insert({
      bien_id: bienId, etage,
      nom: tpl.nom, icone: tpl.icone, couleur: tpl.couleur,
      x, y, w: tpl.w, h: tpl.h
    }).select().single()
    if (data) setPlan(p => [...p, data])
  }

  async function updatePiece(id, updates) {
    setPlan(p => p.map(x => x.id===id ? {...x,...updates} : x))
    await supabase.from('plan_pieces').update(updates).eq('id', id)
  }

  async function deletePiece(id) {
    if (!window.confirm('Supprimer cette pièce du plan ?')) return
    await supabase.from('plan_pieces').delete().eq('id', id)
    setPlan(p => p.filter(x => x.id!==id))
    if (selected===id) setSel(null)
  }

  function getSVGCoords(e) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { col:0, row:0 }
    return {
      col: Math.floor((e.clientX - rect.left) / CELL),
      row: Math.floor((e.clientY - rect.top)  / CELL),
    }
  }

  function onMouseDownPiece(e, piece) {
    e.stopPropagation()
    setSel(piece.id)
    setDragging({
      id: piece.id,
      offX: Math.floor((e.clientX - svgRef.current.getBoundingClientRect().left) / CELL) - piece.x,
      offY: Math.floor((e.clientY - svgRef.current.getBoundingClientRect().top)  / CELL) - piece.y,
    })
  }

  function onMouseMove(e) {
    if (!dragging) return
    const { col, row } = getSVGCoords(e)
    const piece = plan.find(p=>p.id===dragging.id)
    if (!piece) return
    const nx = Math.max(0, Math.min(GRID_W - piece.w, col - dragging.offX))
    const ny = Math.max(0, Math.min(GRID_H - piece.h, row - dragging.offY))
    setPlan(p => p.map(x => x.id===dragging.id ? {...x, x:nx, y:ny} : x))
  }

  async function onMouseUp() {
    if (dragging) {
      const piece = plan.find(p=>p.id===dragging.id)
      if (piece) await supabase.from('plan_pieces').update({ x:piece.x, y:piece.y }).eq('id', piece.id)
      setDragging(null)
    }
  }

  function openEdit(piece) {
    setForm({ nom:piece.nom, icone:piece.icone, couleur:piece.couleur, w:piece.w, h:piece.h })
    setModal(piece)
  }

  async function saveEdit() {
    await updatePiece(modal.id, { nom:form.nom, icone:form.icone, couleur:form.couleur, w:Number(form.w)||2, h:Number(form.h)||2 })
    setModal(null)
  }

  const selPiece = plan.find(p => p.id===selected)
  const etageLabel = ETAGES.find(e=>e.val===etage)?.label || 'Niveau'

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      {/* Header */}
      <div style={css.header}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button style={css.backBtn} onClick={() => navigate('/biens')}>← Biens</button>
          <div>
            <h1 style={css.h1}>Plan — {bien?.adresse}</h1>
            <p style={css.sub}>{plan.length} pièce(s) sur ce niveau · {etageLabel}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select style={css.sel} value={etage} onChange={e=>{ setEtage(Number(e.target.value)); setSel(null) }}>
            {ETAGES.map(e=><option key={e.val} value={e.val}>{e.label}</option>)}
          </select>
        </div>
      </div>

      <div style={css.workspace}>
        {/* PALETTE GAUCHE */}
        <div style={css.palette}>
          <div style={css.palTitle}>Ajouter une pièce</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {PIECE_TEMPLATES.map(tpl => (
              <div key={tpl.nom} style={css.palItem}
                onClick={() => addPiece(tpl)}
                title={`Ajouter : ${tpl.nom}`}>
                <span style={{ fontSize:18 }}>{tpl.icone}</span>
                <span style={{ fontSize:12.5, fontWeight:500 }}>{tpl.nom}</span>
                <span style={{ marginLeft:'auto', fontSize:10, color:'#9E9890' }}>{tpl.w}×{tpl.h}</span>
              </div>
            ))}
          </div>
          <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'10px 0' }}/>
          <div style={{ fontSize:11, color:'#9E9890', lineHeight:1.6, padding:'0 2px' }}>
            <strong>Utilisation :</strong><br/>
            • Cliquez pour ajouter<br/>
            • Glissez pour déplacer<br/>
            • Double-clic pour éditer<br/>
            • Sélectionnez pour supprimer
          </div>
        </div>

        {/* GRILLE SVG */}
        <div style={{ flex:1, overflow:'auto', background:'#F7F5F0', borderRadius:12, border:'1px solid rgba(0,0,0,0.08)' }}>
          <svg
            ref={svgRef}
            width={GRID_W * CELL}
            height={GRID_H * CELL}
            style={{ display:'block', cursor: dragging?'grabbing':'default', userSelect:'none' }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {/* Grille de fond */}
            <defs>
              <pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#FAFAF8"/>
            <rect width="100%" height="100%" fill="url(#grid)"/>

            {/* Étiquette niveau */}
            <text x={10} y={20} fontSize="11" fill="rgba(0,0,0,0.25)" fontFamily="sans-serif">{etageLabel}</text>

            {/* Pièces */}
            {plan.map(piece => {
              const x = piece.x * CELL
              const y = piece.y * CELL
              const w = piece.w * CELL
              const h = piece.h * CELL
              const isSel = selected === piece.id

              return (
                <g key={piece.id}
                  onMouseDown={e => onMouseDownPiece(e, piece)}
                  onDoubleClick={() => openEdit(piece)}
                  style={{ cursor: dragging?.id===piece.id ? 'grabbing' : 'grab' }}>
                  {/* Rectangle pièce */}
                  <rect x={x+1} y={y+1} width={w-2} height={h-2}
                    rx="6"
                    fill={piece.couleur || '#E8F2EB'}
                    stroke={isSel ? '#2D5A3D' : 'rgba(0,0,0,0.15)'}
                    strokeWidth={isSel ? 2 : 1}
                    opacity="0.92"
                  />
                  {/* Icône */}
                  <text x={x+w/2} y={y+h/2 - (h>60?10:4)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={h>60?24:16}>
                    {piece.icone}
                  </text>
                  {/* Nom */}
                  {h > 48 && (
                    <text x={x+w/2} y={y+h/2+16}
                      textAnchor="middle" fontSize="11" fontWeight="500"
                      fill="#1A1714" fontFamily="sans-serif"
                      style={{ pointerEvents:'none' }}>
                      {piece.nom}
                    </text>
                  )}
                  {/* Dimensions */}
                  {isSel && (
                    <text x={x+4} y={y+h-5} fontSize="9" fill="#9E9890" fontFamily="sans-serif">
                      {piece.w}×{piece.h}
                    </text>
                  )}
                  {/* Poignée de suppression */}
                  {isSel && (
                    <g onClick={e => { e.stopPropagation(); deletePiece(piece.id) }} style={{ cursor:'pointer' }}>
                      <circle cx={x+w-8} cy={y+8} r="8" fill="#B83232" opacity="0.85"/>
                      <text x={x+w-8} y={y+8} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="white">✕</text>
                    </g>
                  )}
                  {/* Poignée de redimensionnement */}
                  {isSel && (
                    <rect x={x+w-12} y={y+h-12} width="10" height="10" rx="2"
                      fill="#2D5A3D" opacity="0.7" style={{ cursor:'se-resize' }}
                      onMouseDown={e => {
                        e.stopPropagation()
                        const startX = e.clientX, startY = e.clientY
                        const startW = piece.w, startH = piece.h
                        function onMove(ev) {
                          const dw = Math.round((ev.clientX-startX)/CELL)
                          const dh = Math.round((ev.clientY-startY)/CELL)
                          const nw = Math.max(1, Math.min(GRID_W-piece.x, startW+dw))
                          const nh = Math.max(1, Math.min(GRID_H-piece.y, startH+dh))
                          setPlan(p => p.map(x => x.id===piece.id ? {...x,w:nw,h:nh} : x))
                        }
                        async function onUp() {
                          document.removeEventListener('mousemove', onMove)
                          document.removeEventListener('mouseup', onUp)
                          const p = plan.find(x=>x.id===piece.id)
                          if (p) await supabase.from('plan_pieces').update({ w:p.w, h:p.h }).eq('id', p.id)
                        }
                        document.addEventListener('mousemove', onMove)
                        document.addEventListener('mouseup', onUp)
                      }}
                    />
                  )}
                </g>
              )
            })}

            {/* Message si vide */}
            {plan.length === 0 && (
              <text x={GRID_W*CELL/2} y={GRID_H*CELL/2} textAnchor="middle"
                fontSize="14" fill="rgba(0,0,0,0.25)" fontFamily="sans-serif">
                ← Cliquez sur une pièce pour commencer
              </text>
            )}
          </svg>
        </div>

        {/* PANNEAU DROIT — détails pièce sélectionnée */}
        <div style={css.detail}>
          {selPiece ? (
            <>
              <div style={css.palTitle}>Pièce sélectionnée</div>
              <div style={{ fontSize:32, marginBottom:8 }}>{selPiece.icone}</div>
              <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{selPiece.nom}</div>
              <div style={{ fontSize:12, color:'#6B6560', marginBottom:12 }}>
                Position : col {selPiece.x}, ligne {selPiece.y}<br/>
                Taille : {selPiece.w} × {selPiece.h} cellules
              </div>
              <button style={css.btnEdit} onClick={() => openEdit(selPiece)}>✏️ Modifier</button>
              <button style={css.btnDel}  onClick={() => deletePiece(selPiece.id)}>🗑️ Supprimer</button>
            </>
          ) : (
            <>
              <div style={css.palTitle}>Légende</div>
              {plan.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, cursor:'pointer', padding:'6px 8px', borderRadius:6, background: selected===p.id?'#E8F2EB':'transparent' }}
                  onClick={() => setSel(p.id)}>
                  <div style={{ width:14, height:14, borderRadius:3, background: p.couleur, border:'1px solid rgba(0,0,0,0.15)', flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:'#1A1714' }}>{p.icone} {p.nom}</span>
                </div>
              ))}
              {plan.length === 0 && <div style={{ fontSize:12, color:'#9E9890' }}>Aucune pièce ajoutée</div>}
            </>
          )}
        </div>
      </div>

      {/* MODAL ÉDITION */}
      {modal && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modBox}>
            <div style={css.modH}>
              <span style={{ fontFamily:'Georgia,serif', fontSize:17 }}>Modifier la pièce</span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 60px', gap:10 }}>
                <Fld label="Nom" value={form.nom||''} onChange={v=>set('nom',v)} />
                <Fld label="Icône" value={form.icone||''} onChange={v=>set('icone',v)} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Fld label="Largeur (cellules)" value={form.w||''} onChange={v=>set('w',v)} type="number" />
                <Fld label="Hauteur (cellules)" value={form.h||''} onChange={v=>set('h',v)} type="number" />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={css.lbl}>Couleur</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['#E8F2EB','#EBF2FC','#FDF3E7','#F3ECFC','#FDEAEA','#F0EDE6','#FDF6E3','#E8F8F5'].map(c=>(
                    <div key={c} onClick={()=>set('couleur',c)}
                      style={{ width:28, height:28, borderRadius:6, background:c, border:`2px solid ${form.couleur===c?'#2D5A3D':'rgba(0,0,0,0.12)'}`, cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
              <button style={css.btnP} onClick={saveEdit}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Fld({ label, value, onChange, type='text' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={css.lbl}>{label}</label>
      <input style={css.inp} type={type} value={value} onChange={e=>onChange(e.target.value)} />
    </div>
  )
}

const css = {
  center:   { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:  { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:   { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:16, flexWrap:'wrap' },
  h1:       { fontFamily:'Georgia,serif', fontSize:22, fontWeight:500, color:'#1A1714', margin:0 },
  sub:      { fontSize:12, color:'#6B6560', margin:'3px 0 0' },
  backBtn:  { padding:'6px 14px', background:'#fff', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13 },
  sel:      { padding:'7px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, background:'#fff', cursor:'pointer', outline:'none' },
  workspace:{ display:'flex', gap:12, height:'calc(100vh - 180px)', minHeight:500 },
  palette:  { width:170, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'12px', overflowY:'auto', flexShrink:0 },
  palTitle: { fontSize:10, fontWeight:700, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 },
  palItem:  { display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:7, cursor:'pointer', border:'1px solid rgba(0,0,0,0.06)', marginBottom:4, background:'#FAFAF8', transition:'.12s' },
  detail:   { width:160, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'12px', overflowY:'auto', flexShrink:0, display:'flex', flexDirection:'column' },
  btnEdit:  { width:'100%', padding:'8px', background:'#E8F2EB', color:'#2D5A3D', border:'none', borderRadius:7, fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer', marginBottom:6 },
  btnDel:   { width:'100%', padding:'8px', background:'#FDEAEA', color:'#B83232', border:'none', borderRadius:7, fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer' },
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modBox:   { background:'#fff', borderRadius:12, width:'100%', maxWidth:380, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', overflow:'hidden' },
  modH:     { padding:'16px 20px 12px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  closeBtn: { width:26, height:26, border:'1px solid rgba(0,0,0,0.12)', borderRadius:5, background:'none', cursor:'pointer', fontSize:13 },
  lbl:      { fontSize:10, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  inp:      { padding:'8px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', boxSizing:'border-box' },
  btnP:     { padding:'9px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
}
