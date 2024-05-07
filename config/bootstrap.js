/**
 * Seed Function
 * (sails.config.bootstrap)
 *
 * A function that runs just before your Sails app gets lifted.
 * > Need more flexibility?  You can also create a hook.
 *
 * For more information on seeding your app with fake data, check out:
 * https://sailsjs.com/config/bootstrap
 */


module.exports.bootstrap = async function () {
  const CryptHelper = require('../api/utility/CryptHelper');
  const iota = require('../api/utility/iota');
  // Import dependencies
  var path = require('path');
  const {STRUTTURE_DATA,DATI_SENSIBILI} = require('../api/enums/TransactionDataType');
  const ListManager = require('../api/utility/ListManager');

  // This bootstrap version indicates what version of fake data we're dealing with here.
  var HARD_CODED_DATA_VERSION = 0;

  // This path indicates where to store/look for the JSON file that tracks the "last run bootstrap info"
  // locally on this development computer (if we happen to be on a development computer).
  var bootstrapLastRunInfoPath = path.resolve(sails.config.appPath, '.tmp/bootstrap-version.json');

  // Whether or not to continue doing the stuff in this file (i.e. wiping and regenerating data)
  // depends on some factors:
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  /*  let data = await Organizzazione.create({
      denominazione: 'ASP 5 Messina',
      walletPath: 'wallet-db'
    }).fetch();*/

  let initFromZero = false;
  let walletData = null;
  let wallet = null;
  let mainAccount = null;
  if (initFromZero) {

    // remove all from Organizzazione
    await Organizzazione.destroy({});
    let keyPairOrg1 = await CryptHelper.RSAGenerateKeyPair();
    let organizzazione1 = await Organizzazione.create({
      id: 1,
      denominazione: 'ASP 5 Messina',
      publicKey: keyPairOrg1.publicKey,
      privateKey: keyPairOrg1.privateKey,
    }).fetch();
    let keyPairOrg2 = await CryptHelper.RSAGenerateKeyPair();
    let organizzazione2 = await Organizzazione.create({
      id: 2,
      denominazione: 'ASP 6 Catania',
      publicKey: keyPairOrg2.publicKey,
      privateKey: keyPairOrg2.privateKey,
    }).fetch();
    // create 2 struttura
    await Struttura.destroy({});
    let keyPair1 = await CryptHelper.RSAGenerateKeyPair();
    let struttura1 = await Struttura.create(
      {
        id: 1,
        privateKey: keyPair1.privateKey,
        publicKey: keyPair1.publicKey,
        indirizzo: "Indirizzo della struttura 1",
        denominazione: 'Struttura 1',
        organizzazione: organizzazione1.id,
      }).fetch();
    let keyPair2 = await CryptHelper.RSAGenerateKeyPair();
    let struttura2 = await Struttura.create(
      {
        id: 2,
        privateKey: keyPair2.privateKey,
        publicKey: keyPair2.publicKey,
        indirizzo: "Indirizzo della struttura 2",
        denominazione: 'Struttura 2',
        organizzazione: organizzazione1.id,
      }).fetch();
    await Lista.destroy({});
    let lista1Struttura1 = await Lista.create({
      id: 1,
      denominazione: 'Lista 1 Struttura 1',
      struttura: struttura1.id,
    }).fetch();
    let lista2Struttura1 = await Lista.create({
      id: 2,
      denominazione: 'Lista 2 Struttura 1',
      struttura: struttura1.id,
    }).fetch();
    let lista1Struttura2 = await Lista.create({
      id: 3,
      denominazione: 'Lista 1 Struttura 2',
      struttura: struttura2.id,
    }).fetch();

    let idWalletStruttura1 = await Struttura.getWalletIdStruttura({id: struttura1.id});
    let idWalletStruttura2 = await Struttura.getWalletIdStruttura({id: struttura2.id});
    let idWalleetLista1Struttura1 = await Lista.getWalletIdLista({id: lista1Struttura1.id});
    let idWalleetLista2Struttura1 = await Lista.getWalletIdLista({id: lista2Struttura1.id});
    let idWalleetLista1Struttura2 = await Lista.getWalletIdLista({id: lista1Struttura2.id});

    walletData = await iota.getOrInitWallet();
    wallet = walletData.wallet;
    mainAccount = walletData.mainAccount;
    //let mainAccountBalance = await iota.getAccountBalance(mainAccount);
    /*let accountStruttura1 = await iota.getOrCreateWalletAccount(wallet, idWalletStruttura1);
    let accountStruttura2 = await iota.getOrCreateWalletAccount(wallet, idWalletStruttura2);
    let accountLista1Struttura1 = await iota.getOrCreateWalletAccount(wallet, idWalleetLista1Struttura1);
    let accountLista2Struttura1 = await iota.getOrCreateWalletAccount(wallet, idWalleetLista2Struttura1);
    let accountLista1Struttura2 = await iota.getOrCreateWalletAccount(wallet, idWalleetLista1Struttura2);*/

    let mainBalance = await iota.getAccountBalance(mainAccount);
    await iota.waitUntilBalanceIsGreaterThanZero(mainAccount);
    let allOrganizzazioni = await Organizzazione.find().populate('strutture');
    let dataToStore = [];
    for (let organizzazione of allOrganizzazioni) {
      console.log(organizzazione);
      for (let struttura of organizzazione.strutture) {
        // omit private key
        struttura.privateKey = null;
        let allListe = await Lista.find({struttura: struttura.id});
        struttura.liste = allListe;
      }
      dataToStore.push(organizzazione);
    }

    //await iota.makeTransactionWithText(wallet, mainAccount, await iota.getFirstAddressOfAnAccount(mainAccount), MAIN_DATA, dataToStore, 'Snaposnot del ' + new Date().getTime());
  }
  else
  {
    let walletData = await iota.getOrInitWallet();
    wallet = walletData.wallet;
    mainAccount = walletData.mainAccount;
  }
  let manager = new ListManager(wallet);
  await manager.updateDatiOrganizzazioneToBlockchain(1);
  let data = await manager.getLastDatiOrganizzazioneFromBlockchain(1);
  await manager.updateDatiOrganizzazioneToBlockchain(2);
  let data2 = await manager.getLastDatiOrganizzazioneFromBlockchain(2);
  await manager.updateDatiStrutturaToBlockchain(1);
  let data3 = await manager.getLastDatiStrutturaFromBlockchain(1);
  await manager.updateDatiStrutturaToBlockchain(2);
  let data4 = await manager.getLastDatiStrutturaFromBlockchain(2);
  console.log('ciao');


// If the hard-coded data version has been incremented, or we're being forced
// (i.e. `--drop` or `--environment=test` was set), then run the meat of this
// bootstrap script to wipe all existing data and rebuild hard-coded data.
  if (sails.config.models.migrate !== 'drop' && sails.config.environment !== 'test') {
    // If this is _actually_ a production environment (real or simulated), or we have
    // `migrate: safe` enabled, then prevent accidentally removing all data!
    if (process.env.NODE_ENV === 'production' || sails.config.models.migrate === 'safe') {
      sails.log('Since we are running with migrate: \'safe\' and/or NODE_ENV=production (in the "' + sails.config.environment + '" Sails environment, to be precise), skipping the rest of the bootstrap to avoid data loss...');
      return;
    }//•

    // Compare bootstrap version from code base to the version that was last run
    var lastRunBootstrapInfo = await sails.helpers.fs.readJson(bootstrapLastRunInfoPath)
      .tolerate('doesNotExist');// (it's ok if the file doesn't exist yet-- just keep going.)

    if (lastRunBootstrapInfo && lastRunBootstrapInfo.lastRunVersion === HARD_CODED_DATA_VERSION) {
      sails.log('Skipping v' + HARD_CODED_DATA_VERSION + ' bootstrap script...  (because it\'s already been run)');
      sails.log('(last run on this computer: @ ' + (new Date(lastRunBootstrapInfo.lastRunAt)) + ')');
      return;
    }//•

    sails.log('Running v' + HARD_CODED_DATA_VERSION + ' bootstrap script...  (' + (lastRunBootstrapInfo ? 'before this, the last time the bootstrap ran on this computer was for v' + lastRunBootstrapInfo.lastRunVersion + ' @ ' + (new Date(lastRunBootstrapInfo.lastRunAt)) : 'looks like this is the first time the bootstrap has run on this computer') + ')');
  } else {
    sails.log('Running bootstrap script because it was forced...  (either `--drop` or `--environment=test` was used)');
  }

// Since the hard-coded data version has been incremented, and we're running in
// a "throwaway data" environment, delete all records from all models.
  for (let identity in sails.models) {
    await sails.models[identity].destroy({});
  }//∞

// By convention, this is a good place to set up fake data during development.
/*
  await User.createEach([
    {
      emailAddress: 'admin@example.com',
      fullName: 'Ryan Dahl',
      isSuperAdmin: true,
      password: await sails.helpers.passwords.hashPassword('abc123')
    },
  ]);
*/


// Save new bootstrap version
  await sails.helpers.fs.writeJson.with({
    destination: bootstrapLastRunInfoPath,
    json: {
      lastRunVersion: HARD_CODED_DATA_VERSION,
      lastRunAt: Date.now()
    },
    force: true
  })
    .tolerate((err) => {
      sails.log.warn('For some reason, could not write bootstrap version .json file.  This could be a result of a problem with your configured paths, or, if you are in production, a limitation of your hosting provider related to `pwd`.  As a workaround, try updating app.js to explicitly pass in `appPath: __dirname` instead of relying on `chdir`.  Current sails.config.appPath: `' + sails.config.appPath + '`.  Full error details: ' + err.stack + '\n\n(Proceeding anyway this time...)');
    });

};
