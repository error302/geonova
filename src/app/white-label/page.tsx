'use client';

import { useState, useEffect, useCallback, useRef } from 'react'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api/client'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const whiteLabelConfigSchema = z.object({
  enabled: z.boolean(),
  organizationName: z.string(),
  logoUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  primaryColor: z.string(),
  customCss: z.string().nullable(),
  customDomain: z.string().nullable(),
  emailFooter: z.string().nullable(),
}).passthrough()

const whiteLabelResponseSchema = z.object({
  data: whiteLabelConfigSchema.nullable().optional(),
}).passthrough()

const uploadResponseSchema = z.object({
  data: z.object({ url: z.string() }).passthrough(),
}).passthrough()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhiteLabelConfig {
  enabled: boolean
  organizationName: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  customCss: string | null
  customDomain: string | null
  emailFooter: string | null
}

const DEFAULT: WhiteLabelConfig = {
  enabled: false,
  organizationName: 'METARDU',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#0EA5E9',
  customCss: null,
  customDomain: null,
  emailFooter: null,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WhiteLabelPage() {
  // Config state
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT)
  const [initialConfig, setInitialConfig] = useState<WhiteLabelConfig>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Upload state
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)
  const [dragOverLogo, setDragOverLogo] = useState(false)
  const [dragOverFavicon, setDragOverFavicon] = useState(false)

  // Refs for hidden file inputs
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ---------------------------------------------------------------------------
  // Fetch config on mount
  // ---------------------------------------------------------------------------
  const fetchConfig = useCallback(async () => {
    try {
      const json = await apiGet(
        '/api/white-label',
        whiteLabelResponseSchema,
        { ttlMs: 0 },
      )
      const data: WhiteLabelConfig = (json.data as unknown as WhiteLabelConfig) ?? DEFAULT
      setConfig(data)
      setInitialConfig(data)
      setLogoPreview(data.logoUrl)
      setFaviconPreview(data.faviconUrl)
    } catch (err) {
      if (err instanceof ApiError) {
        showToast('error', err.message || 'Failed to load white-label config')
      } else {
        showToast('error', 'Failed to load white-label config')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
  }

  // ---------------------------------------------------------------------------
  // Save config (PUT)
  // ---------------------------------------------------------------------------
  async function handleSave() {
    setSaving(true)
    try {
      const json = await apiPut(
        '/api/white-label',
        whiteLabelResponseSchema,
        config,
      )
      const saved = (json.data as unknown as WhiteLabelConfig) ?? config
      setConfig(saved)
      setInitialConfig(saved)
      showToast('success', 'White-label configuration saved')
    } catch (err) {
      if (err instanceof ApiError) {
        showToast('error', err.message || 'Failed to save configuration')
      } else {
        showToast('error', 'Failed to save configuration')
      }
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // File upload (POST multipart)
  // ---------------------------------------------------------------------------
  async function uploadFile(file: File, type: 'logo' | 'favicon') {
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon
    const setPreview = type === 'logo' ? setLogoPreview : setFaviconPreview
    const setConfigField = type === 'logo'
      ? (url: string | null) => setConfig((c) => ({ ...c, logoUrl: url }))
      : (url: string | null) => setConfig((c) => ({ ...c, faviconUrl: url }))

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const json = await apiPost(
        '/api/white-label',
        uploadResponseSchema,
        formData,
      )
      const url: string = json.data.url
      setPreview(url)
      setConfigField(url)
      showToast('success', `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded`)
    } catch (err) {
      if (err instanceof ApiError) {
        showToast('error', err.message || `Failed to upload ${type}`)
      } else {
        showToast('error', `Failed to upload ${type}`)
      }
    } finally {
      setUploading(false)
    }
  }

  // Remove logo / favicon
  async function removeImage(type: 'logo' | 'favicon') {
    const setPreview = type === 'logo' ? setLogoPreview : setFaviconPreview
    const setConfigField = type === 'logo'
      ? (url: string | null) => setConfig((c) => ({ ...c, logoUrl: url }))
      : (url: string | null) => setConfig((c) => ({ ...c, faviconUrl: url }))

    setPreview(null)
    setConfigField(null)
  }

  // Drag-and-drop helpers
  function handleDragOver(e: React.DragEvent, type: 'logo' | 'favicon') {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'logo') setDragOverLogo(true)
    else setDragOverFavicon(true)
  }

  function handleDragLeave(e: React.DragEvent, type: 'logo' | 'favicon') {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'logo') setDragOverLogo(false)
    else setDragOverFavicon(false)
  }

  function handleDrop(e: React.DragEvent, type: 'logo' | 'favicon') {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'logo') setDragOverLogo(false)
    else setDragOverFavicon(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      uploadFile(file, type)
    } else {
      showToast('error', 'Please drop a valid image file')
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') {
    const file = e.target.files?.[0]
    if (file) uploadFile(file, type)
    // Reset input so re-selecting the same file still fires onChange
    e.target.value = ''
  }

  // ---------------------------------------------------------------------------
  // Dirty check
  // ---------------------------------------------------------------------------
  const isDirty = JSON.stringify(config) !== JSON.stringify(initialConfig)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">Loading configuration…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <span>{toast.type === 'success' ? '' : '[x]'}</span>
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          White-Label Settings
        </h1>
        <p className="text-[var(--text-muted)] mb-8">
          Customize METARDU for your organization with your own branding
        </p>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
          {/* ---- Enable / Disable Toggle ---- */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Enable White-Label
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Apply your brand identity across the platform
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input aria-label="Enabled"
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-hover)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]" />
            </label>
          </div>

          {config.enabled && (
            <div className="p-6 space-y-6">
              {/* ---- Organization Name ---- */}
              <FieldGroup label="Organization Name" hint="Appears on reports and shared links">
                <input
                  type="text"
                  value={config.organizationName}
                  onChange={(e) => setConfig({ ...config, organizationName: e.target.value })}
                  aria-label="Organization name" placeholder="METARDU"
                  className="input-base"
                />
              </FieldGroup>

              {/* ---- Logo Upload ---- */}
              <FieldGroup label="Logo" hint="Recommended: 200×60 px, PNG or SVG">
                <div className="flex items-start gap-4">
                  <div
                    className={`relative flex-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      dragOverLogo
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
                    }`}
                    onClick={() => logoInputRef.current?.click()}
                    onDragOver={(e) => handleDragOver(e, 'logo')}
                    onDragLeave={(e) => handleDragLeave(e, 'logo')}
                    onDrop={(e) => handleDrop(e, 'logo')}
                  >
                    {uploadingLogo ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--text-muted)]">Uploading…</span>
                      </div>
                    ) : logoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="max-h-16 object-contain"
                        />
                        <span className="text-xs text-[var(--text-muted)]">
                          Click or drag to replace
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <UploadIcon />
                        <span className="text-sm text-[var(--text-muted)]">
                          Click or drag image here
                        </span>
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, 'logo')}
                    />
                  </div>

                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => removeImage('logo')}
                      className="shrink-0 px-3 py-2 text-sm text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </FieldGroup>

              {/* ---- Favicon Upload ---- */}
              <FieldGroup label="Favicon" hint="Recommended: 32×32 px, ICO or PNG">
                <div className="flex items-start gap-4">
                  <div
                    className={`relative flex-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      dragOverFavicon
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
                    }`}
                    onClick={() => faviconInputRef.current?.click()}
                    onDragOver={(e) => handleDragOver(e, 'favicon')}
                    onDragLeave={(e) => handleDragLeave(e, 'favicon')}
                    onDrop={(e) => handleDrop(e, 'favicon')}
                  >
                    {uploadingFavicon ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-[var(--text-muted)]">Uploading…</span>
                      </div>
                    ) : faviconPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={faviconPreview}
                          alt="Favicon preview"
                          className="w-8 h-8 object-contain"
                        />
                        <span className="text-xs text-[var(--text-muted)]">
                          Click or drag to replace
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <UploadIcon />
                        <span className="text-sm text-[var(--text-muted)]">
                          Click or drag image here
                        </span>
                      </div>
                    )}
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, 'favicon')}
                    />
                  </div>

                  {faviconPreview && (
                    <button
                      type="button"
                      onClick={() => removeImage('favicon')}
                      className="shrink-0 px-3 py-2 text-sm text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </FieldGroup>

              {/* ---- Primary Color ---- */}
              <FieldGroup label="Primary Color" hint="Used for accents, buttons, and links">
                <div className="flex items-center gap-4">
                  <input aria-label="Primarycolor"
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-12 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    aria-label="Primary color (hex)" placeholder="#0EA5E9"
                    className="input-base flex-1 font-mono"
                  />
                </div>
              </FieldGroup>

              {/* ---- Custom CSS ---- */}
              <FieldGroup label="Custom CSS" hint="Inject additional styles into the platform">
                <textarea
                  value={config.customCss ?? ''}
                  onChange={(e) => setConfig({ ...config, customCss: e.target.value || null })}
                  placeholder=".my-custom-class { color: red; }"
                  rows={4}
                  className="input-base font-mono text-sm resize-y"
                />
              </FieldGroup>

              {/* ---- Custom Domain ---- */}
              <FieldGroup
                label="Custom Domain"
                hint="Configure a CNAME record pointing to METARDU to use your own domain"
              >
                <input
                  type="text"
                  value={config.customDomain ?? ''}
                  onChange={(e) => setConfig({ ...config, customDomain: e.target.value || null })}
                  aria-label="Custom domain" placeholder="survey.yourcompany.com"
                  className="input-base"
                />
              </FieldGroup>

              {/* ---- Email Footer ---- */}
              <FieldGroup label="Email Footer" hint="Text appended to all automated emails">
                <textarea
                  value={config.emailFooter ?? ''}
                  onChange={(e) => setConfig({ ...config, emailFooter: e.target.value || null })}
                  placeholder="Powered by Your Company"
                  rows={2}
                  className="input-base resize-y"
                />
              </FieldGroup>

              {/* ---- Live Preview ---- */}
              <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                <h3 className="font-medium text-[var(--text-primary)] mb-3 text-sm">
                  Preview
                </h3>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="h-10 object-contain rounded"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      {config.organizationName.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold text-lg text-[var(--text-primary)]">
                    {config.organizationName}
                  </span>
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    Live
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ---- Save Button ---- */}
          <div className="p-6 border-t border-[var(--border-color)]">
            <button
              onClick={handleSave}
              disabled={saving || (!isDirty && config.enabled)}
              className="w-full py-3 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: config.enabled ? config.primaryColor : 'var(--accent)' }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Configuration'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Global styles for .input-base (scoped via style tag) */}
      <style jsx global>{`
        .input-base {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary, transparent);
          color: var(--text-primary);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-base:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-color: var(--accent);
        }
        .input-base:focus {
          border-color: var(--accent);
        }
        .input-base::placeholder {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
        {label}
      </label>
      {hint && (
        <p className="text-xs text-[var(--text-muted)] mb-2">{hint}</p>
      )}
      {children}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--text-muted)]"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
