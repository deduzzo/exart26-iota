module.exports = {


  friendlyName: 'View strutture',


  description: 'Display "Strutture" page.',

  inputs: {
    id: {
      type: 'number',
      required: false
    }
  },


  exits: {

    success: {
      viewTemplatePath: 'pages/strutture'
    }

  },


  fn: async function ({id}) {
    let strutture = null;
    if (id) {
      strutture = await Strutture.findOne({id: id});
    }
    else
      strutture = await Strutture.find();
    // Respond with view.
    return {
      pageTitle: 'Strutture',
      strutture
    };

  }


};
