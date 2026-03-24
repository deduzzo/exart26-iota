import { api } from './client';

// Wallet
export const getWalletInfo = () => api('/api/v1/wallet/get-info');
export const initWallet = () => api('/api/v1/wallet/init', { method: 'POST' });
export const resetWallet = () => api('/api/v1/wallet/reset', { method: 'POST' });

// Dashboard data
export const getDashboardData = () => api('/api/v1/dashboard');

// Organizzazioni
export const getOrganizzazioni = () => api('/api/v1/organizzazioni');
export const getOrganizzazione = (id) => api(`/api/v1/organizzazioni/${id}`);
export const addOrganizzazione = (denominazione) =>
  api('/api/v1/add-organizzazione', { method: 'POST', body: { denominazione } });

// Strutture
export const getStrutture = (idOrg) =>
  api(`/api/v1/strutture${idOrg ? `?organizzazione=${idOrg}` : ''}`);
export const addStruttura = (data) =>
  api('/api/v1/add-struttura', { method: 'POST', body: data });

// Liste
export const getListe = (idStruttura) =>
  api(`/api/v1/liste${idStruttura ? `?struttura=${idStruttura}` : ''}`);
export const addLista = (data) =>
  api('/api/v1/add-lista', { method: 'POST', body: data });

// Assistiti
export const getAssistiti = () => api('/api/v1/assistiti');
export const getAssistito = (id) => api(`/api/v1/assistiti/${id}`);
export const addAssistito = (data) =>
  api('/api/v1/add-assistito', { method: 'POST', body: data });

// Liste + Assistiti
export const addAssistitoInLista = (idAssistito, idLista) =>
  api('/api/v1/add-assistito-in-lista', { method: 'POST', body: { idAssistito, idLista } });

// Graph
export const getGraphData = () => api('/api/v1/graph-data');

// Liste dettaglio (assistiti in lista)
export const getListeDettaglio = (idLista) => api(`/api/v1/liste-dettaglio?idLista=${idLista}`);

// Rimozione assistito da lista (con azioni multi-lista)
export const rimuoviAssistitoDaLista = (idAssistitoListe, stato, azioniAltreListe = []) =>
  api('/api/v1/rimuovi-assistito-da-lista', { method: 'POST', body: { idAssistitoListe, stato, azioniAltreListe } });

// Tag lista
export const updateListaTag = (id, tag) =>
  api('/api/v1/update-lista-tag', { method: 'PUT', body: { id, tag } });

// Admin
export const fetchDbFromBlockchain = () =>
  api('/api/v1/fetch-db-from-blockchain', { method: 'POST' });
export const recoverFromArweave = () =>
  api('/api/v1/recover-from-arweave', { method: 'POST' });

// Pubblico
export const getPublicListe = () => api('/api/v1/public/liste');

// Sync
export const getSyncStatus = () => api('/api/v1/sync-status');
export const resetSync = () => api('/api/v1/sync-reset', { method: 'POST' });

// Debug
export const getDebugData = () => api('/api/v1/debug');
