/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */

module.exports.routes = {

  //  ╦ ╦╔═╗╔╗ ╔═╗╔═╗╔═╗╔═╗╔═╗
  //  ║║║║╣ ╠╩╗╠═╝╠═╣║ ╦║╣ ╚═╗
  //  ╚╩╝╚═╝╚═╝╩  ╩ ╩╚═╝╚═╝╚═╝
  'GET /':                   { action: 'view-homepage-or-redirect' },
  'GET /welcome/:unused?':   { action: 'dashboard/view-welcome' },
  'GET /dashboard':          { action: 'view-dashboard' },
  'GET /strutture/:idOrganizzazione?/:id?':     { action: 'view-strutture' },
  'GET /organizzazioni/:id?':{ action: 'view-organizzazioni' },
  'GET /assistiti/:id?':     { action: 'view-assistiti' },



/*  'GET /signup':             { action: 'entrance/view-signup' },
  'GET /email/confirm':      { action: 'entrance/confirm-email' },
  'GET /email/confirmed':    { action: 'entrance/view-confirmed-email' },

  'GET /login':              { action: 'entrance/view-login' },
  'GET /password/forgot':    { action: 'entrance/view-forgot-password' },
  'GET /password/new':       { action: 'entrance/view-new-password' },

  'GET /account':            { action: 'account/view-account-overview' },
  'GET /account/password':   { action: 'account/view-edit-password' },
  'GET /account/profile':    { action: 'account/view-edit-profile' },*/
  'GET /wallet/verifica': { action: 'wallet/view-verifica' },



  //  ╔╦╗╦╔═╗╔═╗  ╦═╗╔═╗╔╦╗╦╦═╗╔═╗╔═╗╔╦╗╔═╗   ┬   ╔╦╗╔═╗╦ ╦╔╗╔╦  ╔═╗╔═╗╔╦╗╔═╗
  //  ║║║║╚═╗║    ╠╦╝║╣  ║║║╠╦╝║╣ ║   ║ ╚═╗  ┌┼─   ║║║ ║║║║║║║║  ║ ║╠═╣ ║║╚═╗
  //  ╩ ╩╩╚═╝╚═╝  ╩╚═╚═╝═╩╝╩╩╚═╚═╝╚═╝ ╩ ╚═╝  └┘   ═╩╝╚═╝╚╩╝╝╚╝╩═╝╚═╝╩ ╩═╩╝╚═╝
/*  '/terms':                   '/legal/terms',
  '/logout':                  '/api/v1/account/logout',*/


  //  ╦ ╦╔═╗╔╗ ╦ ╦╔═╗╔═╗╦╔═╔═╗
  //  ║║║║╣ ╠╩╗╠═╣║ ║║ ║╠╩╗╚═╗
  //  ╚╩╝╚═╝╚═╝╩ ╩╚═╝╚═╝╩ ╩╚═╝
  // …


  //  ╔═╗╔═╗╦  ╔═╗╔╗╔╔╦╗╔═╗╔═╗╦╔╗╔╔╦╗╔═╗
  //  ╠═╣╠═╝║  ║╣ ║║║ ║║╠═╝║ ║║║║║ ║ ╚═╗
  //  ╩ ╩╩  ╩  ╚═╝╝╚╝═╩╝╩  ╚═╝╩╝╚╝ ╩ ╚═╝
  // Note that, in this app, these API endpoints may be accessed using the `Cloud.*()` methods
  // from the Parasails library, or by using those method names as the `action` in <ajax-form>.
  //  sails run rebuild-cloud-sdk
/*
  '/api/v1/account/logout':                           { action: 'account/logout' },
  'PUT   /api/v1/account/update-password':            { action: 'account/update-password' },
  'PUT   /api/v1/account/update-profile':             { action: 'account/update-profile' },
  'PUT   /api/v1/account/update-billing-card':        { action: 'account/update-billing-card' },
  'PUT   /api/v1/entrance/login':                        { action: 'entrance/login' },
  'POST  /api/v1/entrance/signup':                       { action: 'entrance/signup' },
  'POST  /api/v1/entrance/send-password-recovery-email': { action: 'entrance/send-password-recovery-email' },
  'POST  /api/v1/entrance/update-password-and-login':    { action: 'entrance/update-password-and-login' },
  'POST  /api/v1/deliver-contact-form-message':          { action: 'deliver-contact-form-message' },
  'POST  /api/v1/observe-my-session':                 { action: 'observe-my-session', hasSocketFeatures: true },
*/
  'GET /csrfToken':                       { action: 'security/grant-csrf-token' },
  'GET /api/v1/wallet/get-info':          { action: 'wallet/get-info' },
  'GET /api/v1/get-transaction':          { action: 'get-transaction' },
  'POST /api/v1/add-organizzazione':      { action: 'add-organizzazione' },
  'POST /api/v1/add-struttura':           { action: 'add-struttura' },
  'POST /api/v1/add-lista':               { action: 'add-lista' },
  'POST /api/v1/add-assistito':           { action: 'add-assistito' },
  'GET /api/v1/add-assistito':           { action: 'add-assistito' }, // per websocket
  'POST /api/v1/fetch-db-from-blockchain': { action: 'fetch-db-from-blockchain' },
  'POST /api/v1/add-assistito-in-lista':  { action: 'add-assistito-in-lista' },





  'get /swagger.json': (_, res) => {
    const swaggerJson = require('../swagger/swagger.json');
    if (!swaggerJson) {
      res
        .status(404)
        .set('content-type', 'application/json')
        .send({message: 'Cannot find swagger.json, has the server generated it?'});
    }
    return res
      .status(200)
      .set('content-type', 'application/json')
      .send(swaggerJson);
  },

  'GET /docs': function(req, res) {
    var path = require('path');
    var fs = require('fs');
    var filePath = path.resolve('node_modules/swagger-ui-dist/index.html');
    var apiurl = sails.config.custom.baseUrl + '/swagger.json';
    // csrf
    var csrfToken = '';
    if (req.csrfToken) {
      csrfToken = req.csrfToken();
    }
    fs.readFile(filePath, 'utf8', function(err, data) {
      if (err) {
        return res.serverError(err);
      }
      data = data.replace(' src="./swagger-initializer.js" charset="UTF-8"> ',
      '> let csrfToken= "'+csrfToken +'"; window.onload = function() {' +
      'window.ui = SwaggerUIBundle({' +
      '  url: "'+ apiurl +'",' +
      '  dom_id: "#swagger-ui",' +
      '  deepLinking: true,' +
      '  presets: [' +
      '    SwaggerUIBundle.presets.apis,' +
      '    SwaggerUIStandalonePreset' +
      '  ],' +
      '  plugins: [' +
      '    SwaggerUIBundle.plugins.DownloadUrl' +
      '  ],' +
        '  layout: "StandaloneLayout",' +
        '  requestInterceptor: function(req) {' +
        '    req.headers["X-CSRF-Token"] = csrfToken;' +
        '    return req;' +
        '  }' +
        '});' +
        '};');

    res.send(data);
    });
  }

};
