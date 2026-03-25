import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ForceGraph2D from 'react-force-graph-2d';
import {
  Network, ZoomIn, ZoomOut, Maximize, Copy, Check,
  Building2, Hospital, List, Users, AlertCircle, Loader2, Info
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { getGraphData } from '../api/endpoints';
import { truncateKey, formatDateTime } from '../utils/formatters';
import BlockchainInfoModal from '../components/BlockchainInfoModal';

const NODE_TYPES = {
  organizzazione: {
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.6)',
    size: 12,
    label: 'Organizzazione',
    icon: Building2,
  },
  struttura: {
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    size: 9,
    label: 'Struttura',
    icon: Hospital,
  },
  lista: {
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.6)',
    size: 6,
    label: 'Lista',
    icon: List,
  },
  assistito: {
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    size: 3,
    label: 'Assistito',
    icon: Users,
  },
  trattati: {
    color: '#64748b',
    glowColor: 'rgba(100, 116, 139, 0.4)',
    size: 5,
    label: 'Trattati',
    icon: Users,
  },
};

function buildGraphData(data) {
  const nodes = [];
  const links = [];
  const nodeIds = new Set();

  if (!data) return { nodes, links };

  const { organizzazioni, strutture, assistitiListe } = data;

  // Add organizzazioni nodes
  if (organizzazioni) {
    for (const org of organizzazioni) {
      const id = `org-${org.id}`;
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        nodes.push({
          id,
          type: 'organizzazione',
          label: org.denominazione,
          data: org,
        });
      }
    }
  }

  // Add strutture + liste nodes and links
  if (strutture) {
    for (const str of strutture) {
      if (!str || !str.id) continue;
      const strId = `str-${str.id}`;
      const orgRef = str.organizzazione;
      const orgId = orgRef ? `org-${typeof orgRef === 'object' ? orgRef.id : orgRef}` : null;

      if (!nodeIds.has(strId)) {
        nodeIds.add(strId);
        nodes.push({
          id: strId,
          type: 'struttura',
          label: str.denominazione,
          data: str,
        });
      }

      // Link struttura -> organizzazione
      if (orgId && nodeIds.has(orgId)) {
        links.push({ source: orgId, target: strId });
      }

      // Add liste
      if (str.liste) {
        for (const lista of str.liste) {
          if (!lista || !lista.id) continue;
          const listaId = `lista-${lista.id}`;
          if (!nodeIds.has(listaId)) {
            nodeIds.add(listaId);
            nodes.push({
              id: listaId,
              type: 'lista',
              label: lista.denominazione,
              data: lista,
            });
          }
          links.push({ source: strId, target: listaId });
        }
      }
    }
  }

  // Add assistiti from assistitiListe links
  if (assistitiListe) {
    const assistitoListeMap = new Map();
    // Conta trattati per lista (usciti con stato != 1)
    const trattatiPerLista = new Map(); // listaId -> count

    for (const al of assistitiListe) {
      const assistito = al.assistito;
      const lista = al.lista;
      if (!assistito || !lista) continue;

      const assId = typeof assistito === 'object' ? assistito.id : assistito;
      const listaId = typeof lista === 'object' ? lista.id : lista;
      const listaNome = typeof lista === 'object' ? lista.denominazione : `Lista #${listaId}`;
      const nodeAssId = `ass-${assId}`;
      const nodeListaId = `lista-${listaId}`;
      const isInCoda = al.stato === 1 && !al.chiuso;

      if (!assistitoListeMap.has(assId)) assistitoListeMap.set(assId, []);
      assistitoListeMap.get(assId).push({
        listaId, listaNome, stato: al.stato, dataOraIngresso: al.dataOraIngresso
      });

      if (isInCoda) {
        // Assistito in coda -> collegato alla lista
        if (!nodeIds.has(nodeAssId) && typeof assistito === 'object') {
          nodeIds.add(nodeAssId);
          nodes.push({
            id: nodeAssId,
            type: 'assistito',
            label: assistito.cognome ? `${assistito.cognome} ${assistito.nome || ''}` : `#${assId}`,
            data: { ...assistito, listeAssegnate: assistitoListeMap.get(assId) },
          });
        }
        if (nodeIds.has(nodeListaId) && nodeIds.has(nodeAssId)) {
          links.push({ source: nodeListaId, target: nodeAssId });
        }
      } else {
        // Assistito uscito -> incrementa contatore trattati per questa lista
        trattatiPerLista.set(listaId, (trattatiPerLista.get(listaId) || 0) + 1);
      }
    }

    // Crea nodi "Trattati" per ogni lista che ha pazienti usciti
    for (const [listaId, count] of trattatiPerLista) {
      const trattatiNodeId = `trattati-${listaId}`;
      const nodeListaId = `lista-${listaId}`;
      // Trova il nome della lista
      const listaNode = nodes.find(n => n.id === nodeListaId);
      const listaNome = listaNode?.label || `Lista #${listaId}`;

      if (!nodeIds.has(trattatiNodeId)) {
        nodeIds.add(trattatiNodeId);
        nodes.push({
          id: trattatiNodeId,
          type: 'trattati',
          label: `${listaNome} (${count} trattati)`,
          data: { count, listaNome, listaId },
        });
      }
      if (nodeIds.has(nodeListaId)) {
        links.push({ source: nodeListaId, target: trattatiNodeId });
      }
    }

    // Aggiorna listeAssegnate sui nodi assistiti
    for (const node of nodes) {
      if (node.type === 'assistito' && assistitoListeMap.has(node.data?.id)) {
        node.data.listeAssegnate = assistitoListeMap.get(node.data.id);
      }
    }
  }

  // Add remaining assistiti that are not linked
  if (data.assistiti) {
    for (const ass of data.assistiti) {
      const nodeAssId = `ass-${ass.id}`;
      if (!nodeIds.has(nodeAssId)) {
        nodeIds.add(nodeAssId);
        nodes.push({
          id: nodeAssId,
          type: 'assistito',
          label: ass.cognome
            ? `${ass.cognome} ${ass.nome || ''}`
            : `Assistito #${ass.id}`,
          data: ass,
        });
      }
    }
  }

  return { nodes, links };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  if (!text) return null;

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-white/10 transition-colors"
      title="Copia"
    >
      {copied ? <Check size={12} className="text-neon-emerald" /> : <Copy size={12} className="text-slate-400" />}
    </button>
  );
}

function HoverPanel({ node, position, onInfoClick }) {
  if (!node) return null;

  const typeInfo = NODE_TYPES[node.type];
  const d = node.data || {};
  const Icon = typeInfo.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.2 }}
        className="fixed z-[100] pointer-events-none"
        style={{
          left: Math.min(position.x + 16, window.innerWidth - 340),
          top: Math.min(position.y - 10, window.innerHeight - 300),
        }}
      >
        <div
          className="w-[320px] rounded-2xl p-4 border border-white/10 text-sm"
          style={{
            background: 'rgba(10, 10, 26, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: `0 0 30px ${typeInfo.glowColor}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${typeInfo.color}20` }}
            >
              <Icon size={16} style={{ color: typeInfo.color }} />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider" style={{ color: typeInfo.color }}>
                  {typeInfo.label}
                </p>
                <p className="text-white font-semibold truncate max-w-[240px]">
                  {node.label}
                </p>
              </div>
              {node.type !== 'trattati' && (
                <span className="pointer-events-auto flex-shrink-0">
                  <button
                    onClick={() => onInfoClick && onInfoClick(node)}
                    className="text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    <Info size={14} />
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Common fields */}
          <div className="space-y-1.5">
            <InfoRow label="ID" value={`#${d.id || '-'}`} />

            {d.publicKey && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Chiave Pubblica</span>
                <span className="flex items-center gap-1 font-mono text-xs text-slate-300">
                  {truncateKey(d.publicKey, 20)}
                  <span className="pointer-events-auto">
                    <CopyButton text={d.publicKey} />
                  </span>
                </span>
              </div>
            )}

            <InfoRow
              label="Blockchain"
              value={
                d.ultimaVersioneSuBlockchain >= 0
                  ? <span className="text-neon-emerald text-xs">v{d.ultimaVersioneSuBlockchain} (in sync)</span>
                  : <span className="text-neon-cyan text-xs">In pubblicazione...</span>
              }
            />

            {d.createdAt && (
              <InfoRow label="Creato il" value={formatDateTime(d.createdAt)} />
            )}

            {/* Type-specific fields */}
            {node.type === 'assistito' && (
              <>
                {d.codiceFiscale && <InfoRow label="Codice Fiscale" value={d.codiceFiscale} mono />}
                {d.email && <InfoRow label="Email" value={d.email} />}
                {d.listeAssegnate && d.listeAssegnate.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Liste assegnate</p>
                    {d.listeAssegnate.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="text-slate-300">{l.listaNome}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          l.stato === 1 ? 'bg-neon-cyan/20 text-neon-cyan' :
                          l.stato === 2 ? 'bg-amber-500/20 text-amber-500' :
                          l.stato === 3 ? 'bg-neon-emerald/20 text-neon-emerald' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {l.stato === 1 ? 'In coda' : l.stato === 2 ? 'In assistenza' : l.stato === 3 ? 'Completato' : `Stato ${l.stato}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {node.type === 'struttura' && (
              <>
                {d.indirizzo && <InfoRow label="Indirizzo" value={d.indirizzo} />}
                <InfoRow
                  label="Stato"
                  value={
                    d.attiva !== undefined
                      ? (d.attiva
                        ? <span className="text-neon-emerald text-xs">Attiva</span>
                        : <span className="text-red-400 text-xs">Non attiva</span>)
                      : '-'
                  }
                />
              </>
            )}

            {node.type === 'lista' && (
              <InfoRow
                label="Stato"
                value={
                  d.aperta !== undefined
                    ? (d.aperta
                      ? <span className="text-neon-emerald text-xs">Aperta</span>
                      : <span className="text-red-400 text-xs">Chiusa</span>)
                    : '-'
                }
              />
            )}

            {node.type === 'trattati' && (
              <>
                <InfoRow label="Pazienti trattati" value={<span className="text-slate-200 font-bold">{d.count}</span>} />
                <InfoRow label="Lista di origine" value={d.listaNome} />
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-slate-300 text-xs ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Legend() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="absolute top-4 left-4 z-10 rounded-2xl p-4 border border-white/10"
      style={{
        background: 'rgba(10, 10, 26, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Legenda</p>
      <div className="space-y-2">
        {Object.entries(NODE_TYPES).map(([key, info]) => {
          const Icon = info.icon;
          return (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: info.color,
                  boxShadow: `0 0 8px ${info.glowColor}`,
                }}
              />
              <Icon size={14} style={{ color: info.color }} />
              <span className="text-xs text-slate-300">{info.label}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function StatsBar({ graphData }) {
  const counts = useMemo(() => {
    if (!graphData?.nodes) return { organizzazione: 0, struttura: 0, lista: 0, assistito: 0 };
    const c = { organizzazione: 0, struttura: 0, lista: 0, assistito: 0 };
    for (const n of graphData.nodes) {
      if (c[n.type] !== undefined) c[n.type]++;
    }
    return c;
  }, [graphData]);

  const stats = [
    { label: 'Organizzazioni', count: counts.organizzazione, color: NODE_TYPES.organizzazione.color },
    { label: 'Strutture', count: counts.struttura, color: NODE_TYPES.struttura.color },
    { label: 'Liste', count: counts.lista, color: NODE_TYPES.lista.color },
    { label: 'Assistiti', count: counts.assistito, color: NODE_TYPES.assistito.color },
    { label: 'Connessioni', count: graphData?.links?.length || 0, color: '#64748b' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-2xl px-6 py-3 border border-white/10 flex items-center gap-6"
      style={{
        background: 'rgba(10, 10, 26, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</span>
          <span className="text-xs text-slate-400">{s.label}</span>
        </div>
      ))}
    </motion.div>
  );
}

function ZoomControls({ graphRef }) {
  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.5, 400);
    }
  }, [graphRef]);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.5, 400);
    }
  }, [graphRef]);

  const handleReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 60);
    }
  }, [graphRef]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="absolute top-4 right-4 z-10 flex flex-col gap-2"
    >
      {[
        { icon: ZoomIn, action: handleZoomIn, label: 'Zoom in' },
        { icon: ZoomOut, action: handleZoomOut, label: 'Zoom out' },
        { icon: Maximize, action: handleReset, label: 'Reset zoom' },
      ].map(({ icon: Icon, action, label }) => (
        <button
          key={label}
          onClick={action}
          title={label}
          className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          style={{
            background: 'rgba(10, 10, 26, 0.7)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Icon size={18} />
        </button>
      ))}
    </motion.div>
  );
}

export default function Grafo() {
  const { data, loading, error } = useApi(getGraphData);
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [infoModal, setInfoModal] = useState(null);

  const graphData = useMemo(() => buildGraphData(data), [data]);

  // Track container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Zoom to fit after initial load
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        graphRef.current.zoomToFit(600, 60);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node || null);
  }, []);

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const typeInfo = NODE_TYPES[node.type];
    if (!typeInfo) return;

    // Guard: skip render if coordinates are not yet computed
    if (!isFinite(node.x) || !isFinite(node.y)) return;

    const size = typeInfo.size;
    const isHovered = hoveredNode?.id === node.id;
    const scale = isHovered ? 1.4 : 1;
    const r = size * scale;

    // Glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
    const gradient = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 8);
    gradient.addColorStop(0, typeInfo.glowColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = typeInfo.color;
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(node.x - r * 0.25, node.y - r * 0.25, r * 0.4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    // Label when zoomed in enough or hovered
    if (globalScale > 1.5 || isHovered) {
      const label = node.label || '';
      const fontSize = Math.max(10 / globalScale, 2);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(label, node.x, node.y + r + 3);
    }
  }, [hoveredNode]);

  const linkCanvasObject = useCallback((link, ctx) => {
    const start = link.source;
    const end = link.target;
    if (!start || !end || typeof start.x !== 'number') return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 size={40} className="animate-spin text-neon-cyan mx-auto mb-4" />
          <p className="text-slate-400">Caricamento dati del grafo...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-slate-300 mb-2">Errore nel caricamento</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  if (!graphData.nodes.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Network size={48} className="text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 text-lg mb-2">Nessun dato</p>
          <p className="text-slate-500 text-sm">
            Aggiungi organizzazioni, strutture e assistiti per visualizzare il grafo.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full h-[calc(100vh-2rem)] rounded-2xl overflow-hidden border border-white/10"
      style={{
        background: 'radial-gradient(ellipse at center, #0f0f2e 0%, #0a0a1a 70%)',
      }}
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-5 py-2.5 rounded-2xl border border-white/10"
        style={{
          background: 'rgba(10, 10, 26, 0.7)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Network size={20} className="text-neon-purple" />
        <span className="text-sm font-semibold bg-gradient-to-r from-neon-purple to-neon-cyan bg-clip-text text-transparent">
          Grafo Entita
        </span>
      </motion.div>

      <Legend />
      <ZoomControls graphRef={graphRef} />
      <StatsBar graphData={graphData} />

      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node, color, ctx) => {
          const typeInfo = NODE_TYPES[node.type];
          const r = typeInfo ? typeInfo.size + 4 : 8;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkCanvasObject={linkCanvasObject}
        onNodeHover={handleNodeHover}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={200}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      <HoverPanel
        node={hoveredNode}
        position={mousePos}
        onInfoClick={(node) => {
          const mapping = {
            organizzazione: { entityType: 'ORGANIZZAZIONE', entityId: String(node.data?.id || node.id) },
            struttura: { entityType: 'STRUTTURA', entityId: (node.data?.organizzazione || '') + '_' + (node.data?.id || node.id) },
            lista: { entityType: 'STRUTTURA', entityId: (node.data?.organizzazione || '') + '_' + (node.data?.struttura || '') },
            assistito: { entityType: 'ASSISTITO', entityId: 'ASS#' + (node.data?.id || node.id) },
          };
          const m = mapping[node.type];
          if (m) setInfoModal({ ...m, entityData: node.data || {} });
        }}
      />

      <BlockchainInfoModal
        open={!!infoModal}
        onClose={() => setInfoModal(null)}
        entityType={infoModal?.entityType}
        entityId={infoModal?.entityId}
        entityData={infoModal?.entityData}
      />
    </motion.div>
  );
}
