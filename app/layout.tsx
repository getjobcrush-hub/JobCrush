import './globals.css'

export const metadata = {
  title: 'JobCrush',
  description: 'Discover jobs you\'ll love in the Triangle',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
