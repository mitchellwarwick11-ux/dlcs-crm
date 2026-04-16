// Print pages render their own full HTML — this layout passes children through directly
// so the root layout doesn't double-wrap with <html><body>
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
