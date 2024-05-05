const iotaUtils = require('../utility/iota');
const {Wallet} = require('@iota/sdk');
const CryptHelper = require('../utility/CryptHelper');
module.exports = {


  friendlyName: 'Wallet',


  description: 'Wallet something.',


  inputs: {},


  exits: {
    success: {
      responseType: 'ok'
    },
    notFound: {
      responseType: 'notFound' // Questo usa lo status code HTTP 404
    }
  },

  fn: async function (inputs) {
    //const {wallet,init,mnemonic,mainAccount} = await iotaUtils.getOrInitWallet();

    //let subAccountName = "sub-account";
    //let subAccount = await iotaUtils.getOrCreateWalletAccount(wallet, subAccountName);
    //let transaction = await iotaUtils.makeTransactionWithText(wallet, mainAccount, await iotaUtils.getFirstAddressOfAnAccount(subAccount), "hello2", {message: "hello world",status:true});
    //let allTransactionTag = await iotaUtils.getAllTransactionOfAccountWithTag(mainAccount, "hello2");
    //let outputs = await iotaUtils.getAllOutputs(mainAccount);

    //let {publicKey, privateKey} = await CryptHelper.RSAGenerateKeyPair();
/*    let AESKey2 = CryptHelper.AESGenerateKey();
    let message = 'hello world';
    const iv = CryptHelper.generateIv();

    let encryptedAESKey = CryptHelper.RSAEncrypt(AESKey2, publicKey);
    let encryptedMessage = CryptHelper.AESEncrypt(message, AESKey, iv);
    let encryptedIv = CryptHelper.RSAEncrypt(iv, publicKey);
    let hmac = CryptHelper.generateHMAC(encryptedMessage, AESKey);
    let data = {
      message: encryptedMessage,
      key: CryptHelper.RSAEncrypt(AESKey, publicKey),
      iv: encryptedIv,
      version: 1
    };

    let decryptedAESKey = CryptHelper.RSADecrypt(encryptedAESKey, privateKey);
    let decryptedIv = CryptHelper.RSADecrypt(encryptedIv, privateKey);
    let decryptedMessage = CryptHelper.AESDecrypt(encryptedMessage, decryptedAESKey, decryptedIv);*/

    let {privateKey,publicKey, AESKey,data} = await CryptHelper.encryptAndSend('Hello, world!');
    let res2 = await CryptHelper.receiveAndDecrypt(data, privateKey);


    console.log(res2);



    return {};
  }


};
