export const metadata = {
  title: 'Bookd — Reimagine Basketball',
  description: 'Tournament & League booking platform. Create events, accept registrations, get paid directly.',
  icons: {
    icon: '/bookd.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
