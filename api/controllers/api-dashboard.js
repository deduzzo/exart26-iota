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

    // Ultime 10 operazioni (assistiti inseriti in lista) con dettagli
    let ultimeOperazioni = db.AssistitiListe.findWithDetails({}, { sort: 'al.createdAt DESC', limit: 10 });

    return {
      stats: {
        organizzazioni: organizzazioniCount,
        strutture: struttureCount,
        liste: listeCount,
        assistiti: assistitiCount,
        listeAperte: listeAperte,
        assistitiInCoda: assistitiInCoda,
      },
      walletInitialized,
      walletInfo,
      arweaveStatus,
      ultimeOperazioni,
    };
  }
};
