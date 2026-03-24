const fs = require('fs');
const path = require('path');
const iota = require('../../utility/iota');

module.exports = {

  friendlyName: 'Reset wallet',

  description: 'Distrugge il wallet corrente e ne crea uno nuovo. Operazione irreversibile.',

  inputs: {},

  exits: {},

  fn: async function () {
    try {
      sails.log.warn('[reset-wallet] Reset wallet richiesto!');

      // 1. Rimuovi il mnemonic dal config
      const configPath = path.resolve(__dirname, '../../../config/private_iota_conf.js');
      let content = fs.readFileSync(configPath, 'utf8');
      // Sostituisci il mnemonic con null
      content = content.replace(
        /IOTA_MNEMONIC:\s*'[^']*'/,
        "IOTA_MNEMONIC: null"
      );
      fs.writeFileSync(configPath, content, 'utf8');
      sails.log.info('[reset-wallet] Mnemonic rimosso dal config');

      // 2. Svuota il DB locale (cache)
      if (sails.models.blockchaindata) {
        await sails.models.blockchaindata.destroy({});
        sails.log.info('[reset-wallet] BlockchainData svuotato');
      }
      await Organizzazione.destroy({});
      await Struttura.destroy({});
      await Lista.destroy({});
      await Assistito.destroy({});
      await AssistitiListe.destroy({});
      sails.log.info('[reset-wallet] DB locale svuotato');

      // 3. Reset stato runtime di iota.js
      iota._resetRuntime();

      // 4. Inizializza nuovo wallet
      const result = await iota.getOrInitWallet();
      sails.log.info('[reset-wallet] Nuovo wallet creato: ' + result.address);

      return {
        success: true,
        mnemonic: result.mnemonic,
        address: result.address,
      };
    } catch (err) {
      sails.log.error('[reset-wallet] Errore:', err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

};
