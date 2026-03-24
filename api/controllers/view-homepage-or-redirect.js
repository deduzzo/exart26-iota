let iota = require('../utility/iota');
const ArweaveHelper = require('../utility/ArweaveHelper');

const pageTitle = 'Home';


module.exports = {


  friendlyName: 'View homepage or redirect',


  description: 'Display or redirect to the appropriate homepage, depending on login status.',


  exits: {

    success: {
      statusCode: 200,
      description: 'Requesting user is a guest, so show the public landing page.',
      viewTemplatePath: 'pages/dashboard'
    },

    redirect: {
      responseType: 'redirect',
      description: 'Requesting user is logged in, so redirect to the internal welcome page.'
    },

  },

  fn: async function () {
    let walletStatus = await iota.getStatusAndBalance();
    let walletInitialized = await iota.isWalletInitialized();

    let organizzazioniCount = await Organizzazione.count();
    let struttureCount = await Struttura.count();
    let listeCount = await Lista.count();
    let assistitiCount = await Assistito.count();
    let listeAperte = await Lista.count({aperta: true});
    let assistitiInCoda = await AssistitiListe.count({stato: 1, chiuso: false});

    let arweaveStatus = {enabled: ArweaveHelper.isEnabled(), balance: null};
    if (arweaveStatus.enabled) {
      try {
        arweaveStatus.balance = await ArweaveHelper.getBalance();
      } catch (e) {
        arweaveStatus.balance = null;
      }
    }

    let ultimeOperazioni = await AssistitiListe.find({
      sort: 'createdAt DESC',
      limit: 10
    }).populate('assistito').populate('lista');

    return {
      pageTitle,
      pageSubTitle: 'addr: ' + (walletStatus.address || 'N/A'),
      walletStatus,
      walletInitialized,
      stats: {
        organizzazioni: organizzazioniCount,
        strutture: struttureCount,
        liste: listeCount,
        assistiti: assistitiCount,
        listeAperte: listeAperte,
        assistitiInCoda: assistitiInCoda,
      },
      arweaveStatus,
      ultimeOperazioni,
    };

  }


};
