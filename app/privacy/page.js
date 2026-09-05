export const metadata = { title: 'Privacy Policy — PCS FieldService' };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6, color: '#1f2937' }}>
      <h1>Privacy Policy</h1>
      <p><em>Last updated: September 5, 2026</em></p>
      <p>
        PCS FieldService ("the Service") is a field service management application operated by PCS LLC
        and used internally by EMF Contracting LLC and its authorized staff and technicians.
      </p>
      <h2>Data we process</h2>
      <p>
        The Service stores work order, scheduling, invoicing, and payment-status data belonging to the
        contracting business that operates it. When connected to QuickBooks Online, the Service reads
        invoice and payment records from the connected QuickBooks company solely to display and reconcile
        payment status inside the Service. QuickBooks data is not sold, shared with third parties, or used
        for any purpose other than operating the Service for the connected business.
      </p>
      <h2>Storage and security</h2>
      <p>
        Data is stored in access-controlled databases. OAuth tokens for connected services are stored
        server-side and are never exposed to end users. Access to the Service requires authentication.
      </p>
      <h2>Data retention and disconnection</h2>
      <p>
        The QuickBooks connection can be revoked at any time from within the Service or from the Intuit
        account settings. Upon disconnection, stored OAuth tokens are deleted.
      </p>
      <h2>Contact</h2>
      <p>Questions about this policy: support@pcstext.com</p>
    </div>
  );
}
