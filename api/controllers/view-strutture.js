const ListManager = require('../utility/ListManager');
module.exports = {


  friendlyName: 'View strutture',


  description: 'Display "Strutture" page.',

  inputs: {
    id: {
      type: 'number',
      required: false
    },
    idOrganizzazione: {
      type: 'number',
      required: false
    }
  },


  exits: {

    success: {
      viewTemplatePath: 'pages/strutture'
    }

  },


  fn: async function ({id, idOrganizzazione}) {
    let strutture = null;
    let organizzazione = null;
    if (idOrganizzazione) {
      organizzazione = await Organizzazione.findOne({id: idOrganizzazione});
    }
    if (id) {
      strutture = await Struttura.findOne({id: id, organizzazione: idOrganizzazione}).populate('liste');
    } else if (idOrganizzazione) {
      strutture = await Struttura.find({organizzazione: idOrganizzazione}).populate('liste');
    } else {
      strutture = await Struttura.find().populate('liste');
    }
    let manager = new ListManager();
    for (let struttura of strutture) {
      for (let lista of struttura.liste) {
        await manager.updateListeAssistitiFromBlockchain(lista);
      }
    }
    return {
      pageTitle: 'Strutture ' + (organizzazione ? '  ' + organizzazione.denominazione : ''),
      strutture,
      id,
      organizzazione
    };

  }


};
