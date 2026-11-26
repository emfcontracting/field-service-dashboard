// lib/invoiceRecipient.js
// -----------------------------------------------------------------------------
// Who a subcontractor invoice is addressed to. EMF unless the sub wrote it to
// another client (client_type 'other', client_* columns). Used by the PDF, the
// portal preview, and the submit mail.
// -----------------------------------------------------------------------------
export const EMF_RECIPIENT = {
  name: 'EMF Contracting LLC',
  lines: ['565 Pine Plain Rd', 'Gaston, SC 29075'],
  email: 'emfcontractingsc2@gmail.com',
  isEmf: true,
};

export function invoiceRecipient(invoice) {
  if (invoice?.client_type !== 'other') return EMF_RECIPIENT;
  const cityLine = [invoice.client_city, [invoice.client_state, invoice.client_zip].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
  return {
    name: invoice.client_name || 'Client',
    lines: [invoice.client_address, cityLine].filter(Boolean),
    email: invoice.client_email || '',
    isEmf: false,
  };
}
