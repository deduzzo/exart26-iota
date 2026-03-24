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
    let organizzazioniCount = await Organizzazione.count();
    let struttureCount = await Struttura.count();
    let listeCount = await Lista.count();
    let assistitiCount = await Assistito.count();
    let listeAperte = await Lista.count({aperta: true});
    let assistitiInCoda = await AssistitiListe.count({stato: 1, chiuso: false});

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

    // Ultime 10 operazioni (assistiti inseriti in lista)
    let ultimeOperazioni = await AssistitiListe.find({
      sort: 'createdAt DESC',
      limit: 10
    }).populate('assistito').populate('lista');

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
