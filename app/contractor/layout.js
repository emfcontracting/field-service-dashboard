// Subcontractor portal layout: its own installable manifest (start page
// /contractor/dashboard) and the bottom tab bar on phones.
import ContractorNav from './components/ContractorNav';
import { LangProvider } from './components/LangProvider';

export const metadata = {
  title: 'Contractor Portal',
  manifest: '/contractor-manifest.json',
  appleWebApp: { capable: true, title: 'Contractor', statusBarStyle: 'black-translucent' },
};

export default function ContractorLayout({ children }) {
  return (
    <LangProvider>
      <div className="pb-20 md:pb-0">{children}</div>
      <ContractorNav />
    </LangProvider>
  );
}
