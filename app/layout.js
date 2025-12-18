import './globals.css'

export const metadata = {
  title: 'FSM - Field Service Management',
  description: 'Field Service Management System',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-gray-900">
        <main className="flex-1">
          {children}
        </main>
        
        {/* Footer - appears on all pages */}
        <footer className="bg-gray-900 text-gray-400 text-center py-6 text-sm border-t border-gray-700 mt-auto">
          <div className="container mx-auto px-4">
            <p className="font-semibold">Created by Daniel Jones</p>
            <p className="text-xs text-gray-500 mt-1">
              © 2025 PCS LLC. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}