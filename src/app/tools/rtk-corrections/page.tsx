'use client';

/**
 * NTRIP / RTK Corrections Client
 *
 * AUDIT FIX (2026-07-03): Real-time GNSS correction client for receiving
 * RTK corrections from CORS networks (KENCORS, TANZACORS, etc.) via NTRIP.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Satellite, Wifi, WifiOff, Activity, Zap } from 'lucide-react'
import { CORS_NETWORKS, RTCM_TYPE_NAMES, type RTCMMessage } from '@/lib/gnss/ntripClient'

export default function NTRIPClientPage() {
  const [network, setNetwork] = useState(CORS_NETWORKS[0].id)
  const [host, setHost] = useState(CORS_NETWORKS[0].host)
  const [port, setPort] = useState(CORS_NETWORKS[0].port)
  const [mountpoint, setMountpoint] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<RTCMMessage[]>([])
  const [messageCount, setMessageCount] = useState(0)
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const net = CORS_NETWORKS.find(n => n.id === network)
    if (net) { setHost(net.host); setPort(net.port) }
  }, [network])

  const connect = useCallback(() => {
    if (!host || !mountpoint) { setError('Host and mountpoint are required'); return }
    setError(null); setStatusMsg('Connecting...'); setMessages([]); setMessageCount(0)
    const params = new URLSearchParams({ host, port: String(port), mountpoint })
    if (username) params.set('user', username)
    if (password) params.set('pass', password)
    const es = new EventSource(`/api/gnss/ntrip?${params}`)
    eventSourceRef.current = es
    es.addEventListener('status', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setStatusMsg(data.message || data.error || '')
      if (data.connected) { setConnected(true); setError(null) }
      else { setConnected(false); if (data.error) setError(data.error) }
    })
    es.addEventListener('rtcm', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      setMessageCount(data.messageCount); setLastMessageAt(data.lastMessageAt)
      setMessages(prev => [...prev, { type: data.type, length: data.length, receivedAt: data.receivedAt }].slice(-50))
    })
    es.onerror = () => { setConnected(false); setError('Connection lost'); es.close() }
  }, [host, port, mountpoint, username, password])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null }
    setConnected(false); setStatusMsg('Disconnected')
  }, [])

  useEffect(() => { return () => { if (eventSourceRef.current) eventSourceRef.current.close() } }, [])

  const correctionAge = lastMessageAt ? Math.round((Date.now() - new Date(lastMessageAt).getTime()) / 1000) : null
  const messageTypeCounts = messages.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc }, {} as Record<number, number>)
  const selectedNetwork = CORS_NETWORKS.find(n => n.id === network)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="RTK Corrections (NTRIP)" subtitle="Real-time GNSS correction stream from CORS networks" reference="NTRIP v2 (RTCM 10410.1) | RTCM 3.3 | KENCORS" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Connection Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">CORS Network</label>
                <select value={network} onChange={e => setNetwork(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white">
                  {CORS_NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Caster Host</label>
                  <input type="text" value={host} onChange={e => setHost(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Port</label>
                  <input type="number" value={port} onChange={e => setPort(parseInt(e.target.value) || 2101)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Mountpoint</label>
                <input type="text" value={mountpoint} onChange={e => setMountpoint(e.target.value)} placeholder="NBI0" className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Username (optional)</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                {!connected ? (
                  <button onClick={connect} disabled={!host || !mountpoint} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-green-700">
                    <Wifi className="w-4 h-4" /> Connect
                  </button>
                ) : (
                  <button onClick={disconnect} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                    <WifiOff className="w-4 h-4" /> Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>
          {selectedNetwork?.description && (
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-1">{selectedNetwork.name}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{selectedNetwork.description}</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className={`rounded-xl p-6 border ${connected ? 'bg-green-500/5 border-green-500/20' : 'bg-[var(--bg-card)] border-[var(--border-color)]'}`}>
            <div className="flex items-center gap-3 mb-4">
              {connected ? <Satellite className="w-6 h-6 text-green-400 animate-pulse" /> : <Satellite className="w-6 h-6 text-[var(--text-muted)]" />}
              <div>
                <div className="text-sm font-semibold text-white">{connected ? 'Connected' : 'Disconnected'}</div>
                <div className="text-xs text-[var(--text-muted)]">{statusMsg}</div>
              </div>
            </div>
            {error && <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-red-400 text-xs mb-3">{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                <div className="text-2xl font-bold text-white">{messageCount}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Messages</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                <div className={`text-2xl font-bold ${correctionAge !== null && correctionAge > 10 ? 'text-red-400' : 'text-white'}`}>{correctionAge !== null ? `${correctionAge}s` : '—'}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Corr. Age</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                <div className="text-2xl font-bold text-white">{Object.keys(messageTypeCounts).length}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase">Msg Types</div>
              </div>
            </div>
          </div>
          {messages.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--accent)]" />RTCM Message Types</h3>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {Object.entries(messageTypeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[var(--text-muted)]">Type {type}</span>
                    <span className="text-white">{RTCM_TYPE_NAMES[parseInt(type)] || 'Unknown'}</span>
                    <span className="font-mono text-[var(--accent)]">{count}×</span>
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
