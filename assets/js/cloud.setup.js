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
  methods: {"grantCsrfToken":{"verb":"GET","url":"/csrfToken"},"getInfo":{"verb":"GET","url":"/api/v1/wallet/get-info","args":[]},"getTransaction":{"verb":"GET","url":"/api/v1/get-transaction","args":["accountName","transactionId"]},"addOrganizzazione":{"verb":"POST","url":"/api/v1/add-organizzazione","args":["denominazione"]},"addStruttura":{"verb":"POST","url":"/api/v1/add-struttura","args":["denominazione","indirizzo","organizzazione","attiva"]},"addLista":{"verb":"POST","url":"/api/v1/add-lista","args":["denominazione","struttura"]},"addAssistito":{"verb":"POST","url":"/api/v1/add-assistito","args":["nome","cognome","codiceFiscale","dataNascita","email","telefono","indirizzo"]},"fetchDbFromBlockchain":{"verb":"POST","url":"/api/v1/fetch-db-from-blockchain","args":[]},"addAssistitoInLista":{"verb":"POST","url":"/api/v1/add-assistito-in-lista","args":["idAssistito","idLista"]}}
  /* eslint-enable */

});
