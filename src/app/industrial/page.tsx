/**
 * MetaRDU Industrial — Download Page
 *
 * Landing page for the desktop surveying application. Hosts download links
 * for the main app (platform-specific installers) and the free standalone
 * PDF verifier.
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Download, Shield, CheckCircle2, Cpu, FileBox, Radio,
  Mountain, Ship, Terminal, FileCheck, ArrowRight, GitBranch,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Mountain,
    title: 'Mining EOM Auditor',
    description: 'Drop a LAS/LAZ file → get a signed volume report in 90 seconds. CSF ground classification, per-bench breakdown, DXF design surface comparison.',
  },
  {
    icon: Ship,
    title: 'Marine S-44 Suite',
    description: 'CUBE surface generation, TPU calculation, IHO S-44 compliance checking, S-57 chart export. All offline, all native Rust.',
  },
  {
    icon: Radio,
    title: 'NTRIP/RTCM3 Client',
    description: 'RTK corrections streaming directly in the app. Eliminates the need for a separate NTRIP client — one less tool in the field kit.',
  },
  {
    icon: FileCheck,
    title: 'Forensic Audit Trail',
    description: 'Every signed PDF embeds a SHA-256 chain-of-custody appendix. The standalone verifier confirms integrity without installing the paid app.',
  },
  {
    icon: Cpu,
    title: 'Machine Control Compiler',
    description: 'DXF → Leica .svd / Trimble .tp3 / Topcon .top. Replaces $5-15k/seat/year legacy software for machine control file generation.',
  },
  {
    icon: Terminal,
    title: 'Zero-Touch Watch Folder',
    description: 'Drop the SD card → walk away → signed PDF is waiting. The pipeline runs automatically on any new .las/.laz file.',
  },
]

const STATS = [
  { value: '80+', label: 'Rust Tests' },
  { value: '119', label: 'IPC Commands' },
  { value: '33', label: 'Tool Dialogs' },
  { value: '0', label: 'Cloud Dependencies' },
]

export default function IndustrialPage() {
  const [copied, setCopied] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,165,0,0.15),transparent_50%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400 mb-6">
            <Shield className="h-4 w-4" />
            Offline · No Subscription · Node-Locked License
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
            MetaRDU <span className="text-orange-500">Industrial</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Desktop surveying software for mining and marine operations.
            Built with Rust + Tauri 2.0. Runs on rugged field laptops.
            No cloud, no API keys, no subscriptions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#download"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-8 py-3 text-lg font-bold text-slate-950 transition-colors hover:bg-orange-400"
            >
              <Download className="h-5 w-5" />
              Download
            </a>
            <a
              href="https://github.com/error302/metardu-industrial"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-8 py-3 text-lg font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              <GitBranch className="h-5 w-5" />
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 px-6 border-y border-slate-800">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-orange-500">{stat.value}</div>
              <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            What's Inside
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-orange-500/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 flex-shrink-0">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Download</h2>
          <p className="text-center text-slate-400 mb-12">
            The core app is free and open-source. The EOM Volumetric Auditor module
            requires a license — contact sales for a perpetual or per-report license.
          </p>

          {/* Main App */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <FileBox className="h-6 w-6 text-orange-500" />
              <h3 className="text-xl font-bold">MetaRDU Industrial App</h3>
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                v0.1.0
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Full desktop application with all mining and marine tools.
              Requires Windows 10+, macOS 12+, or Ubuntu 22.04+.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DownloadButton
                platform="Windows"
                extension=".msi"
                href="/download/metardu-industrial-0.1.0-windows.msi"
              />
              <DownloadButton
                platform="macOS"
                extension=".dmg"
                href="/download/metardu-industrial-0.1.0-macos.dmg"
              />
              <DownloadButton
                platform="Linux"
                extension=".AppImage"
                href="/download/metardu-industrial-0.1.0-linux.AppImage"
              />
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Installers will be available once the first production build is signed.
              For now, build from source: <code className="text-orange-400">cargo tauri build</code>
            </div>
          </div>

          {/* Free Verifier */}
          <div className="rounded-xl border border-green-800/30 bg-green-900/10 p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <FileCheck className="h-6 w-6 text-green-400" />
              <h3 className="text-xl font-bold">Standalone PDF Verifier</h3>
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                FREE · Open Source
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Verify the chain-of-custody of any MetaRDU Industrial signed PDF report.
              No installation required — just run the binary. Mine owners, insurers,
              and lawyers can verify reports without buying the software.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DownloadButton
                platform="Windows"
                extension=".exe"
                href="/download/metardu-verify-windows.exe"
                free
              />
              <DownloadButton
                platform="macOS"
                extension=""
                href="/download/metardu-verify-macos"
                free
              />
              <DownloadButton
                platform="Linux"
                extension=""
                href="/download/metardu-verify-linux"
                free
              />
            </div>
          </div>

          {/* License Info */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-orange-500" />
              <h3 className="text-xl font-bold">Licensing</h3>
            </div>
            <div className="space-y-3">
              <LicenseTier
                name="Trial"
                price="Free"
                description="3 signed reports per machine. All features unlocked. No time limit."
              />
              <LicenseTier
                name="Per-Report"
                price="Pay per deliverable"
                description="Buy a pack of N signed reports. No subscription. Never expires."
              />
              <LicenseTier
                name="Perpetual"
                price="One-time purchase"
                description="Unlimited signed reports on one machine. Forever. No recurring fees."
              />
              <LicenseTier
                name="Site License"
                price="Annual"
                description="Unlimited reports for one named site. For continuous-monitoring operations."
              />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300"
              >
                View full pricing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-slate-500">
            MetaRDU Industrial is built with Tauri 2.0 (Rust) + React 19 + OpenLayers 10.
            No Mapbox, no subscription services, no API keys.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            © 2026 MetaRDU. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

function DownloadButton({
  platform, extension, href, free = false,
}: {
  platform: string; extension: string; href: string; free?: boolean
}) {
  return (
    <a
      href={href}
      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
        free
          ? 'border-green-700/30 bg-green-900/20 text-green-300 hover:bg-green-900/30'
          : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
      }`}
    >
      <Download className="h-4 w-4" />
      {platform}
      {extension && <span className="text-xs opacity-60">{extension}</span>}
    </a>
  )
}

function LicenseTier({
  name, price, description,
}: {
  name: string; price: string; description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-800 p-3">
      <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{name}</span>
          <span className="text-sm text-orange-400">{price}</span>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}
