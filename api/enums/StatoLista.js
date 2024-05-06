class StatoLista {
  static get IN_CODA() {
    return 1;
  }
  static get IN_ASSISTENZA() {
    return 2;
  }
  static get COMPLETATO() {
    return 3;
  }
  static get RIMOSSO() {
    return 4;
  }
  static get ANNULLATO() {
    return 5;
  }
}

module.exports = StatoLista;
