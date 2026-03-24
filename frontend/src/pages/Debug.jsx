import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug, Wallet, Database, Link2, ChevronDown, ChevronRight,
  ExternalLink, CheckCircle, AlertTriangle, XCircle, RefreshCw, Copy, Cloud
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getDebugData, getArweaveStatus, getArweaveTransactions, getArweaveConsistency, arweaveTestUpload, arweaveTestVerify } from '../api/endpoints';
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

  // Arweave state
  const [arweaveStatus, setArweaveStatus] = useState(null);
  const [arweaveStatusLoading, setArweaveStatusLoading] = useState(false);
  const [arweaveTxType, setArweaveTxType] = useState('MAIN_DATA');
  const [arweaveTxs, setArweaveTxs] = useState([]);
  const [arweaveTxsLoading, setArweaveTxsLoading] = useState(false);
  const [arweaveConsistency, setArweaveConsistency] = useState(null);
  const [arweaveConsistencyLoading, setArweaveConsistencyLoading] = useState(false);
  const [arweaveTestTxId, setArweaveTestTxId] = useState(null);
  const [arweaveTestLogs, setArweaveTestLogs] = useState([]);
  const [arweaveTestUploading, setArweaveTestUploading] = useState(false);
  const [arweaveTestVerifying, setArweaveTestVerifying] = useState(false);

  const addTestLog = useCallback((msg, success = null) => {
    const prefix = success === true ? '\u2713' : success === false ? '\u2717' : '\u2022';
    setArweaveTestLogs(prev => [...prev, `[${new Date().toLocaleTimeString('it-IT')}] ${prefix} ${msg}`]);
  }, []);

  const loadArweaveStatus = useCallback(async () => {
    setArweaveStatusLoading(true);
    try {
      const res = await getArweaveStatus();
      setArweaveStatus(res);
    } catch (e) {
      setArweaveStatus({ error: e.message });
    } finally {
      setArweaveStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArweaveStatus();
  }, [loadArweaveStatus]);

  const loadArweaveTxs = async () => {
    setArweaveTxsLoading(true);
    try {
      const res = await getArweaveTransactions(arweaveTxType, 20);
      setArweaveTxs(res.transactions || res || []);
    } catch (e) {
      setArweaveTxs([]);
    } finally {
      setArweaveTxsLoading(false);
    }
  };

  const loadArweaveConsistency = async () => {
    setArweaveConsistencyLoading(true);
    try {
      const res = await getArweaveConsistency();
      setArweaveConsistency(res);
    } catch (e) {
      setArweaveConsistency({ error: e.message });
    } finally {
      setArweaveConsistencyLoading(false);
    }
  };

  const handleTestUpload = async () => {
    setArweaveTestUploading(true);
    setArweaveTestLogs([]);
    setArweaveTestTxId(null);
    addTestLog('Avvio test upload su Arweave...');
    try {
      const res = await arweaveTestUpload();
      const txId = res.txId || res.id;
      setArweaveTestTxId(txId);
      addTestLog(`Upload OK - txId: ${txId}`, true);
    } catch (e) {
      addTestLog(`Upload fallito: ${e.message}`, false);
    } finally {
      setArweaveTestUploading(false);
    }
  };

  const handleTestVerify = async () => {
    if (!arweaveTestTxId) return;
    setArweaveTestVerifying(true);
    addTestLog(`Verifica transazione ${arweaveTestTxId}...`);
    try {
      const res = await arweaveTestVerify(arweaveTestTxId);
      if (res.queryFound !== undefined) addTestLog(res.queryFound ? 'Query trovata' : 'Query non trovata', res.queryFound);
      if (res.downloadOk !== undefined) addTestLog(res.downloadOk ? 'Download OK' : 'Download fallito', res.downloadOk);
      if (res.payloadMatch !== undefined) addTestLog(res.payloadMatch ? 'Payload verificato' : 'Payload non corrisponde', res.payloadMatch);
      const allOk = res.queryFound && res.downloadOk && res.payloadMatch;
      addTestLog(allOk ? 'Test completato con successo' : 'Test completato con errori', allOk);
    } catch (e) {
      addTestLog(`Verifica fallita: ${e.message}`, false);
    } finally {
      setArweaveTestVerifying(false);
    }
  };

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

        {/* 5. ARWEAVE */}
        <CollapsibleSection title="Arweave" icon={Cloud} iconColor="text-orange-400">
          {/* 5a. Stato Arweave */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Stato Arweave</h4>
              <button
                onClick={loadArweaveStatus}
                disabled={arweaveStatusLoading}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw size={12} className={arweaveStatusLoading ? 'animate-spin' : ''} /> Aggiorna
              </button>
            </div>
            {arweaveStatusLoading && !arweaveStatus ? (
              <LoadingSpinner size={24} />
            ) : arweaveStatus?.error ? (
              <p className="text-xs text-red-400">Errore: {arweaveStatus.error}</p>
            ) : arweaveStatus ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-static rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Modalita</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    arweaveStatus.mode === 'arlocal' ? 'bg-blue-500/10 text-blue-400' :
                    arweaveStatus.mode === 'mainnet' ? 'bg-neon-emerald/10 text-neon-emerald' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {arweaveStatus.mode || '-'}
                  </span>
                </div>
                <div className="glass-static rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Abilitato</p>
                  <p className={`text-sm font-bold ${arweaveStatus.enabled ? 'text-neon-emerald' : 'text-red-400'}`}>
                    {arweaveStatus.enabled ? 'Si' : 'No'}
                  </p>
                </div>
                <div className="glass-static rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Indirizzo</p>
                  <p className="text-xs font-mono text-slate-200 break-all">{arweaveStatus.address || '-'}</p>
                </div>
                <div className="glass-static rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo</p>
                  <p className="text-sm font-mono text-orange-400">{arweaveStatus.balance || '0'}</p>
                </div>
                {arweaveStatus.arLocalRunning !== undefined && (
                  <div className="glass-static rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">ArLocal</p>
                    <p className={`text-sm font-bold ${arweaveStatus.arLocalRunning ? 'text-neon-emerald' : 'text-slate-500'}`}>
                      {arweaveStatus.arLocalRunning ? 'Running' : 'Offline'}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* 5b. Transazioni Arweave */}
          <div className="mb-6 border-t border-white/5 pt-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Transazioni Arweave</h4>
            <div className="flex items-center gap-3 mb-3">
              <select
                value={arweaveTxType}
                onChange={(e) => setArweaveTxType(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-400/50"
              >
                <option value="MAIN_DATA">MAIN_DATA</option>
                <option value="ORGANIZZAZIONE_DATA">ORGANIZZAZIONE_DATA</option>
                <option value="STRUTTURE_LISTE_DATA">STRUTTURE_LISTE_DATA</option>
                <option value="ASSISTITI_DATA">ASSISTITI_DATA</option>
                <option value="PRIVATE_KEY">PRIVATE_KEY</option>
              </select>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadArweaveTxs}
                disabled={arweaveTxsLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {arweaveTxsLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Carica'}
              </motion.button>
            </div>
            {arweaveTxsLoading ? (
              <LoadingSpinner size={24} />
            ) : arweaveTxs.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Nessuna transazione caricata. Seleziona un tipo e clicca Carica.</p>
            ) : (
              <div className="space-y-2">
                {arweaveTxs.map((tx, i) => (
                  <div key={tx.txId || tx.id || i} className="glass-static rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-orange-400">{truncateAddress(tx.txId || tx.id || '-', 12)}</span>
                        <button
                          onClick={() => copyText(tx.txId || tx.id)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                          {copiedDigest === (tx.txId || tx.id) ? <CheckCircle size={12} className="text-neon-emerald" /> : <Copy size={12} className="text-slate-400" />}
                        </button>
                      </div>
                      <span className="text-xs text-slate-500">{tx.timestamp ? new Date(tx.timestamp).toLocaleString('it-IT') : '-'}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {tx.entityId && (
                        <span className="text-slate-400">Entity: <span className="text-slate-200 font-mono">{tx.entityId}</span></span>
                      )}
                      {tx.version !== null && tx.version !== undefined && (
                        <span className="text-slate-400">v{tx.version}</span>
                      )}
                    </div>
                    {tx.payload && <JsonBlock data={tx.payload} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5c. Consistency Check */}
          <div className="mb-6 border-t border-white/5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Consistency Check</h4>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadArweaveConsistency}
                disabled={arweaveConsistencyLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {arweaveConsistencyLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Verifica Consistency'}
              </motion.button>
            </div>
            {arweaveConsistencyLoading ? (
              <LoadingSpinner size={24} />
            ) : arweaveConsistency?.error ? (
              <p className="text-xs text-red-400">Errore: {arweaveConsistency.error}</p>
            ) : arweaveConsistency?.results ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">Tipo</th>
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">EntityId</th>
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">Su IOTA</th>
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">Su Arweave</th>
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">Versione IOTA</th>
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">Versione Arweave</th>
                      <th className="text-left py-2 px-2 text-slate-500 uppercase tracking-wider font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arweaveConsistency.results.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2 px-2 text-slate-300 font-mono">{row.type || '-'}</td>
                        <td className="py-2 px-2 text-slate-300 font-mono">{row.entityId ?? '-'}</td>
                        <td className="py-2 px-2">
                          {row.onIota ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" />}
                        </td>
                        <td className="py-2 px-2">
                          {row.onArweave ? <CheckCircle size={14} className="text-neon-emerald" /> : <XCircle size={14} className="text-red-400" />}
                        </td>
                        <td className="py-2 px-2 text-slate-300 font-mono">{row.versionIota ?? '-'}</td>
                        <td className="py-2 px-2 text-slate-300 font-mono">{row.versionArweave ?? '-'}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            row.status === 'consistent' ? 'bg-neon-emerald/10 text-neon-emerald' :
                            row.status === 'version_mismatch' ? 'bg-amber-500/10 text-amber-500' :
                            row.status === 'missing_on_arweave' ? 'bg-red-500/10 text-red-400' :
                            row.status === 'missing_on_iota' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {row.status === 'consistent' && <CheckCircle size={12} />}
                            {row.status === 'version_mismatch' && <AlertTriangle size={12} />}
                            {(row.status === 'missing_on_arweave' || row.status === 'missing_on_iota') && <XCircle size={12} />}
                            {row.status || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">Clicca il pulsante per verificare la consistency tra IOTA e Arweave.</p>
            )}
          </div>

          {/* 5d. Test Interattivo */}
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Test Interattivo</h4>
            <div className="flex items-center gap-3 mb-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleTestUpload}
                disabled={arweaveTestUploading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {arweaveTestUploading ? <RefreshCw size={14} className="animate-spin inline mr-1" /> : null}
                Test Upload
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleTestVerify}
                disabled={!arweaveTestTxId || arweaveTestVerifying}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {arweaveTestVerifying ? <RefreshCw size={14} className="animate-spin inline mr-1" /> : null}
                Verifica
              </motion.button>
              {arweaveTestTxId && (
                <span className="text-xs text-slate-400">
                  txId: <span className="font-mono text-orange-400">{truncateAddress(arweaveTestTxId, 12)}</span>
                </span>
              )}
            </div>
            {arweaveTestLogs.length > 0 && (
              <div className="bg-black/30 rounded-xl p-4 max-h-60 overflow-y-auto font-mono text-xs space-y-1">
                {arweaveTestLogs.map((log, i) => (
                  <div key={i} className={
                    log.includes('\u2713') ? 'text-neon-emerald' :
                    log.includes('\u2717') ? 'text-red-400' :
                    'text-slate-300'
                  }>
                    {log}
                  </div>
                ))}
              </div>
            )}
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
