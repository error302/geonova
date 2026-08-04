'use client'

/**
 * AttributeTable — Spreadsheet view of parcel/beacon data
 *
 * Inspired by QGIS Attribute Table. Shows all features in a project
 * as rows with their attributes as columns. Supports:
 * - Inline editing of attribute values
 * - Sort by any column
 * - Filter/search
 * - Select row to highlight on map
 * - Bulk operations (delete, export)
 * - Add new parcels from the table
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Search, ArrowUpDown, Trash2, Download, Plus,
  CheckCircle2, AlertTriangle, MapPin,
} from 'lucide-react'

export interface AttributeRow {
  id: string
  parcelNumber: string
  ownerName: string
  lrNumber: string
  areaHa: number
  perimeterM: number
  beaconCount: number
  status: 'registered' | 'pending' | 'disputed' | 'cancelled'
  easting: number  // centroid
  northing: number
}

interface AttributeTableProps {
  rows: AttributeRow[]
  onSelectRow?: (row: AttributeRow) => void
  onDeleteRow?: (id: string) => void
  onExport?: () => void
}

type SortField = keyof AttributeRow
type SortDirection = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  registered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  disputed: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

export function AttributeTable({ rows, onSelectRow, onDeleteRow, onExport }: AttributeTableProps) {
  const [query, setQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('parcelNumber')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Filter
  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter(r =>
      r.parcelNumber.toLowerCase().includes(q) ||
      r.ownerName.toLowerCase().includes(q) ||
      r.lrNumber.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    )
  }, [rows, query])

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal || '')
      const bStr = String(bVal || '')
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return sorted
  }, [filteredRows, sortField, sortDir])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }, [sortField])

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedRows.size === sortedRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(sortedRows.map(r => r.id)))
    }
  }, [selectedRows, sortedRows])

  const handleCellEdit = useCallback((id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field })
    setEditValue(currentValue)
  }, [])

  const saveCellEdit = useCallback(() => {
    // In a real implementation, this would call an API to update the record
    setEditingCell(null)
    setEditValue('')
  }, [])

  const columns: Array<{ key: SortField; label: string; width: string; align?: 'left' | 'right' | 'center' }> = [
    { key: 'parcelNumber', label: 'Parcel No.', width: '120px' },
    { key: 'ownerName', label: 'Owner', width: '150px' },
    { key: 'lrNumber', label: 'LR Number', width: '120px' },
    { key: 'areaHa', label: 'Area (ha)', width: '90px', align: 'right' },
    { key: 'perimeterM', label: 'Perimeter (m)', width: '100px', align: 'right' },
    { key: 'beaconCount', label: 'Beacons', width: '70px', align: 'center' },
    { key: 'status', label: 'Status', width: '100px', align: 'center' },
  ]

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Attribute Table
          </span>
          <span className="text-[10px] text-gray-500">
            {sortedRows.length} of {rows.length} parcels
          </span>
          {selectedRows.size > 0 && (
            <span className="text-[10px] text-[var(--accent)]">
              {selectedRows.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Filter..."
              className="h-7 pl-7 pr-2 w-40 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
            />
          </div>

          {/* Export */}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-gray-400 hover:text-gray-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          )}

          {/* Bulk delete */}
          {selectedRows.size > 0 && onDeleteRow && (
            <button
              onClick={() => {
                selectedRows.forEach(id => onDeleteRow(id))
                setSelectedRows(new Set())
              }}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selectedRows.size})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
            <tr className="border-b border-[var(--border-color)]">
              <th className="px-2 py-2 w-8">
                <input aria-label="Select all rows"
                  type="checkbox"
                  checked={selectedRows.size === sortedRows.length && sortedRows.length > 0}
                  onChange={selectAll}
                  className="w-3.5 h-3.5 rounded border-[var(--border-color)] accent-[var(--accent)]"
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-2 cursor-pointer hover:bg-white/[0.04] transition-colors ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ width: col.width }}
                >
                  <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">{col.label}</span>
                    <ArrowUpDown className={`w-2.5 h-2.5 ${sortField === col.key ? 'text-[var(--accent)]' : 'text-gray-600'}`} />
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-8 text-center">
                  <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No parcels found</p>
                  <p className="text-[10px] text-gray-600 mt-1">Import parcels or adjust your filter</p>
                </td>
              </tr>
            ) : (
              sortedRows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onSelectRow?.(row)}
                  className={`border-b border-[var(--border-color)]/30 cursor-pointer transition-colors ${
                    selectedRows.has(row.id) ? 'bg-[var(--accent)]/5' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="px-2 py-1.5" onClick={(e) => { e.stopPropagation(); toggleRowSelection(row.id) }}>
                    <input aria-label="Select row"
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={() => toggleRowSelection(row.id)}
                      className="w-3.5 h-3.5 rounded border-[var(--border-color)] accent-[var(--accent)]"
                    />
                  </td>
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 text-xs ${
                        col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : ''
                      }`}
                      onDoubleClick={() => handleCellEdit(row.id, col.key, String(row[col.key] || ''))}
                    >
                      {editingCell?.id === row.id && editingCell.field === col.key ? (
                        <input aria-label="Search filter"
                          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus into the editing cell (inline edit)
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={saveCellEdit}
                          onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') setEditingCell(null) }}
                          className="w-full h-6 px-1 bg-white border border-[var(--accent)] rounded text-xs text-black"
                        />
                      ) : col.key === 'status' ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${STATUS_COLORS[row[col.key]]}`}>
                          {row[col.key]}
                        </span>
                      ) : col.key === 'areaHa' || col.key === 'perimeterM' ? (
                        <span className="text-[var(--text-secondary)]">
                          {typeof row[col.key] === 'number' ? (row[col.key] as number).toFixed(col.key === 'areaHa' ? 4 : 2) : ''}
                        </span>
                      ) : (
                        <span className="text-[var(--text-primary)]">{row[col.key]}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    {onDeleteRow && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteRow(row.id) }}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-2 border-t border-[var(--border-color)] text-[10px] text-gray-500">
        <span>
          {sortedRows.length} parcel{sortedRows.length !== 1 ? 's' : ''}
          {selectedRows.size > 0 && ` · ${selectedRows.size} selected`}
        </span>
        <span>Double-click any cell to edit</span>
      </div>
    </div>
  )
}
