'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search, BookOpen, Map, FileText, Calculator, CreditCard,
  ChevronDown, ChevronRight, MessageSquare, Mail, Phone,
  Compass, ShieldCheck,
} from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const FAQS: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'How do I create my first survey project?',
    answer: 'Navigate to Dashboard and click "New Project". Enter the project name, survey type (Cadastral, Topographic, Engineering, etc.), county, and LR number. Once created, you can access the map, fieldbook, and document generation tools from the project workspace.',
  },
  {
    category: 'Getting Started',
    question: 'What survey types does METARDU support?',
    answer: 'METARDU supports 6 survey types: Cadastral (land boundaries, mutations, subdivisions), Topographic (contours, features), Engineering (roads, buildings, pipelines), Control (traverse, triangulation), Hydrographic (bathymetry, soundings), and Mining (stockpiles, volumes).',
  },
  {
    category: 'Map',
    question: 'How do I draw a parcel boundary on the map?',
    answer: 'Open the map and click the "Capture" dock on the left. Select the Polygon tool, then click on the map to place vertices. Double-click to finish. The topology checker will automatically validate for overlaps and self-intersections.',
  },
  {
    category: 'Map',
    question: 'Can I use the map offline in the field?',
    answer: 'Yes. Click the "Offline Tiles" button on the map to pre-cache tiles for your project area. Tiles are stored in your browser and work without internet. All fieldbook data is also saved locally and syncs when you reconnect.',
  },
  {
    category: 'Map',
    question: 'Why does the map require two fingers on mobile?',
    answer: 'On mobile, single-finger drag is reserved for page scrolling. Use two fingers to pan and zoom the map. Tap the lock icon in the bottom-left to toggle this behavior if you need single-finger pan.',
  },
  {
    category: 'Fieldbook',
    question: 'How do I capture measurements on mobile?',
    answer: 'On the fieldbook page (mobile view), tap the bottom bar to open the measurement capture form. Choose GPS Point, Bearing+Distance, Angle, or Offset. Enter your readings and tap "Capture Reading" to save them to the fieldbook.',
  },
  {
    category: 'Fieldbook',
    question: 'Can I connect my GNSS rover directly to METARDU?',
    answer: 'Yes. On the fieldbook desktop sidebar, use the "GNSS Rover" panel to connect via Bluetooth or USB-C OTG. METARDU supports CHCNAV, South, EFIX, Stonex, Trimble, and Leica rovers via Web Bluetooth and Web Serial APIs.',
  },
  {
    category: 'Fieldbook',
    question: 'What bearing format should I use?',
    answer: 'METARDU uses the Kenya-standard DDD.MMSS format (e.g., 45.3015 = 45°30\'15"). The smart bearing parser shows a live preview as you type, converting to decimal degrees automatically.',
  },
  {
    category: 'Documents',
    question: 'How do I generate a deed plan?',
    answer: 'Open a project, navigate to Documents, and select "Deed Plan". Enter the parcel details, surveyor info, and beacon schedule. The system generates a PDF using the official Survey of Kenya template with grid overlay, north arrow, and scale bar.',
  },
  {
    category: 'Documents',
    question: 'Can I add my company logo to documents?',
    answer: 'Yes, on Pro and Enterprise plans. Go to Account Settings > Company Logo to upload your logo. Free plan documents include a METARDU watermark. Paid plans with a logo show it in the title block; paid plans without a logo show nothing.',
  },
  {
    category: 'Documents',
    question: 'What document templates are available?',
    answer: 'METARDU generates: Deed Plans, Form C-22, Beacon Certificates, Traverse Computation Sheets, Setting Out Sheets, Mutation Forms, Form No. 4, Topographic Plans, and NLIMS/ArdhiSasa submission JSON. All comply with Survey Act Cap 299.',
  },
  {
    category: 'Tools',
    question: 'What calculation tools are available?',
    answer: 'METARDU includes 60+ tools: COGO (radiation, intersection, resection), Traverse (Bowditch adjustment), Leveling (rise & fall), Coordinate Transformation (WGS84, Arc 1960, Cassini), Curves, Areas, Volumes, Grade, Chainage, and more.',
  },
  {
    category: 'Subscription',
    question: 'What are the plan limits?',
    answer: 'Free: 1 project, basic tools, METARDU watermark. Pro: unlimited projects, all tools, custom logo, DXF/LandXML export, offline tiles. Enterprise: multi-user, team collaboration, API access, priority support. See /pricing for details.',
  },
  {
    category: 'Subscription',
    question: 'How do I upgrade my plan?',
    answer: 'Visit /pricing to compare plans. Click "Upgrade" and complete payment via M-Pesa, card, or PayPal. Your subscription activates immediately. Admins can also promote any user via the admin dashboard.',
  },
  {
    category: 'Compliance',
    question: 'Is METARDU compliant with Kenyan survey law?',
    answer: 'Yes. METARDU follows the Survey Act (Cap 299), Land Registration Act (2012), Sectional Properties Act (2012), and Data Protection Act (2019). All document templates use official SoK formats. Traverse precision thresholds match statutory requirements (1:10,000 urban, 1:5,000 rural).',
  },
]

const CATEGORIES = ['All', 'Getting Started', 'Map', 'Fieldbook', 'Documents', 'Tools', 'Subscription', 'Compliance']

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  'Getting Started': BookOpen,
  'Map': Map,
  'Fieldbook': FileText,
  'Documents': FileText,
  'Tools': Calculator,
  'Subscription': CreditCard,
  'Compliance': ShieldCheck,
}

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredFaqs = useMemo(() => {
    let result = FAQS
    if (activeCategory !== 'All') {
      result = result.filter(f => f.category === activeCategory)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(f =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
      )
    }
    return result
  }, [query, activeCategory])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent)]/10 mb-4">
          <BookOpen className="w-7 h-7 text-[var(--accent)]" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Help & Support</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Find answers, learn workflows, and get the most out of METARDU
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search for help..."
          className="w-full h-12 pl-10 pr-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => {
          const Icon = cat === 'All' ? BookOpen : CATEGORY_ICONS[cat]
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]'
                  : 'bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] text-gray-400 hover:text-gray-300'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {cat}
            </button>
          )
        })}
      </div>

      {/* FAQ list */}
      <div className="space-y-2">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No results found</p>
            <p className="text-xs text-gray-600 mt-1">Try a different search term or category</p>
          </div>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const id = `${faq.category}-${idx}`
            const isExpanded = expandedId === id
            const Icon = CATEGORY_ICONS[faq.category] || BookOpen
            return (
              <div
                key={id}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-tertiary)]/50 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{faq.question}</span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1">
                    <div className="flex gap-3">
                      <div className="w-4 shrink-0" />
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Quick links */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/docs" icon={BookOpen} label="Documentation" />
        <QuickLink href="/docs/quick-start" icon={Compass} label="Quick Start" />
        <QuickLink href="/docs/api" icon={FileText} label="API Reference" />
        <QuickLink href="/community" icon={MessageSquare} label="Community" />
      </div>

      {/* Contact support */}
      <div className="mt-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Still need help?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a href="mailto:support@metardu.com" className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
            <Mail className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">Email Support</p>
              <p className="text-[10px] text-gray-500">support@metardu.com</p>
            </div>
          </a>
          <a href="/community" className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
            <MessageSquare className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">Community Forum</p>
              <p className="text-[10px] text-gray-500">Ask other surveyors</p>
            </div>
          </a>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
            <Phone className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">Enterprise</p>
              <p className="text-[10px] text-gray-500">Priority support</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof BookOpen; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--accent)]/30 hover:bg-[var(--bg-tertiary)]/30 transition-colors"
    >
      <Icon className="w-4 h-4 text-[var(--accent)]" />
      <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>
    </Link>
  )
}
