// src/pages/PlanBien.jsx — Plan interactif avec équipements v3.1 (resize fix)
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CELL = 48
const GRID_W = 28
const GRID_H = 20

const ETAGES_BASE = [
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

const PIECE_TEMPLATES = [
  { nom:'Entrée',        icone:'🚪', couleur:'#F0EDE6', w:2, h:2 },
  { nom:'Salon',         icone:'🛋️', couleur:'#E8F2EB', w:5, h:4 },
  { nom:'Séjour',        icone:'🪑', couleur:'#E8F2EB', w:4, h:3 },
  { nom:'Cuisine',       icone:'🍳', couleur:'#FDF3E7', w:3, h:3 },
  { nom:'Chambre',       icone:'🛏️', couleur:'#EBF2FC', w:4, h:3 },
  { nom:'Salle de bain', icone:'🛁', couleur:'#F3ECFC', w:3, h:3 },
  { nom:'Salle d\'eau',  icone:'🚿', couleur:'#F3ECFC', w:2, h:3 },
  { nom:'WC',            icone:'🚽', couleur:'#F7F5F0', w:1, h:2 },
  { nom:'Couloir',       icone:'↔️', couleur:'#F7F5F0', w:5, h:1 },
  { nom:'Bureau',        icone:'💼', couleur:'#EBF2FC', w:3, h:3 },
  { nom:'Escalier',      icone:'🪜', couleur:'#F0EDE6', w:2, h:3 },
  { nom:'Débarras',      icone:'📦', couleur:'#F0EDE6', w:2, h:2 },
  { nom:'Dressing',      icone:'👔', couleur:'#F3ECFC', w:2, h:2 },
  { nom:'Buanderie',     icone:'🧺', couleur:'#F7F5F0', w:2, h:2 },
  { nom:'Garage',        icone:'🚗', couleur:'#F0EDE6', w:5, h:4 },
  { nom:'Jardin',        icone:'🌿', couleur:'#E8F2EB', w:7, h:5 },
  { nom:'Terrasse',      icone:'☀️', couleur:'#FDF3E7', w:4, h:3 },
  { nom:'Balcon',        icone:'🌅', couleur:'#FDF3E7', w:3, h:1 },
  { nom:'Dépendance',    icone:'🏚️', couleur:'#F0EDE6', w:3, h:3 },
  { nom:'Personnalisée', icone:'✏️', couleur:'#F7F5F0', w:3, h:3, custom:true },
]

const EQUIP_CATALOGUE = {
  'Ouvertures': [
    { nom:'Porte',                    icone:'🚪', cat:'menuiserie' },
    { nom:'Fenêtre',                  icone:'🪟', cat:'menuiserie' },
    { nom:'Porte-fenêtre',            icone:'🪟', cat:'menuiserie' },
    { nom:'Volet roulant électrique', icone:'🪟', cat:'electricite' },
    { nom:'Volet roulant manuel',     icone:'🪟', cat:'menuiserie' },
    { nom:'Velux / Fenêtre de toit',  icone:'🪟', cat:'menuiserie' },
    { nom:'Portail motorisé',         icone:'🚧', cat:'electricite' },
    { nom:'Portail manuel',           icone:'🚧', cat:'menuiserie' },
    { nom:'Garage motorisé',          icone:'🚗', cat:'electricite' },
    { nom:'Serrure / Verrou',         icone:'🔐', cat:'menuiserie' },
    { nom:'Digicode',                 icone:'🔢', cat:'electricite' },
  ],
  'Électricité': [
    { nom:'Prise murale',             icone:'🔌', cat:'electricite' },
    { nom:'Interrupteur',             icone:'🔘', cat:'electricite' },
    { nom:'Tableau électrique',       icone:'⚡', cat:'electricite' },
    { nom:'Luminaire / Lustre',       icone:'💡', cat:'electricite' },
    { nom:'Spot encastré',            icone:'💡', cat:'electricite' },
    { nom:'Détecteur fumée',          icone:'🔴', cat:'electricite' },
    { nom:'VMC / Ventilation',        icone:'💨', cat:'electricite' },
    { nom:'Interphone',               icone:'📞', cat:'electricite' },
    { nom:'Sonnette',                 icone:'🔔', cat:'electricite' },
    { nom:'Climatiseur / PAC',        icone:'❄️', cat:'electricite' },
  ],
  'Plomberie': [
    { nom:'Robinet / Mitigeur',       icone:'🚰', cat:'plomberie' },
    { nom:'Évier',                    icone:'🪣', cat:'plomberie' },
    { nom:'Lavabo',                   icone:'🪣', cat:'plomberie' },
    { nom:'Baignoire',                icone:'🛁', cat:'plomberie' },
    { nom:'Douche / Receveur',        icone:'🚿', cat:'plomberie' },
    { nom:'WC / Cuvette',             icone:'🚽', cat:'plomberie' },
    { nom:'Chasse d\'eau',            icone:'💧', cat:'plomberie' },
    { nom:'Lave-vaisselle',           icone:'🫧', cat:'plomberie' },
    { nom:'Lave-linge',               icone:'🫧', cat:'plomberie' },
    { nom:'Chauffe-eau / Ballon',     icone:'💧', cat:'plomberie' },
  ],
  'Chauffage': [
    { nom:'Radiateur',                icone:'🌡️', cat:'chauffage' },
    { nom:'Sèche-serviettes',         icone:'🌡️', cat:'chauffage' },
    { nom:'Chaudière',                icone:'🔥', cat:'chauffage' },
    { nom:'Thermostat',               icone:'🌡️', cat:'chauffage' },
    { nom:'Insert / Cheminée',        icone:'🔥', cat:'chauffage' },
    { nom:'Plancher chauffant',       icone:'🌡️', cat:'chauffage' },
  ],
  'Structure': [
    { nom:'Mur / Cloison',            icone:'🧱', cat:'structure' },
    { nom:'Plafond',                  icone:'⬆️', cat:'structure' },
    { nom:'Sol / Parquet',            icone:'🟫', cat:'structure' },
    { nom:'Carrelage',                icone:'🟫', cat:'structure' },
    { nom:'Escalier',                 icone:'🪜', cat:'structure' },
    { nom:'Garde-corps',              icone:'🚧', cat:'structure' },
    { nom:'Toiture / Ardoises',       icone:'🏠', cat:'structure' },
    { nom:'Gouttière',                icone:'💧', cat:'structure' },
    { nom:'Façade',                   icone:'🏠', cat:'structure' },
  ],
  'Équipements': [
    { nom:'Four / Cuisinière',        icone:'🔥', cat:'electricite' },
    { nom:'Hotte aspirante',          icone:'💨', cat:'electricite' },
    { nom:'Réfrigérateur',            icone:'🧊', cat:'electricite' },
    { nom:'Placard / Rangement',      icone:'🗄️', cat:'menuiserie' },
    { nom:'Boîte aux lettres',        icone:'📬', cat:'menuiserie' },
  ],
}

const CAT_COLORS = {
  electricite:'#EBF2FC', plomberie:'#E8F8F5', chauffage:'#FDF3E7',
  menuiserie:'#F3ECFC', structure:'#F7F5F0', autre:'#F0EDE6',
}
const PIECE_COLORS = ['#E8F2EB','#EBF2FC','#FDF3E7','#F3ECFC','#FDEAEA','#F0EDE6','#FDF6E3','#E8F8F5']

export default function PlanBien() {
  const { id: bienId } = useParams()
  const { session }    = useAuth()
  const navigate       = useNavigate()

  const [bien, setBien]           = useState(null)
  const [plan, setPlan]           = useState([])
  const [equips, setEquips]       = useState([])
  const [etage, setEtage]         = useState(0)
  const [etages, setEtages]       = useState(ETAGES_BASE)
  const [loading, setLoading]     = useState(true)
  const [selPiece, setSelPiece]   = useState(null)
  const [selEquip, setSelEquip]   = useState(null)
  const [dragging, setDragging]   = useState(null)
  const [draggingEq, setDraggingEq] = useState(null)
  const [tab, setTab]             = useState('pieces')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [customNom, setCustomNom] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [customEquip, setCustomEquip] = useState('')
  const [equipSearch, setEquipSearch] = useState('')

  // ⚠️ REF pour accès synchrone dans les event listeners (fix resize)
  const planRef  = useRef([])
  const equipsRef = useRef([])
  planRef.current  = plan
  equipsRef.current = equips

  const svgRef = useRef(null)

  const load = useCallback(async () => {
    if (!session || !bienId) return
    setLoading(true)
    const [bRes, pRes, eRes] = await Promise.all([
      supabase.from('biens').select('*').eq('id', bienId).single(),
      supabase.from('plan_pieces').select('*').eq('bien_id', bienId).eq('etage', etage),
      supabase.from('plan_equipements').select('*').eq('bien_id', bienId).eq('etage', etage),
    ])
    if (bRes.error) { setLoading(false); return }
    setBien(bRes.data)
    setPlan(pRes.data || [])
    setEquips(eRes.data || [])
    setLoading(false)
  }, [session, bienId, etage])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── Pièces ───────────────────────────────────────────────
  async function addPiece(tpl) {
    if (tpl.custom) { setAddingCustom(true); return }
    let x = 0, y = 0
    outer: for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        if (col + tpl.w > GRID_W || row + tpl.h > GRID_H) continue
        const ok = !planRef.current.some(p =>
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
    if (!customNom.trim()) return
    const { data } = await supabase.from('plan_pieces').insert({
      bien_id: bienId, etage, nom: customNom.trim(), icone: '✏️',
      couleur: '#F7F5F0', x: 0, y: 0, w: 3, h: 3
    }).select().single()
    if (data) setPlan(p => [...p, data])
    setCustomNom(''); setAddingCustom(false)
  }

  async function deletePiece(id) {
    if (!window.confirm('Supprimer cette pièce ?')) return
    await supabase.from('plan_pieces').delete().eq('id', id)
    setPlan(p => p.filter(x => x.id !== id))
    if (selPiece === id) setSelPiece(null)
  }

  // ── Équipements ──────────────────────────────────────────
  async function addEquip(eqTpl, pieceId) {
    const piece = planRef.current.find(p => p.id === pieceId)
    const { data } = await supabase.from('plan_equipements').insert({
      bien_id: bienId, plan_piece_id: pieceId || null, etage,
      nom: eqTpl.nom, icone: eqTpl.icone, categorie: eqTpl.cat,
      couleur: CAT_COLORS[eqTpl.cat] || '#F7F5F0',
      grid_x: piece ? piece.x * CELL + Math.floor(piece.w * CELL / 2) - 12 : 20,
      grid_y: piece ? piece.y * CELL + Math.floor(piece.h * CELL / 2) - 12 : 20,
    }).select().single()
    if (data) { setEquips(e => [...e, data]); setSelEquip(data.id) }
  }

  async function addCustomEquip(pieceId) {
    if (!customEquip.trim()) return
    await addEquip({ nom: customEquip.trim(), icone: '🔧', cat: 'autre' }, pieceId)
    setCustomEquip('')
  }

  async function deleteEquip(id) {
    await supabase.from('plan_equipements').delete().eq('id', id)
    setEquips(e => e.filter(x => x.id !== id))
    if (selEquip === id) setSelEquip(null)
  }

  // ── Drag pièces ──────────────────────────────────────────
  function getCell(e) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { col: 0, row: 0 }
    return {
      col: Math.max(0, Math.floor((e.clientX - rect.left) / CELL)),
      row: Math.max(0, Math.floor((e.clientY - rect.top) / CELL)),
    }
  }

  function onMouseDownPiece(e, piece) {
    e.stopPropagation()
    setSelPiece(piece.id); setSelEquip(null)
    const rect = svgRef.current?.getBoundingClientRect()
    setDragging({
      id: piece.id,
      offX: Math.floor((e.clientX - rect.left) / CELL) - piece.x,
      offY: Math.floor((e.clientY - rect.top) / CELL) - piece.y,
    })
  }

  function onMouseDownEquip(e, eq) {
    e.stopPropagation()
    setSelEquip(eq.id); setSelPiece(null)
    setDraggingEq({ id: eq.id, sx: e.clientX, sy: e.clientY, ox: eq.grid_x||0, oy: eq.grid_y||0 })
  }

  function onMouseMove(e) {
    if (dragging) {
      const { col, row } = getCell(e)
      const piece = planRef.current.find(p => p.id === dragging.id)
      if (!piece) return
      const nx = Math.max(0, Math.min(GRID_W - piece.w, col - dragging.offX))
      const ny = Math.max(0, Math.min(GRID_H - piece.h, row - dragging.offY))
      setPlan(p => p.map(x => x.id === dragging.id ? { ...x, x: nx, y: ny } : x))
    }
    if (draggingEq) {
      const dx = e.clientX - draggingEq.sx, dy = e.clientY - draggingEq.sy
      const nx = Math.max(0, Math.min(GRID_W * CELL - 24, draggingEq.ox + dx))
      const ny = Math.max(0, Math.min(GRID_H * CELL - 24, draggingEq.oy + dy))
      setEquips(eq => eq.map(x => x.id === draggingEq.id ? { ...x, grid_x: nx, grid_y: ny } : x))
    }
  }

  async function onMouseUp() {
    if (dragging) {
      const piece = planRef.current.find(p => p.id === dragging.id)
      if (piece) await supabase.from('plan_pieces').update({ x: piece.x, y: piece.y }).eq('id', piece.id)
      setDragging(null)
    }
    if (draggingEq) {
      const eq = equipsRef.current.find(e => e.id === draggingEq.id)
      if (eq) await supabase.from('plan_equipements').update({ grid_x: eq.grid_x, grid_y: eq.grid_y }).eq('id', eq.id)
      setDraggingEq(null)
    }
  }

  // ── Resize — utilise planRef pour éviter les closures stale ──
  function startResize(e, piece) {
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const startW = piece.w, startH = piece.h

    function onMove(ev) {
      const dw = Math.round((ev.clientX - startX) / CELL)
      const dh = Math.round((ev.clientY - startY) / CELL)
      // Utiliser les valeurs courantes via planRef
      const cur = planRef.current.find(x => x.id === piece.id)
      if (!cur) return
      const nw = Math.max(1, Math.min(GRID_W - cur.x, startW + dw))
      const nh = Math.max(1, Math.min(GRID_H - cur.y, startH + dh))
      setPlan(p => p.map(x => x.id === piece.id ? { ...x, w: nw, h: nh } : x))
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // Lire planRef pour avoir les valeurs finales
      const cur = planRef.current.find(x => x.id === piece.id)
      if (cur) await supabase.from('plan_pieces').update({ w: cur.w, h: cur.h }).eq('id', cur.id)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function addEtageCustom() {
    const nom = prompt('Nom du niveau (ex: Combles, Mezzanine…)')
    if (!nom) return
    const val = 100 + etages.length
    setEtages(e => [...e, { val, label: nom }])
    setEtage(val)
  }

  const selPieceData = plan.find(p => p.id === selPiece)
  const selEquipData = equips.find(e => e.id === selEquip)
  const etageLabel   = etages.find(e => e.val === etage)?.label || 'Niveau'

  const filteredCat = Object.entries(EQUIP_CATALOGUE).reduce((acc, [cat, items]) => {
    const f = items.filter(i => !equipSearch || i.nom.toLowerCase().includes(equipSearch.toLowerCase()))
    if (f.length) acc[cat] = f
    return acc
  }, {})

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button style={css.backBtn} onClick={() => navigate('/biens')}>← Retour</button>
          <div>
            <h1 style={css.h1}>Plan — {bien?.adresse}</h1>
            <p style={css.sub}>{plan.length} pièce(s) · {equips.length} équipement(s) · {etageLabel}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select style={css.sel} value={etage} onChange={e => { setEtage(Number(e.target.value)); setSelPiece(null); setSelEquip(null) }}>
            {etages.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
          </select>
          <button style={css.btnXs} onClick={addEtageCustom}>+ Niveau</button>
        </div>
      </div>

      {addingCustom && (
        <div style={css.customBox}>
          <span style={{ fontSize:13, color:'#2D5A3D', fontWeight:500 }}>Nom :</span>
          <input style={css.customInput} value={customNom} autoFocus
            placeholder="Ex: Véranda, Cellier…"
            onChange={e => setCustomNom(e.target.value)}
            onKeyDown={e => e.key==='Enter' && addCustomPiece()} />
          <button style={css.btnPrimary} onClick={addCustomPiece}>Ajouter</button>
          <button style={css.btnSec} onClick={() => setAddingCustom(false)}>✕</button>
        </div>
      )}

      <div style={css.workspace}>
        {/* PALETTE */}
        <div style={css.palette}>
          <div style={css.palTabs}>
            <button style={{ ...css.palTab, ...(tab==='pieces'?css.palTabActive:{}) }} onClick={() => setTab('pieces')} title="Pièces">🏠</button>
            <button style={{ ...css.palTab, ...(tab==='equips'?css.palTabActive:{}) }} onClick={() => setTab('equips')} title="Équipements">🔧</button>
          </div>

          {tab==='pieces' && (
            <>
              <div style={css.palTitle}>Pièces</div>
              {PIECE_TEMPLATES.map(tpl => (
                <div key={tpl.nom} style={css.palItem} onClick={() => addPiece(tpl)}>
                  <span style={{ fontSize:15 }}>{tpl.icone}</span>
                  <span style={{ fontSize:11.5 }}>{tpl.nom}</span>
                </div>
              ))}
            </>
          )}

          {tab==='equips' && (
            <>
              <div style={css.palTitle}>
                Équipements
                {selPieceData && <span style={{ color:'#2D5A3D', fontWeight:400 }}> → {selPieceData.nom}</span>}
              </div>
              <input style={css.searchInput} placeholder="Chercher…" value={equipSearch}
                onChange={e => setEquipSearch(e.target.value)} />
              <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                <input style={{ ...css.searchInput, flex:1, margin:0, fontSize:11 }} placeholder="Perso…"
                  value={customEquip} onChange={e => setCustomEquip(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && addCustomEquip(selPiece)} />
                <button style={{ ...css.btnXs, padding:'4px 7px', fontSize:14 }}
                  onClick={() => addCustomEquip(selPiece)}>+</button>
              </div>
              {!selPieceData && (
                <div style={{ fontSize:10, color:'#C8813A', marginBottom:6, lineHeight:1.4 }}>
                  💡 Sélectionnez une pièce avant d'ajouter un équipement
                </div>
              )}
              {Object.entries(filteredCat).map(([cat, items]) => (
                <div key={cat}>
                  <div style={css.catLabel}>{cat}</div>
                  {items.map(item => (
                    <div key={item.nom} style={css.equipItem}
                      onClick={() => addEquip(item, selPiece)}
                      title={`Ajouter dans ${selPieceData?.nom || 'le plan'}`}>
                      <span style={{ fontSize:13 }}>{item.icone}</span>
                      <span style={{ fontSize:11 }}>{item.nom}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        {/* SVG */}
        <div style={{ flex:1, overflow:'auto', background:'#F0EDE6', borderRadius:12, border:'1px solid rgba(0,0,0,0.08)' }}>
          <svg ref={svgRef}
            width={GRID_W*CELL} height={GRID_H*CELL}
            style={{ display:'block', cursor:(dragging||draggingEq)?'grabbing':'default', userSelect:'none', minWidth:GRID_W*CELL }}
            onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onClick={() => { setSelPiece(null); setSelEquip(null) }}>
            <defs>
              <pattern id="g" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#FAFAF8"/>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <text x={8} y={18} fontSize="11" fill="rgba(0,0,0,0.2)" fontFamily="sans-serif">{etageLabel}</text>

            {/* PIÈCES */}
            {plan.map(piece => {
              const px=piece.x*CELL, py=piece.y*CELL, pw=piece.w*CELL, ph=piece.h*CELL
              const isSel = selPiece === piece.id
              const peq = equips.filter(e => e.plan_piece_id === piece.id)
              return (
                <g key={piece.id}
                  style={{ cursor: dragging?.id===piece.id ? 'grabbing' : 'grab' }}
                  onMouseDown={e => onMouseDownPiece(e, piece)}
                  onDoubleClick={e => { e.stopPropagation(); setForm({ nom:piece.nom, icone:piece.icone, couleur:piece.couleur, w:piece.w, h:piece.h }); setModal('editPiece') }}>
                  <rect x={px+1} y={py+1} width={pw-2} height={ph-2} rx="6"
                    fill={piece.couleur||'#E8F2EB'}
                    stroke={isSel?'#2D5A3D':'rgba(0,0,0,0.18)'}
                    strokeWidth={isSel?2.5:1} opacity=".93"/>
                  <text x={px+pw/2} y={py+ph/2-(ph>80?14:4)} textAnchor="middle" dominantBaseline="middle"
                    fontSize={ph>80?20:13} style={{ pointerEvents:'none' }}>{piece.icone}</text>
                  {ph > 52 && (
                    <text x={px+pw/2} y={py+ph/2+(ph>80?12:8)} textAnchor="middle"
                      fontSize="11" fontWeight="500" fill="#1A1714" fontFamily="sans-serif"
                      style={{ pointerEvents:'none' }}>
                      {piece.nom}{peq.length > 0 ? ` (${peq.length})` : ''}
                    </text>
                  )}
                  {isSel && (
                    <>
                      {/* Bouton supprimer */}
                      <g onClick={e => { e.stopPropagation(); deletePiece(piece.id) }} style={{ cursor:'pointer' }}>
                        <circle cx={px+pw-9} cy={py+9} r="9" fill="#B83232" opacity=".85"/>
                        <text x={px+pw-9} y={py+9} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="white">✕</text>
                      </g>
                      {/* Poignée resize — onMouseDown sur document, pas dans SVG */}
                      <rect
                        x={px+pw-14} y={py+ph-14} width="12" height="12" rx="2"
                        fill="#2D5A3D" opacity=".75"
                        style={{ cursor:'se-resize' }}
                        onMouseDown={e => { e.stopPropagation(); startResize(e, piece) }}
                      />
                      <text x={px+pw-8} y={py+ph-8} textAnchor="middle" dominantBaseline="middle"
                        fontSize="8" fill="white" style={{ pointerEvents:'none' }}>↘</text>
                    </>
                  )}
                </g>
              )
            })}

            {/* ÉQUIPEMENTS */}
            {equips.map(eq => {
              const ex = eq.grid_x||20, ey = eq.grid_y||20
              const isSel = selEquip === eq.id
              return (
                <g key={eq.id}
                  style={{ cursor: draggingEq?.id===eq.id ? 'grabbing' : 'grab' }}
                  onMouseDown={e => onMouseDownEquip(e, eq)}
                  onDoubleClick={e => { e.stopPropagation(); setForm({ nom:eq.nom, icone:eq.icone, notes:eq.notes||'', piece_id:eq.plan_piece_id||'' }); setModal('editEquip') }}>
                  <circle cx={ex+12} cy={ey+12} r="13"
                    fill={CAT_COLORS[eq.categorie]||'#F7F5F0'}
                    stroke={isSel?'#2D5A3D':'rgba(0,0,0,0.2)'}
                    strokeWidth={isSel?2.5:1.5} opacity=".95"/>
                  <text x={ex+12} y={ey+12} textAnchor="middle" dominantBaseline="middle"
                    fontSize="13" style={{ pointerEvents:'none' }}>{eq.icone}</text>
                  {isSel && (
                    <>
                      <text x={ex+12} y={ey+30} textAnchor="middle" fontSize="9"
                        fill="#1A1714" fontFamily="sans-serif" style={{ pointerEvents:'none' }}>
                        {eq.nom.length>16 ? eq.nom.slice(0,16)+'…' : eq.nom}
                      </text>
                      <g onClick={e => { e.stopPropagation(); deleteEquip(eq.id) }} style={{ cursor:'pointer' }}>
                        <circle cx={ex+22} cy={ey+2} r="7" fill="#B83232" opacity=".85"/>
                        <text x={ex+22} y={ey+2} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="white">✕</text>
                      </g>
                    </>
                  )}
                </g>
              )
            })}

            {plan.length===0 && equips.length===0 && (
              <text x={GRID_W*CELL/2} y={GRID_H*CELL/2} textAnchor="middle"
                fontSize="14" fill="rgba(0,0,0,0.2)" fontFamily="sans-serif">
                ← Cliquez sur une pièce pour commencer
              </text>
            )}
          </svg>
        </div>

        {/* PANNEAU DROIT */}
        <div style={css.detail}>
          {selPieceData && (
            <>
              <div style={css.palTitle}>Pièce</div>
              <div style={{ fontSize:26, margin:'4px 0' }}>{selPieceData.icone}</div>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{selPieceData.nom}</div>
              <div style={{ fontSize:11, color:'#6B6560', marginBottom:8 }}>{selPieceData.w}×{selPieceData.h}</div>
              <button style={css.btnEdit} onClick={() => { setForm({ nom:selPieceData.nom, icone:selPieceData.icone, couleur:selPieceData.couleur, w:selPieceData.w, h:selPieceData.h }); setModal('editPiece') }}>✏️ Modifier</button>
              <button style={css.btnDel} onClick={() => deletePiece(selPieceData.id)}>🗑️ Supprimer</button>
              {equips.filter(e=>e.plan_piece_id===selPieceData.id).length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={css.palTitle}>Équipements ({equips.filter(e=>e.plan_piece_id===selPieceData.id).length})</div>
                  {equips.filter(e=>e.plan_piece_id===selPieceData.id).map(eq => (
                    <div key={eq.id} style={{ display:'flex', gap:5, padding:'4px 4px', borderRadius:5, cursor:'pointer',
                      background: selEquip===eq.id?'#E8F2EB':'transparent', marginBottom:2 }}
                      onClick={() => { setSelEquip(eq.id); setSelPiece(null) }}>
                      <span style={{ fontSize:12 }}>{eq.icone}</span>
                      <span style={{ fontSize:11 }}>{eq.nom}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {selEquipData && (
            <>
              <div style={css.palTitle}>Équipement</div>
              <div style={{ fontSize:26, margin:'4px 0' }}>{selEquipData.icone}</div>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{selEquipData.nom}</div>
              <div style={{ fontSize:11, color:'#6B6560', marginBottom:4 }}>{selEquipData.categorie}</div>
              {selEquipData.plan_piece_id && (
                <div style={{ fontSize:11, color:'#6B6560', marginBottom:6 }}>
                  📍 {plan.find(p=>p.id===selEquipData.plan_piece_id)?.nom}
                </div>
              )}
              {selEquipData.notes && <div style={{ fontSize:11, color:'#6B6560', marginBottom:8, lineHeight:1.4 }}>{selEquipData.notes}</div>}
              <button style={css.btnEdit} onClick={() => { setForm({ nom:selEquipData.nom, icone:selEquipData.icone, notes:selEquipData.notes||'', piece_id:selEquipData.plan_piece_id||'' }); setModal('editEquip') }}>✏️ Modifier</button>
              <button style={css.btnDel} onClick={() => deleteEquip(selEquipData.id)}>🗑️ Supprimer</button>
            </>
          )}

          {!selPieceData && !selEquipData && (
            <>
              <div style={css.palTitle}>Aide</div>
              <div style={{ fontSize:10.5, color:'#9E9890', lineHeight:1.9 }}>
                🏠 onglet = pièces<br/>
                🔧 onglet = équipements<br/>
                • Glisser pour déplacer<br/>
                • ↘ pour redimensionner<br/>
                • Double-clic pour éditer<br/>
                • ✕ rouge pour supprimer
              </div>
              {plan.length > 0 && (
                <>
                  <div style={{ ...css.palTitle, marginTop:10 }}>Légende</div>
                  {plan.map(p => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 4px',
                      borderRadius:5, cursor:'pointer', background: selPiece===p.id?'#E8F2EB':'transparent', marginBottom:2 }}
                      onClick={() => setSelPiece(p.id)}>
                      <div style={{ width:10, height:10, borderRadius:2, background:p.couleur, border:'1px solid rgba(0,0,0,0.1)', flexShrink:0 }}/>
                      <span style={{ fontSize:10.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.icone} {p.nom}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODALS */}
      {(modal==='editPiece'||modal==='editEquip') && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modBox}>
            <div style={css.modH}>
              <span style={{ fontFamily:'Georgia,serif', fontSize:16 }}>
                {modal==='editPiece' ? 'Modifier la pièce' : "Modifier l'équipement"}
              </span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:11 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 60px', gap:10 }}>
                <Fld label="Nom" val={form.nom||''} set={v=>set('nom',v)} />
                <Fld label="Icône" val={form.icone||''} set={v=>set('icone',v)} />
              </div>
              {modal==='editPiece' && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <Fld label="Largeur (cellules)" val={form.w||''} set={v=>set('w',v)} type="number" />
                    <Fld label="Hauteur (cellules)" val={form.h||''} set={v=>set('h',v)} type="number" />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={css.lbl}>Couleur</label>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {PIECE_COLORS.map(c => (
                        <div key={c} onClick={()=>set('couleur',c)}
                          style={{ width:24, height:24, borderRadius:5, background:c, cursor:'pointer',
                            border:`2.5px solid ${form.couleur===c?'#2D5A3D':'rgba(0,0,0,0.12)'}` }}/>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {modal==='editEquip' && (
                <>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <label style={css.lbl}>Pièce associée</label>
                    <select style={css.inp} value={form.piece_id||''} onChange={e=>set('piece_id',e.target.value)}>
                      <option value="">— Libre (non associé) —</option>
                      {plan.map(p => <option key={p.id} value={p.id}>{p.icone} {p.nom}</option>)}
                    </select>
                  </div>
                  <Fld label="Notes" val={form.notes||''} set={v=>set('notes',v)} multiline />
                </>
              )}
              <button style={css.btnPrimary} onClick={async () => {
                if (modal==='editPiece' && selPieceData) {
                  const u = { nom:form.nom, icone:form.icone, couleur:form.couleur, w:Number(form.w)||selPieceData.w, h:Number(form.h)||selPieceData.h }
                  setPlan(p => p.map(x => x.id===selPieceData.id ? {...x,...u} : x))
                  await supabase.from('plan_pieces').update(u).eq('id', selPieceData.id)
                } else if (modal==='editEquip' && selEquipData) {
                  const u = { nom:form.nom, icone:form.icone, notes:form.notes||null, plan_piece_id:form.piece_id||null }
                  setEquips(e => e.map(x => x.id===selEquipData.id ? {...x,...u} : x))
                  await supabase.from('plan_equipements').update(u).eq('id', selEquipData.id)
                }
                setModal(null)
              }}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Fld({ label, val, set, type='text', multiline }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={css.lbl}>{label}</label>
      {multiline
        ? <textarea style={{ ...css.inp, minHeight:56, resize:'vertical' }} value={val} onChange={e=>set(e.target.value)} />
        : <input style={css.inp} type={type} value={val} onChange={e=>set(e.target.value)} />
      }
    </div>
  )
}

const css = {
  center:      { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:     { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:16, flexWrap:'wrap' },
  h1:          { fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, color:'#1A1714', margin:0 },
  sub:         { fontSize:12, color:'#6B6560', margin:'3px 0 0' },
  backBtn:     { padding:'6px 14px', background:'#fff', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:13 },
  sel:         { padding:'7px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, background:'#fff', outline:'none' },
  btnXs:       { padding:'5px 11px', background:'#fff', color:'#2D5A3D', border:'1px solid #2D5A3D', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
  customBox:   { display:'flex', gap:8, marginBottom:10, alignItems:'center', padding:'9px 13px', background:'#E8F2EB', borderRadius:8 },
  customInput: { flex:1, padding:'7px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13, outline:'none' },
  workspace:   { display:'flex', gap:10, height:'calc(100vh - 185px)', minHeight:450 },
  palette:     { width:162, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'8px', overflowY:'auto', flexShrink:0, display:'flex', flexDirection:'column', gap:2 },
  palTabs:     { display:'flex', gap:4, marginBottom:8 },
  palTab:      { flex:1, padding:'6px', border:'1px solid rgba(0,0,0,0.10)', borderRadius:7, background:'#F7F5F0', cursor:'pointer', fontSize:16, textAlign:'center' },
  palTabActive:{ background:'#E8F2EB', borderColor:'#2D5A3D' },
  palTitle:    { fontSize:9.5, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, marginTop:6 },
  palItem:     { display:'flex', alignItems:'center', gap:7, padding:'5px 7px', borderRadius:7, cursor:'pointer', border:'1px solid rgba(0,0,0,0.06)', background:'#FAFAF8', fontSize:12 },
  catLabel:    { fontSize:9, fontWeight:700, color:'#C8813A', textTransform:'uppercase', letterSpacing:'.06em', marginTop:6, marginBottom:2, paddingLeft:2 },
  equipItem:   { display:'flex', alignItems:'center', gap:6, padding:'4px 6px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(0,0,0,0.05)', background:'#FAFAF8', marginBottom:2 },
  searchInput: { width:'100%', padding:'6px 9px', border:'1px solid rgba(0,0,0,0.14)', borderRadius:7, fontFamily:'inherit', fontSize:12, outline:'none', boxSizing:'border-box', marginBottom:6 },
  detail:      { width:162, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'12px', overflowY:'auto', flexShrink:0, display:'flex', flexDirection:'column' },
  btnEdit:     { width:'100%', padding:'7px', background:'#E8F2EB', color:'#2D5A3D', border:'none', borderRadius:7, fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer', marginBottom:5 },
  btnDel:      { width:'100%', padding:'7px', background:'#FDEAEA', color:'#B83232', border:'none', borderRadius:7, fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer' },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modBox:      { background:'#fff', borderRadius:12, width:'100%', maxWidth:380, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', overflow:'hidden' },
  modH:        { padding:'14px 20px 10px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  closeBtn:    { width:26, height:26, border:'1px solid rgba(0,0,0,0.12)', borderRadius:5, background:'none', cursor:'pointer', fontSize:13 },
  lbl:         { fontSize:10, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  inp:         { padding:'8px 10px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' },
  btnPrimary:  { padding:'9px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSec:      { padding:'7px 13px', background:'#fff', color:'#6B6560', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
}
