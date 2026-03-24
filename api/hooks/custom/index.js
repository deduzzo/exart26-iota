/**
 * @description :: The conventional "custom" hook.  Extends this app with custom server-start-time and request-time logic.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

module.exports = function defineCustomHook(sails) {

  return {

    /**
     * Runs when a Sails app loads/lifts.
     */
    initialize: async function () {

      sails.log.info('Initializing project hook... (`api/hooks/custom/`)');

      // Check Stripe/Sendgrid configuration (for billing and emails).
      var IMPORTANT_STRIPE_CONFIG = ['stripeSecret', 'stripePublishableKey'];
      var IMPORTANT_SENDGRID_CONFIG = ['sendgridSecret', 'internalEmailAddress'];
      var isMissingStripeConfig = _.difference(IMPORTANT_STRIPE_CONFIG, Object.keys(sails.config.custom)).length > 0;
      var isMissingSendgridConfig = _.difference(IMPORTANT_SENDGRID_CONFIG, Object.keys(sails.config.custom)).length > 0;

      if (isMissingStripeConfig || isMissingSendgridConfig) {

        let missingFeatureText = isMissingStripeConfig && isMissingSendgridConfig ? 'billing and email' : isMissingStripeConfig ? 'billing' : 'email';
        let suffix = '';
        if (_.contains(['silly'], sails.config.log.level)) {
          suffix =
`
> Tip: To exclude sensitive credentials from source control, use:
> • config/local.js (for local development)
> • environment variables (for production)
>
> If you want to check them in to source control, use:
> • config/custom.js  (for development)
> • config/env/staging.js  (for staging)
> • config/env/production.js  (for production)
>
> (See https://sailsjs.com/docs/concepts/configuration for help configuring Sails.)
`;
        }

        let problems = [];
        if (sails.config.custom.stripeSecret === undefined) {
          problems.push('No `sails.config.custom.stripeSecret` was configured.');
        }
        if (sails.config.custom.stripePublishableKey === undefined) {
          problems.push('No `sails.config.custom.stripePublishableKey` was configured.');
        }
        if (sails.config.custom.sendgridSecret === undefined) {
          problems.push('No `sails.config.custom.sendgridSecret` was configured.');
        }
        if (sails.config.custom.internalEmailAddress === undefined) {
          problems.push('No `sails.config.custom.internalEmailAddress` was configured.');
        }

        sails.log.verbose(
`Some optional settings have not been configured yet:
---------------------------------------------------------------------
${problems.join('\n')}

Until this is addressed, this app's ${missingFeatureText} features
will be disabled and/or hidden in the UI.

 [?] If you're unsure or need advice, come by https://sailsjs.com/support
---------------------------------------------------------------------${suffix}`);
      }//ﬁ

      // Set an additional config keys based on whether Stripe config is available.
      // This will determine whether or not to enable various billing features.
      sails.config.custom.enableBillingFeatures = !isMissingStripeConfig;

      // After "sails-hook-organics" finishes initializing, configure Stripe
      // and Sendgrid packs with any available credentials.
      sails.after('hook:organics:loaded', ()=>{

        sails.helpers.stripe.configure({
          secret: sails.config.custom.stripeSecret
        });

        sails.helpers.sendgrid.configure({
          secret: sails.config.custom.sendgridSecret,
          from: sails.config.custom.fromEmailAddress,
          fromName: sails.config.custom.fromName,
        });

      });//_∏_

      // ... Any other app-specific setup code that needs to run on lift,
      // even in production, goes here ...

    },


    routes: {

      /**
       * Runs before every matching route.
       *
       * @param {Ref} req
       * @param {Ref} res
       * @param {Function} next
       */
      before: {
        '/*': {
          skipAssets: true,
          fn: async function(req, res, next){

            var url = require('url');

            // First, if this is a GET request (and thus potentially a view),
            // attach a couple of guaranteed locals.
            if (req.method === 'GET') {

              // The  `_environment` local lets us do a little workaround to make Vue.js
              // run in "production mode" without unnecessarily involving complexities
              // with webpack et al.)
              if (res.locals._environment !== undefined) {
                throw new Error('Cannot attach Sails environment as the view local `_environment`, because this view local already exists!  (Is it being attached somewhere else?)');
              }
              res.locals._environment = sails.config.environment;

              // The `me` local is set explicitly to `undefined` here just to avoid having to
              // do `typeof me !== 'undefined'` checks in our views/layouts/partials.
              // > Note that, depending on the request, this may or may not be set to the
              // > logged-in user record further below.
              if (res.locals.me !== undefined) {
                throw new Error('Cannot attach view local `me`, because this view local already exists!  (Is it being attached somewhere else?)');
              }
              res.locals.me = undefined;
            }//ﬁ

            // Next, if we're running in our actual "production" or "staging" Sails
            // environment, check if this is a GET request via some other host,
            // for example a subdomain like `webhooks.` or `click.`.  If so, we'll
            // automatically go ahead and redirect to the corresponding path under
            // our base URL, which is environment-specific.
            // > Note that we DO NOT redirect virtual socket requests and we DO NOT
            // > redirect non-GET requests (because it can confuse some 3rd party
            // > platforms that send webhook requests.)  We also DO NOT redirect
            // > requests in other environments to allow for flexibility during
            // > development (e.g. so you can preview an app running locally on
            // > your laptop using a local IP address or a tool like ngrok, in
            // > case you want to run it on a real, physical mobile/IoT device)
            var configuredBaseHostname;
            try {
              configuredBaseHostname = url.parse(sails.config.custom.baseUrl).host;
            } catch (unusedErr) { /*…*/}
            if ((sails.config.environment === 'staging' || sails.config.environment === 'production') && !req.isSocket && req.method === 'GET' && req.hostname !== configuredBaseHostname) {
              sails.log.info('Redirecting GET request from `'+req.hostname+'` to configured expected host (`'+configuredBaseHostname+'`)...');
              return res.redirect(sails.config.custom.baseUrl+req.url);
            }//•

            return next();
          }
        }
      }
    }


  };

};
