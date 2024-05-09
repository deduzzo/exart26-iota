const pageTitle = 'Home';
const pageSubTitle = 'Pagina principale';

module.exports = {


  friendlyName: 'View dashboard',


  description: 'Display "Dashboard" page.',

  exits: {

    success: {
      viewTemplatePath: 'pages/dashboard'
    }

  },


  fn: async function () {

    return {
      pageTitle,
      pageSubTitle,
    };

  }


};
