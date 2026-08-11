'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectResult {
  id: string;
  name: string;
  description: string;
  relevance: number;
}

interface SubmissionResult {
  id: string;
  title: string;
  status: string;
  relevance: number;
}

interface SurveyorResult {
  id: string;
  full_name: string;
  isk_number: string;
  relevance: number;
}

interface SearchResults {
  projects: ProjectResult[];
  submissions: SubmissionResult[];
  surveyors: SurveyorResult[];
}

interface SearchResponse {
  results: SearchResults;
  total: number;
  query: string;
}

type ResultType = 'projects' | 'submissions' | 'surveyors';

/** Flattened item for keyboard navigation */
interface FlatItem {
  type: ResultType;
  data: ProjectResult | SubmissionResult | SurveyorResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;

const GROUP_LABELS: Record<ResultType, string> = {
  projects: 'Projects',
  submissions: 'Submissions',
  surveyors: 'Surveyors',
};

const GROUP_ICONS: Record<ResultType, React.ReactNode> = {
  projects: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    </svg>
  ),
  submissions: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  surveyors: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

function getRoute(type: ResultType, id: string): string {
  switch (type) {
    case 'projects':
      return `/dashboard/projects/${id}`;
    case 'submissions':
      return `/dashboard/submissions/${id}`;
    case 'surveyors':
      return `/dashboard/surveyors/${id}`;
  }
}

function getPrimaryLabel(item: FlatItem['data']): string {
  if ('name' in item) return item.name;
  if ('title' in item) return item.title;
  if ('full_name' in item) return item.full_name;
  return '';
}

function getSecondaryLabel(item: FlatItem['data']): string | null {
  if ('description' in item && item.description) return item.description;
  if ('status' in item && item.status) return item.status;
  if ('isk_number' in item && item.isk_number) return `ISK ${item.isk_number}`;
  return null;
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved':
      return 'text-[var(--success)]';
    case 'pending':
    case 'under_review':
      return 'text-[var(--warning)]';
    case 'rejected':
      return 'text-[var(--error)]';
    default:
      return 'text-[var(--text-muted)]';
  }
}

function flattenResults(results: SearchResults): FlatItem[] {
  const items: FlatItem[] = [];
  // Sort each group by relevance descending
  const sortedProjects = [...results.projects].sort((a, b) => b.relevance - a.relevance);
  const sortedSubmissions = [...results.submissions].sort((a, b) => b.relevance - a.relevance);
  const sortedSurveyors = [...results.surveyors].sort((a, b) => b.relevance - a.relevance);

  for (const project of sortedProjects) items.push({ type: 'projects', data: project });
  for (const submission of sortedSubmissions) items.push({ type: 'submissions', data: submission });
  for (const surveyor of sortedSurveyors) items.push({ type: 'surveyors', data: surveyor });
  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardSearch() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ------ Flatten items for keyboard navigation ------
  const flatItems = results ? flattenResults(results) : [];
  const hasResults = flatItems.length > 0;

  // ------ Group tracking (which type starts at which flat index) ------
  const groupBoundaries = useRef<Map<number, ResultType>>(new Map());

  useEffect(() => {
    groupBoundaries.current.clear();
    if (!results) return;

    let idx = 0;
    const order: ResultType[] = ['projects', 'submissions', 'surveyors'];
    for (const type of order) {
      const arr = results[type];
      if (arr.length > 0) {
        groupBoundaries.current.set(idx, type);
        idx += arr.length;
      }
    }
  }, [results]);

  // ------ Search API call ------
  const performSearch = useCallback(async (q: string) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!q.trim()) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data: SearchResponse = await res.json();
      // Only update if this wasn't aborted
      if (!controller.signal.aborted) {
        setResults(data.results);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Search error:', err);
      setResults(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // ------ Input change with debounce ------
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveIndex(-1);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setResults(null);
        setIsLoading(false);
        setIsOpen(false);
        return;
      }

      setIsOpen(true);
      setIsLoading(true);
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, DEBOUNCE_MS);
    },
    [performSearch],
  );

  // ------ Clear search ------
  const handleClear = useCallback(() => {
    setQuery('');
    setResults(null);
    setIsLoading(false);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  // ------ Click outside to close ------
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ------ Escape to close ------
  useEffect(() => {
    function handleEscape(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // ------ Cleanup on unmount ------
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ------ Navigate to result ------
  const navigateTo = useCallback(
    (item: FlatItem) => {
      const route = getRoute(item.type, item.data.id);
      setIsOpen(false);
      router.push(route);
    },
    [router],
  );

  // ------ Keyboard navigation ------
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' && query.trim()) {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < flatItems.length) {
            navigateTo(flatItems[activeIndex]);
          }
          break;
        }
        case 'Escape': {
          setIsOpen(false);
          break;
        }
      }
    },
    [isOpen, flatItems, activeIndex, navigateTo, query],
  );

  // ------ Scroll active item into view ------
  useEffect(() => {
    if (activeIndex < 0 || !isOpen) return;
    const el = containerRef.current?.querySelector(
      `[data-search-index="${activeIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  // ------ Focus input on Cmd/Ctrl+K ------
  useEffect(() => {
    function handleGlobalShortcut(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        if (query.trim()) setIsOpen(true);
      }
    }
    document.addEventListener('keydown', handleGlobalShortcut);
    return () => document.removeEventListener('keydown', handleGlobalShortcut);
  }, [query]);

  // ------ Render grouped results ------
  const renderResults = () => {
    if (!isOpen) return null;

    if (isLoading && !results) {
      return (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300">
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        </div>
      );
    }

    if (results && !hasResults && query.trim()) {
      return (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300">
          <div className="flex flex-col items-center justify-center px-4 py-8">
            <Search className="h-8 w-8 text-[var(--text-muted)] mb-2 opacity-50" />
            <p className="text-sm text-[var(--text-secondary)]">No results found</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Try a different search term
            </p>
          </div>
        </div>
      );
    }

    if (!results || !hasResults) return null;

    const order: ResultType[] = ['projects', 'submissions', 'surveyors'];
    let flatIdx = 0;

    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300">
        <div className="max-h-80 overflow-y-auto overscroll-contain">
          {order.map((type) => {
            const items = results[type];
            if (!items.length) return null;

            // Sort by relevance
            const sorted = [...items].sort((a, b) => b.relevance - a.relevance);
            const startIdx = flatIdx;

            const group = (
              <div key={type}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-primary)]/50 border-b border-[var(--border-color)]">
                  {GROUP_ICONS[type]}
                  {GROUP_LABELS[type]}
                  <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)] opacity-70">
                    {sorted.length}
                  </span>
                </div>

                {/* Items */}
                {sorted.map((item, i) => {
                  const currentFlatIdx = startIdx + i;
                  const isActive = activeIndex === currentFlatIdx;
                  const primary = getPrimaryLabel(item);
                  const secondary = getSecondaryLabel(item);

                  return (
                    <button
                      key={`${type}-${item.id}`}
                      data-search-index={currentFlatIdx}
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100 border-b border-[var(--border-color)] last:border-b-0',
                        isActive
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]',
                      )}
                      onClick={() => navigateTo({ type, data: item })}
                      onMouseEnter={() => setActiveIndex(currentFlatIdx)}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'shrink-0 flex items-center justify-center w-8 h-8 rounded-md border',
                          isActive
                            ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
                        )}
                      >
                        {GROUP_ICONS[type]}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]',
                          )}
                        >
                          {primary}
                        </p>
                        {secondary && (
                          <p
                            className={cn(
                              'text-xs truncate mt-0.5',
                              'status' in item
                                ? getStatusColor(item.status as string)
                                : 'text-[var(--text-muted)]',
                            )}
                          >
                            {secondary}
                          </p>
                        )}
                      </div>

                      {/* Relevance indicator */}
                      <div className="shrink-0 w-10 text-right">
                        <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                          {Math.round(item.relevance * 100)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );

            flatIdx += sorted.length;
            return group;
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)]/40 text-[10px] text-[var(--text-muted)]">
          <span>{results ? Object.values(results).reduce((sum, arr) => sum + (arr as unknown[]).length, 0) : 0} results</span>
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[9px]">
              ↑↓
            </kbd>
            <span>navigate</span>
            <kbd className="px-1 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[9px]">
              ↵
            </kbd>
            <span>open</span>
            <kbd className="px-1 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[9px]">
              esc
            </kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search input */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-full border bg-[var(--bg-secondary)] px-5 py-3 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          isOpen
            ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-subtle)] bg-[var(--bg-card)]'
            : 'border-[var(--border-color)] hover:border-[var(--border-hover)]',
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          aria-label="Search projects, submissions, surveyors..."
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-w-0"
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 flex items-center justify-center w-5 h-5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {!query && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] shrink-0">
            <span className="text-[9px]">⌘</span>K
          </kbd>
        )}
      </div>

      {/* Results dropdown */}
      {renderResults()}
    </div>
  );
}
