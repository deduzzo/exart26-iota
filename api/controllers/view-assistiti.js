const ListManager = require('../utility/ListManager');
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
        allAssistiti.push({...assistito.clearData});
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
