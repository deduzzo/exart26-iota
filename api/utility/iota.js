const {CoinType, Utils, Wallet,Client} = require('@iota/sdk');

const IOTA_WALLET_DB_PATH = sails.config.custom.IOTA_WALLET_DB_PATH;
const IOTA_NODE_URL = sails.config.custom.IOTA_NODE_URL;
const STRONGHOLD_PASSWORD = sails.config.custom.IOTA_STRONGHOLD_PASSWORD;
const STRONGHOLD_SNAPSHOT_PATH = sails.config.custom.IOTA_STRONGHOLD_SNAPSHOT_PATH;
const IOTA_MAIN_ACCOUNT_ALIAS = sails.config.custom.IOTA_MAIN_ACCOUNT_ALIAS;
const IOTA_SUB_ACCOUNT_ALIAS = sails.config.custom.IOTA_SUB_ACCOUNT_ALIAS;
const IOTA_EXPLORER_URL = sails.config.custom.IOTA_EXPLORER_URL;


let stringToHex = (text) => {
  return '0x' + Buffer.from(text).toString('hex');
};

let _getWalletOptions = () => {
  return {
    storagePath: IOTA_WALLET_DB_PATH,
    clientOptions: {
      nodes: [IOTA_NODE_URL],
    },
    coinType: CoinType.Shimmer,
    secretManager: {
      stronghold: {
        snapshotPath: STRONGHOLD_SNAPSHOT_PATH,
        password: STRONGHOLD_PASSWORD,
      },
    },
  };
};

let _initWallet = async (wallet) => {
  const mnemonic = Utils.generateMnemonic();
  await wallet.storeMnemonic(mnemonic);
  await wallet.createAccount({
    alias: IOTA_MAIN_ACCOUNT_ALIAS,
  });
  return mnemonic;
};

let getFirstAddressOfAnAccount = async (account) => {
  return (await account.addresses())[0].address;
};

let getAccountBalance = async (account) => {
  let balance = await account.getBalance();
  return balance;
};

let getOrCreateWalletAccount = async (wallet, accountAlias) => {
  let account = null;
  try {
    account = await wallet.getAccount(accountAlias);
    // eslint-disable-next-line no-unused-vars
  } catch (ex) {
    account = await wallet.createAccount({
      alias: accountAlias,
    });
  }
  return account;
};

let getOrInitWallet = async () => {
  let init = false;
  let mnemonic = '';
  let wallet = new Wallet(_getWalletOptions());
  let mainAccount = null;
  let subAccount = null;
  try {
    mainAccount = await wallet.getAccount(IOTA_MAIN_ACCOUNT_ALIAS);
    subAccount = await wallet.getAccount(IOTA_SUB_ACCOUNT_ALIAS);
  }
    // eslint-disable-next-line no-unused-vars
  catch (ex) {
    mnemonic = await _initWallet(wallet);
    mainAccount = await getOrCreateWalletAccount(wallet, IOTA_MAIN_ACCOUNT_ALIAS);
    subAccount = await getOrCreateWalletAccount(wallet, IOTA_SUB_ACCOUNT_ALIAS);
    init = true;
  }
  return {wallet: wallet, init: init, mnemonic: mnemonic, mainAccount: mainAccount, subAccount: subAccount};

};

let makeTransactionWithText = async (wallet, account, destAddr, tag, dataObject,nota = '') => {
  await account.sync();

  // To sign a transaction we need to unlock stronghold.
  await wallet.setStrongholdPassword(STRONGHOLD_PASSWORD);
  const amount = BigInt(1000000);

  const transactionDataJson = JSON.stringify(dataObject);

  const transactionOptions = {
    taggedDataPayload: {
      type: 6,
      tag: stringToHex(tag),
      data: stringToHex(transactionDataJson)
    },
    note: nota,
    allowMicroAmount: true
  };

  let response;
  try {
    response = await account.send(amount, destAddr, transactionOptions);
  } catch (e) {
    console.log(e);
    return null;
  }
  console.log(`Block sent: ${IOTA_EXPLORER_URL}/block/${response.blockId}`);
};

let getAllTransactionOfAccountWithTag = async (account, tag) => {
  await account.sync();
  let transactions = await account.transactions();
  return transactions.filter(t => t.payload.essence.payload.tag === stringToHex(tag));
};

/*let findTransactionObjects = async (ofAddress, tag) => {
  const client = new Client({
    nodes: [IOTA_NODE_URL]
  });
  try {
    const outputidsResponse = await client.basicOutputIds([
      //{address: ofAddress},
      {tag: stringToHex(tag)},
      /!*           { hasExpiration: true },
                  { hasTimelock: true },
                  { hasStorageDepositReturn: true },*!/
      //{tag: stringToHex(tag)}
    ]);
    const outputs = await client.getOutputs(outputidsResponse.items);
    console.log(outputidsResponse);
  } catch (e) {
    console.log(e);
  }
};*/

let getAllOutputs = async (account) => {
  let outputs = await account.outputs();
  return outputs;
};




module.exports = {
  stringToHex,
  getOrInitWallet,
  getOrCreateWalletAccount,
  getFirstAddressOfAnAccount,
  getAccountBalance,
  makeTransactionWithText,
  getAllTransactionOfAccountWithTag,
  getAllOutputs,
  IOTA_MAIN_ACCOUNT_ALIAS: IOTA_MAIN_ACCOUNT_ALIAS,
};

