const iota = require('../utility/iota');
const ArweaveHelper = require('../utility/ArweaveHelper');

const pageTitle = 'Dashboard';
const pageSubTitle = 'Panoramica del sistema';

module.exports = {

  friendlyName: 'View dashboard',

  description: 'Display "Dashboard" page.',

  exits: {
    success: {
      viewTemplatePath: 'pages/dashboard'
    }
  },

  fn: async function () {
    let organizzazioniCount = await Organizzazione.count();
    let struttureCount = await Struttura.count();
    let listeCount = await Lista.count();
    let assistitiCount = await Assistito.count();
    let listeAperte = await Lista.count({aperta: true});
    let assistitiInCoda = await AssistitiListe.count({stato: 1, chiuso: false});

    let walletInitialized = await iota.isWalletInitialized();

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
      pageTitle,
      pageSubTitle,
      stats: {
        organizzazioni: organizzazioniCount,
        strutture: struttureCount,
        liste: listeCount,
        assistiti: assistitiCount,
        listeAperte: listeAperte,
        assistitiInCoda: assistitiInCoda,
      },
      walletInitialized,
      arweaveStatus,
      ultimeOperazioni,
    };
  }
};
