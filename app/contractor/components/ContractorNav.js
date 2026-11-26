'use client';
// Bottom tab bar for the subcontractor portal on phones. Hidden on the login
// page and the print view; desktop keeps the page headers' own links.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/app/contractor/components/LangProvider';

const TABS = [
  { href: '/contractor/dashboard', label: 'Home', icon: '🏠' },
  { href: '/contractor/invoices', label: 'Invoices', icon: '🧾' },
  { href: '/contractor/tax-records', label: 'Expenses', icon: '💳' },
  { href: '/contractor/tax-report', label: 'Taxes', icon: '📊' },
  { href: '/contractor/settings', label: 'Profile', icon: '👤' },
];

export default function ContractorNav() {
  const path = usePathname() || '';
  const { t } = useLang();
  if (path === '/contractor' || path === '/contractor/welcome' || path.endsWith('/print')) return null;
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-800 border-t border-gray-700 no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = path === tab.href || path.startsWith(tab.href + '/');
          return (
            <li key={tab.href}>
              <Link href={tab.href}
                className={`flex flex-col items-center justify-center py-2 text-[11px] ${active ? 'text-blue-400' : 'text-gray-400'}`}>
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="mt-0.5">{t(tab.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
