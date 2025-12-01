import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
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
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#8B5CF6',
          colorBackground: '#0a0a0a',
          colorInputBackground: '#1a1a1a',
          colorInputText: '#ededed',
          colorText: '#ededed',
        },
        elements: {
          formButtonPrimary: 'bg-purple-600 hover:bg-purple-700',
          card: 'bg-gray-900 border border-gray-800',
          headerTitle: 'text-white',
          headerSubtitle: 'text-gray-400',
          formFieldLabel: 'text-gray-300',
          formFieldInput: 'bg-gray-800 border-gray-700 text-white',
          footerActionLink: 'text-purple-400 hover:text-purple-300',
        },
      }}
    >
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
