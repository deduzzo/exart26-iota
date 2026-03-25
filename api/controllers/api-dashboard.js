const db = require('../utility/db');
const iota = require('../utility/iota');
const ArweaveHelper = require('../utility/ArweaveHelper');

module.exports = {

  friendlyName: 'API Dashboard',

  description: 'Ritorna dati JSON per la dashboard: statistiche, stato wallet, stato Arweave, ultime operazioni.',

  inputs: {},

  exits: {
    success: {
      description: 'Dati dashboard.',
    },
  },

  fn: async function () {
    let organizzazioniCount = db.Organizzazione.count();
    let struttureCount = db.Struttura.count();
    let listeCount = db.Lista.count();
    let assistitiCount = db.Assistito.count();
    let listeAperte = db.Lista.count({aperta: true});
    let assistitiInCoda = db.AssistitiListe.count({stato: 1, chiuso: false});
    let assistitiInLista = assistitiInCoda;
    let assistitiUsciti = db.AssistitiListe.count({chiuso: true});
    let transazioniTotali = db.BlockchainData.count();
    let assistitiListeCount = db.AssistitiListe.count();
    let oggettiTotali = organizzazioniCount + struttureCount + listeCount + assistitiCount + assistitiListeCount;

    let walletInitialized = await iota.isWalletInitialized();
    let walletInfo = null;
    if (walletInitialized) {
      try {
        walletInfo = await iota.getStatusAndBalance();
      } catch (e) {
        walletInfo = { status: 'Errore', error: e.message };
      }
    }

    let arweaveStatus = {enabled: ArweaveHelper.isEnabled(), balance: null};
    if (arweaveStatus.enabled) {
      try {
        arweaveStatus.balance = await ArweaveHelper.getBalance();
      } catch (e) {
        arweaveStatus.balance = null;
      }
    }

    // Ultime operazioni: activity feed aggregato da tutte le tabelle
    const ultimeOperazioni = [];

    // Creazione organizzazioni
    for (const o of db.Organizzazione.find({}, { sort: 'createdAt DESC', limit: 5 })) {
      ultimeOperazioni.push({
        tipo: 'ORGANIZZAZIONE_CREATA',
        label: o.denominazione,
        entityType: 'ORGANIZZAZIONE',
        entityId: o.id,
        timestamp: o.createdAt,
      });
    }

    // Creazione strutture
    for (const s of db.Struttura.find({}, { sort: 'createdAt DESC', limit: 5 })) {
      ultimeOperazioni.push({
        tipo: 'STRUTTURA_CREATA',
        label: s.denominazione,
        entityType: 'STRUTTURA',
        entityId: s.id,
        timestamp: s.createdAt,
      });
    }

    // Creazione liste
    for (const l of db.Lista.find({}, { sort: 'createdAt DESC', limit: 5 })) {
      ultimeOperazioni.push({
        tipo: 'LISTA_CREATA',
        label: l.denominazione,
        entityType: 'LISTA',
        entityId: l.id,
        timestamp: l.createdAt,
      });
    }

    // Creazione assistiti
    for (const a of db.Assistito.find({}, { sort: 'createdAt DESC', limit: 5 })) {
      ultimeOperazioni.push({
        tipo: 'ASSISTITO_CREATO',
        label: `${a.cognome} ${a.nome}`,
        entityType: 'ASSISTITO',
        entityId: a.id,
        timestamp: a.createdAt,
      });
    }

    // Inserimenti/uscite lista — usa timestamp business (dataOraIngresso/Uscita), non createdAt
    const ingressi = db.AssistitiListe.findWithDetails({}, { sort: 'al.dataOraIngresso DESC', limit: 10 });
    for (const al of ingressi) {
      ultimeOperazioni.push({
        tipo: al.chiuso ? 'USCITA_DA_LISTA' : 'INGRESSO_IN_LISTA',
        label: `${al.assNome ? al.assCognome + ' ' + al.assNome : 'Assistito #' + al.assistito} → ${al.listaDenominazione || 'Lista #' + al.lista}`,
        entityType: 'ASSISTITO',
        entityId: al.assistito,
        stato: al.stato,
        timestamp: al.chiuso ? (al.dataOraUscita || al.updatedAt) : (al.dataOraIngresso || al.createdAt),
      });
    }

    // Ordina per timestamp DESC e prendi le ultime 15
    ultimeOperazioni.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    ultimeOperazioni.splice(15);

    return {
      stats: {
        organizzazioni: organizzazioniCount,
        strutture: struttureCount,
        liste: listeCount,
        assistiti: assistitiCount,
        listeAperte: listeAperte,
        assistitiInCoda: assistitiInCoda,
        assistitiInLista: assistitiInLista,
        assistitiUsciti: assistitiUsciti,
        transazioniTotali: transazioniTotali,
        oggettiTotali: oggettiTotali,
      },
      walletInitialized,
      walletInfo,
      arweaveStatus,
      ultimeOperazioni,
    };
  }
};
