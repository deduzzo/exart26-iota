const {CoinType, Utils, Wallet, Client} = require('@iota/sdk');

const {
  IOTA_WALLET_DB_PATH,
  IOTA_NODE_URL,
  IOTA_EXPLORER_URL,
  IOTA_STRONGHOLD_SNAPSHOT_PATH,
  IOTA_STRONGHOLD_PASSWORD,
  IOTA_MAIN_ACCOUNT_ALIAS,
  TRANSACTION_VALUE,
  ACCOUNT_BASE_BALANCE,
  TRANSACTION_ZERO_VALUE,
  COIN_TYPE,
  MAIN_PRIVATE_KEY,
  MAIN_PUBLIC_KEY,
} = require('../../config/private_iota_conf');

let _wallet = null;

const ASSISTITO_ACCOUNT_PREFIX = 'ASS#';

const COIN_NAME_MAP = {
  Shimmer: {token: 'SMR', base: 'glow'},
  IOTA: {token: 'IOTA', base: 'glow'}
};

const _coinTypeNames = {
  [CoinType.Shimmer]: 'Shimmer',
  [CoinType.IOTA]: 'IOTA'
};

const GET_MAIN_KEYS = () => {
  return {privateKey: MAIN_PRIVATE_KEY, publicKey: MAIN_PUBLIC_KEY};
};

let _getCoinName = () => {
  return COIN_NAME_MAP[_coinTypeNames[COIN_TYPE]];
};

let _getWalletOptions = () => {
  return {
    storagePath: IOTA_WALLET_DB_PATH,
    clientOptions: {
      nodes: [IOTA_NODE_URL],
    },
    coinType: COIN_TYPE,
    secretManager: {
      stronghold: {
        snapshotPath: IOTA_STRONGHOLD_SNAPSHOT_PATH,
        password: IOTA_STRONGHOLD_PASSWORD,
      },
    },
  };
};

let getWallet = () => {
  if (!_wallet) {
    _wallet = new Wallet(_getWalletOptions());
  }
  return _wallet;
};

let stringToHex = (text) => {
  return '0x' + Buffer.from(text).toString('hex');
};

let hexToString = (hex) => {
  return Buffer.from(hex.replace('0x', ''), 'hex').toString();
};


let _initWallet = async () => {
  const mnemonic = Utils.generateMnemonic();
  await getWallet().storeMnemonic(mnemonic);
  await getWallet().createAccount({
    alias: IOTA_MAIN_ACCOUNT_ALIAS,
  });
  return mnemonic;
};

let getFirstAddressOfAnAccount = async (account) => {
  return (await account.addresses())[0].address;
};

let getMainAccount = async () => {
  return await getWallet().getAccount(IOTA_MAIN_ACCOUNT_ALIAS);
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

let getAllWalletAccountsMatching = async (predicate) => {
  let accounts = await getWallet().getAccounts();
  accounts = accounts.filter(a => a.meta.alias.includes(predicate));
  return accounts;
};

let getOrCreateWalletAccount = async (accountAlias) => {
  let account = null;
  let accounts = await getWallet().getAccounts();
  try {
    account = accounts.find(a => a.meta.alias === accountAlias);
    if (!account) {
      account = await getWallet().createAccount({
        alias: accountAlias,
      });
    }
    //account = await getWallet().getAccount(accountAlias.toString());
    // eslint-disable-next-line no-unused-vars
  } catch (ex) {
    console.log(ex);
  }
  let balance = await getAccountBalance(account);
  if (balance.baseCoin.available < ACCOUNT_BASE_BALANCE && accountAlias !== IOTA_MAIN_ACCOUNT_ALIAS) {
    let mainAccount = await getMainAccount();
    let mainAccountBalanceBefore = await getAccountBalance(mainAccount);
    await mainAccount.send(ACCOUNT_BASE_BALANCE, await getFirstAddressOfAnAccount(account));
    console.log('MAIN BALANCE: ' + mainAccountBalanceBefore.baseCoin.available);
    await waitUntilBalanceIsGreaterThanZero(account);
  }
  return account;
};

let getOrInitWallet = async (waitForBalance = true) => {
  let init = false;
  let mnemonic = '';
  let mainAccount = null;
  try {
    mainAccount = await getWallet().getAccount(IOTA_MAIN_ACCOUNT_ALIAS);
  }
    // eslint-disable-next-line no-unused-vars
  catch (ex) {
    mnemonic = await _initWallet();
    mainAccount = await getOrCreateWalletAccount(IOTA_MAIN_ACCOUNT_ALIAS);
    init = true;
  }
  console.log('MainAddress: ' + (await getFirstAddressOfAnAccount(mainAccount)));
  if (waitForBalance) {
    await waitUntilBalanceIsGreaterThanZero(mainAccount);
  }
  if (init) {
    return {init: init, mnemonic: mnemonic, mainAccount: mainAccount};
  }

};

let isWalletInitialized = async () => {
  try {
    await getWallet().getAccount(IOTA_MAIN_ACCOUNT_ALIAS);
    return true;
  } catch (ex) {
    return false;
  }
};


let _formatBalance = (longInt) => {
  // ritorna il valore con il punto nelle migliaia
  return longInt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

let showBalanceFormatted = (balance) => {
  let coinName = _getCoinName();

  let mainValue = balance / BigInt(1000000);
  return _formatBalance(balance) + ' ' + coinName.base + ' [' + _formatBalance(mainValue) + ' ' + coinName.token + ']';
};


let getStatusAndBalance = async () => {
  if (!await isWalletInitialized()) {
    return {status: 'WALLET non inizializzato', balance: BigInt(0)};
  }
  let mainAccount = await getMainAccount();
  let mainAddress = await getFirstAddressOfAnAccount(mainAccount);
  let balance = await getAccountBalance(mainAccount);
  return {
    status: 'WALLET OK',
    balance: showBalanceFormatted(balance.baseCoin.available),
    address: mainAddress
  };
};

let makeTransactionWithText = async (account, destAddr, tag, dataObject, nota = '') => {

  let balance = await getAccountBalance(account);
  // To sign a transaction we need to unlock stronghold.
  await getWallet().setStrongholdPassword(IOTA_STRONGHOLD_PASSWORD);

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
    let url = IOTA_EXPLORER_URL + '/block/' + response.blockId;
    console.log(`Block sent: ${IOTA_EXPLORER_URL}/block/${response.blockId}`);
    return {success: true, blockId: response.blockId, url: url, transactionId: response.transactionId, error: null};
  } catch (e) {
    console.error(e);
    return {success: false, error: e};
  }
};

let getAllTransactionOfAccountWithTag = async (account, tag) => {
  await account.sync();
  let transactions = await account.transactions();
  transactions = transactions.filter(t => t.payload.essence.payload !== undefined && t.payload.essence.payload.tag === stringToHex(tag));
  // ordered by timestamp
  transactions = transactions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  return transactions;
};

let getLastTransactionOfAccountWithTag = async (account, tag) => {
  let transactions = await getAllTransactionOfAccountWithTag(account, tag);
  return transactions.length > 0 ? transactions[0] : null;
};

let getAllIncomingTransactionOfAccountWithTag = async (account, tag) => {
  await account.sync();
  let transactions = await account.incomingTransactions();
  return transactions.filter(t => t.payload.essence.payload.tag === stringToHex(tag));
};

let getTransactionByAccountNameAndId = async (accountAlias, transactionId) => {
  let account = await getOrCreateWalletAccount(accountAlias);
  if (account) {
    return await account.getTransaction(transactionId);
  }
  return null;
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
  getWallet,
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
  isWalletInitialized,
  getMainAccount,
  showBalanceFormatted,
  getStatusAndBalance,
  getTransactionByAccountNameAndId,
  getAllWalletAccountsMatching,
  MAIN_ACCOUNT_ALIAS: IOTA_MAIN_ACCOUNT_ALIAS,
  COIN_NAME_MAP,
  GET_MAIN_KEYS,
  ASSISTITO_ACCOUNT_PREFIX
};

