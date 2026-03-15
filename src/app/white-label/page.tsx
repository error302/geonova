'use client'

import { useState } from 'react'
import { WhiteLabelConfig, DEFAULT_WHITE_LABEL } from '@/lib/enterprise'

export default function WhiteLabelPage() {
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT_WHITE_LABEL)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">White-Label Settings</h1>
        <p className="text-gray-600 mb-8">Customize GeoNova for your organization</p>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Enable White-Label</h2>
              <p className="text-sm text-gray-500">Customize the platform with your brand</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.enabled}
                onChange={(e) => setConfig({...config, enabled: e.target.checked})}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {config.enabled && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={config.organizationName}
                    onChange={(e) => setConfig({...config, organizationName: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={config.logoUrl || ''}
                    onChange={(e) => setConfig({...config, logoUrl: e.target.value})}
                    placeholder="https://your-domain.com/logo.png"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
                  <input
                    type="url"
                    value={config.faviconUrl || ''}
                    onChange={(e) => setConfig({...config, faviconUrl: e.target.value})}
                    placeholder="https://your-domain.com/favicon.ico"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <div className="flex gap-4">
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                      className="w-16 h-10 border rounded"
                    />
                    <input
                      type="text"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                      className="flex-1 p-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom CSS</label>
                  <textarea
                    value={config.customCss || ''}
                    onChange={(e) => setConfig({...config, customCss: e.target.value})}
                    placeholder=".custom-class { ... }"
                    rows={4}
                    className="w-full p-2 border rounded-lg font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain</label>
                  <input
                    type="text"
                    value={config.customDomain || ''}
                    onChange={(e) => setConfig({...config, customDomain: e.target.value})}
                    placeholder="survey.yourcompany.com"
                    className="w-full p-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Configure CNAME record to point to GeoNova
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Footer</label>
                  <textarea
                    value={config.emailFooter || ''}
                    onChange={(e) => setConfig({...config, emailFooter: e.target.value})}
                    placeholder="Powered by Your Company"
                    rows={2}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-800 mb-2">Preview</h3>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg"
                    style={{ backgroundColor: config.primaryColor }}
                  />
                  <span className="font-semibold text-lg">{config.organizationName}</span>
                </div>
              </div>
            </>
          )}

          <button
            onClick={handleSave}
            className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {saved ? '✓ Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}
