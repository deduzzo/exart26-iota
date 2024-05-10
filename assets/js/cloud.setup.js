/**
 * cloud.setup.js
 *
 * Configuration for this Sails app's generated browser SDK ("Cloud").
 *
 * Above all, the purpose of this file is to provide endpoint definitions,
 * each of which corresponds with one particular route+action on the server.
 *
 * > This file was automatically generated.
 * > (To regenerate, run `sails run rebuild-cloud-sdk`)
 */

Cloud.setup({

  /* eslint-disable */
  methods: {"grantCsrfToken":{"verb":"GET","url":"/csrfToken"},"getInfo":{"verb":"GET","url":"/api/v1/wallet/get-info","args":[]},"getTransaction":{"verb":"GET","url":"/api/v1/get-transaction","args":["accountName","transactionId"]},"addOrganizzazione":{"verb":"POST","url":"/api/v1/add-organizzazione","args":["denominazione"]}}
  /* eslint-enable */

});
