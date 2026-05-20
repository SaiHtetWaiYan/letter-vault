import './globals.css';

export const metadata = {
  title: 'Letter Vault',
  description: 'Sealed letters unlocked only when every trusted keyholder confirms.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2307090e'/%3E%3Ccircle cx='20' cy='20' r='18.5' stroke='%23e8a84c' stroke-width='0.6' opacity='0.25'/%3E%3Cline x1='20' y1='1' x2='20' y2='4.5' stroke='%23e8a84c' stroke-width='0.8' opacity='0.4' stroke-linecap='round'/%3E%3Cline x1='20' y1='35.5' x2='20' y2='39' stroke='%23e8a84c' stroke-width='0.8' opacity='0.4' stroke-linecap='round'/%3E%3Cline x1='1' y1='20' x2='4.5' y2='20' stroke='%23e8a84c' stroke-width='0.8' opacity='0.4' stroke-linecap='round'/%3E%3Cline x1='35.5' y1='20' x2='39' y2='20' stroke='%23e8a84c' stroke-width='0.8' opacity='0.4' stroke-linecap='round'/%3E%3Cpath d='M20 6 L34 20 L20 34 L6 20 Z' stroke='%23e8a84c' stroke-width='1.15' fill='none' opacity='0.75'/%3E%3Cpath d='M6 20 L20 13.5 L34 20' stroke='%23e8a84c' stroke-width='0.9' fill='none' opacity='0.45'/%3E%3Crect x='15.2' y='21.5' width='9.6' height='7.5' rx='1.4' stroke='%23e8a84c' stroke-width='1.1' fill='none'/%3E%3Cpath d='M17.2 21.5 L17.2 19.5 Q17.2 16.8 20 16.8 Q22.8 16.8 22.8 19.5 L22.8 21.5' stroke='%23e8a84c' stroke-width='1.1' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='20' cy='25' r='1.2' fill='%23e8a84c' opacity='0.8'/%3E%3Cline x1='20' y1='26.2' x2='20' y2='28' stroke='%23e8a84c' stroke-width='1' stroke-linecap='round' opacity='0.8'/%3E%3C/svg%3E" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Inter:wght@300..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
