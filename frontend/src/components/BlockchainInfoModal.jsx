import { useState, useEffect, useCallback } from 'react';
import { Copy, ExternalLink, Info, Clock, Hash, Check } from 'lucide-react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { getEntityTransactions } from '../api/endpoints';

const TAG_COLORS = {
  ORGANIZZAZIONE_DATA: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  STRUTTURE_LISTE_DATA: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  ASSISTITI_DATA: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  PRIVATE_KEY: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ASSISTITI_IN_LISTA: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  MOVIMENTI_ASSISTITI_LISTA: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

function TagBadge({ tag }) {
  const colorClass = TAG_COLORS[tag] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  return (
    <span className={`px-2 py-0.5 text-xs font-mono rounded-md border ${colorClass}`}>
      {tag}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
      title="Copia"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function DetailRow({ label, value, copyable = false, truncate = false }) {
  if (value === undefined || value === null) return null;
  const display = truncate && typeof value === 'string' && value.length > 30
    ? value.slice(0, 12) + '...' + value.slice(-8)
    : String(value);
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-slate-400 text-sm min-w-[120px] shrink-0">{label}</span>
      <span className="text-white text-sm font-mono break-all">{display}</span>
      {copyable && <CopyButton text={String(value)} />}
    </div>
  );
}

function formatDigest(digest) {
  if (!digest || digest.length < 14) return digest || '-';
  return digest.slice(0, 8) + '...' + digest.slice(-6);
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(typeof ts === 'number' ? ts : ts);
    return d.toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return String(ts);
  }
}

function EntityDetails({ entityType, entityData }) {
  if (!entityData) return null;

  const d = entityData;

  const sections = {
    ORGANIZZAZIONE: (
      <>
        <DetailRow label="Denominazione" value={d.denominazione} />
        <DetailRow label="ID" value={d.id} />
        <DetailRow label="Versione BC" value={d.blockchainVersion} />
        <DetailRow label="Chiave Pubblica" value={d.publicKey} truncate copyable />
      </>
    ),
    STRUTTURA: (
      <>
        <DetailRow label="Denominazione" value={d.denominazione} />
        <DetailRow label="ID" value={d.id} />
        <DetailRow label="Indirizzo" value={d.indirizzo} />
        <DetailRow label="Attiva" value={d.attiva ? 'Si' : 'No'} />
        <DetailRow label="Versione BC" value={d.blockchainVersion} />
      </>
    ),
    ASSISTITO: (
      <>
        <DetailRow label="Nome Cognome" value={[d.nome, d.cognome].filter(Boolean).join(' ')} />
        <DetailRow label="Codice Fiscale" value={d.codiceFiscale} copyable />
        <DetailRow label="AnonId" value={d.anonId} truncate copyable />
        <DetailRow label="Email" value={d.email} />
        <DetailRow label="Telefono" value={d.telefono} />
        <DetailRow label="Versione BC" value={d.blockchainVersion} />
      </>
    ),
    ASSISTITO_LISTA: (
      <>
        <DetailRow label="Stato" value={d.statoLabel || d.stato} />
        <DetailRow label="Data Ingresso" value={formatTimestamp(d.dataIngresso || d.createdAt)} />
        <DetailRow label="Data Uscita" value={formatTimestamp(d.dataUscita)} />
      </>
    ),
  };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} className="text-cyan-400" />
        <span className="text-sm font-semibold text-cyan-400">Dettagli Entita</span>
      </div>
      <div className="divide-y divide-white/5">
        {sections[entityType] || <p className="text-slate-400 text-sm">Tipo non supportato</p>}
      </div>
    </div>
  );
}

function TransactionCard({ tx }) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-3 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <TagBadge tag={tx.tag} />
        {tx.version !== undefined && tx.version !== null && (
          <span className="text-xs text-slate-400 font-mono">v{tx.version}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Hash size={13} className="text-slate-500 shrink-0" />
          <span className="text-xs font-mono text-slate-300">{formatDigest(tx.digest)}</span>
          {tx.digest && <CopyButton text={tx.digest} />}
        </div>

        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400">{formatTimestamp(tx.timestamp)}</span>
        </div>

        {tx.explorerUrl && (
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Explorer <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function BlockchainInfoModal({ entityType, entityId, entityData, open, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !entityType || !entityId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setTransactions([]);

    getEntityTransactions(entityType, entityId)
      .then((data) => {
        if (cancelled) return;
        setTransactions(Array.isArray(data) ? data : data?.transactions || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Errore nel recupero delle transazioni');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, entityType, entityId]);

  const title = entityType === 'ORGANIZZAZIONE' ? 'Info Organizzazione'
    : entityType === 'STRUTTURA' ? 'Info Struttura'
    : entityType === 'ASSISTITO' ? 'Info Assistito'
    : entityType === 'ASSISTITO_LISTA' ? 'Info Assistito in Lista'
    : 'Info Blockchain';

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <EntityDetails entityType={entityType} entityData={entityData} />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Hash size={16} className="text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-400">
            Activity Log {!loading && `(${transactions.length} transazion${transactions.length === 1 ? 'e' : 'i'})`}
          </span>
        </div>

        {loading && (
          <div className="py-8">
            <LoadingSpinner size={28} />
            <p className="text-center text-slate-400 text-sm mt-3">Caricamento transazioni...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">Nessuna transazione trovata sulla blockchain</p>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {transactions.map((tx, i) => (
              <TransactionCard key={tx.digest || i} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
