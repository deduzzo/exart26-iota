const ListManager = require('../utility/ListManager');
module.exports = {


  friendlyName: 'Aggiorna db da blockchain',


  description: 'Aggiorna il database locale con i dati presenti sulla blockchain.',


  inputs: {

  },


  exits: {
      success: {
        description: 'All done.',
      },
  },


  fn: async function (inputs) {
    let manager = new ListManager();
    let res = await manager.updateDBfromBlockchain();
    return {'error': res.success, dataImported: res.data};
  }


};
