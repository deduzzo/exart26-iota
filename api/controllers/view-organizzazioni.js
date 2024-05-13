module.exports = {


  friendlyName: 'View organizzazioni',


  description: 'Display "Organizzazioni" page.',


  inputs: {
    id: {
      type: 'number',
      required: false
    }
  },


  exits: {

    success: {
      viewTemplatePath: 'pages/organizzazioni'
    }

  },


  fn: async function ({id}) {
    let organizzazioni = null;
    if (id) {
      organizzazioni = await Organizzazione.findOne({id: id}).populate('strutture');;
    }
    else
      organizzazioni = await Organizzazione.find().populate('strutture');
    // Respond with view.
    return {
      pageTitle: 'Organizzazioni e strutture',
      organizzazioni,
      id
    };

  }


};
