class StatoLista {
  static get INSERITO_IN_CODA() {
    return 1;
  }
  static get RIMOSSO_IN_ASSISTENZA() {
    return 2;
  }
  static get RIMOSSO_COMPLETATO() {
    return 3;
  }
  static get RIMOSSO_CAMBIO_LISTA() {
    return 4;
  }
  static get RIMOSSO_RINUNCIA() {
    return 5;
  }
  static get RIMOSSO_ANNULLATO() {
    return 6;
  }
}

module.exports = StatoLista;
