// Survey workspace container — the group layout is a passthrough so every
// page gets the global top NavBar (AppShell). This nested layout keeps the
// padding the old sidebar layout used to provide for these workspace pages.
export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="p-4 md:p-6 lg:p-8">{children}</div>
}
