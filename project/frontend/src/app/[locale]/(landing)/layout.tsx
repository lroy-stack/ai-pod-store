export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      {children}
    </main>
  )
}
