// Public privacy policy. Both the App Store and Google Play require a
// publicly reachable URL for this, and App Store Review Guideline 5.1.1(i)
// additionally requires the app itself to link to it. No auth, no data
// fetching — this page must render for a reviewer who is not logged in.
export const metadata = {
  title: 'Privacy Policy — FSM Mobile',
  description: 'How PCS LLC handles data in the FSM Mobile app and the FSM dashboard.',
};

const EFFECTIVE = 'September 23, 2026';
const CONTACT = 'emfcbre@gmail.com';

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-slate-100 mb-2">{title}</h2>
      <div className="space-y-3 text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-slate-200 px-5 py-10">
      <article className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">
          FSM Mobile and the FSM dashboard · Effective {EFFECTIVE}
        </p>

        <Section title="Who we are">
          <p>
            FSM Mobile and the FSM dashboard are operated by PCS LLC (&ldquo;we&rdquo;). The apps are
            work tools for field-service technicians and office staff at the contracting
            companies that license them. They are not consumer apps and are not offered to
            the general public.
          </p>
        </Section>

        <Section title="Who the users are">
          <p>
            Accounts are created by your employer&rsquo;s office staff. You cannot register
            yourself, and we do not collect data about anyone who is not an employee or
            subcontractor of a licensing company.
          </p>
        </Section>

        <Section title="What we collect">
          <p>We collect only what the job requires:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-slate-200">Account information</strong> — your name, work
              email address, role, and internal user ID. Your PIN is used to sign in and is not
              readable by us in plain text.
            </li>
            <li>
              <strong className="text-slate-200">Work records</strong> — the work orders assigned
              to you and what you enter against them: check-in and check-out times, clock pauses
              and their reasons, daily hours, materials and costs, comments and notes, customer
              signatures, and photos you take or attach on site.
            </li>
            <li>
              <strong className="text-slate-200">Notification token</strong> — a device token so
              we can send you push notifications, for example when a work order is assigned to
              you. It is stored with your user ID and the platform name (iOS or Android).
            </li>
            <li>
              <strong className="text-slate-200">Availability</strong> — the working days and
              hours you mark yourself available for.
            </li>
          </ul>
          <p>
            The app also keeps a copy of your own work orders, daily logs, and time entries in a
            local database on your device, so that you can keep working when you have no signal.
            That copy is cleared when you log out.
          </p>
        </Section>

        <Section title="What we do not collect">
          <p>
            We do not collect your location. We do not track you across other apps or websites.
            We do not use advertising networks or third-party analytics, and we do not sell or
            rent your data to anyone. The app does not read your photo library on its own — it
            opens the picker only when you choose to attach a photo, and only the photos you
            pick are sent.
          </p>
        </Section>

        <Section title="Why we use it">
          <p>
            To dispatch and schedule work, to record what was done for billing and for the
            client&rsquo;s own records, to send you the notifications the job depends on, and to
            meet the reporting obligations your employer has toward its clients.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>
            Your employer&rsquo;s office and management see your work records — that is the point
            of the system. Work-order information is also reported to the client that issued the
            work order.
          </p>
          <p>
            We use service providers to run the system: Supabase (database and storage), Vercel
            (hosting), Expo and Google Firebase Cloud Messaging (push notification delivery), and
            Google Workspace (email). They process data on our behalf and are not permitted to use
            it for their own purposes. We disclose data otherwise only where the law requires it.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Work records are kept for as long as your employer and its clients are required to
            keep them, which for construction and facility-service work is typically several
            years after a job closes. Your notification token is deleted when you log out or
            uninstall the app. Account records are deactivated when you leave, and the work you
            recorded stays attached to the jobs it belongs to.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Traffic between the app and our servers is encrypted in transit. Access to the
            dashboard is limited by role. No system is perfectly secure, and we do not claim
            otherwise; if a breach affects your data we will notify you and your employer as
            required by law.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            You can start a deletion request from inside the app: open the work-order list and
            tap <em>Delete account</em>. That opens a pre-filled email to the office. You can also
            write to{' '}
            <a className="text-blue-400 underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>{' '}
            directly.
          </p>
          <p>
            Deleting your account removes your access and your personal profile. It does not
            erase the work records themselves — hours worked, signatures, and job documentation
            belong to the job and must be retained for legal and contractual reasons. We will tell
            you what was removed and what was kept.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The app is a workplace tool and is not directed to children. We do not knowingly
            collect data from anyone under 16.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we change this policy we will update the effective date above, and for material
            changes we will notify users through the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            PCS LLC ·{' '}
            <a className="text-blue-400 underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
          </p>
        </Section>
      </article>
    </main>
  );
}
