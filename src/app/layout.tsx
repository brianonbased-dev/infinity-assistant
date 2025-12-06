import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Infinity Assistant - Search, Assist, Build',
  description: 'Your AI assistant for searching knowledge, getting help, and building solutions. Powered by InfinityAssistant.io',
  keywords: ['AI assistant', 'knowledge search', 'code generation', 'help'],
  openGraph: {
    title: 'Infinity Assistant',
    description: 'Search, Assist, Build - Your intelligent AI companion',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
