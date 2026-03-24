import { forwardRef } from 'react';

/**
 * Voucher stampabile per l'assistito.
 * Contiene dati personali + ID anonimo per verifica pubblica.
 * Progettato per stampa A5/mezza pagina.
 */
const VoucherPrint = forwardRef(({ assistito, liste = [] }, ref) => {
  if (!assistito) return null;

  return (
    <div ref={ref} className="voucher-print">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .voucher-print, .voucher-print * { visibility: visible !important; }
          .voucher-print {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 30px !important;
          }
        }
        .voucher-print {
          font-family: 'Segoe UI', system-ui, sans-serif;
          background: white;
          color: #1a1a2e;
          padding: 32px;
          max-width: 600px;
          margin: 0 auto;
        }
        .voucher-print .header {
          text-align: center;
          border-bottom: 2px solid #06b6d4;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .voucher-print .header h1 {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0;
        }
        .voucher-print .header p {
          font-size: 12px;
          color: #666;
          margin: 4px 0 0;
        }
        .voucher-print .anon-box {
          background: #f0fdfa;
          border: 2px dashed #06b6d4;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          margin: 20px 0;
        }
        .voucher-print .anon-box .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #666;
          margin-bottom: 8px;
        }
        .voucher-print .anon-box .id {
          font-size: 36px;
          font-weight: 800;
          font-family: 'Courier New', monospace;
          letter-spacing: 6px;
          color: #0891b2;
        }
        .voucher-print .anon-box .note {
          font-size: 10px;
          color: #999;
          margin-top: 8px;
        }
        .voucher-print .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 16px 0;
        }
        .voucher-print .info-item .label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          margin-bottom: 2px;
        }
        .voucher-print .info-item .value {
          font-size: 14px;
          color: #1a1a2e;
          font-weight: 500;
        }
        .voucher-print .liste-section {
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
          margin-top: 16px;
        }
        .voucher-print .liste-section h3 {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666;
          margin-bottom: 8px;
        }
        .voucher-print .lista-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 6px;
          font-size: 13px;
        }
        .voucher-print .footer {
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
          margin-top: 20px;
          text-align: center;
          font-size: 10px;
          color: #999;
        }
        .voucher-print .footer .url {
          color: #0891b2;
          font-weight: 600;
        }
      `}</style>

      <div className="header">
        <h1>ExArt26 IOTA - Voucher Assistito</h1>
        <p>Gestione Liste d'Attesa Riabilitazione Sanitaria (Ex Art. 26)</p>
      </div>

      <div className="anon-box">
        <div className="label">Il tuo ID Anonimo</div>
        <div className="id">{assistito.anonId || '--------'}</div>
        <div className="note">Usa questo codice per verificare la tua posizione nelle liste d'attesa</div>
      </div>

      <div className="info-grid">
        <div className="info-item">
          <div className="label">Nome</div>
          <div className="value">{assistito.nome}</div>
        </div>
        <div className="info-item">
          <div className="label">Cognome</div>
          <div className="value">{assistito.cognome}</div>
        </div>
        <div className="info-item">
          <div className="label">Codice Fiscale</div>
          <div className="value" style={{fontFamily: 'monospace'}}>{assistito.codiceFiscale}</div>
        </div>
        <div className="info-item">
          <div className="label">Data Registrazione</div>
          <div className="value">{new Date().toLocaleDateString('it-IT')}</div>
        </div>
        {assistito.email && (
          <div className="info-item">
            <div className="label">Email</div>
            <div className="value">{assistito.email}</div>
          </div>
        )}
        {assistito.telefono && (
          <div className="info-item">
            <div className="label">Telefono</div>
            <div className="value">{assistito.telefono}</div>
          </div>
        )}
      </div>

      {liste.length > 0 && (
        <div className="liste-section">
          <h3>Liste d'Attesa Assegnate</h3>
          {liste.map((l, i) => (
            <div key={i} className="lista-item">
              <span>{l.listaNome || `Lista #${l.listaId}`}</span>
              <span style={{color: '#0891b2', fontWeight: 600}}>
                {l.posizione ? `Posizione #${l.posizione}` : 'In coda'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="footer">
        <p>Per verificare la tua posizione visita la pagina pubblica:</p>
        <p className="url">{window.location.origin}/pubblico</p>
        <p style={{marginTop: 8}}>Dati verificabili sulla blockchain IOTA 2.0 - Immutabili e trasparenti</p>
        <p style={{marginTop: 4}}>Documento generato il {new Date().toLocaleString('it-IT')}</p>
      </div>
    </div>
  );
});

VoucherPrint.displayName = 'VoucherPrint';
export default VoucherPrint;
