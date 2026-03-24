import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug, Wallet, Database, Link2, ChevronDown, ChevronRight,
  ExternalLink, CheckCircle, AlertTriangle, XCircle, RefreshCw, Copy
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getDebugData } from '../api/endpoints';
import { truncateAddress } from '../utils/formatters';

function StatusBadge({ status }) {
  const config = {
    consistent: { color: 'bg-neon-emerald/10 text-neon-emerald', icon: CheckCircle, label: 'Consistente' },
    not_on_blockchain: { color: 'bg-amber-500/10 text-amber-500', icon: AlertTriangle, label: 'Non su blockchain' },
    missing_keys: { color: 'bg-red-500/10 text-red-400', icon: XCircle, label: 'Chiavi mancanti' },
    missing: { color: 'bg-red-500/10 text-red-400', icon: XCircle, label: 'Mancante' },
  };
  const c = config[status] || config.missing;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>
      <Icon size={12} /> {c.label}
    </span>
  );
}

function CollapsibleSection({ title, icon: Icon, iconColor = 'text-neon-cyan', count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-static rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/5 transition-colors"
      >
        <Icon size={20} className={iconColor} />
        <span className="font-semibold text-lg flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-1 rounded">{count}</span>
        )}
        {open ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/5 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function JsonBlock({ data, maxHeight = 300 }) {
  const [expanded, setExpanded] = useState(false);
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = text.length > 500;

  return (
    <div className="relative">
      <pre
        className={`text-xs font-mono text-slate-300 bg-black/30 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all ${
          !expanded && isLong ? 'max-h-[200px]' : ''
        }`}
        style={expanded ? {} : { maxHeight: `${maxHeight}px` }}
      >
        {text}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-neon-cyan hover:text-neon-cyan/70 transition-colors"
        >
          {expanded ? 'Comprimi' : 'Espandi tutto'}
        </button>
      )}
    </div>
  );
}

function TxCard({ tx }) {
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [showEncrypted, setShowEncrypted] = useState(false);

  return (
    <div className="glass-static rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-mono text-xs text-neon-cyan">{truncateAddress(tx.digest, 12)}</span>
        <span className="text-xs text-slate-500">{tx.timestampFormatted || '-'}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {tx.entityId && (
          <span className="text-slate-400">Entity: <span className="text-slate-200 font-mono">{tx.entityId}</span></span>
        )}
        {tx.version !== null && tx.version !== undefined && (
          <span className="text-slate-400">v{tx.version}</span>
        )}
      </div>

      {/* Decrypted payload */}
      {tx.decryptedPayload && (
        <div>
          <button
            onClick={() => setShowDecrypted(!showDecrypted)}
            className="flex items-center gap-1 text-xs text-neon-emerald hover:text-neon-emerald/70 transition-colors"
          >
            {showDecrypted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Dati decifrati
          </button>
          {showDecrypted && <JsonBlock data={tx.decryptedPayload} />}
        </div>
      )}

      {tx.decryptError && (
        <p className="text-xs text-red-400">Errore decrypt: {tx.decryptError}</p>
      )}

      {/* Encrypted payload */}
      <div>
        <button
          onClick={() => setShowEncrypted(!showEncrypted)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showEncrypted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Payload cifrato
        </button>
        {showEncrypted && <JsonBlock data={tx.encryptedPayload} maxHeight={150} />}
      </div>
    </div>
  );
}

function DataTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-slate-500 italic">Nessun record</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map(col => (
              <th key={col.key} className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="py-2 px-2 text-slate-300 font-mono">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Debug() {
  const { data, loading, error, reload } = useApi(getDebugData);
  const [copiedDigest, setCopiedDigest] = useState(null);

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedDigest(text);
    setTimeout(() => setCopiedDigest(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <XCircle size={40} className="text-red-400 mx-auto mb-4" />
        <p className="text-red-400 mb-4">Errore: {error}</p>
        <button onClick={reload} className="text-neon-cyan text-sm hover:underline">Riprova</button>
      </div>
    );
  }

  const wallet = data?.wallet;
  const txs = data?.blockchainTransactions || {};
  const db = data?.database || {};
  const crossRef = data?.crossReferences || {};
  const totalTxCount = Object.values(txs).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bug className="text-neon-cyan" size={32} />
            Debug
          </h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={reload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-sm text-slate-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={16} /> Ricarica
          </motion.button>
        </div>
        <p className="text-slate-400 mb-8">Visualizzazione completa dello stato del sistema: wallet, blockchain, database, cross-references</p>
      </motion.div>

      <div className="space-y-4">

        {/* 1. WALLET */}
        <CollapsibleSection title="Wallet" icon={Wallet} iconColor="text-neon-cyan" defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-static rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Stato</p>
              <p className={`text-sm font-bold ${wallet?.status === 'WALLET OK' ? 'text-neon-emerald' : 'text-amber-500'}`}>
                {wallet?.status || '-'}
              </p>
            </div>
            <div className="glass-static rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rete</p>
              <p className="text-sm font-mono text-slate-200">{wallet?.network || '-'}</p>
            </div>
            <div className="glass-static rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo</p>
              <p className="text-sm font-mono text-neon-cyan">{wallet?.balance || '0'}</p>
            </div>
            <div className="glass-static rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Mnemonic</p>
              <p className={`text-sm font-bold ${wallet?.hasMnemonic ? 'text-neon-emerald' : 'text-red-400'}`}>
                {wallet?.hasMnemonic ? 'Presente' : 'Assente'}
              </p>
            </div>
          </div>
          {wallet?.address && (
            <div className="mt-4 glass-static rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Indirizzo</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-slate-200 break-all flex-1">{wallet.address}</p>
                <button onClick={() => copyText(wallet.address)} className="shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors">
                  {copiedDigest === wallet.address ? <CheckCircle size={14} className="text-neon-emerald" /> : <Copy size={14} className="text-slate-400" />}
                </button>
                <a
                  href={`${wallet.explorerUrl || 'https://explorer.rebased.iota.org'}/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors"
                >
                  <ExternalLink size={14} className="text-neon-cyan" />
                </a>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* 2. BLOCKCHAIN TRANSACTIONS */}
        <CollapsibleSection title="Transazioni Blockchain" icon={Link2} iconColor="text-neon-purple" count={totalTxCount}>
          {data?.meta?.allTags?.map(tag => {
            const tagTxs = txs[tag];
            const isError = tagTxs && !Array.isArray(tagTxs);
            const count = Array.isArray(tagTxs) ? tagTxs.length : 0;

            return (
              <div key={tag} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-200">{tag}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    count > 0 ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-white/5 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </div>
                {isError && (
                  <p className="text-xs text-red-400 italic">Errore: {tagTxs.error}</p>
                )}
                {Array.isArray(tagTxs) && tagTxs.length === 0 && (
                  <p className="text-xs text-slate-600 italic ml-4">Nessuna transazione</p>
                )}
                {Array.isArray(tagTxs) && tagTxs.length > 0 && (
                  <div className="space-y-2 ml-2">
                    {tagTxs.map((tx, i) => (
                      <TxCard key={tx.digest || i} tx={tx} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CollapsibleSection>

        {/* 3. DATABASE LOCALE */}
        <CollapsibleSection
          title="Database Locale"
          icon={Database}
          iconColor="text-neon-emerald"
          count={
            (db.organizzazioni?.length || 0) +
            (db.strutture?.length || 0) +
            (db.liste?.length || 0) +
            (db.assistiti?.length || 0) +
            (db.assistitiListe?.length || 0)
          }
        >
          {/* Organizzazioni */}
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Organizzazioni ({db.organizzazioni?.length || 0})</h4>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'denominazione', label: 'Denominazione' },
              { key: 'hasPublicKey', label: 'PubKey', render: v => v ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" /> },
              { key: 'hasPrivateKey', label: 'PrivKey', render: v => v ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" /> },
              { key: 'ultimaVersioneSuBlockchain', label: 'Version BC' },
              { key: 'publicKeyTruncated', label: 'Public Key', render: v => <span className="text-xs">{v || '-'}</span> },
            ]}
            rows={db.organizzazioni || []}
          />

          {/* Strutture */}
          <h4 className="text-sm font-semibold text-slate-300 mb-2 mt-6">Strutture ({db.strutture?.length || 0})</h4>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'denominazione', label: 'Denominazione' },
              { key: 'organizzazione', label: 'Org', render: v => typeof v === 'object' ? v?.id : v },
              { key: 'attiva', label: 'Attiva', render: v => v ? 'Si' : 'No' },
              { key: 'hasPublicKey', label: 'PubKey', render: v => v ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" /> },
              { key: 'hasPrivateKey', label: 'PrivKey', render: v => v ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" /> },
              { key: 'ultimaVersioneSuBlockchain', label: 'Version BC' },
            ]}
            rows={db.strutture || []}
          />

          {/* Liste */}
          <h4 className="text-sm font-semibold text-slate-300 mb-2 mt-6">Liste ({db.liste?.length || 0})</h4>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'denominazione', label: 'Denominazione' },
              { key: 'struttura', label: 'Struttura', render: v => typeof v === 'object' ? v?.id : v },
              { key: 'aperta', label: 'Aperta', render: v => v ? 'Si' : 'No' },
              { key: 'ultimaVersioneSuBlockchain', label: 'Version BC' },
            ]}
            rows={db.liste || []}
          />

          {/* Assistiti */}
          <h4 className="text-sm font-semibold text-slate-300 mb-2 mt-6">Assistiti ({db.assistiti?.length || 0})</h4>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'cognome', label: 'Cognome' },
              { key: 'nome', label: 'Nome' },
              { key: 'codiceFiscale', label: 'CF' },
              { key: 'hasPublicKey', label: 'PubKey', render: v => v ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" /> },
              { key: 'hasPrivateKey', label: 'PrivKey', render: v => v ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" /> },
              { key: 'ultimaVersioneSuBlockchain', label: 'Version BC' },
            ]}
            rows={db.assistiti || []}
          />

          {/* AssistitiListe */}
          <h4 className="text-sm font-semibold text-slate-300 mb-2 mt-6">Assistiti in Liste ({db.assistitiListe?.length || 0})</h4>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'assistito', label: 'Assistito', render: v => typeof v === 'object' ? `${v?.cognome} ${v?.nome} (#${v?.id})` : v },
              { key: 'lista', label: 'Lista', render: v => typeof v === 'object' ? `${v?.denominazione} (#${v?.id})` : v },
              { key: 'stato', label: 'Stato' },
              { key: 'chiuso', label: 'Chiuso', render: v => v ? 'Si' : 'No' },
              { key: 'dataOraIngresso', label: 'Ingresso', render: v => v ? new Date(v).toLocaleString('it-IT') : '-' },
              { key: 'dataOraUscita', label: 'Uscita', render: v => v ? new Date(v).toLocaleString('it-IT') : '-' },
            ]}
            rows={db.assistitiListe || []}
          />

          {/* BlockchainData cache */}
          <h4 className="text-sm font-semibold text-slate-300 mb-2 mt-6">BlockchainData Cache ({db.blockchainData?.length || 0})</h4>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'tag', label: 'Tag' },
              { key: 'entityId', label: 'Entity' },
              { key: 'version', label: 'Version' },
              { key: 'digest', label: 'Digest', render: v => <span title={v}>{truncateAddress(v, 10)}</span> },
              { key: 'timestamp', label: 'Timestamp', render: v => v ? new Date(v).toLocaleString('it-IT') : '-' },
            ]}
            rows={db.blockchainData || []}
          />
        </CollapsibleSection>

        {/* 4. CROSS REFERENCES */}
        <CollapsibleSection title="Cross-References" icon={Link2} iconColor="text-amber-500">
          {/* Organizzazioni */}
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Organizzazioni</h4>
          {crossRef.organizzazioni?.length === 0 && <p className="text-xs text-slate-600 italic mb-4">Nessuna organizzazione</p>}
          <div className="space-y-3 mb-6">
            {crossRef.organizzazioni?.map(org => (
              <div key={org.id} className="glass-static rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="font-semibold text-sm text-slate-200">
                    #{org.id} - {org.denominazione}
                  </span>
                  <StatusBadge status={org.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">PubKey:</span>{' '}
                    {org.hasPublicKey ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">PrivKey locale:</span>{' '}
                    {org.hasPrivateKey ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">PrivKey on-chain:</span>{' '}
                    {org.privateKeyOnChain ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">BC version:</span>{' '}
                    <span className="text-slate-200">{org.ultimaVersioneSuBlockchain}</span>
                  </div>
                </div>
                {org.blockchainTxDigests?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500">TX ({org.blockchainTxCount}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {org.blockchainTxDigests.map(d => (
                        <span key={d} className="font-mono text-xs bg-neon-cyan/10 text-neon-cyan px-1.5 py-0.5 rounded" title={d}>
                          {truncateAddress(d, 6)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Strutture */}
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Strutture</h4>
          {crossRef.strutture?.length === 0 && <p className="text-xs text-slate-600 italic mb-4">Nessuna struttura</p>}
          <div className="space-y-3 mb-6">
            {crossRef.strutture?.map(str => (
              <div key={str.id} className="glass-static rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="font-semibold text-sm text-slate-200">
                    #{str.id} - {str.denominazione} <span className="text-slate-500 text-xs">(Org #{str.organizzazioneId}, entity: {str.entityId})</span>
                  </span>
                  <StatusBadge status={str.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">PubKey:</span>{' '}
                    {str.hasPublicKey ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">PrivKey on-chain:</span>{' '}
                    {str.privateKeyOnChain ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">Liste:</span>{' '}
                    <span className="text-slate-200">{str.listeCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">BC version:</span>{' '}
                    <span className="text-slate-200">{str.ultimaVersioneSuBlockchain}</span>
                  </div>
                </div>
                {str.blockchainTxDigests?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500">TX ({str.blockchainTxCount}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {str.blockchainTxDigests.map(d => (
                        <span key={d} className="font-mono text-xs bg-neon-purple/10 text-neon-purple px-1.5 py-0.5 rounded" title={d}>
                          {truncateAddress(d, 6)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Assistiti */}
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Assistiti</h4>
          {crossRef.assistiti?.length === 0 && <p className="text-xs text-slate-600 italic mb-4">Nessun assistito</p>}
          <div className="space-y-3">
            {crossRef.assistiti?.map(ass => (
              <div key={ass.id} className="glass-static rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="font-semibold text-sm text-slate-200">
                    #{ass.id} - {ass.cognome} {ass.nome} <span className="text-slate-500 text-xs">({ass.codiceFiscale}, entity: {ass.entityId})</span>
                  </span>
                  <StatusBadge status={ass.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">PubKey:</span>{' '}
                    {ass.hasPublicKey ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">PrivKey locale:</span>{' '}
                    {ass.hasPrivateKey ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">PrivKey on-chain:</span>{' '}
                    {ass.privateKeyOnChain ? <CheckCircle size={12} className="inline text-neon-emerald" /> : <XCircle size={12} className="inline text-red-400" />}
                  </div>
                  <div>
                    <span className="text-slate-500">BC version:</span>{' '}
                    <span className="text-slate-200">{ass.ultimaVersioneSuBlockchain}</span>
                  </div>
                </div>
                {ass.blockchainTxDigests?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500">TX ({ass.blockchainTxCount}):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ass.blockchainTxDigests.map(d => (
                        <span key={d} className="font-mono text-xs bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded" title={d}>
                          {truncateAddress(d, 6)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {ass.listeAssegnate?.length > 0 && (
                  <div className="mt-3 border-t border-white/5 pt-2">
                    <span className="text-xs text-slate-500">Liste assegnate ({ass.listeAssegnate.length}):</span>
                    <div className="space-y-1 mt-1">
                      {ass.listeAssegnate.map(al => (
                        <div key={al.id} className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400">Lista #{al.listaId}</span>
                          {al.listaDenominazione && <span className="text-slate-300">{al.listaDenominazione}</span>}
                          <span className={`px-1.5 py-0.5 rounded ${
                            al.stato === 1 ? 'bg-neon-emerald/10 text-neon-emerald' :
                            al.chiuso ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            stato: {al.stato}
                          </span>
                          {al.chiuso && <span className="text-slate-500">(chiuso)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer timestamp */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-600">
          Dati caricati: {data?.meta?.timestamp ? new Date(data.meta.timestamp).toLocaleString('it-IT') : '-'}
        </p>
      </div>
    </div>
  );
}
