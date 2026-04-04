'use client'

import { useState } from 'react'
import { Scale, Calculator, FileCheck, Gavel, Route, BookOpen, ArrowRight } from 'lucide-react'
import dynamic from 'next/dynamic'

const BoundaryLawSearch = dynamic(() => import('@/components/landlaw/BoundaryLawSearch'), { ssr: false })
const AdversePossessionCalc = dynamic(() => import('@/components/landlaw/AdversePossessionCalc'), { ssr: false })
const AIPlanChecker = dynamic(() => import('@/components/landlaw/AIPlanChecker'), { ssr: false })
const DisputeGuide = dynamic(() => import('@/components/landlaw/DisputeGuide'), { ssr: false })
const EasementGuide = dynamic(() => import('@/components/landlaw/EasementGuide'), { ssr: false })

type Tab = 'boundaries' | 'adverse' | 'checker' | 'disputes' | 'easements'

export default function LandLawPage() {
  const [activeTab, setActiveTab] = useState<Tab>('boundaries')

  const tabs = [
    { id: 'boundaries', label: 'Boundary Law', icon: Scale },
    { id: 'adverse', label: 'Adverse Possession', icon: Calculator },
    { id: 'checker', label: 'AI Plan Checker', icon: FileCheck },
    { id: 'disputes', label: 'Dispute Guide', icon: Gavel },
    { id: 'easements', label: 'Easements', icon: Route }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Land Law Intelligence</h1>
          </div>
          <p className="text-amber-100 text-lg">
            Kenyan boundary law, dispute resolution, and survey compliance tools
          </p>
          <div className="flex gap-3 mt-4">
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
              Browns Boundary Control
            </span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
              Survey Regulations 1994
            </span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
              RDM 1.1
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="border-b">
            <nav className="flex">
              {tabs.map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-amber-500 text-amber-600 bg-amber-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'boundaries' && <BoundaryLawSearch />}
            {activeTab === 'adverse' && <AdversePossessionCalc />}
            {activeTab === 'checker' && <AIPlanChecker />}
            {activeTab === 'disputes' && <DisputeGuide />}
            {activeTab === 'easements' && <EasementGuide />}
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Scale className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium">Boundary Law Knowledge Base</h3>
                <p className="text-sm text-gray-500">15+ topics with case law</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Calculator className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-medium">Adverse Possession Calculator</h3>
                <p className="text-sm text-gray-500">12-year requirement tracker</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">AI Plan Compliance</h3>
                <p className="text-sm text-gray-500">14 automated checks</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Need Legal Consultation?</h3>
              <p className="text-gray-300 mt-1">
                Connect with experienced land law attorneys for complex disputes
              </p>
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-medium">
              Find an Attorney <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
