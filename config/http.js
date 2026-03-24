/**
 * HTTP Server Settings
 * (sails.config.http)
 *
 * Configuration for the underlying HTTP server in Sails.
 * (for additional recommended settings, see `config/env/production.js`)
 *
 * For more information on configuration, check out:
 * https://sailsjs.com/config/http
 */

var rateLimit = require('express-rate-limit');

module.exports.http = {

  /****************************************************************************
   *                                                                           *
   * Sails/Express middleware to run for every HTTP request.                   *
   * (Only applies to HTTP requests -- not virtual WebSocket requests.)        *
   *                                                                           *
   * https://sailsjs.com/documentation/concepts/middleware                     *
   *                                                                           *
   ****************************************************************************/

  middleware: {

    /***************************************************************************
     *                                                                          *
     * The order in which middleware should be run for HTTP requests.           *
     * (This Sails app's routes are handled by the "router" middleware below.)  *
     *                                                                          *
     ***************************************************************************/
    swaggerUi: require('express').static('node_modules/swagger-ui-dist'),

    apiRateLimit: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minuti
      max: 1000, // massimo 1000 richieste per IP per finestra (SPA fa molte chiamate)
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Troppe richieste da questo IP, riprova tra 15 minuti.' },
      skip: function (req) {
        // Applica solo alle rotte API
        return !req.path.startsWith('/api/');
      },
    }),

    order: [
      'cookieParser',
      'session',
      'apiRateLimit',
      'bodyParser',
      'compress',
      'poweredBy',
      'router',
      'www',
      'favicon',
      'swaggerUi',
    ],
    /***************************************************************************
     *                                                                          *
     * The body parser that will handle incoming multipart HTTP requests.       *
     *                                                                          *
     * https://sailsjs.com/config/http#?customizing-the-body-parser             *
     *                                                                          *
     ***************************************************************************/

    // bodyParser: (function _configureBodyParser(){
    //   var skipper = require('skipper');
    //   var middlewareFn = skipper({ strict: true });
    //   return middlewareFn;
    // })(),

  },

};
