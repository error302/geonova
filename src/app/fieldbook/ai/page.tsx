'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Observation {
  from: string;
  to: string;
  bearing: string;
  distance: number;
  bs?: number;
  is?: number;
  fs?: number;
  notes?: string;
}

interface ParsedFieldBook {
  survey_type: string;
  stations: Observation[];
  warnings: string[];
}

export default function FieldBookAIPage() {
  const [inputMethod, setInputMethod] = useState<'photo' | 'text'>('text');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedFieldBook | null>(null);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('projects').select('id, name').eq('user_id', user.id);
      if (data) setProjects(data);
    }
  };
  loadProjects();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseTextToObservations = (text: string): ParsedFieldBook => {
    const lines = text.split('\n').filter((l: any) => l.trim());
    const observations: Observation[] = [];
    const warnings: string[] = [];
    let surveyType = 'unknown';

    for (const line of lines) {
      let match = line.match(/(\w+)\s*[-–>to]+\s*(\w+)\s*[,;]?\s*(\d+)[°]\s*(\d+)[']\s*(\d+(?:\.\d+)?)["]?\s*[,;]?\s*(\d+(?:\.\d+)?)?m?/i);
      if (match) {
        surveyType = 'traverse';
        observations.push({
          from: match[1],
          to: match[2],
          bearing: `${match[3]}°${match[4]}'${match[5]}"`,
          distance: parseFloat(match[6]) || 0,
        });
        continue;
      }

      match = line.match(/(\w+)\s+bs\s+(\d+\.?\d*)/i);
      if (match && match[1] && match[2]) {
        surveyType = 'leveling';
        const existing = observations.find((o: any) => o.from === match![1] && o.bs === undefined);
        if (existing) {
          existing.bs = parseFloat(match[2]);
        } else {
          observations.push({ from: match[1], to: '', bearing: '', distance: 0, bs: parseFloat(match[2]) });
        }
        continue;
      }

      match = line.match(/(\w+)\s+fs\s+(\d+\.?\d*)/i);
      if (match && match[1] && match[2]) {
        surveyType = 'leveling';
        const existing = observations.find((o: any) => o.from === match![1] && o.fs === undefined);
        if (existing) {
          existing.fs = parseFloat(match[2]);
        } else {
          observations.push({ from: match[1], to: '', bearing: '', distance: 0, fs: parseFloat(match[2]) });
        }
        continue;
      }

      match = line.match(/(\w+)\s*[-–>to]+\s*(\w+)\s*[,;]?\s*(\d+(?:\.\d+)?)\s*m?/i);
      if (match) {
        surveyType = 'traverse';
        observations.push({
          from: match[1],
          to: match[2],
          bearing: '',
          distance: parseFloat(match[3]),
        });
      }
    }

    if (observations.length === 0) {
      warnings.push('Could not parse any observations. Please check the format.');
    }

    return { survey_type: surveyType, stations: observations, warnings };
  };

  const handleInterpret = async () => {
    setLoading(true);
    setError('');

    try {
      if (inputMethod === 'text' && !textInput.trim()) {
        setError('Please enter field notes to interpret');
        setLoading(false);
        return;
      }

      if (inputMethod === 'photo' && !file) {
        setError('Please select a photo to upload');
        setLoading(false);
        return;
      }

      if (inputMethod === 'text') {
        const parsed = parseTextToObservations(textInput);
        setResult(parsed);
      } else {
        setResult({
          survey_type: 'traverse',
          stations: [
            { from: 'CP1', to: 'T1', bearing: '045°20\'10"', distance: 102.345 },
            { from: 'CP1', to: 'T2', bearing: '082°10\'00"', distance: 87.230 },
            { from: 'T1', to: 'T2', bearing: '120°15\'00"', distance: 65.125 }
          ],
          warnings: ['Photo interpretation requires external AI integration']
        });
      }
    } catch (e) {
      setError('Failed to interpret notes');
    }

    setLoading(false);
  };

  const handleSaveToProject = async () => {
    if (!selectedProject || !result) return;

    setSaving(true);
    try {
      const insertData = result.stations.map((obs: any) => ({
        project_id: selectedProject,
        name: obs.to || obs.from,
        easting: 0,
        northing: 0,
        elevation: null,
        is_control: false
      }));

      const { error } = await supabase.from('survey_points').insert(insertData);

      if (error) {
        setError('Failed to save to project');
      } else {
        // Saved - user sees data in the list
      }
    } catch (e) {
      setError('Failed to save to project');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Field Book Interpreter</h1>
            <p className="text-[var(--text-secondary)]">Paste notes or upload a photo to interpret into structured observations.</p>
          </div>
          <a
            href="/fieldbook"
            className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm"
          >
            ← Digital Field Book
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setInputMethod('text')}
                className={`px-4 py-2 rounded text-sm ${inputMethod === 'text' ? 'bg-[var(--accent)] text-black font-semibold' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}
              >
                Text Notes
              </button>
              <button
                onClick={() => setInputMethod('photo')}
                className={`px-4 py-2 rounded text-sm ${inputMethod === 'photo' ? 'bg-[var(--accent)] text-black font-semibold' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}
              >
                Photo
              </button>
            </div>

            {inputMethod === 'text' ? (
              <div>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full h-64 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono text-sm"
                  placeholder={`Example (Traverse):\nA to B, 045°30'00\", 100.000\nB to C, 120°15'00\", 85.000\n\nExample (Leveling):\nBM1 BS 1.245\nTP1 FS 2.335\nTP1 BS 0.845\nBM2 FS 2.115`}
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] rounded-lg text-[var(--text-primary)]"
                >
                  {file ? file.name : 'Select Photo'}
                </button>
                <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
                  Photo interpretation requires external AI integration
                </p>
              </div>
            )}

            <button
              onClick={handleInterpret}
              disabled={loading}
              className="w-full mt-4 px-6 py-4 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-bold rounded-lg disabled:opacity-50"
            >
              {loading ? 'Interpreting...' : '🔍 Interpret Notes'}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400">
                {error}
              </div>
            )}
          </div>

          <div>
            {result ? (
              <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">INTERPRETED OBSERVATIONS</h3>

                <div className="mb-4 p-3 bg-[var(--bg-tertiary)]/50 rounded">
                  <span className="text-[var(--text-secondary)]">Survey Type Detected: </span>
                  <span className="text-[var(--accent)] font-medium uppercase">{result.survey_type}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="text-left py-2 text-[var(--text-secondary)]">From</th>
                        <th className="text-left py-2 text-[var(--text-secondary)]">To</th>
                        <th className="text-right py-2 text-[var(--text-secondary)]">Bearing</th>
                        <th className="text-right py-2 text-[var(--text-secondary)]">Distance</th>
                        {(result.stations[0]?.bs !== undefined || result.stations[0]?.fs !== undefined) && (
                          <>
                            <th className="text-right py-2 text-[var(--text-secondary)]">BS</th>
                            <th className="text-right py-2 text-[var(--text-secondary)]">FS</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {result.stations.map((obs, i) => (
                        <tr key={i} className="border-b border-[var(--border-color)]">
                          <td className="py-2 text-[var(--text-primary)]">{obs.from}</td>
                          <td className="py-2 text-[var(--text-primary)]">{obs.to}</td>
                          <td className="py-2 text-right font-mono text-[var(--text-primary)]">{obs.bearing || '—'}</td>
                          <td className="py-2 text-right font-mono text-[var(--text-primary)]">{obs.distance ? `${obs.distance.toFixed(3)}m` : '—'}</td>
                          {obs.bs !== undefined && <td className="py-2 text-right font-mono text-[var(--text-primary)]">{obs.bs?.toFixed(3)}</td>}
                          {obs.fs !== undefined && <td className="py-2 text-right font-mono text-[var(--text-primary)]">{obs.fs?.toFixed(3)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {result.warnings.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                    <p className="text-yellow-400 text-sm font-medium mb-1">⚠ Warnings:</p>
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-yellow-400 text-sm">{w}</p>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-[var(--border-color)] space-y-3">
                  <div>
                    <label className="label">Save to Project</label>
                    <select
                      className="input"
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                    >
                      <option value="">Select a project...</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSaveToProject}
                    disabled={!selectedProject || saving}
                    className="w-full px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : '💾 Save to Project'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--border-color)] rounded-xl p-6 text-center">
                <p className="text-[var(--text-muted)]">Results will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

