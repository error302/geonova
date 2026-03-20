'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { computeChainageTable } from '@/lib/engine/chainage'
import { generateLongitudinalProfileSvg } from '@/lib/reports/profileSvg'

interface PageProps {
  params: { id: string }
}

interface Project {
  id: string;
  name: string;
  location: string | null;
  utm_zone: number;
  hemisphere: string;
}

interface SurveyPoint {
  id: string;
  name: string;
  easting: number;
  northing: number;
  elevation: number | null;
}

interface Alignment {
  id: string;
  name: string;
  description: string | null;
}

interface ChainagePoint {
  id: string;
  point_name: string;
  chainage: number;
  easting: number;
  northing: number;
  elevation: number;
}

interface CrossSection {
  id: string;
  chainage: number;
  offset_distance: number;
  offset_direction: string;
  elevation: number;
}

export default function ProfilesPage({ params }: PageProps) {
  const supabase = createClient();
  const [project, setProject] = useState<Project | null>(null);
  const [points, setPoints] = useState<SurveyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [alignments, setAlignments] = useState<Alignment[]>([]);
  const [selectedAlignment, setSelectedAlignment] = useState<Alignment | null>(null);
  const [chainagePoints, setChainagePoints] = useState<ChainagePoint[]>([]);
  const [crossSections, setCrossSections] = useState<CrossSection[]>([]);
  
  const [newAlignmentName, setNewAlignmentName] = useState('');
  const [selectedPoints, setSelectedPoints] = useState<SurveyPoint[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'profile' | 'cross-sections'>('create');

  const [svgModalOpen, setSvgModalOpen] = useState(false);
  const [svgPage, setSvgPage] = useState<'A3' | 'A4'>('A3');
  const [svgOrientation, setSvgOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [svgHScale, setSvgHScale] = useState<number>(1000);
  const [svgVScale, setSvgVScale] = useState<number>(100);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id)
        .single();
      if (projectData) setProject(projectData);

      const { data: pointsData } = await supabase
        .from('survey_points')
        .select('*')
        .eq('project_id', params.id)
        .order('name');
      if (pointsData) setPoints(pointsData);

      const { data: alignmentsData } = await supabase
        .from('alignments')
        .select('*')
        .eq('project_id', params.id)
        .order('created_at', { ascending: false });
      if (alignmentsData) setAlignments(alignmentsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAlignmentData = async (alignmentId: string) => {
    const { data: cpData } = await supabase
      .from('chainage_points')
      .select('*')
      .eq('alignment_id', alignmentId)
      .order('chainage');
    if (cpData) setChainagePoints(cpData);

    const { data: csData } = await supabase
      .from('cross_sections')
      .select('*')
      .eq('alignment_id', alignmentId)
      .order('chainage');
    if (csData) setCrossSections(csData);
  };

  const createAlignment = async () => {
    if (!newAlignmentName || selectedPoints.length < 2) return;

    try {
      const { data: alignment, error } = await supabase
        .from('alignments')
        .insert({
          project_id: params.id,
          name: newAlignmentName
        })
        .select()
        .single();

      if (error) throw error;

      const first = selectedPoints[0]
      const table = computeChainageTable({
        start: { easting: first.easting, northing: first.northing },
        startName: first.name,
        startChainage: 0,
        alignment: selectedPoints.slice(1).map((p) => ({ name: p.name, easting: p.easting, northing: p.northing })),
      })

      const byName = new Map(selectedPoints.map((p) => [p.name, p]))
      const chainageData = table.map((row) => {
        const source = byName.get(row.pointName)
        return {
          alignment_id: alignment.id,
          project_id: params.id,
          point_name: row.pointName,
          chainage: row.chainage,
          easting: row.easting,
          northing: row.northing,
          elevation: source?.elevation ?? 0,
        }
      })

      await supabase.from('chainage_points').insert(chainageData)

      setNewAlignmentName('');
      setSelectedPoints([]);
      await loadData();
      setSelectedAlignment(alignment);
      await loadAlignmentData(alignment.id);
      setActiveTab('profile');
    } catch (err) {
      console.error('Error creating alignment:', err);
      alert('Failed to create alignment');
    }
  };

  const togglePointSelection = (point: SurveyPoint) => {
    if (selectedPoints.find(p => p.id === point.id)) {
      setSelectedPoints(selectedPoints.filter(p => p.id !== point.id));
    } else {
      setSelectedPoints([...selectedPoints, point]);
    }
  };

  const handleAlignmentSelect = async (alignment: Alignment) => {
    setSelectedAlignment(alignment);
    await loadAlignmentData(alignment.id);
    setActiveTab('profile');
  };

  const addCrossSection = async (chainage: number) => {
    if (!selectedAlignment) return;

    const centerPoint = chainagePoints.find(cp => Math.abs(cp.chainage - chainage) < 0.001);
    
    await supabase.from('cross_sections').insert({
      alignment_id: selectedAlignment.id,
      chainage,
      offset_distance: 0,
      offset_direction: 'center',
      elevation: centerPoint?.elevation || 0
    });

    await loadAlignmentData(selectedAlignment.id);
  };

  const formatChainage = (value: number): string => {
    const km = Math.floor(value / 1000);
    const m = value % 1000;
    return `${km}+${m.toFixed(3).padStart(3, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[#E8841A]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white">
      <div className="border-b border-gray-800 bg-[var(--bg-card)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href={`/project/${params.id}`} className="text-[#E8841A] hover:underline text-sm">
                ← Back to Project
              </Link>
              <h1 className="text-2xl font-bold mt-1">Profile Generator</h1>
              <p className="text-gray-500 text-sm">{project?.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  activeTab === 'create' ? 'bg-[#E8841A] text-black' : 'bg-gray-800 text-gray-300'
                }`}
              >
                Create Alignment
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                disabled={!selectedAlignment}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  activeTab === 'profile' ? 'bg-[#E8841A] text-black' : 'bg-gray-800 text-gray-300'
                } disabled:opacity-50`}
              >
                Longitudinal Profile
              </button>
              <button
                onClick={() => setActiveTab('cross-sections')}
                disabled={!selectedAlignment}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  activeTab === 'cross-sections' ? 'bg-[#E8841A] text-black' : 'bg-gray-800 text-gray-300'
                } disabled:opacity-50`}
              >
                Cross Sections
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Alignment</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Alignment Name</label>
                  <input
                    className="input"
                    value={newAlignmentName}
                    onChange={e => setNewAlignmentName(e.target.value)}
                    placeholder="e.g., Main Road Centerline"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    onClick={createAlignment}
                    disabled={!newAlignmentName || selectedPoints.length < 2}
                    className="px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded disabled:opacity-50"
                  >
                    Create Alignment
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Select Points for Alignment (in order)</h3>
              <p className="text-sm text-gray-500 mb-4">Click points in the order they appear along the centerline</p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                {points.map(point => (
                  <button
                    key={point.id}
                    onClick={() => togglePointSelection(point)}
                    className={`p-3 rounded text-left transition-colors ${
                      selectedPoints.find(p => p.id === point.id)
                        ? 'bg-[#E8841A] text-black'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    }`}
                  >
                    <div className="font-medium">{point.name}</div>
                    <div className="text-xs opacity-75">
                      E: {point.easting.toFixed(0)}
                    </div>
                    <div className="text-xs opacity-75">
                      N: {point.northing.toFixed(0)}
                    </div>
                    {point.elevation && (
                      <div className="text-xs opacity-75">
                        RL: {point.elevation.toFixed(2)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedPoints.length > 0 && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded">
                  <span className="text-sm text-gray-400">Selected: </span>
                  <span className="text-[#E8841A]">
                    {selectedPoints.map(p => p.name).join(' → ')}
                  </span>
                </div>
              )}
            </div>

            {alignments.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-gray-800 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Existing Alignments</h3>
                <div className="space-y-2">
                  {alignments.map(alignment => (
                    <button
                      key={alignment.id}
                      onClick={() => handleAlignmentSelect(alignment)}
                      className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded text-left flex justify-between items-center"
                    >
                      <span className="font-medium">{alignment.name}</span>
                      <span className="text-[#E8841A]">View →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && selectedAlignment && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-gray-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Longitudinal Profile - {selectedAlignment.name}</h2>
                <button
                  onClick={() => setSvgModalOpen(true)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm"
                >
                  Export SVG
                </button>
              </div>

              {chainagePoints.length > 0 ? (
                <>
                  <ProfileChart points={chainagePoints} />

                  {svgModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSvgModalOpen(false)}>
                      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-lg font-semibold text-white">Export profile SVG (to-scale)</div>
                          <button onClick={() => setSvgModalOpen(false)} className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200">
                            ✕
                          </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-gray-800 p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Page</div>
                            <div className="flex gap-2">
                              <select value={svgPage} onChange={(e) => setSvgPage(e.target.value as any)} className="flex-1 bg-gray-900 border border-gray-800 rounded px-3 py-2 text-gray-200">
                                <option value="A3">A3</option>
                                <option value="A4">A4</option>
                              </select>
                              <select value={svgOrientation} onChange={(e) => setSvgOrientation(e.target.value as any)} className="flex-1 bg-gray-900 border border-gray-800 rounded px-3 py-2 text-gray-200">
                                <option value="landscape">Landscape</option>
                                <option value="portrait">Portrait</option>
                              </select>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Print at 100% for true scale.</p>
                          </div>

                          <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-gray-800 p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Scales</div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-xs text-gray-400">
                                Horizontal (1:)
                                <input inputMode="numeric" value={svgHScale} onChange={(e) => setSvgHScale(parseInt(e.target.value || '1000', 10) || 1000)} className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-gray-200 font-mono" />
                              </label>
                              <label className="text-xs text-gray-400">
                                Vertical (1:)
                                <input inputMode="numeric" value={svgVScale} onChange={(e) => setSvgVScale(parseInt(e.target.value || '100', 10) || 100)} className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-gray-200 font-mono" />
                              </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">If a scale won’t fit, GeoNova will auto-fit to the nearest standard scale.</p>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                          <button onClick={() => setSvgModalOpen(false)} className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200">
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const svgText = generateLongitudinalProfileSvg(
                                chainagePoints.map((p) => ({ chainage: p.chainage, elevation: p.elevation, label: p.point_name })),
                                {
                                  page: svgPage,
                                  orientation: svgOrientation,
                                  horizontalScaleDenom: svgHScale,
                                  verticalScaleDenom: svgVScale,
                                  title: 'LONGITUDINAL PROFILE',
                                  subtitle: `${project?.name ?? ''} — ${selectedAlignment.name}`.trim(),
                                }
                              );
                              const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${selectedAlignment.name}_profile_${svgPage}_${svgOrientation}_H${svgHScale}_V${svgVScale}.svg`;
                              a.click();
                              URL.revokeObjectURL(url);
                              setSvgModalOpen(false);
                            }}
                            className="px-4 py-2 rounded bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold"
                          >
                            Download SVG
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 grid grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="text-xs text-gray-500">Start Chainage</div>
                      <div className="text-[#E8841A] font-mono">{formatChainage(chainagePoints[0]?.chainage || 0)}</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="text-xs text-gray-500">End Chainage</div>
                      <div className="text-[#E8841A] font-mono">{formatChainage(chainagePoints[chainagePoints.length - 1]?.chainage || 0)}</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="text-xs text-gray-500">Lowest Point</div>
                      <div className="text-gray-200 font-mono">
                        {Math.min(...chainagePoints.map(p => p.elevation)).toFixed(3)} m
                      </div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="text-xs text-gray-500">Highest Point</div>
                      <div className="text-gray-200 font-mono">
                        {Math.max(...chainagePoints.map(p => p.elevation)).toFixed(3)} m
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">No chainage points found</p>
              )}
            </div>

            <div className="bg-[var(--bg-card)] border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Chainage Points Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">Point</th>
                      <th className="text-right py-2 text-gray-400">Chainage</th>
                      <th className="text-right py-2 text-gray-400">Easting</th>
                      <th className="text-right py-2 text-gray-400">Northing</th>
                      <th className="text-right py-2 text-gray-400">Elevation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainagePoints.map((cp, idx) => (
                      <tr key={cp.id} className="border-b border-gray-800">
                        <td className="py-2 text-gray-200">{cp.point_name}</td>
                        <td className="py-2 text-right font-mono text-[#E8841A]">{formatChainage(cp.chainage)}</td>
                        <td className="py-2 text-right font-mono text-gray-300">{cp.easting.toFixed(3)}</td>
                        <td className="py-2 text-right font-mono text-gray-300">{cp.northing.toFixed(3)}</td>
                        <td className="py-2 text-right font-mono text-gray-300">{cp.elevation.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cross-sections' && selectedAlignment && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Cross Sections - {selectedAlignment.name}</h2>
              <p className="text-sm text-gray-500 mb-4">
                Select a chainage station to add cross section observations
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
                {chainagePoints.map(cp => {
                  const hasCrossSection = crossSections.some(cs => Math.abs(cs.chainage - cp.chainage) < 0.001);
                  return (
                    <button
                      key={cp.id}
                      onClick={() => addCrossSection(cp.chainage)}
                      className={`p-3 rounded text-center transition-colors ${
                        hasCrossSection
                          ? 'bg-green-900/30 border border-green-700 text-green-400'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="font-mono text-[#E8841A]">{formatChainage(cp.chainage)}</div>
                      <div className="text-xs mt-1">
                        {hasCrossSection ? 'Has Data' : 'Add XS'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <CrossSectionTable crossSections={crossSections} chainagePoints={chainagePoints} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileChart({ points }: { points: ChainagePoint[] }) {
  const width = 800;
  const height = 300;
  const padding = 60;

  if (points.length === 0) return null;

  const elevations = points.map(p => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const minCh = Math.min(...points.map(p => p.chainage));
  const maxCh = Math.max(...points.map(p => p.chainage));
  const chRange = maxCh - minCh || 1;
  const elevRange = maxElev - minElev || 1;

  function toX(ch: number) {
    return padding + ((ch - minCh) / chRange) * (width - padding * 2);
  }

  function toY(elev: number) {
    return height - padding - ((elev - minElev) / elevRange) * (height - padding * 2);
  }

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.chainage)} ${toY(p.elevation)}`)
    .join(' ');

  return (
    <svg
      id="profile-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      fontFamily={'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}
      className="bg-gray-900 rounded border border-amber-500/30 w-full"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="#0b1020" />
      <rect width={width} height={height} fill="url(#grid)" />
      
      <path d={pathData} stroke="#E8841A" strokeWidth={2} fill="none"/>
      
      {points.map(p => (
        <g key={p.id}>
          <circle cx={toX(p.chainage)} cy={toY(p.elevation)} r={4} fill="#E8841A"/>
          <text x={toX(p.chainage)} y={height - 10} fill="white" fontSize={9} textAnchor="middle">
            {Math.round(p.chainage)}
          </text>
          <text x={toX(p.chainage)} y={toY(p.elevation) - 8} fill="white" fontSize={7} textAnchor="middle">
            {p.elevation.toFixed(2)}
          </text>
        </g>
      ))}
      
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="white" strokeWidth={1}/>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="white" strokeWidth={1}/>
      
      <text x={width / 2} y={height - 5} fill="gray" fontSize={10} textAnchor="middle">
        Chainage (m)
      </text>
      <text x={15} y={height / 2} fill="gray" fontSize={10} textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`}>
        Elevation (m)
      </text>
      
      <text x={width - padding} y={padding} fill="#E8841A" fontSize={10} fontWeight="bold">
        PROFILE
      </text>
    </svg>
  );
}

function CrossSectionTable({ crossSections, chainagePoints }: { crossSections: CrossSection[]; chainagePoints: ChainagePoint[] }) {
  const groupedSections: { [key: number]: CrossSection[] } = {};
  
  crossSections.forEach(cs => {
    if (!groupedSections[cs.chainage]) {
      groupedSections[cs.chainage] = [];
    }
    groupedSections[cs.chainage].push(cs);
  });

  const formatChainage = (value: number): string => {
    const km = Math.floor(value / 1000);
    const m = value % 1000;
    return `${km}+${m.toFixed(3).padStart(3, '0')}`;
  };

  if (Object.keys(groupedSections).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No cross sections added yet.</p>
        <p className="text-sm">Click on a chainage station above to add cross section data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedSections).map(([ch, sections]) => {
        const center = sections.find(s => s.offset_direction === 'center');
        const left = sections.find(s => s.offset_direction === 'left');
        const right = sections.find(s => s.offset_direction === 'right');
        
        return (
          <div key={ch} className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-[#E8841A] font-mono mb-2">{formatChainage(parseFloat(ch))}</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-1 text-gray-400">Position</th>
                  <th className="text-right py-1 text-gray-400">Offset (m)</th>
                  <th className="text-right py-1 text-gray-400">Elevation (m)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-1 text-gray-300">Left</td>
                  <td className="py-1 text-right font-mono text-gray-300">
                    {left ? left.offset_distance.toFixed(3) : '—'}
                  </td>
                  <td className="py-1 text-right font-mono text-gray-300">
                    {left ? left.elevation.toFixed(3) : '—'}
                  </td>
                </tr>
                <tr className="border-b border-gray-800 bg-[#E8841A]/10">
                  <td className="py-1 text-[#E8841A] font-medium">Center</td>
                  <td className="py-1 text-right font-mono text-[#E8841A]">0.000</td>
                  <td className="py-1 text-right font-mono text-[#E8841A]">
                    {center ? center.elevation.toFixed(3) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-300">Right</td>
                  <td className="py-1 text-right font-mono text-gray-300">
                    {right ? right.offset_distance.toFixed(3) : '—'}
                  </td>
                  <td className="py-1 text-right font-mono text-gray-300">
                    {right ? right.elevation.toFixed(3) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
