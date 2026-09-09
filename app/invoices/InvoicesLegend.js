// app/invoices/InvoicesLegend.js
// ─────────────────────────────────────────────────────────────────────────────
// What every mark on an invoice line means, and — for the bulk bar — which
// invoices each action will actually reach.
//
// Same principle as the work orders legend: it renders the REAL chips, built
// from the same config the rows and the actions use, so it cannot drift into
// describing something the page has stopped doing.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { STATUS_CONFIG } from '@/lib/invoiceStatus';
import { BULK_ACTIONS } from '@/lib/invoiceBulkActions';
import { DISPUTE_STATUS } from '@/lib/disputeStatus';
import { CBRE_POSTING_STATUS, CBRE_POSTING_ORDER } from '@/lib/cbrePostingStatus';
import StatusTrack from '@/app/dashboard/components/StatusTrack';

const Row = ({ mark, children }) => (
  <div className="flex items-start gap-2 py-1">
    <span className="shrink-0 w-[150px] flex items-center gap-1">{mark}</span>
    <span className="text-slate-500 leading-snug">{children}</span>
  </div>
);

const Group = ({ title, children }) => (
  <div className="min-w-[280px] flex-1">
    <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5 border-b border-[#1e1e2e] pb-1">
      {title}
    </div>
    {children}
  </div>
);

const Pill = ({ className = '', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${className}`}>
    {children}
  </span>
);

export default function InvoicesLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-[#1e1e2e] pt-3 px-6 pb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        Legend — the marks on an invoice, and what each bulk action touches
      </button>

      {open && (
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-5 text-xs">

          <Group title="Where the invoice stands">
            {Object.entries(STATUS_CONFIG)
              .filter(([key]) => key !== 'synced')     /* same thing as accepted */
              .map(([key, cfg]) => (
                <Row key={key} mark={<Pill className={cfg.color}>{cfg.label}</Pill>}>
                  {key === 'draft'    && 'Generated here, not yet sent to CBRE.'}
                  {key === 'approved' && 'Uploaded to CBRE, not yet accepted by them.'}
                  {key === 'accepted' && 'CBRE took it and passed it to accounts payable. Also shown for “synced”.'}
                  {key === 'paid'     && 'The money arrived. Hover the row for the cheque it came on.'}
                  {key === 'rejected' && 'CBRE sent it back — the reason is on the invoice.'}
                </Row>
              ))}
          </Group>

          <Group title="On the line">
            <Row mark={<Pill className="bg-purple-500/15 text-purple-300 border-purple-500/30">QB #10285</Pill>}>
              The invoice exists in QuickBooks under that number. Without it, it has never been sent.
            </Row>
            <Row mark={<span className="inline-block w-2 h-2 rounded-full bg-amber-400" />}>
              A payment has been recorded on this invoice.
            </Row>
            <Row mark={<Pill className="bg-sky-500/15 text-sky-300 border-sky-500/30">💳 Approved to Pay</Pill>}>
              CBRE released it for payment on that date — the money has not arrived yet.
            </Row>
            <Row mark={<Pill className="bg-amber-500/15 text-amber-300 border-amber-500/30">⏸️ On hold</Pill>}>
              Something is unresolved: an NTE increase still pending, a total above the approved NTE,
              a work order CBRE has closed, or an open dispute. Sending it now loses the difference.
            </Row>
            <Row mark={<StatusTrack track="posting" wo={{ cbre_posting_status: 'CIR' }} size="mini" />}>
              How far CBRE is through approving and paying:
              {' '}{CBRE_POSTING_ORDER.map((c, i) => (
                <span key={c}>{i > 0 && ' → '}<span className="text-slate-300 font-mono" title={CBRE_POSTING_STATUS[c]?.label}>{c}</span></span>
              ))}.
              Filled segments are stages already cleared. CIR or CMP starts the 75-day payout clock.
            </Row>
            <Row mark={<Pill className="bg-emerald-500/10 text-emerald-400/90 border-emerald-500/25">💵 11/19/2026</Pill>}>
              When the payment is due, counted from that posting.
            </Row>
            {Object.entries(DISPUTE_STATUS).slice(0, 3).map(([key, cfg]) => (
              <Row key={key} mark={<Pill className={cfg.badge}>{cfg.emoji} {cfg.short}</Pill>}>
                The work order behind this invoice is in the Escalations tab: {cfg.label.toLowerCase()}.
              </Row>
            ))}
          </Group>

          <Group title="What each bulk action reaches">
            <div className="text-[11px] text-slate-600 mb-1.5 leading-snug">
              The number on each button is how many of your selection it will actually change.
              The rest are named and skipped — an action never touches a row it does not apply to.
            </div>
            {Object.entries(BULK_ACTIONS).map(([key, a]) => (
              <Row key={key} mark={<span className="text-slate-300 font-semibold">{a.emoji} {a.label}</span>}>
                {key === 'mark_paid'       && 'Everything not already paid and not still a draft. You give the date and, if you have it, the cheque number — a payment from last week is entered as last week, not as today.'}
                {key === 'unmark_paid'     && 'Only invoices marked paid. Clears the date, amount and cheque and puts them back to accepted.'}
                {key === 'mark_accepted'   && 'Only drafts and uploaded ones. Never moves anything backwards, never touches a paid invoice.'}
                {key === 'approved_to_pay' && 'Only invoices without that stamp and not yet paid.'}
                {key === 'mark_rejected'   && 'Everything not already rejected and not paid. The reason you type is recorded on each one.'}
                {key === 'add_note'        && 'Everything selected. The note is appended with today’s date — an existing note is somebody’s work and stays.'}
              </Row>
            ))}
            <Row mark={<span className="text-slate-300 font-semibold">📗 Push to QuickBooks</span>}>
              Creates real invoices in QB, one call each, and e-mails them from there.
              Skips anything already in QuickBooks and anything on hold, then reports per invoice.
            </Row>
            <Row mark={<span className="text-slate-300 font-semibold">📊 Export selection</span>}>
              An Excel file of the selected rows — invoice, work order, building, totals, QB number,
              posting stage, approval and payment dates, cheque, and why anything is on hold.
            </Row>
          </Group>

        </div>
      )}
    </div>
  );
}
