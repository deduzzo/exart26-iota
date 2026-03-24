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
  'GET /dashboard':          { action: 'view-dashboard' },
  'GET /strutture/:idOrganizzazione?/:id?':     { action: 'view-strutture' },
  'GET /organizzazioni/:id?':{ action: 'view-organizzazioni' },
  'GET /assistiti/:id?':     { action: 'view-assistiti' },
  'GET /wallet/verifica': { action: 'wallet/view-verifica' },



  //  ╔╦╗╦╔═╗╔═╗  ╦═╗╔═╗╔╦╗╦╦═╗╔═╗╔═╗╔╦╗╔═╗   ┬   ╔╦╗╔═╗╦ ╦╔╗╔╦  ╔═╗╔═╗╔╦╗╔═╗
  //  ║║║║╚═╗║    ╠╦╝║╣  ║║║╠╦╝║╣ ║   ║ ╚═╗  ┌┼─   ║║║ ║║║║║║║║  ║ ║╠═╣ ║║╚═╗
  //  ╩ ╩╩╚═╝╚═╝  ╩╚═╚═╝═╩╝╩╩╚═╚═╝╚═╝ ╩ ╚═╝  └┘   ═╩╝╚═╝╚╩╝╝╚╝╩═╝╚═╝╩ ╩═╩╝╚═╝
  '/terms':                   '/legal/terms',


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
  'POST  /api/v1/observe-my-session':                 { action: 'observe-my-session', hasSocketFeatures: true },
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
  'POST /api/v1/recover-from-arweave':    { action: 'recover-from-arweave' },




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
