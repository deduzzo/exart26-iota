import { api } from './client';

// Wallet
export const getWalletInfo = () => api('/api/v1/wallet/get-info');
export const initWallet = () => api('/wallet/verifica?initWallet=true');

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

// Admin
export const fetchDbFromBlockchain = () =>
  api('/api/v1/fetch-db-from-blockchain', { method: 'POST' });
export const recoverFromArweave = () =>
  api('/api/v1/recover-from-arweave', { method: 'POST' });
