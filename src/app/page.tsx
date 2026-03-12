export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--accent)' }}>
          GEONOVA
        </h1>
        <p className="text-xl text-[var(--text-secondary)] mb-2">
          Professional Surveying Calculations
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          Based on N.N. Basak — Surveying and Levelling
        </p>
      </div>

      <div className="mb-12">
        <h2 className="text-lg font-semibold mb-6 text-[var(--text-secondary)]">
          QUICK TOOLS — No Project Required
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ToolCard href="/tools/distance" title="Distance & Bearing" desc="Two-point coordinates" />
          <ToolCard href="/tools/bearing" title="Bearing Calculator" desc="WCB and Quadrant" />
          <ToolCard href="/tools/area" title="Area Computation" desc="Coordinate method" />
          <ToolCard href="/tools/traverse" title="Traverse Adjustment" desc="Bowditch / Transit" />
          <ToolCard href="/tools/leveling" title="Leveling" desc="Rise & Fall / HOC" />
          <ToolCard href="/tools/coordinates" title="Coordinate Convert" desc="UTM ↔ Lat/Lon" />
          <ToolCard href="/tools/curves" title="Horizontal Curves" desc="Elements & Stakeout" />
          <ToolCard href="/tools/cogo" title="COGO Tools" desc="Radiation / Intersection" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--accent)' }}>
            Calculation Accuracy
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            All algorithms follow Basak standards. Full working shown for every calculation. 
            Precision ratios and arithmetic checks included.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--accent)' }}>
            Two Modes
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            <strong>Quick Tools:</strong> Standalone calculators for instant results.<br/>
            <strong>Project Mode:</strong> Full workflow with storage (Phase 2).
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--accent)' }}>
            Standards
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Traverse: 1:5000 excellent, 1:1000 acceptable<br/>
            Leveling: ±12√K mm ordinary, ±6√K mm precise<br/>
            Coordinates: 4 decimal places (0.1mm)
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a 
      href={href} 
      className="card p-5 hover:border-[var(--accent)] transition-all group"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <h3 className="font-semibold mb-1 group-hover:text-[var(--accent)] transition-colors">
        {title}
      </h3>
      <p className="text-xs text-[var(--text-muted)]">{desc}</p>
    </a>
  );
}
