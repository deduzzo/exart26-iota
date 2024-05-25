module.exports = {


  friendlyName: 'Console socket',


  description: 'Mostra un messaggio sulla console e lo invia tramite socket (se richiesto)',


  inputs: {
    message: {
      type: 'string',
      required: true
    },
    socketId : {
      type: 'string',
      required: false,
    },
    socketChannel : {
      type: 'string',
      required: false,
      defaultsTo: 'message'
    },
    otherObjectData :  {
      type: 'ref',
      required: false,
      defaultsTo: {}
    }
  },


  exits: {
    success: {
      description: 'All done.',
    },
  },


  fn: async function (inputs,exits) {
    if (inputs.socketId)
      sails.sockets.broadcast(inputs.socketId, inputs.socketChannel, { message: inputs.message, ...inputs.otherObjectData});
    // log message
    sails.log.info(inputs.message);
    return exits.success();
  }


};

