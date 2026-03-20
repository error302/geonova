'use client'

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react'
import {
  getListings, searchListings, postListing, deleteListing,
  sendInquiry, getInquiriesFor,
  InstrumentListing, ListingType, InstrumentCategory, Currency, Condition,
  CATEGORIES, CONDITIONS, BRANDS, COUNTRIES, CURRENCIES, fmtPrice,
} from '@/lib/marketplace/instruments'
import { compressImage, isImageFile, MAX_IMAGES, base64Bytes } from '@/lib/marketplace/imageUtils'
import { useSubscription } from '@/lib/subscription/subscriptionContext'
import { createClient } from '@/lib/supabase/client'

// ── tiny helpers ─────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function condBadge(c: Condition) {
  const m: Record<Condition, string> = {
    new:       'bg-green-900/40 text-green-300 border-green-700/40',
    excellent: 'bg-blue-900/40  text-blue-300  border-blue-700/40',
    good:      'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)]',
    fair:      'bg-amber-900/30 text-amber-400 border-amber-700/30',
    for_parts: 'bg-red-900/30   text-red-400   border-red-700/30',
  }
  return m[c]
}

function typeBadge(t: ListingType) {
  if (t === 'sale')   return 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20'
  if (t === 'rent')   return 'bg-purple-900/40 text-purple-300 border-purple-700/40'
  return 'bg-amber-900/30 text-amber-400 border-amber-700/30'
}

function typeLabel(t: ListingType) {
  if (t === 'sale') return 'For sale'
  if (t === 'rent') return 'For rent'
  return 'Wanted'
}

// ── Image picker component ────────────────────────────────────────────────────

function ImagePicker({
  images,
  onChange,
}: {
  images: string[]
  onChange: (imgs: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const processFiles = async (files: FileList | File[]) => {
    const eligible = Array.from(files).filter(isImageFile).slice(0, MAX_IMAGES - images.length)
    if (eligible.length === 0) return
    setUploading(true)
    const compressed: string[] = []
    for (const file of eligible) {
      try {
        const b64 = await compressImage(file)
        compressed.push(b64)
      } catch { /* skip bad file */ }
    }
    onChange([...images, ...compressed].slice(0, MAX_IMAGES))
    setUploading(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
  }

  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i))

  const totalKB = Math.round(images.reduce((s, b) => s + base64Bytes(b), 0) / 1024)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-[var(--text-muted)]">
          Photos ({images.length}/{MAX_IMAGES})
        </label>
        {images.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)]">{totalKB} KB stored</span>
        )}
      </div>

      {/* Existing images grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((src, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-color)] group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => remove(i)}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Remove photo"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white text-center py-0.5">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {images.length < MAX_IMAGES && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border-color)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-secondary)]'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--text-muted)]">Compressing…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm text-[var(--text-secondary)] font-medium">
                {images.length === 0 ? 'Add photos' : 'Add more photos'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Drag & drop or click · JPEG, PNG, HEIC · Max {MAX_IMAGES} photos
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files) processFiles(e.target.files) }}
      />
    </div>
  )
}

// ── Image gallery (in detail panel) ─────────────────────────────────────────

function ImageGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  if (images.length === 0) {
    return (
      <div className="h-52 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] flex items-center justify-center">
        <svg className="w-10 h-10 text-[var(--border-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    )
  }

  return (
    <>
      {/* Main image */}
      <div
        className="relative h-56 rounded-xl overflow-hidden border border-[var(--border-color)] cursor-zoom-in bg-[var(--bg-secondary)]"
        onClick={() => setLightbox(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]} alt="Listing photo" className="w-full h-full object-contain" />
        {images.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); setActive(a => (a - 1 + images.length) % images.length) }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); setActive(a => (a + 1) % images.length) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setActive(i) }}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === active ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
        <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
          {active + 1}/{images.length}
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2">
          {images.map((src, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-colors ${
                i === active ? 'border-[var(--accent)]' : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
              }`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white p-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setActive(a => (a - 1 + images.length) % images.length) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); setActive(a => (a + 1) % images.length) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[active]} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// ── Post listing modal ────────────────────────────────────────────────────────

// ── Verified badge ───────────────────────────────────────────────────────────

function VerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 rounded-full font-medium ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}>
      <svg className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.307 4.491 4.491 0 01-1.307-3.497A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
      </svg>
      Verified Pro
    </span>
  )
}

// ── Upgrade prompt ────────────────────────────────────────────────────────────

function UpgradeToPost({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Pro required to post</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">
          Posting listings on the equipment marketplace is a <strong className="text-[var(--text-primary)]">Pro feature</strong>. 
          Upgrade to list your instruments for sale or rent — and get a <strong className="text-[var(--accent)]">Verified Pro</strong> badge 
          that builds buyer trust.
        </p>

        {/* What Pro gets you */}
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 mb-6 text-left space-y-2">
          {[
            'Post unlimited sale and rental listings',
            'Verified Pro badge on every listing',
            'Buyers see your listings first',
            'Unlimited survey projects',
            'Full PDF + DXF reports',
            'GPS stakeout mode',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <svg className="w-4 h-4 text-[var(--accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {item}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <a href="/pricing" className="btn btn-primary flex-1">
            Upgrade — KSh 500/mo
          </a>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">14-day free trial · No card needed to start</p>
      </div>
    </div>
  )
}

const BLANK: Omit<InstrumentListing, 'id' | 'postedAt' | 'sold'> = {
  type: 'sale', category: 'total_station', title: '', brand: '', model: '',
  condition: 'good', year: undefined, description: '', price: 0 as any,
  currency: 'KES', rentPeriod: undefined, location: '', country: 'Kenya',
  sellerName: '', sellerContact: '', images: [], verified: false,
}

function PostModal({ onSave, onClose, verified }: { onSave: (l: InstrumentListing) => void; onClose: () => void; verified: boolean }) {
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.title.trim())         { setErr('Give the listing a title'); return }
    if (!form.brand.trim())         { setErr('Brand is required'); return }
    if (!form.model.trim())         { setErr('Model is required'); return }
    if (!form.description.trim())   { setErr('Add a description'); return }
    if (!form.price || Number(form.price) <= 0) { setErr('Set a price'); return }
    if (!form.location.trim())      { setErr('Location is required'); return }
    if (!form.sellerName.trim())    { setErr('Your name is required'); return }
    if (!form.sellerContact.trim()) { setErr('Contact details required so buyers can reach you'); return }
    setErr('')
    setSubmitting(true)
    try {
      onSave(postListing({ ...form, price: Number(form.price), verified }))
    } catch (e: any) {
      setErr(e.message || 'Failed to save. Try removing some photos.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Post a listing</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl p-1">×</button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {err && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{err}</p>}

          {/* Listing type */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-2">Listing type *</label>
            <div className="flex gap-2">
              {(['sale','rent','wanted'] as ListingType[]).map(t => (
                <button key={t} onClick={() => f('type', t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.type === t ? typeBadge(t) : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]'
                  }`}>
                  {t === 'sale' ? 'Selling' : t === 'rent' ? 'For rent' : 'Wanted'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Category *</label>
              <select value={form.category} onChange={e => f('category', e.target.value as InstrumentCategory)} className="input w-full">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Condition *</label>
              <select value={form.condition} onChange={e => f('condition', e.target.value as Condition)} className="input w-full">
                {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label} — {c.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Brand *</label>
              <input value={form.brand} onChange={e => f('brand', e.target.value)} list="brand-list"
                placeholder="Leica, Trimble…" className="input w-full" />
              <datalist id="brand-list">{BRANDS.map(b => <option key={b} value={b} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Model *</label>
              <input value={form.model} onChange={e => f('model', e.target.value)}
                placeholder="TS16, S9, DNA03…" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Year of manufacture</label>
              <input type="number" min={1990} max={new Date().getFullYear()}
                value={form.year || ''} onChange={e => f('year', Number(e.target.value) || undefined)}
                placeholder="e.g. 2019" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                {form.type === 'wanted' ? 'Max budget' : 'Price'} *
              </label>
              <div className="flex gap-2">
                <input type="number" min={0} value={form.price || ''}
                  onChange={e => f('price', e.target.value)}
                  placeholder="Amount" className="input flex-1" />
                <select value={form.currency} onChange={e => f('currency', e.target.value as Currency)} className="input w-20">
                  {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
            </div>
          </div>

          {form.type === 'rent' && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Rent period</label>
              <select value={form.rentPeriod || 'day'} onChange={e => f('rentPeriod', e.target.value)} className="input w-full">
                <option value="day">Per day</option>
                <option value="week">Per week</option>
                <option value="month">Per month</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Listing title *</label>
            <input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="e.g. Leica TS16 Total Station — 2019, with tribrach and case"
              className="input w-full" />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Description *</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={4}
              placeholder="Describe the instrument: accessories included (case, tribrach, cables, charger), reason for selling, calibration status, any faults, original box, etc."
              className="input w-full resize-none" />
          </div>

          {/* ── Image upload ── */}
          <ImagePicker
            images={form.images}
            onChange={imgs => f('images', imgs)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Location (town) *</label>
              <input value={form.location} onChange={e => f('location', e.target.value)}
                placeholder="Nairobi, Kampala…" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Country *</label>
              <select value={form.country} onChange={e => f('country', e.target.value)} className="input w-full">
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Your name *</label>
              <input value={form.sellerName} onChange={e => f('sellerName', e.target.value)}
                placeholder="Your name or company" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Contact (phone / email) *</label>
              <input value={form.sellerContact} onChange={e => f('sellerContact', e.target.value)}
                placeholder="+254712345678" className="input w-full" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={submitting} className="btn btn-primary flex-1">
            {submitting ? 'Saving…' : form.type === 'wanted' ? 'Post wanted ad' : 'Post listing'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Listing detail drawer ─────────────────────────────────────────────────────

function ListingDetail({ listing, onClose, onRefresh }: {
  listing: InstrumentListing; onClose: () => void; onRefresh: () => void
}) {
  const [inquiries, setInquiries] = useState(getInquiriesFor(listing.id))
  const [showForm, setShowForm] = useState(false)
  const [sent, setSent] = useState(false)
  const [iqErr, setIqErr] = useState('')
  const [form, setForm] = useState({ buyerName: '', buyerContact: '', message: '' })
  const fq = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const catLabel  = CATEGORIES.find(c => c.id === listing.category)?.label  ?? listing.category
  const condLabel = CONDITIONS.find(c  => c.id === listing.condition)?.label ?? listing.condition

  const submit = () => {
    if (!form.buyerName)      { setIqErr('Your name is required');    return }
    if (!form.buyerContact)   { setIqErr('Your contact is required'); return }
    if (!form.message.trim()) { setIqErr('Write a message to the seller'); return }
    sendInquiry({ listingId: listing.id, ...form })
    setSent(true)
    setInquiries(getInquiriesFor(listing.id))
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-color)] h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-card)] z-10">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--text-primary)] leading-snug text-sm truncate">{listing.title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{catLabel} · {listing.location}, {listing.country}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 ml-3 flex-shrink-0">×</button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Photo gallery ── */}
          <ImageGallery images={listing.images} />

          {/* Price + badges */}
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--accent)]">
              {fmtPrice(listing.price, listing.currency, listing.type === 'rent' ? listing.rentPeriod : undefined)}
            </span>
            <div className="flex gap-2 flex-wrap justify-end">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadge(listing.type)}`}>{typeLabel(listing.type)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${condBadge(listing.condition)}`}>{condLabel}</span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {([
              ['Brand',    listing.brand],
              ['Model',    listing.model],
              ['Category', catLabel],
              ['Year',     listing.year ? String(listing.year) : '—'],
              ['Location', `${listing.location}, ${listing.country}`],
              ['Posted',   relTime(listing.postedAt)],
            ] as [string,string][]).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{k}</p>
                <p className="text-[var(--text-primary)] mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Description</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {listing.description || 'No description provided.'}
            </p>
          </div>

          {/* Seller */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {listing.type === 'wanted' ? 'Posted by' : 'Seller'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-[var(--text-primary)]">{listing.sellerName}</p>
              {listing.verified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-[var(--accent)] mt-0.5">{listing.sellerContact}</p>
          </div>

          {/* Contact form */}
          {!sent && !showForm && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary w-full">
              {listing.type === 'wanted' ? 'I have this instrument' : 'Contact seller'}
            </button>
          )}
          {sent && (
            <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 text-center">
              <p className="text-green-400 font-semibold text-sm">Message sent</p>
              <p className="text-xs text-green-500 mt-1">
                The {listing.type === 'wanted' ? 'buyer' : 'seller'} will contact you at the details you provided.
              </p>
            </div>
          )}
          {showForm && !sent && (
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {listing.type === 'wanted' ? 'Offer your instrument' : 'Send message to seller'}
              </h3>
              {iqErr && <p className="text-xs text-red-400">{iqErr}</p>}
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Your name *</label>
                <input value={form.buyerName} onChange={e => fq('buyerName', e.target.value)}
                  placeholder="Your full name" className="input w-full text-sm py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Your contact *</label>
                <input value={form.buyerContact} onChange={e => fq('buyerContact', e.target.value)}
                  placeholder="+254712345678 or email" className="input w-full text-sm py-1.5" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Message *</label>
                <textarea value={form.message} onChange={e => fq('message', e.target.value)} rows={3}
                  placeholder={listing.type === 'wanted'
                    ? 'Describe your instrument — brand, model, condition, year, asking price…'
                    : 'Ask questions, propose a price, arrange to inspect the instrument…'}
                  className="input w-full resize-none text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 text-sm py-2">Cancel</button>
                <button onClick={submit} className="btn btn-primary flex-1 text-sm py-2">Send</button>
              </div>
            </div>
          )}

          {/* Inquiries received */}
          {inquiries.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Messages received ({inquiries.length})
              </p>
              <div className="space-y-2">
                {inquiries.map(iq => (
                  <div key={iq.id} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-3 text-sm">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-medium text-[var(--text-primary)]">{iq.buyerName}</span>
                      <span className="text-xs text-[var(--text-muted)]">{relTime(iq.sentAt)}</span>
                    </div>
                    <p className="text-xs text-[var(--accent)] mb-1">{iq.buyerContact}</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{iq.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, onClick }: { listing: InstrumentListing; onClick: () => void }) {
  const catLabel  = CATEGORIES.find(c => c.id === listing.category)?.label  ?? listing.category
  const condLabel = CONDITIONS.find(c  => c.id === listing.condition)?.label ?? listing.condition
  const cover     = listing.images[0]

  return (
    <div onClick={onClick}
      className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden hover:border-[var(--accent)]/30 transition-colors cursor-pointer group">

      {/* Cover photo or placeholder */}
      <div className="h-44 bg-[var(--bg-secondary)] overflow-hidden relative flex-shrink-0">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--border-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
        {/* Photo count badge */}
        {listing.images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M16.5 3.75h.008v.008h-.008V3.75z" /></svg>
            {listing.images.length}
          </div>
        )}
        {/* Type badge overlay */}
        <div className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full border font-medium ${typeBadge(listing.type)}`}>
          {typeLabel(listing.type)}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <h3 className="font-semibold text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent)] transition-colors text-sm flex-1">
            {listing.title}
          </h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${condBadge(listing.condition)}`}>
            {condLabel}
          </span>
        </div>

        <p className="text-xs text-[var(--text-muted)] mb-3">
          {catLabel} · {listing.location}, {listing.country}
        </p>

        {listing.description && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">
            {listing.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
          <span className="text-base font-bold text-[var(--accent)]">
            {fmtPrice(listing.price, listing.currency, listing.type === 'rent' ? listing.rentPeriod : undefined)}
          </span>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              {listing.verified && <VerifiedBadge small />}
              <p className="text-xs text-[var(--text-muted)]">{listing.sellerName}</p>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">{relTime(listing.postedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { plan, isTrialing, loading: subLoading } = useSubscription()
  const isPro = plan === 'pro' || plan === 'team' || isTrialing

  const [listings, setListings]       = useState<InstrumentListing[]>([])
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState<'' | ListingType>('sale')
  const [filterCat, setFilterCat]     = useState<'' | InstrumentCategory>('')
  const [filterCountry, setFilterCountry] = useState('')
  const [showPost, setShowPost]       = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [active, setActive]           = useState<InstrumentListing | null>(null)

  const reload = useCallback(() => {
    if (search.trim()) {
      setListings(searchListings(search))
    } else {
      setListings(getListings({
        type: filterType || undefined,
        category: filterCat || undefined,
        country: filterCountry || undefined,
      }))
    }
  }, [search, filterType, filterCat, filterCountry])

  useEffect(() => { reload() }, [reload])

  const counts = {
    sale:   getListings({ type: 'sale'   }).length,
    rent:   getListings({ type: 'rent'   }).length,
    wanted: getListings({ type: 'wanted' }).length,
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Equipment marketplace</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Buy, sell and rent survey instruments — directly between surveyors.
            </p>
          </div>
          <button
            onClick={() => isPro ? setShowPost(true) : setShowUpgrade(true)}
            className="btn btn-primary flex-shrink-0 flex items-center gap-2"
          >
            {!isPro && !subLoading && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
            + Post listing
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([
            { key: '',       label: 'All',        count: counts.sale + counts.rent + counts.wanted },
            { key: 'sale',   label: 'For sale',   count: counts.sale },
            { key: 'rent',   label: 'For rent',   count: counts.rent },
            { key: 'wanted', label: 'Wanted',     count: counts.wanted },
          ] as const).map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilterType(key as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filterType === key
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--accent)]/40'
              }`}>
              {label}{count > 0 && <span className="ml-1.5 text-xs opacity-70">({count})</span>}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by brand, model, location…"
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:border-[var(--accent)]" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value as any)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-sm">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-sm">
            <option value="">All countries</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Empty state */}
        {listings.length === 0 && (
          <div className="text-center py-24 border border-dashed border-[var(--border-color)] rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {search || filterCat || filterCountry ? 'No matching listings' : 'No listings yet'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              {search || filterCat || filterCountry
                ? 'Try adjusting your filters'
                : 'Be the first to list a survey instrument. Sell, rent out, or post a wanted ad.'}
            </p>
            {!search && !filterCat && !filterCountry && (
              <button onClick={() => isPro ? setShowPost(true) : setShowUpgrade(true)} className="btn btn-primary">Post a listing</button>
            )}
          </div>
        )}

        {/* Grid */}
        {listings.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(l => (
              <ListingCard key={l.id} listing={l} onClick={() => setActive(l)} />
            ))}
          </div>
        )}
      </div>

      {showUpgrade && <UpgradeToPost onClose={() => setShowUpgrade(false)} />}

      {showPost && (
        <PostModal
          verified={isPro}
          onSave={l => { reload(); setShowPost(false); setActive(l) }}
          onClose={() => setShowPost(false)}
        />
      )}

      {active && (
        <ListingDetail
          listing={listings.find(l => l.id === active.id) ?? active}
          onClose={() => setActive(null)}
          onRefresh={reload}
        />
      )}
    </div>
  )
}
