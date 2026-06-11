import './globals.css';

export const metadata = {
  title: 'Quick POS — Owner Dashboard',
  description: 'Sales and inventory overview for store owners',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS Dashboard',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#e8521a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
