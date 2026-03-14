export default function ToolsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">Quick Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">No project required — enter values and get instant results</p>
      
      <div className="space-y-8">
        {/* FIELD LAYOUT */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Field Layout</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/setting-out" title="Setting Out" />
            <ToolLink href="/tools/missing-line" title="Missing Line" />
          </div>
        </section>

        {/* LEVELING */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Leveling</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/leveling" title="Leveling" />
            <ToolLink href="/tools/two-peg-test" title="Two Peg Test" />
            <ToolLink href="/tools/height-of-object" title="Height of Object" />
          </div>
        </section>

        {/* CALCULATIONS */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Calculations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/distance" title="Distance & Bearing" />
            <ToolLink href="/tools/bearing" title="Bearing" />
            <ToolLink href="/tools/area" title="Area" />
            <ToolLink href="/tools/grade" title="Grade" />
          </div>
        </section>

        {/* TRAVERSE & ADJUSTMENT */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Traverse & Adjustment</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/traverse" title="Traverse" />
            <ToolLink href="/tools/coordinates" title="Coordinates" />
            <ToolLink href="/tools/cogo" title="COGO" />
          </div>
        </section>

        {/* CURVES */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Curves</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/curves" title="Horizontal Curves" />
            <ToolLink href="/tools/tacheometry" title="Tacheometry" />
          </div>
        </section>

        {/* SPECIALIZED SURVEYS */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Specialized Surveys</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/mining" title="⛏ Mining Survey" />
            <ToolLink href="/tools/hydrographic" title="🌊 Hydrographic" />
            <ToolLink href="/tools/drone" title="🚁 Drone/UAV" />
          </div>
        </section>
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
