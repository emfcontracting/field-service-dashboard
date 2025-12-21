'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function CBREInvoicingPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ready');
  const [workflowStep, setWorkflowStep] = useState(1);
  const [nteVerified, setNteVerified] = useState(false);
  const [photosRetrieved, setPhotosRetrieved] = useState(false);
  const [qbInvoiceCreated, setQbInvoiceCreated] = useState(false);
  const [vwasUploaded, setVwasUploaded] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCBREWorkOrders(),
      fetchCBREInvoices()
    ]);
    setLoading(false);
  };

  const fetchCBREWorkOrders = async () => {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name, email)
      `)
      .eq('acknowledged', true)
      .eq('is_locked', false)
      .or('client.eq.CBRE,client.eq.UPS,client.is.null')
      .order('acknowledged_at', { ascending: false });

    if (error) {
      console.error('Error fetching CBRE work orders:', error);
    } else {
      setWorkOrders(data || []);
    }
  };

  const fetchCBREInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(
          wo_number,
          building,
          work_order_description,
          vwas_wo_number,
          cbre_nte,
          client,
          lead_tech:users!lead_tech_id(first_name, last_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
  };

  const startWorkflow = (wo) => {
    setSelectedWO(wo);
    setWorkflowStep(1);
    setNteVerified(false);
    setPhotosRetrieved(false);
    setQbInvoiceCreated(false);
    setVwasUploaded(false);
  };

  const startInvoiceWorkflow = (invoice) => {
    setSelectedInvoice(invoice);
    setSelectedWO(null);
    
    if (invoice.cbre_status === 'paid' || invoice.status === 'synced') {
      setWorkflowStep(6);
      setNteVerified(true);
      setPhotosRetrieved(true);
      setQbInvoiceCreated(true);
      setVwasUploaded(true);
    } else if (invoice.vwas_submitted) {
      setWorkflowStep(6);
      setNteVerified(true);
      setPhotosRetrieved(true);
      setQbInvoiceCreated(true);
      setVwasUploaded(true);
    } else if (invoice.quickbooks_invoice_id) {
      setWorkflowStep(5);
      setNteVerified(true);
      setPhotosRetrieved(false);
      setQbInvoiceCreated(true);
      setVwasUploaded(false);
    } else if (invoice.status === 'approved') {
      setWorkflowStep(4);
      setNteVerified(true);
      setPhotosRetrieved(false);
      setQbInvoiceCreated(false);
      setVwasUploaded(false);
    } else {
      setWorkflowStep(3);
      setNteVerified(true);
      setPhotosRetrieved(false);
      setQbInvoiceCreated(false);
      setVwasUploaded(false);
    }
  };

  const updateInvoiceStatus = async (invoiceId, status, cbreStatus = null) => {
    const updates = { status };
    if (cbreStatus) {
      updates.cbre_status = cbreStatus;
    }

    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      await fetchData();
    }
  };

  const markVWASSubmitted = async (invoiceId) => {
    const { error } = await supabase
      .from('invoices')
      .update({
        vwas_submitted: true,
        vwas_submitted_at: new Date().toISOString(),
        cbre_status: 'submitted_to_vwas',
        status: 'accepted'
      })
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('Error updating VWAS status: ' + error.message);
    } else {
      alert('✅ Invoice marked as submitted to VWAS!');
      setVwasUploaded(true);
      setWorkflowStep(6);
      await fetchData();
    }
  };

  const closeWorkflow = () => {
    setSelectedWO(null);
    setSelectedInvoice(null);
    setWorkflowStep(1);
    setNteVerified(false);
    setPhotosRetrieved(false);
    setQbInvoiceCreated(false);
    setVwasUploaded(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-yellow-600';
      case 'approved': return 'bg-blue-600';
      case 'accepted': return 'bg-green-600';
      case 'synced': return 'bg-green-600'; // Legacy support
      case 'paid': return 'bg-green-600';
      case 'rejected': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  // Get display name for status
  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'draft': return 'DRAFT';
      case 'approved': return 'UPLOADED TO CBRE';
      case 'accepted': return 'ACCEPTED CBRE - SUBMITTED TO AP';
      case 'synced': return 'ACCEPTED CBRE - SUBMITTED TO AP'; // Legacy support
      case 'paid': return 'PAID';
      case 'rejected': return 'REJECTED';
      default: return status?.toUpperCase() || 'UNKNOWN';
    }
  };

  const WorkflowSteps = () => {
    const steps = [
      { num: 1, title: 'Open RFI Ticket', desc: 'EMF FSM - Preview & Generate' },
      { num: 2, title: 'Verify NTE', desc: 'Check VWAS Compliance' },
      { num: 3, title: 'Finalize in EMF', desc: 'Generate Invoice' },
      { num: 4, title: 'Create QB Invoice', desc: 'QuickBooks' },
      { num: 5, title: 'Upload to VWAS', desc: 'Invoice + Photos' },
      { num: 6, title: 'Update Status', desc: 'Mark Complete' }
    ];

    return (
      <div className="flex items-center justify-between mb-8 px-4">
        {steps.map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                ${workflowStep > step.num ? 'bg-green-600 text-white' : 
                  workflowStep === step.num ? 'bg-blue-600 text-white' : 
                  'bg-gray-700 text-gray-400'}`}>
                {workflowStep > step.num ? '✓' : step.num}
              </div>
              <div className="text-center mt-2">
                <div className={`text-xs font-semibold ${workflowStep >= step.num ? 'text-white' : 'text-gray-500'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-gray-500">{step.desc}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-1 mx-2 ${workflowStep > step.num ? 'bg-green-600' : 'bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const StepContent = () => {
    const wo = selectedWO;
    const invoice = selectedInvoice;
    const woNumber = wo?.wo_number || invoice?.work_order?.wo_number;
    const building = wo?.building || invoice?.work_order?.building;
    const vwasWO = wo?.vwas_wo_number || invoice?.work_order?.vwas_wo_number;

    switch (workflowStep) {
      case 1:
        return (
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Step 1: Open RFI Ticket in EMF FSM</h3>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-300 mb-4">
                  Navigate to the Ready for Invoice (RFI) page and click the ticket's "Generate Invoice" button.
                </p>
                <div className="flex gap-3">
                  <a
                    href="/invoices"
                    target="_blank"
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold inline-block"
                  >
                    📄 Open Invoicing Page
                  </a>
                </div>
              </div>
              
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">📋 Instructions:</div>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Go to the Invoicing page</li>
                  <li>Find WO #{woNumber} in the "Ready to Invoice" tab</li>
                  <li>Click "Generate Invoice" button</li>
                  <li>Click "Preview & Generate Invoice" to review</li>
                </ol>
              </div>

              <button
                onClick={() => setWorkflowStep(2)}
                className="w-full bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg font-bold text-lg"
              >
                ✅ Done - Continue to Step 2
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Step 2: Verify NTE Compliance in VWAS</h3>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-300 mb-4">
                  Open VWAS and verify the work order's NTE (Not-To-Exceed) amount.
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="text-gray-400 text-sm">EMF WO #</div>
                    <div className="font-bold text-lg">{woNumber}</div>
                  </div>
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="text-gray-400 text-sm">VWAS WO #</div>
                    <div className="font-bold text-lg">{vwasWO || 'Not Set'}</div>
                  </div>
                </div>

                <a
                  href="https://enterprise.serviceinsight.cbre.com/PRD40177VWS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold inline-block"
                >
                  🔗 Open VWAS
                </a>
              </div>

              <div className="bg-yellow-900 text-yellow-200 p-4 rounded-lg">
                <div className="font-bold mb-2">⚠️ NTE Check:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Confirm the invoice total does NOT exceed the NTE</li>
                  <li>If it exceeds, request NTE increase before proceeding</li>
                  <li>Document any scope changes if applicable</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 bg-gray-800 p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="nteVerified"
                  checked={nteVerified}
                  onChange={(e) => setNteVerified(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <label htmlFor="nteVerified" className="font-semibold">
                  I have verified the NTE in VWAS and the invoice is compliant
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setWorkflowStep(1)}
                  className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg font-semibold"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWorkflowStep(3)}
                  disabled={!nteVerified}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg font-bold text-lg"
                >
                  ✅ NTE Verified - Continue to Step 3
                </button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Step 3: Complete Ticket in EMF System</h3>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-300 mb-4">
                  Finalize the invoice in the EMF system by clicking "Finalize & Generate Invoice".
                </p>
                
                <a
                  href="/invoices"
                  target="_blank"
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold inline-block"
                >
                  📄 Open Invoicing Page
                </a>
              </div>

              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">📋 Instructions:</div>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Review all labor hours, materials, and notes</li>
                  <li>Make any necessary edits to line items</li>
                  <li>Click "Finalize & Generate Invoice"</li>
                  <li>Confirm the invoice is created</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setWorkflowStep(2)}
                  className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg font-semibold"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWorkflowStep(4)}
                  className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg font-bold text-lg"
                >
                  ✅ Invoice Generated - Continue to Step 4
                </button>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Step 4: Create Invoice in QuickBooks</h3>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-300 mb-4">
                  Create the invoice in QuickBooks with all billable labor, materials, and charges.
                </p>
                
                <div className="flex gap-3">
                  <a
                    href="https://qbo.intuit.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold inline-block"
                  >
                    💰 Open QuickBooks
                  </a>
                  
                  {invoice && (
                    <button
                      onClick={() => window.open(`/invoices/${invoice.invoice_id}/print`, '_blank')}
                      className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg font-semibold"
                    >
                      🖨️ View EMF Invoice
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">📋 Instructions:</div>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Open QuickBooks and create a new invoice</li>
                  <li>Include all billable labor, materials, and additional charges</li>
                  <li>Match the amounts from the EMF invoice</li>
                  <li>Save and export the invoice as a PDF</li>
                </ol>
              </div>

              <div className="flex items-center gap-3 bg-gray-800 p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="qbCreated"
                  checked={qbInvoiceCreated}
                  onChange={(e) => setQbInvoiceCreated(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <label htmlFor="qbCreated" className="font-semibold">
                  I have created the invoice in QuickBooks and saved the PDF
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setWorkflowStep(3)}
                  className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg font-semibold"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (invoice) {
                      updateInvoiceStatus(invoice.invoice_id, 'approved');
                    }
                    setWorkflowStep(5);
                  }}
                  disabled={!qbInvoiceCreated}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg font-bold text-lg"
                >
                  ✅ QB Invoice Created - Continue to Step 5
                </button>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Step 5: Upload Invoice & Photos to VWAS</h3>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-300 mb-4">
                  Upload the QuickBooks invoice PDF and job photos to VWAS.
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://enterprise.serviceinsight.cbre.com/PRD40177VWS"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold inline-block"
                  >
                    🔗 Open VWAS
                  </a>
                  
                  <a
                    href={`https://mail.google.com/mail/u/0/#search/in:anywhere+${woNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold inline-block"
                  >
                    📧 Open Gmail (emfcbre@gmail.com)
                  </a>
                </div>
              </div>

              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">📋 Instructions:</div>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Open VWAS and find the work order</li>
                  <li>Attach the QuickBooks invoice PDF</li>
                  <li>Open Gmail (emfcbre@gmail.com) and find the job photos</li>
                  <li>Download photos and upload them to VWAS</li>
                  <li>Submit the invoice through VWAS to CBRE</li>
                </ol>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-gray-800 p-4 rounded-lg">
                  <input
                    type="checkbox"
                    id="photosRetrieved"
                    checked={photosRetrieved}
                    onChange={(e) => setPhotosRetrieved(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <label htmlFor="photosRetrieved" className="font-semibold">
                    I have retrieved the photos from emfcbre@gmail.com
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-gray-800 p-4 rounded-lg">
                  <input
                    type="checkbox"
                    id="vwasUploaded"
                    checked={vwasUploaded}
                    onChange={(e) => setVwasUploaded(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <label htmlFor="vwasUploaded" className="font-semibold">
                    I have uploaded the invoice and photos to VWAS
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setWorkflowStep(4)}
                  className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg font-semibold"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (invoice) {
                      markVWASSubmitted(invoice.invoice_id);
                    } else {
                      setWorkflowStep(6);
                    }
                  }}
                  disabled={!photosRetrieved || !vwasUploaded}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg font-bold text-lg"
                >
                  ✅ Uploaded to VWAS - Continue to Step 6
                </button>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="bg-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Step 6: Update EMF System Status</h3>
            <div className="space-y-4">
              <div className="bg-green-900 text-green-200 p-6 rounded-lg text-center">
                <div className="text-4xl mb-3">🎉</div>
                <div className="font-bold text-xl mb-2">Workflow Complete!</div>
                <p>The invoice has been submitted to VWAS for processing.</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-bold mb-3">Status Progression:</h4>
                <div className="flex items-center justify-center gap-4">
                  <span className="bg-yellow-600 px-4 py-2 rounded-lg font-semibold">Draft</span>
                  <span className="text-gray-400">→</span>
                  <span className="bg-blue-600 px-4 py-2 rounded-lg font-semibold">Approved</span>
                  <span className="text-gray-400">→</span>
                  <span className="bg-green-600 px-4 py-2 rounded-lg font-semibold">Synced</span>
                </div>
              </div>

              {invoice && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-bold mb-3">Invoice Details:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Invoice #:</span>
                      <span className="ml-2 font-semibold">{invoice.invoice_number}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total:</span>
                      <span className="ml-2 font-bold text-green-400">${invoice.total?.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                        {invoice.status?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">VWAS:</span>
                      <span className="ml-2">
                        {invoice.vwas_submitted ? '✅ Submitted' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={closeWorkflow}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg font-bold text-lg"
              >
                ✅ Done - Return to List
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading CBRE invoicing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">🏢 CBRE Invoicing Workflow</h1>
            <p className="text-gray-400 mt-1">Step-by-step process for CBRE/VWAS invoice submission</p>
          </div>
          <div className="flex gap-3">
            <a
              href="/invoices"
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              📄 Standard Invoicing
            </a>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Active Workflow */}
        {(selectedWO || selectedInvoice) ? (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">
                  WO #{selectedWO?.wo_number || selectedInvoice?.work_order?.wo_number}
                </h2>
                <p className="text-gray-400">
                  {selectedWO?.building || selectedInvoice?.work_order?.building}
                </p>
              </div>
              <button
                onClick={closeWorkflow}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <WorkflowSteps />
            <StepContent />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-700 flex-wrap">
              <button
                onClick={() => setActiveTab('ready')}
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === 'ready'
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Ready for Invoice ({workOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('in-progress')}
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === 'in-progress'
                    ? 'text-yellow-400 border-b-2 border-yellow-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                In Progress ({invoices.filter(i => i.status === 'draft' || i.status === 'approved').length})
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === 'rejected'
                    ? 'text-red-400 border-b-2 border-red-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Rejected ({invoices.filter(i => i.status === 'rejected').length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === 'completed'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Submitted to VWAS ({invoices.filter(i => i.vwas_submitted).length})
              </button>
            </div>

            {/* Content */}
            {activeTab === 'ready' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Work Orders Ready for CBRE Invoicing</h2>
                
                {workOrders.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No work orders ready for invoicing.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left">WO #</th>
                          <th className="px-4 py-3 text-left">Building</th>
                          <th className="px-4 py-3 text-left">VWAS WO #</th>
                          <th className="px-4 py-3 text-left">Lead Tech</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workOrders.map(wo => (
                          <tr
                            key={wo.wo_id}
                            className="border-t border-gray-700 hover:bg-gray-700 transition"
                          >
                            <td className="px-4 py-3 font-semibold">{wo.wo_number}</td>
                            <td className="px-4 py-3">{wo.building}</td>
                            <td className="px-4 py-3 text-gray-400">{wo.vwas_wo_number || '—'}</td>
                            <td className="px-4 py-3">
                              {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => startWorkflow(wo)}
                                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
                              >
                                Start Workflow →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'in-progress' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Invoices In Progress</h2>
                
                {invoices.filter(i => i.status === 'draft' || i.status === 'approved').length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No invoices in progress.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left">Invoice #</th>
                          <th className="px-4 py-3 text-left">WO #</th>
                          <th className="px-4 py-3 text-left">Building</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices
                          .filter(i => i.status === 'draft' || i.status === 'approved')
                          .map(invoice => (
                            <tr
                              key={invoice.invoice_id}
                              className="border-t border-gray-700 hover:bg-gray-700 transition"
                            >
                              <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                              <td className="px-4 py-3">{invoice.work_order?.wo_number}</td>
                              <td className="px-4 py-3">{invoice.work_order?.building}</td>
                              <td className="px-4 py-3 text-right font-bold text-green-400">
                                ${invoice.total?.toFixed(2)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                                  {getStatusDisplayName(invoice.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => startInvoiceWorkflow(invoice)}
                                  className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm font-semibold"
                                >
                                  Continue →
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rejected' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-red-400">❌ Rejected Invoices</h2>
                
                {invoices.filter(i => i.status === 'rejected').length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No rejected invoices. 🎉
                  </div>
                ) : (
                  <>
                    <div className="bg-red-900 text-red-200 p-4 rounded-lg mb-4">
                      <div className="font-bold mb-1">These invoices were rejected by CBRE</div>
                      <p className="text-sm">Click "Return to Draft" to make corrections and resubmit.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left">Invoice #</th>
                            <th className="px-4 py-3 text-left">WO #</th>
                            <th className="px-4 py-3 text-left">Building</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices
                            .filter(i => i.status === 'rejected')
                            .map(invoice => (
                              <tr
                                key={invoice.invoice_id}
                                className="border-t border-gray-700 hover:bg-gray-700 transition"
                              >
                                <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                                <td className="px-4 py-3">{invoice.work_order?.wo_number}</td>
                                <td className="px-4 py-3">{invoice.work_order?.building}</td>
                                <td className="px-4 py-3 text-right font-bold text-green-400">
                                  ${invoice.total?.toFixed(2)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-600">
                                    REJECTED
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => updateInvoiceStatus(invoice.invoice_id, 'draft')}
                                    className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm font-semibold"
                                  >
                                    ↩️ Return to Draft
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'completed' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Submitted to VWAS</h2>
                
                {invoices.filter(i => i.vwas_submitted).length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No invoices submitted to VWAS yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left">Invoice #</th>
                          <th className="px-4 py-3 text-left">WO #</th>
                          <th className="px-4 py-3 text-left">Building</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-left">Submitted</th>
                          <th className="px-4 py-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices
                          .filter(i => i.vwas_submitted)
                          .map(invoice => (
                            <tr
                              key={invoice.invoice_id}
                              className="border-t border-gray-700 hover:bg-gray-700 transition"
                            >
                              <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                              <td className="px-4 py-3">{invoice.work_order?.wo_number}</td>
                              <td className="px-4 py-3">{invoice.work_order?.building}</td>
                              <td className="px-4 py-3 text-right font-bold text-green-400">
                                ${invoice.total?.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {invoice.vwas_submitted_at 
                                  ? new Date(invoice.vwas_submitted_at).toLocaleDateString()
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                                  {getStatusDisplayName(invoice.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Quick Reference */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">📋 Quick Reference - CBRE Invoice Process</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="font-bold text-green-400 mb-2">Step 1-3: EMF FSM</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Open RFI ticket</li>
                <li>• Click "Generate Invoice"</li>
                <li>• Preview & Finalize</li>
              </ul>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="font-bold text-blue-400 mb-2">Step 4: QuickBooks</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Create matching invoice</li>
                <li>• Export as PDF</li>
              </ul>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="font-bold text-purple-400 mb-2">Step 5-6: VWAS</div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Upload QB invoice PDF</li>
                <li>• Get photos from emfcbre@gmail.com</li>
                <li>• Submit to CBRE</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
