'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/api-client/client';
import type { AdjustedStation } from '@/lib/engine/planGeometry';

const SurveyMap = dynamic(() => import('@/components/map/SurveyMap'), { ssr: false });

interface MapPageProps {
  params: { id: string };
}

interface BoundaryStationRow {
  pointName?: string | null
  label?: string | null
  id?: string | null
  station?: number | string | null
  originalEasting?: number | null
  originalNorthing?: number | null
  adjustedEasting?: number | null
  adjustedNorthing?: number | null
  easting?: number | null
  northing?: number | null
}
interface ProjectRow {
  boundary_data?: { adjustedStations?: BoundaryStationRow[] } | null
  name?: string | null
  lr_number?: string | null
  surveyor_name?: string | null
  surveyor_license?: string | null
  client_name?: string | null
  county?: string | null
}

export default function MapPage({ params }: MapPageProps) {
  const [stations, setStations] = useState<AdjustedStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBeacon, setSelectedBeacon] = useState<{ label: string; easting: number; northing: number } | null>(null);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [savingVertices, setSavingVertices] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<{
    name: string;
    lrNumber: string;
    surveyorName: string;
    surveyorLicense: string;
    clientName: string;
    county: string;
  } | null>(null);
  const dbClient = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await dbClient.auth.getSession();
      if (!session) { setError('Not authenticated'); return; }

      const { data: project, error: projErr } = (await dbClient
        .from('projects')
        .select('boundary_data, id, name, lr_number, surveyor_name, surveyor_license, client_name, county')
        .eq('id', params.id)
        .single()) as { data: ProjectRow | null; error: { message: string; code: string; details?: string } | null };

      if (projErr || !project) {
        setError('Project not found');
        setLoading(false);
        return;
      }

      // Store project metadata for sheet layout
      setProjectInfo({
        name: project.name ?? '',
        lrNumber: project.lr_number ?? '',
        surveyorName: project.surveyor_name ?? '',
        surveyorLicense: project.surveyor_license ?? '',
        clientName: project.client_name ?? '',
        county: project.county ?? '',
      });

      const raw = project.boundary_data?.adjustedStations ?? [];
      if (raw.length < 3) {
        setError('No adjusted traverse data found. Complete the traverse computation first.');
        setLoading(false);
        return;
      }

      const mapped: AdjustedStation[] = raw.map((s: BoundaryStationRow) => ({
        pointName: s.pointName ?? s.label ?? s.id ?? String(s.station ?? ''),
        originalEasting: Number(s.originalEasting ?? s.easting ?? 0),
        originalNorthing: Number(s.originalNorthing ?? s.northing ?? 0),
        adjustedEasting: Number(s.adjustedEasting ?? s.easting ?? 0),
        adjustedNorthing: Number(s.adjustedNorthing ?? s.northing ?? 0),
      }));

      setStations(mapped);
      setLoading(false);
    }

    load();
  }, [params.id]);

  // ── Handle beacon click from the map ─────────────────────────────────────
  const handleBeaconClick = useCallback((label: string, easting: number, northing: number) => {
    setSelectedBeacon({ label, easting, northing });
    // Auto-dismiss after 5 seconds
    setTimeout(() => setSelectedBeacon(null), 5000);
  }, []);

  // ── Handle vertex edits from the map → save back to project ──────────────
  const handleVerticesChange = useCallback(async (updated: Array<{ easting: number; northing: number }>) => {
    if (stations.length === 0 || updated.length === 0) return;

    setSavingVertices(true);
    setSaveMsg(null);

    try {
      // Rebuild adjustedStations with updated coordinates
      const newStations = stations.map((s, i) => {
        if (i < updated.length) {
          return {
            ...s,
            adjustedEasting: updated[i].easting,
            adjustedNorthing: updated[i].northing,
          };
        }
        return s;
      });

      // Fetch current boundary_data to preserve other fields
      const { data: project } = (await dbClient
        .from('projects')
        .select('boundary_data')
        .eq('id', params.id)
        .single()) as { data: { boundary_data?: { adjustedStations?: BoundaryStationRow[] } | null } | null };

      const currentBoundaryData = project?.boundary_data ?? {};
      const updatedBoundaryData = {
        ...currentBoundaryData,
        adjustedStations: newStations.map(s => ({
          pointName: s.pointName,
          originalEasting: s.originalEasting,
          originalNorthing: s.originalNorthing,
          adjustedEasting: s.adjustedEasting,
          adjustedNorthing: s.adjustedNorthing,
        })),
      };

      const { error: updateErr } = await dbClient
        .from('projects')
        .update({ boundary_data: updatedBoundaryData })
        .eq('id', params.id);

      if (updateErr) {
        setSaveMsg('Failed to save vertex changes');
      } else {
        setStations(newStations);
        setSaveMsg('Vertices saved');
      }
    } catch {
      setSaveMsg('Error saving vertex changes');
    } finally {
      setSavingVertices(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [stations, params.id, dbClient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Loading traverse data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <p className="text-xs text-gray-500 mt-1">
            Ensure the traverse has been computed and adjusted before viewing the map.
          </p>
        </div>
      </div>
    );
  }

  const sumE = stations.reduce((sum, s) => sum + s.adjustedEasting, 0);
  const sumN = stations.reduce((sum, s) => sum + s.adjustedNorthing, 0);
  const centroidEasting = sumE / stations.length;
  const centroidNorthing = sumN / stations.length;

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs">
        <button
          onClick={() => setEditingEnabled(v => !v)}
          className={`px-3 py-1.5 rounded font-medium transition-colors ${
            editingEnabled
              ? 'bg-amber-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
          }`}
          title={editingEnabled ? 'Disable vertex editing' : 'Enable vertex editing — drag vertices to adjust parcel boundary'}
        >
          {editingEnabled ? 'Editing On' : 'Edit Vertices'}
        </button>
        {editingEnabled && (
          <span className="text-amber-600">
            Drag vertices to adjust. Changes save automatically.
          </span>
        )}
        {savingVertices && (
          <span className="text-blue-600">Saving...</span>
        )}
        {saveMsg && (
          <span className={saveMsg.includes('Failed') || saveMsg.includes('Error') ? 'text-red-600' : 'text-green-600'}>
            {saveMsg}
          </span>
        )}
        <div className="flex-1" />
        {selectedBeacon && (
          <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded">
            <span className="font-semibold text-blue-800">{selectedBeacon.label}</span>
            <span className="text-blue-600 font-mono">
              E {selectedBeacon.easting.toFixed(3)} | N {selectedBeacon.northing.toFixed(3)}
            </span>
          </div>
        )}
      </div>

      {/* ── Survey Map ─────────────────────────────────────────────────── */}
      <div className="flex-1">
        <SurveyMap
          projectId={params.id}
          adjustedStations={stations}
          centroidEasting={centroidEasting}
          centroidNorthing={centroidNorthing}
          readOnly={!editingEnabled}
          enableEditing={editingEnabled}
          onBeaconClick={handleBeaconClick}
          onVerticesChange={handleVerticesChange}
          lrNumber={projectInfo?.lrNumber}
          projectName={projectInfo?.name}
          surveyorName={projectInfo?.surveyorName}
          surveyorLicense={projectInfo?.surveyorLicense}
          clientName={projectInfo?.clientName}
          county={projectInfo?.county}
        />
      </div>
    </div>
  );
}
