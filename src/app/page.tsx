'use client'
import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function Home() {
  const [activeTab, setActiveTab] = useState('traverse')
  const { t, language } = useLanguage()

  return (
    <div className="min-h-screen">
      {/* Section 1: Hero */}
      <section className="min-h-screen flex items-center bg-[var(--bg-primary)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E8841A" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            {language === 'en' ? (
              <>
                <h1 className="text-5xl md:text-7xl font-bold mb-4">
                  <span className="text-[var(--text-primary)]">Professional </span>
                  <span className="text-[var(--accent)]">Surveying</span>
                </h1>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white">Made Simple</h1>
              </>
            ) : (
              <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                {t('landing.hero')}
              </h1>
            )}
            <p className="text-xl text-[var(--text-secondary)] mb-8 max-w-xl">
              {t('landing.subtitle')}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/register"
                className="px-8 py-4 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-colors"
              >
                {t('landing.getStarted')}
              </a>
              <a
                href="/tools"
                className="px-8 py-4 border-2 border-[var(--accent)] text-[var(--accent)] font-semibold rounded-lg hover:bg-[var(--accent)] hover:text-black transition-colors"
              >
                {t('tools.quickTools')}
              </a>
            </div>
            <p className="mt-8 text-sm text-[var(--text-muted)]">
              Built in Africa. Used worldwide.
            </p>
            <div className="flex gap-3 mt-4">
              <span className="text-2xl">🇰🇪</span>
              <span className="text-2xl">🇺🇬</span>
              <span className="text-2xl">🇹🇿</span>
              <span className="text-2xl">🇳🇬</span>
              <span className="text-2xl">🇿🇦</span>
              <span className="text-2xl">🇮🇳</span>
              <span className="text-2xl">🇮🇩</span>
              <span className="text-2xl">🇧🇷</span>
              <span className="text-2xl">🇦🇺</span>
              <span className="text-2xl">🇬🇧</span>
              <span className="text-2xl">🇺🇸</span>
            </div>
          </div>
          
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#E8841A] to-[#E8841A]/20 rounded-2xl blur-3xl"></div>
              <div className="relative bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 shadow-2xl">
                <div className="aspect-video bg-[var(--bg-primary)] rounded-lg overflow-hidden relative">
                  <svg className="w-full h-full" viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
                    <rect fill="#0f172a" width="400" height="225"/>
                    <path d="M0 120 Q100 80 200 100 T400 90" stroke="#E8841A" strokeWidth="2" fill="none" opacity="0.8"/>
                    <circle cx="100" cy="90" r="6" fill="#E8841A"/>
                    <circle cx="200" cy="100" r="6" fill="#E8841A"/>
                    <circle cx="300" cy="95" r="6" fill="#E8841A"/>
                    <circle cx="100" cy="160" r="5" fill="#22c55e"/>
                    <circle cx="200" cy="170" r="5" fill="#22c55e"/>
                    <circle cx="300" cy="165" r="5" fill="#22c55e"/>
                    <line x1="100" y1="90" x2="100" y2="160" stroke="#22c55e" strokeWidth="1" strokeDasharray="4"/>
                    <line x1="200" y1="100" x2="200" y2="170" stroke="#22c55e" strokeWidth="1" strokeDasharray="4"/>
                    <line x1="300" y1="95" x2="300" y2="165" stroke="#22c55e" strokeWidth="1" strokeDasharray="4"/>
                    <rect x="10" y="10" width="80" height="50" rx="4" fill="#1e293b" stroke="#334155"/>
                    <text x="15" y="30" fill="#94a3b8" fontSize="8">E: 484500.0000</text>
                    <text x="15" y="45" fill="#94a3b8" fontSize="8">N: 9876500.0000</text>
                  </svg>
                </div>
                <div className="flex gap-2 mt-3">
                  <div className="h-8 flex-1 bg-[var(--bg-tertiary)] rounded flex items-center px-3">
                    <span className="text-xs text-[var(--text-secondary)]">Precision</span>
                    <span className="ml-auto text-[var(--accent)] text-xs font-mono">1:12,500</span>
                  </div>
                  <div className="h-8 flex-1 bg-[var(--bg-tertiary)] rounded flex items-center px-3">
                    <span className="text-xs text-[var(--text-secondary)]">Misclosure</span>
                    <span className="ml-auto text-green-500 text-xs font-mono">0.052m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Problem Statement */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-8">
            Surveyors spend hours on manual calculations,
            <span className="text-[var(--accent)]"> arithmetic checks,</span> and report writing.
            <br/>GeoNova eliminates that stress completely.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[var(--bg-primary)] p-6 rounded-xl border border-[var(--border-color)] border-l-2 border-l-red-500/50">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3 className="text-[var(--text-primary)] font-semibold mb-2">Hours of Manual Computation</h3>
              <p className="text-[var(--text-secondary)] text-sm">Complex traverse calculations done entirely by hand</p>
            </div>
            <div className="bg-[var(--bg-primary)] p-6 rounded-xl border border-[var(--border-color)] border-l-2 border-l-yellow-500/50">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 className="text-[var(--text-primary)] font-semibold mb-2">Error-Prone Arithmetic Checks</h3>
              <p className="text-[var(--text-secondary)] text-sm">Manual leveling checks that can fail silently</p>
            </div>
            <div className="bg-[var(--bg-primary)] p-6 rounded-xl border border-[var(--border-color)] border-l-2 border-l-orange-500/50">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <h3 className="text-[var(--text-primary)] font-semibold mb-2">Time-Consuming Report Writing</h3>
              <p className="text-[var(--text-secondary)] text-sm">Creating professional reports entirely from scratch</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#E8841A]/40 max-w-[120px]"></div>
            <p className="text-[var(--accent)] font-semibold text-lg tracking-wide">GeoNova solves all three</p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#E8841A]/40 max-w-[120px]"></div>
          </div>
        </div>
      </section>

      {/* Section 3: Features Grid */}
      <section className="py-20 bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] text-center mb-4">
            Everything You Need
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-12">Professional surveying tools in one platform</p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🗺"
              title="Interactive Map"
              desc="Plot survey points, draw traverses, compute areas — all on a live map"
            />
            <FeatureCard
              icon="📐"
              title="Complete Calculator Suite"
              desc="Traverse, leveling, curves, COGO, setting out — all following Basak standards"
            />
            <FeatureCard
              icon="📄"
              title="PDF Reports"
              desc="Professional survey reports generated instantly with one click"
            />
            <FeatureCard
              icon="📱"
              title="Works on Any Device"
              desc="Install on Android as a native app. Works offline in the field."
            />
            <FeatureCard
              icon="🔄"
              title="Process Field Notes"
              desc="Upload your CSV — GeoNova detects survey type and computes automatically"
            />
            <FeatureCard
              icon="🌍"
              title="Built for Africa"
              desc="Supports UTM zones across Africa. Available in 10 languages. Local pricing."
            />
          </div>
        </div>
      </section>

      {/* Section 4: How It Works */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] text-center mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Create A Project"
              desc="Set up your survey project with location, UTM zone and datum"
            />
            <StepCard
              number="2"
              title="Add Your Data"
              desc="Enter points manually, upload CSV, or use our field mode on your phone"
            />
            <StepCard
              number="3"
              title="Get Your Results"
              desc="Traverse adjustment, PDF report, DXF export — done in minutes"
            />
          </div>
        </div>
      </section>

      {/* Section 5: Tool Showcase */}
      <section className="py-20 bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] text-center mb-4">
            Powerful Tools
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-12">Professional calculators following N.N. Basak standards</p>
          
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {['traverse', 'leveling', 'cogo', 'curves'].map((tool) => (
              <button
                key={tool}
                onClick={() => setActiveTab(tool)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === tool
                    ? 'bg-[var(--accent)] text-black'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                {tool.charAt(0).toUpperCase() + tool.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 max-w-2xl mx-auto">
            {activeTab === 'traverse' && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Traverse Adjustment</h3>
                <div className="font-mono text-sm bg-[var(--bg-primary)] p-4 rounded-lg">
                  <div className="text-[var(--text-secondary)] mb-2">Input:</div>
                  <div className="text-[var(--text-primary)]">5 stations, 1234.56m total distance</div>
                  <div className="text-[var(--text-secondary)] mt-4 mb-2">Output:</div>
                  <div className="text-green-400">Precision: 1 : 12,500</div>
                  <div className="text-green-400">Misclosure E: 0.042m</div>
                  <div className="text-green-400">Misclosure N: 0.031m</div>
                  <div className="text-[var(--accent)] mt-2">✓ Bowditch adjustment applied</div>
                </div>
              </div>
            )}
            {activeTab === 'leveling' && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Leveling Calculator</h3>
                <div className="font-mono text-sm bg-[var(--bg-primary)] p-4 rounded-lg">
                  <div className="text-[var(--text-secondary)] mb-2">Input:</div>
                  <div className="text-[var(--text-primary)]">6 stations, 1.245km total</div>
                  <div className="text-[var(--text-secondary)] mt-4 mb-2">Output:</div>
                  <div className="text-green-400">ΣBS - ΣFS = 2.345m</div>
                  <div className="text-green-400">Last RL - First RL = 2.345m</div>
                  <div className="text-[var(--accent)] mt-2">✓ Arithmetic check PASSED</div>
                  <div className="text-green-400">Misclosure: ±15mm (Allowable: ±13.4mm)</div>
                </div>
              </div>
            )}
            {activeTab === 'cogo' && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">COGO Tools</h3>
                <div className="font-mono text-sm bg-[var(--bg-primary)] p-4 rounded-lg">
                  <div className="text-[var(--text-secondary)] mb-2">Available Functions:</div>
                  <div className="text-[var(--text-primary)]">• Radiation</div>
                  <div className="text-[var(--text-primary)]">• Intersection (Forward/Backward)</div>
                  <div className="text-[var(--text-primary)]">• Traverse</div>
                  <div className="text-[var(--text-primary)]">• Side Shot</div>
                  <div className="text-[var(--text-primary)]">• Offset</div>
                  <div className="text-[var(--text-primary)]">• Missing Line</div>
                  <div className="text-[var(--accent)] mt-2">✓ Full working shown</div>
                </div>
              </div>
            )}
            {activeTab === 'curves' && (
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Horizontal Curves</h3>
                <div className="font-mono text-sm bg-[var(--bg-primary)] p-4 rounded-lg">
                  <div className="text-[var(--text-secondary)] mb-2">Input:</div>
                  <div className="text-[var(--text-primary)]">R = 300m, Δ = 45°</div>
                  <div className="text-[var(--text-secondary)] mt-4 mb-2">Output:</div>
                  <div className="text-green-400">Tangent: 267.95m</div>
                  <div className="text-green-400">Length: 235.62m</div>
                  <div className="text-green-400">External: 95.26m</div>
                  <div className="text-green-400">Mid-ordinate: 56.72m</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 6: Testimonials */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] text-center mb-4">
            What Surveyors Say
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-12">Join thousands of professionals</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <TestimonialCard
              quote="GeoNova saved me hours on traverse calculations. The PDF reports are professional and ready to submit."
              name="Surveyor Joseph"
              title="Land Surveyor"
              country="🇰🇪"
            />
            <TestimonialCard
              quote="The leveling arithmetic check caught an error before I submitted. Worth its weight in gold."
              name="Eng. Sarah"
              title="Civil Engineer"
              country="🇺🇬"
            />
            <TestimonialCard
              quote="Offline mode is a game changer. I can work in remote areas without internet and sync later."
              name="Mwangaza"
              title="Field Surveyor"
              country="🇹🇿"
            />
          </div>
        </div>
      </section>

      {/* Section 7: Pricing */}
      <section className="py-20 bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] text-center mb-4">
            Simple Pricing
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-12">Start free, upgrade when you need</p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              tier="FREE"
              price="KSh 0"
              features={[
                'All quick tools',
                '1 project',
                '5 survey points',
                'Basic PDF report'
              ]}
              cta="Get Started Free"
              popular={false}
            />
            <PricingCard
              tier="PRO"
              price="KSh 500/mo"
              features={[
                'Unlimited projects',
                'Unlimited points',
                'Full PDF reports',
                'DXF + LandXML export',
                'CSV import',
                'Offline mode',
                'Priority support'
              ]}
              cta="Start Free Trial"
              popular={true}
            />
            <PricingCard
              tier="TEAM"
              price="KSh 2,000/mo"
              features={[
                'Everything in Pro',
                '5 team members',
                'Real-time collaboration',
                'Role-based access',
                'Audit trail',
                'Branded reports'
              ]}
              cta="Contact Us"
              popular={false}
            />
          </div>
          
          <p className="text-center text-[var(--text-muted)] text-sm mt-8">
            Pricing also available in UGX, TZS, NGN. All plans include 14-day free trial.
          </p>
        </div>
      </section>

      {/* Section 8: Survey Guide Preview */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] text-center mb-4">
            AI Field Guide
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-12">New to a survey type? GeoNova guides you step by step</p>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <GuideCard
              icon="📐"
              title="Closed Traverse"
              steps="6 steps"
            />
            <GuideCard
              icon="📏"
              title="Leveling Run"
              steps="5 steps"
            />
            <GuideCard
              icon="🎯"
              title="Setting Out"
              steps="4 steps"
            />
          </div>
          
          <div className="text-center">
            <a
              href="/guide"
              className="inline-flex items-center text-[var(--accent)] hover:underline font-medium"
            >
              View All Guides →
            </a>
          </div>
        </div>
      </section>

      {/* Section 9: Mobile App Banner */}
      <section className="py-20 bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-r from-[#E8841A]/20 to-transparent rounded-2xl p-12 border border-[var(--accent)]/30">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
                  Take GeoNova to the field
                </h2>
                <p className="text-[var(--text-secondary)] mb-8">
                  Install GeoNova on your Android phone. Works offline. Syncs when you are back online.
                </p>
                <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg inline-block">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">Add to Home Screen:</p>
                  <p className="text-[var(--text-primary)] text-sm">Open in Chrome → Menu → Add to Home Screen</p>
                </div>
              </div>
              
              <div className="flex justify-center">
                <div className="w-48 h-80 bg-[var(--bg-secondary)] rounded-3xl border-4 border-[var(--border-color)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#E8841A]/10 to-transparent"></div>
                  <div className="p-4 pt-8">
                    <div className="text-xs text-[var(--accent)] mb-2">Field Mode</div>
                    <div className="space-y-2">
                      <div className="bg-[var(--bg-tertiary)] p-2 rounded text-xs text-white">Points</div>
                      <div className="bg-[var(--bg-tertiary)] p-2 rounded text-xs text-white">Traverse</div>
                      <div className="bg-[var(--bg-tertiary)] p-2 rounded text-xs text-white">Leveling</div>
                      <div className="bg-[var(--bg-tertiary)] p-2 rounded text-xs text-white">Radiation</div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-[var(--accent)] text-black text-center py-2 rounded-lg text-sm font-medium">
                        📲 Add to Home Screen
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 10: Footer */}
      <footer className="bg-[var(--bg-primary)] border-t border-[var(--border-color)] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-4">GeoNova</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li><a href="#" className="hover:text-[var(--accent)]">About</a></li>
                <li><a href="#" className="hover:text-[var(--accent)]">Blog</a></li>
                <li><a href="#" className="hover:text-[var(--accent)]">Careers</a></li>
                <li><a href="#" className="hover:text-[var(--accent)]">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-4">Tools</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li><a href="/tools/distance" className="hover:text-[var(--accent)]">Distance & Bearing</a></li>
                <li><a href="/tools/traverse" className="hover:text-[var(--accent)]">Traverse</a></li>
                <li><a href="/tools/leveling" className="hover:text-[var(--accent)]">Leveling</a></li>
                <li><a href="/tools/cogo" className="hover:text-[var(--accent)]">COGO</a></li>
                <li><a href="/tools/curves" className="hover:text-[var(--accent)]">Curves</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li><a href="/guide" className="hover:text-[var(--accent)]">Field Guide</a></li>
                <li><a href="/docs" className="hover:text-[var(--accent)]">Documentation</a></li>
                <li><a href="/docs/csv-import" className="hover:text-[var(--accent)]">Sample Files</a></li>
                <li><a href="#" className="hover:text-[var(--accent)]">Basak Standards</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-[var(--text-primary)] font-bold text-lg mb-4">Connect</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>support@geonova.app</li>
                <li><a href="/community" className="hover:text-[var(--accent)]">WhatsApp Community</a></li>
                <li><a href="/community" className="hover:text-[var(--accent)]">Twitter/X</a></li>
                <li><a href="/community" className="hover:text-[var(--accent)]">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[var(--border-color)] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[var(--text-muted)]">
              © 2026 GeoNova. Built for surveyors, by a surveyor.
            </p>
            <div className="flex gap-2">
              <span className="text-sm text-[var(--text-muted)]">Language:</span>
              <select className="bg-transparent text-[var(--text-secondary)] text-sm border-none focus:ring-0">
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="pt">Português</option>
                <option value="es">Español</option>
                <option value="hi">हिन्दी</option>
                <option value="id">Bahasa Indonesia</option>
              </select>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-[var(--bg-secondary)] p-6 rounded-xl border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-[var(--text-primary)] font-semibold mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm">{desc}</p>
    </div>
  )
}

function StepCard({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center text-2xl font-bold text-black mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)]">{desc}</p>
    </div>
  )
}

function TestimonialCard({ quote, name, title, country }: { quote: string; name: string; title: string; country: string }) {
  return (
    <div className="bg-[var(--bg-primary)] p-6 rounded-xl border border-[var(--border-color)]">
      <p className="text-[var(--text-secondary)] mb-4 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{country}</span>
        <div>
          <p className="text-[var(--text-primary)] font-medium">{name}</p>
          <p className="text-[var(--text-muted)] text-sm">{title}</p>
        </div>
      </div>
    </div>
  )
}

function PricingCard({ tier, price, features, cta, popular }: { 
  tier: string; 
  price: string; 
  features: string[]; 
  cta: string;
  popular: boolean;
}) {
  return (
    <div className={`bg-[var(--bg-secondary)] p-6 rounded-xl border ${popular ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'} relative`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-black text-xs font-bold px-3 py-1 rounded-full">
          Most Popular
        </div>
      )}
      <h3 className="text-[var(--text-primary)] font-bold text-lg mb-2">{tier}</h3>
      <p className="text-[var(--accent)] text-2xl font-bold mb-4">{price}</p>
      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="text-[var(--text-secondary)] text-sm flex items-center gap-2">
            <span className="text-[var(--accent)]">✓</span> {feature}
          </li>
        ))}
      </ul>
      <button className={`w-full py-3 rounded-lg font-medium transition-colors ${
        popular 
          ? 'bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]' 
          : 'bg-[var(--bg-tertiary)] text-white hover:bg-[var(--bg-tertiary)]'
      }`}>
        {cta}
      </button>
    </div>
  )
}

function GuideCard({ icon, title, steps }: { icon: string; title: string; steps: string }) {
  return (
    <div className="bg-[var(--bg-primary)] p-6 rounded-xl border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-[var(--text-primary)] font-semibold mb-1">{title}</h3>
      <p className="text-[var(--text-muted)] text-sm">{steps}</p>
    </div>
  )
}
