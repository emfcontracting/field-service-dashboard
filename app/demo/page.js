'use client';

// app/demo/page.js — public landing page for the PCS FieldService demo.
// Styles live in ./landing.css (all classes prefixed lp-), so nothing here
// depends on or leaks into the dashboard's Tailwind theme.

import Link from 'next/link';
import { archivo } from './fonts';
import './landing.css';

// One CBRE work order, start to finish. The hero panel lights these in order.
const CHAIN = [
  { label: 'Dispatch imported',  detail: 'From the CBRE mail, no typing',      time: '07:42' },
  { label: 'Tech assigned',      detail: 'M. Reyes, lead',                     time: '07:51' },
  { label: 'On site',            detail: 'Arrival reported to CBRE (P2)',       time: '09:18' },
  { label: 'NTE increase',       detail: '$1,250 → $2,840, approved',           time: '11:05' },
  { label: 'Completed',          detail: 'Hours, photos, materials logged',     time: '14:37' },
  { label: 'Reported to CBRE',   detail: 'Vendor App completion, prefilled',   time: '14:52' },
  { label: 'Invoiced',           detail: 'Pushed to QuickBooks',                time: '15:10' },
  { label: 'Paid',               detail: 'Matched from the remittance',         time: '+31 d' },
];

const SPEC = [
  { chore: 'Dispatch emails',
    does: 'CBRE and UPS dispatch mails become work orders on their own, checked every ten minutes. Building, priority, NTE and due dates come across.' },
  { chore: 'Chasing techs for updates',
    does: 'Techs check in and out, log hours, materials and photos in the iOS or Android app. The office sees it the moment it is entered.' },
  { chore: 'NTE increases',
    does: 'The request is built from what is already logged, with the on-site proof CBRE asks for, ready to print or send.' },
  { chore: 'The CBRE Vendor App',
    does: 'Acknowledgements, site arrival for P1 and P2, and completions are queued with every field prefilled. Nothing is reported that CBRE will bounce.' },
  { chore: 'Posted work orders that need more money',
    does: 'Escalations move to a linked sub work order, so the original stays clean and the extra work still gets billed.' },
  { chore: 'Invoicing and getting paid',
    does: 'Invoices come from logged hours and materials, go to QuickBooks with your own numbering, and payments are matched as they arrive.' },
  { chore: 'Scorecards',
    does: 'Response and completion times against CBRE targets, with stop-the-clock pauses recorded where they happened.' },
  { chore: 'Subcontractors',
    does: 'Subs get their own portal to invoice against work that is actually complete.' },
];

const DEMOS = [
  { href: '/demo/dashboard', title: 'Office dashboard',
    text: 'Work orders, CBRE status, assignments, calendar, missing hours and availability.' },
  { href: '/demo/mobile', title: 'Field app',
    text: 'What your techs see on the phone: their jobs, check-in, hours and the cost summary.' },
  { href: '/demo/invoices', title: 'Invoicing',
    text: 'Invoices built from the logged work, ready to review and send.' },
];

const PLANS = [
  { name: 'Small teams',   price: '$149', fit: 'Up to a handful of techs on one dispatch inbox' },
  { name: 'Growing teams', price: '$299', fit: 'Several crews, CBRE and direct clients side by side' },
  { name: 'Enterprise',    price: '$499', fit: 'Multiple offices, subcontractors, custom branding' },
];

function Mark() {
  return (
    <span className="lp-mark" aria-hidden="true">
      <span>PCS</span>
    </span>
  );
}

export default function DemoLandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className={`lp ${archivo.variable}`}>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-row">
          <Link href="/demo" className="lp-brand">
            <Mark />
            <span className="lp-brand-name">PCS FieldService</span>
          </Link>
          <nav className="lp-nav-links" aria-label="Demo sections">
            <Link href="/demo/dashboard">Dashboard</Link>
            <Link href="/demo/mobile">Field app</Link>
            <Link href="/demo/invoices">Invoicing</Link>
            <a href="#contact" className="lp-nav-cta">Talk to us</a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-wrap lp-hero">
          <div className="lp-hero-copy">
            <h1 className="lp-h1">Field service software built inside a CBRE vendor.</h1>
            <p className="lp-lede">
              PCS FieldService takes a work order from the dispatch email to the paid invoice:
              the tech's phone, the NTE increase, the Vendor App, QuickBooks. It runs a working
              CBRE and UPS contractor's operation every day.
            </p>
            <div className="lp-actions">
              <Link href="/demo/dashboard" className="lp-btn lp-btn-primary">Open the dashboard demo</Link>
              <Link href="/demo/mobile" className="lp-btn lp-btn-ghost">Open the field app demo</Link>
            </div>
            <p className="lp-note">No sign-up. Sample data, and every change stays in your browser.</p>
          </div>

          <figure className="lp-panel" aria-label="One CBRE work order moving through the system">
            <div className="lp-plate">
              <span className="lp-plate-wo">C3104527</span>
              <span className="lp-plate-site">SCWCL West Columbia, P2 electrical</span>
            </div>
            <ol className="lp-chain">
              {CHAIN.map((step, i) => (
                <li key={step.label} className="lp-step" style={{ '--i': i }}>
                  <span className="lp-lamp" aria-hidden="true" />
                  <span className="lp-step-label">{step.label}</span>
                  <span className="lp-step-detail">{step.detail}</span>
                  <span className="lp-step-time">{step.time}</span>
                </li>
              ))}
            </ol>
            <figcaption className="lp-panel-foot">One work order, one record. Nobody re-keyed anything.</figcaption>
          </figure>
        </section>

        {/* Spec */}
        <section className="lp-band">
          <div className="lp-wrap">
            <h2 className="lp-h2">What it takes off your desk</h2>
            <dl className="lp-spec">
              {SPEC.map(row => (
                <div key={row.chore} className="lp-spec-row">
                  <dt>{row.chore}</dt>
                  <dd>{row.does}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Demo entrances */}
        <section className="lp-wrap lp-demos">
          <h2 className="lp-h2">Try it</h2>
          <p className="lp-sub">
            The demo company is Summit Mechanical Services, with work orders in every state.
            Assign techs, log hours, change statuses. Reset puts everything back.
          </p>
          <div className="lp-doors">
            {DEMOS.map(d => (
              <Link key={d.href} href={d.href} className="lp-door">
                <span className="lp-door-title">{d.title}</span>
                <span className="lp-door-text">{d.text}</span>
                <span className="lp-door-go">Open</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="lp-band">
          <div className="lp-wrap">
            <h2 className="lp-h2">Pricing</h2>
            <table className="lp-rates">
              <thead>
                <tr><th scope="col">Plan</th><th scope="col">Per month</th><th scope="col">Built for</th></tr>
              </thead>
              <tbody>
                {PLANS.map(p => (
                  <tr key={p.name}>
                    <th scope="row">{p.name}</th>
                    <td className="lp-price">{p.price}</td>
                    <td>{p.fit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-sub">Your logo on the dashboard and the field app. Onboarding is set up with you.</p>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="lp-wrap lp-contact">
          <div>
            <h2 className="lp-h2">Built by a contractor who writes code</h2>
            <p className="lp-sub">
              I dispatch CBRE and UPS work and wrote this system because the portals and the
              paperwork were eating the day. If you work the same way, I'll walk you through it
              on your own work orders.
            </p>
          </div>
          <div className="lp-card">
            <p className="lp-card-name">Daniel Jones</p>
            <p className="lp-card-role">Professional Commercial Solutions LLC</p>
            <a href="mailto:daniel@pcsllc.dev" className="lp-card-line">daniel@pcsllc.dev</a>
            <a href="tel:+18887523431" className="lp-card-line">(888) 752-3431</a>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-row">
          <span>© {year} Professional Commercial Solutions LLC</span>
          <span className="lp-foot-links">
            <a href="https://pcsllc.dev" target="_blank" rel="noopener noreferrer">pcsllc.dev</a>
            <Link href="/privacy">Privacy</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
