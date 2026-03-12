export default function ToolsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">Quick Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">No project required — enter values and get instant results</p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ToolLink href="/tools/distance" title="Distance & Bearing" />
        <ToolLink href="/tools/bearing" title="Bearing" />
        <ToolLink href="/tools/area" title="Area" />
        <ToolLink href="/tools/traverse" title="Traverse" />
        <ToolLink href="/tools/leveling" title="Leveling" />
        <ToolLink href="/tools/coordinates" title="Coordinates" />
        <ToolLink href="/tools/curves" title="Curves" />
        <ToolLink href="/tools/cogo" title="COGO" />
      </div>
    </div>
  );
}

function ToolLink({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} className="card p-5 hover:border-[var(--accent)] transition-all">
      <h3 className="font-semibold">{title}</h3>
    </a>
  );
}
