'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface GuideType {
  id: string;
  name: string;
  icon: string;
  description: string;
  time: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  steps: number;
}

const guideTypes: GuideType[] = [
  {
    id: 'closed-traverse',
    name: 'Closed Traverse',
    icon: '🔗',
    description: 'Survey around a polygon and return to start for accuracy verification',
    time: '2-4 hours',
    difficulty: 'Intermediate',
    steps: 6
  },
  {
    id: 'leveling',
    name: 'Leveling Run',
    icon: '📊',
    description: 'Establish relative elevations using differential leveling',
    time: '1-2 hours',
    difficulty: 'Beginner',
    steps: 5
  },
  {
    id: 'radiation',
    name: 'Radiation Survey',
    icon: '📡',
    description: 'Take multiple readings from a single instrument station',
    time: '1-3 hours',
    difficulty: 'Beginner',
    steps: 4
  },
  {
    id: 'setting-out',
    name: 'Setting Out',
    icon: '📍',
    description: 'Mark designed points and lines on the ground for construction',
    time: '1-4 hours',
    difficulty: 'Intermediate',
    steps: 4
  },
  {
    id: 'boundary',
    name: 'Boundary Survey',
    icon: '🏡',
    description: 'Mark property boundaries and corners for land registration',
    time: '4-8 hours',
    difficulty: 'Advanced',
    steps: 6
  },
  {
    id: 'road-survey',
    name: 'Road Survey',
    icon: '🛣️',
    description: 'Profile and cross-sections for road design and construction',
    time: '3-6 hours',
    difficulty: 'Intermediate',
    steps: 5
  },
  {
    id: 'control-network',
    name: 'Control Network',
    icon: '🎯',
    description: 'Establish densified control points for larger surveys',
    time: '4-8 hours',
    difficulty: 'Advanced',
    steps: 5
  },
  {
    id: 'mining',
    name: 'Mining Survey',
    icon: '⛏️',
    description: 'Underground traverse, volume calculations, and subsidence monitoring',
    time: '4-8 hours',
    difficulty: 'Advanced',
    steps: 6
  },
  {
    id: 'hydrographic',
    name: 'Hydrographic Survey',
    icon: '🌊',
    description: 'Bathymetry, tidal corrections, and chart datum conversions',
    time: '3-6 hours',
    difficulty: 'Advanced',
    steps: 5
  },
  {
    id: 'drone',
    name: 'Drone/UAV Survey',
    icon: '🚁',
    description: 'GCP planning, accuracy verification, and survey reports',
    time: '2-4 hours',
    difficulty: 'Intermediate',
    steps: 5
  }
];

export default function GuidePage() {
  const [progress, setProgress] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const saved = localStorage.getItem('guide_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const progressMap: { [key: string]: number } = {};
        Object.keys(parsed).forEach(key => {
          const data = parsed[key];
          progressMap[key] = data.completedSteps || 0;
        });
        setProgress(progressMap);
      } catch {}
    }
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-400';
      case 'Intermediate': return 'text-yellow-400';
      case 'Advanced': return 'text-red-400';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">Survey Guide</h1>
          <p className="text-[var(--text-secondary)]">Select a survey workflow to get started</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guideTypes.map(guide => {
            const completedSteps = progress[guide.id] || 0;
            const progressPercent = Math.round((completedSteps / guide.steps) * 100);
            
            return (
              <Link
                key={guide.id}
                href={`/guide/${guide.id}`}
                className="block bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent)]/50 rounded-xl p-6 transition-all hover:shadow-lg hover:shadow-[#E8841A]/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{guide.icon}</div>
                  {completedSteps > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[var(--accent)] rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">{completedSteps}/{guide.steps}</span>
                    </div>
                  )}
                </div>
                
                <h3 className="text-xl font-semibold mb-2">{guide.name}</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-4">{guide.description}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{guide.time}</span>
                  <span className={getDifficultyColor(guide.difficulty)}>
                    {guide.difficulty}
                  </span>
                </div>
                
                {completedSteps > 0 && completedSteps < guide.steps && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                    <div className="text-xs text-[var(--accent)]">
                      Continue where you left off →
                    </div>
                  </div>
                )}
                
                {completedSteps === guide.steps && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                    <div className="text-xs text-green-400">
                      ✓ Complete
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-12 bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">How Guides Work</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-[var(--text-secondary)]">
            <div>
              <div className="text-xl mb-2">👨‍🎓 👴</div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">Two Modes</h3>
              <p>Junior Mode explains everything. Senior Mode gives quick prompts for experienced surveyors.</p>
            </div>
            <div>
              <div className="text-xl mb-2">📊</div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">Track Progress</h3>
              <p>Your progress is saved automatically. Pick up where you left off anytime.</p>
            </div>
            <div>
              <div className="text-xl mb-2">🔗</div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">METARDU Tools</h3>
              <p>Each step links directly to the relevant METARDU calculator or tool.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
