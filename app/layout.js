import './globals.css'

export const metadata = {
  title: 'カード相場チェッカー',
  description: '高回転カードの仕入れ判断ツール',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <meta name="theme-color" content="#0f0f1a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  )
}
