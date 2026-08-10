'use client';

import { useState, useId } from 'react';
import { Sparkles, X, Copy, Check, Loader2, ChevronDown } from 'lucide-react';
import { SurveyType } from '@/types/project';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  surveyType: SurveyType;
  projectId: string;
}

const REPORT_SECTIONS: Record<string, string[]> = {
  cadastral: [
    'Methodology',
    'Boundary Definition and Misclosure Assessment',
    'Control Network',
    'Compliance with Survey Act'
  ],
  topographic: [
    'Methodology and Control Network',
    'Feature Extraction and DTM',
    'Data Reduction',
    'Accuracy Assessment'
  ],
  engineering: [
    'Setting Out Methodology',
    'Deviation and Tolerances',
    'Volume Calculation',
    'Quality Control'
  ],
  default: [
    'Introduction',
    'Methodology',
    'Results and Analysis',
    'Conclusion and Recommendations'
  ]
};

export default function GenerateReportModal({ isOpen, onClose, surveyType, projectId }: Props) {
  const reportSectionId = useId();
  const [sectionType, setSectionType] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sections = REPORT_SECTIONS[surveyType] || REPORT_SECTIONS.default;
  const activeSection = sectionType || sections[0];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    setCopied(false);

    try {
      // Create lightweight generic payload for now, real project data could be passed if needed
      const projectData = { projectId, dateRetrieved: new Date().toISOString() };
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-section',
          data: {
            sectionType: activeSection,
            surveyType,
            projectData,
            customInstructions
          }
        })
      });

      if (!response.ok) {
        // AUDIT FIX (M15, 2026-07-02): Actionable error message.
        const errBody = await response.text().catch(() => 'unknown')
        throw new Error(
          `Report generation failed (HTTP ${response.status}). ${errBody}. ` +
          `Common causes: the AI service is unavailable, the project has insufficient ` +
          `data for this section, or you've exceeded the rate limit. ` +
          `Try again in a few minutes, or generate this section manually.`
        )
      }

      const rawData = (await response.json()) as { error?: string };
      if (rawData.error) throw new Error(rawData.error);
      
      // Handle deeply nested or strange response formats gracefully
      const finalContent = rawData.result?.result?.result ?? rawData.result?.result ?? rawData.result ?? '';
      
      if (typeof finalContent === 'string') {
        setResult(finalContent);
      } else {
        setResult(JSON.stringify(finalContent, null, 2));
      }
    } catch (err: unknown) {
      // AUDIT FIX (M15, 2026-07-02): Actionable error message.
      setError(
        (err as Error)?.message ||
        'Could not generate the report. Check your network connection and try again. If the problem persists, the AI service may be temporarily unavailable.'
      )
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 leading-tight">Generate Report</h2>
              <p className="text-xs text-gray-500">Intelligently draft {surveyType} report sections</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-wrap flex-1 overflow-hidden">
          {/* Left Panel: Controls */}
          <div className="w-full md:w-1/3 p-5 border-r border-gray-100 bg-white flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={reportSectionId}>Report Section</label>
              <div className="relative">
                <select
                  id={reportSectionId}
                  value={activeSection}
                  onChange={(e) => setSectionType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[140px]">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="custom-instructions-optional">
                Custom Instructions <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                 id="custom-instructions-optional" value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Focus specifically on the secondary points established using the TS16..."
                className="w-full h-full min-h-[140px] resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Generating...' : 'Generate Section'}
            </button>
          </div>

          {/* Right Panel: Output */}
          <div className="w-full md:w-2/3 bg-gray-50 flex flex-col relative">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200/60 bg-white">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Output</span>
              <button
                onClick={handleCopy}
                disabled={!result || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-md transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                  <div className="relative flex h-10 w-10">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-20"></span>
                    <Loader2 className="relative inline-flex rounded-full w-10 h-10 text-indigo-600 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Drafting compliance report...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
                  <p className="font-semibold mb-1">Generation Failed</p>
                  <p>{error}</p>
                </div>
              ) : result ? (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap font-sans">
                  {result}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <div className="text-center px-8">
                    <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
                    <p>Select a section and click Generate to draft your report.</p>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
