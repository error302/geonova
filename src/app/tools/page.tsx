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
        <ToolLink href="/tools/setting-out" title="Setting Out" />
        <ToolLink href="/tools/tacheometry" title="Tacheometry" />
        <ToolLink href="/tools/missing-line" title="Missing Line" />
        <ToolLink href="/tools/height-of-object" title="Height of Object" />
        <ToolLink href="/tools/grade" title="Grade" />
        <ToolLink href="/tools/two-peg-test" title="Two Peg Test" />
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
