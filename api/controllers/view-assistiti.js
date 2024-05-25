const ListManager = require('../utility/ListManager');
const moment = require('moment');
module.exports = {


  friendlyName: 'View assistiti',


  description: 'Display "Assistiti" page.',

  inputs: {
    id: {
      type: 'number',
      required: false
    }
  },

  exits: {

    success: {
      viewTemplatePath: 'pages/assistiti'
    }

  },


  fn: async function ({id}) {
    let manager = new ListManager();

    let assistitiIds  = await manager.getAllIdAssistitiFromBlockchain();
    let allAssistiti = await Assistito.find({});
    if (id) {
      if (!allAssistiti.find(a => a.id === id)) {
        let assistito = await manager.getLastDatiAssistitoFromBlockchain(id);
        let assistitoObj = await Assistito.create({
          id: assistito.clearData.id,
          nome: assistito.clearData.nome,
          cognome: assistito.clearData.cognome,
          dataNascita: moment(assistito.clearData.dataNascita).format('YYYY-MM-DD'),
          codiceFiscale: assistito.clearData.codiceFiscale,
          indirizzo: assistito.clearData.indirizzo,
          telefono: assistito.clearData.telefono,
          email: assistito.clearData.email,
          publicKey: assistito.clearData.publicKey
        }).fetch();
        allAssistiti.push(assistitoObj);
      }
    }
    let allAssistitiMap = allAssistiti.reduce((map, obj) => {
      map[obj.id] = obj;
      return map;
    }, {});


    // Respond with view.
    return {
      pageTitle: 'Assistiti',
      assistitiIds,
      allAssistitiMap,
      id
    };

  }


};
