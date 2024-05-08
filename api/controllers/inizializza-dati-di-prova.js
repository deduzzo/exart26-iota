const path = require('path');
const CryptHelper = require('../utility/CryptHelper');
const ListManager = require('../utility/ListManager');
const {STRUTTURE_DATA,DATI_SENSIBILI} = require('../enums/TransactionDataType');
const {INSERITO_IN_CODA} = require('../enums/StatoLista');

module.exports = {


  friendlyName: 'Inizializza dati di prova',


  description: '',


  inputs: {

  },


  exits: {

  },


  fn: async function (inputs) {


    /*  let data = await Organizzazione.create({
        denominazione: 'ASP 5 Messina',
        walletPath: 'wallet-db'
      }).fetch();*/

    let initFromZero = true;
    let walletData = null;
    let wallet = null;
    let mainAccount = null;
    if (initFromZero === true) {

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

      let keyPairAss1 = await CryptHelper.RSAGenerateKeyPair();
      let keyPairAss2 = await CryptHelper.RSAGenerateKeyPair();
      let userS = await Assistito.createEach([
        {
          id: 1,
          nome: 'Mario',
          cognome: 'Rossi',
          codiceFiscale: 'RSSMRA01A01H501A',
          dataNascita: '2001-01-01',
          email: 'prova@prova.it',
          telefono: '3333333333',
          indirizzo: 'Via prova 1',
          publicKey: keyPairAss1.publicKey,
          privateKey: keyPairAss1.privateKey,
        },
        {
          id: 2,
          nome: 'Luca',
          cognome: 'Verdi',
          codiceFiscale: 'VRDLCA01A01H501A',
          dataNascita: '2001-01-01',
          email: 'prova2@prova.it',
          telefono: '3333333333',
          indirizzo: 'Via prova 2',
          publicKey: keyPairAss2.publicKey,
          privateKey: keyPairAss2.privateKey,
        }
      ]).fetch();



      walletData = await iota.getOrInitWallet();
      wallet = walletData.wallet;
      mainAccount = walletData.mainAccount;


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
    /*
      await manager.updateDatiOrganizzazioneToBlockchain(1);
      let data = await manager.getLastDatiOrganizzazioneFromBlockchain(1);
      await manager.updateDatiOrganizzazioneToBlockchain(2);
      let data2 = await manager.getLastDatiOrganizzazioneFromBlockchain(2);
      await manager.updateDatiStrutturaToBlockchain(1);
      let data3 = await manager.getLastDatiStrutturaFromBlockchain(1);
      await manager.updateDatiStrutturaToBlockchain(2);
      let data4 = await manager.getLastDatiStrutturaFromBlockchain(2);
    */


    await manager.aggiungiAssistitoInLista(1,1);
    await manager.aggiungiAssistitoInLista(2,2);
    await manager.aggiungiAssistitoInLista(1,1);
    await manager.aggiungiAssistitoInLista(1,2);
    /*  await AssistitiListe.create({
        assistito: 2,
        lista: 1,
        stato: INSERITO_IN_CODA,
      });

      await AssistitiListe.create({
        assistito: 1,
        lista: 1,
        stato: INSERITO_IN_CODA,
      });*/




    return;

  }


};
