import './globals.css';

export const metadata = {
  title: 'Anime Game Packs',
  description: 'Предложка игр для друзей с Discord, голосованием, чатом и админкой.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
