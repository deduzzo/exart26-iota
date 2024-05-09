let iota = require('../utility/iota');

const pageTitle = 'Home';
let pageSubTitle = '';


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
    let walletStatus =  await iota.getStatusAndBalance();
    if (this.req.me) {
      throw {redirect:'/welcome'};
    }
    pageSubTitle = 'addr: ' + walletStatus.address;

    return {
      pageTitle,
      pageSubTitle,
      walletStatus: walletStatus
    };

  }


};
