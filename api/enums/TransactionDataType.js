class TransactionDataType {
  static get MAIN_DATA() {
    return 'MAIN_DATA';
  }
  static get BALANCE_DISTRIBUTE() {
    return 'BALANCE_DISTRIBUTE';
  }
  static get ORGANIZZAZIONE_DATA() {
    return 'ORGANIZZAZIONE_DATA';
  }
  static get DATI_SENSIBILI() {
    return 'DATI_SENSIBILI';
  }
  static get PRIVATE_KEY() {
    return 'PRIVATE_KEY';
  }
  static get STRUTTURE_LISTE_DATA() {
    return 'STRUTTURE_LISTE_DATA';
  }
  static get LISTE_IN_CODA() {
    return 'LISTE_IN_CODA';
  }
  static get ASSISTITI_IN_LISTA() {
    return 'ASSISTITI_IN_LISTA';
  }
  static get MOVIMENTI_ASSISTITI_LISTA() {
    return 'MOVIMENTI_ASSISTITI_LISTA';
  }
}

module.exports = TransactionDataType;
