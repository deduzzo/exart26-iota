const {CoinType, Utils, Wallet, Client} = require('@iota/sdk');

const IOTA_WALLET_DB_PATH = sails.config.custom.IOTA_WALLET_DB_PATH;
const IOTA_NODE_URL = sails.config.custom.IOTA_NODE_URL;
const STRONGHOLD_PASSWORD = sails.config.custom.IOTA_STRONGHOLD_PASSWORD;
const STRONGHOLD_SNAPSHOT_PATH = sails.config.custom.IOTA_STRONGHOLD_SNAPSHOT_PATH;
const MAIN_ACCOUNT_ALIAS = sails.config.custom.IOTA_MAIN_ACCOUNT_ALIAS;
const IOTA_EXPLORER_URL = sails.config.custom.IOTA_EXPLORER_URL;
const TRANSACTION_VALUE = BigInt(100000);
const ACCOUNT_BASE_BALANCE = BigInt(500000);
const TRANSACTION_ZERO_VALUE = BigInt(0);


let stringToHex = (text) => {
  return '0x' + Buffer.from(text).toString('hex');
};

let hexToString = (hex) => {
  return Buffer.from(hex.replace('0x', ''), 'hex').toString();
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
    alias: MAIN_ACCOUNT_ALIAS,
  });
  return mnemonic;
};

let getFirstAddressOfAnAccount = async (account) => {
  return (await account.addresses())[0].address;
};

let getMainAccount = async (wallet) => {
  return await wallet.getAccount(MAIN_ACCOUNT_ALIAS);
};

let getAccountBalance = async (account) => {
  return await account.sync();
};

let waitUntilBalanceIsGreaterThanZero = async (account) => {
  let balance = await getAccountBalance(account);
  while (balance.baseCoin.available === TRANSACTION_ZERO_VALUE) {
    console.log('Waiting for balance to be greater than zero');
    await new Promise(resolve => setTimeout(resolve, 5000));
    balance = await getAccountBalance(account);
  }
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
    if (accountAlias !== MAIN_ACCOUNT_ALIAS) {
      let mainAccount = await getMainAccount(wallet);
      let mainAccountBalanceBefore = await getAccountBalance(mainAccount);
      await mainAccount.send(ACCOUNT_BASE_BALANCE, await getFirstAddressOfAnAccount(account));
      console.log('MAIN BALANCE: ' + mainAccountBalanceBefore.baseCoin.available);
      await waitUntilBalanceIsGreaterThanZero(account);
    }
  }
  return account;
};

let getOrInitWallet = async () => {
  let init = false;
  let mnemonic = '';
  let wallet = new Wallet(_getWalletOptions());
  let mainAccount = null;
  try {
    mainAccount = await wallet.getAccount(MAIN_ACCOUNT_ALIAS);
  }
    // eslint-disable-next-line no-unused-vars
  catch (ex) {
    mnemonic = await _initWallet(wallet);
    mainAccount = await getOrCreateWalletAccount(wallet, MAIN_ACCOUNT_ALIAS);
    init = true;
  }
  console.log('MainAddress: ' + (await getFirstAddressOfAnAccount(mainAccount)));
  await waitUntilBalanceIsGreaterThanZero(mainAccount);
  return {wallet: wallet, init: init, mnemonic: mnemonic, mainAccount: mainAccount};

};

let makeTransactionWithText = async (wallet, account, destAddr, tag, dataObject, nota = '') => {

  let balance = await getAccountBalance(account);
  // To sign a transaction we need to unlock stronghold.
  await wallet.setStrongholdPassword(STRONGHOLD_PASSWORD);

  const amount = TRANSACTION_VALUE;

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
    console.log(`Block sent: ${IOTA_EXPLORER_URL}/block/${response.blockId}`);
    return {success: true, blockId: response.blockId,error: null};
  } catch (e) {
    console.error(e);
    return {success: false, error: e};
  }
};

let getAllTransactionOfAccountWithTag = async (account, tag) => {
  await account.sync();
  let transactions = await account.transactions();
  transactions = transactions.filter(t => t.payload.essence.payload.tag === stringToHex(tag));
  // ordered by timestamp
  transactions = transactions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  return transactions;
};

let getLastTransactionOfAccountWithTag = async (account, tag) => {
  let transactions = await getAllTransactionOfAccountWithTag(account, tag);
  return transactions[0];
};

let getAllIncomingTransactionOfAccountWithTag = async (account, tag) => {
  await account.sync();
  let transactions = await account.incomingTransactions();
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
  hexToString,
  getOrInitWallet,
  getOrCreateWalletAccount,
  getFirstAddressOfAnAccount,
  getAccountBalance,
  makeTransactionWithText,
  getAllTransactionOfAccountWithTag,
  getLastTransactionOfAccountWithTag,
  getAllIncomingTransactionOfAccountWithTag,
  getAllOutputs,
  waitUntilBalanceIsGreaterThanZero,
  MAIN_ACCOUNT_ALIAS: MAIN_ACCOUNT_ALIAS,
};

