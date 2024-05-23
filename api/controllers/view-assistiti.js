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
    let assistiti = null;
    if (id) {
      assistiti = await Assistito.findOne({id: id}).populate('liste');
    }
    else
      assistiti = await Assistito.find().populate('liste');



    // Respond with view.
    return {
      pageTitle: 'Assistiti',
      assistiti,
      id
    };

  }


};
