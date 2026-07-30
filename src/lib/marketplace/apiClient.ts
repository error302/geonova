/**
 * Marketplace API Client
 *
 * Replaces the localStorage-based instruments.ts with real API calls.
 * All data now persists to the instrument_listings table (migration 033).
 */

import type { InstrumentListing, ListingType, InstrumentCategory, Condition, Currency } from './instruments'

export interface ListingFilters {
  type?: ListingType
  category?: InstrumentCategory
  condition?: Condition
  q?: string
}

export async function fetchListings(filters?: ListingFilters): Promise<InstrumentListing[]> {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.category) params.set('category', filters.category)
  if (filters?.condition) params.set('condition', filters.condition)
  if (filters?.q) params.set('q', filters.q)

  const res = await fetch(`/api/marketplace/listings?${params}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

export async function createListing(data: {
  type: string
  category: string
  title: string
  brand?: string
  model?: string
  condition: string
  year?: number
  description?: string
  price: number
  currency?: string
  rentPeriod?: string
  location?: string
  country?: string
  sellerName?: string
  sellerContact?: string
  images?: string[]
}): Promise<InstrumentListing | null> {
  const res = await fetch('/api/marketplace/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data || null
}

export async function deleteListing(id: string): Promise<boolean> {
  const res = await fetch(`/api/marketplace/listings/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return res.ok
}

export async function sendInquiry(listingId: string, data: {
  message: string
  contactEmail?: string
  contactPhone?: string
}): Promise<boolean> {
  const res = await fetch('/api/marketplace/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, ...data }),
    credentials: 'include',
  })
  return res.ok
}

export async function fetchInquiries(listingId: string): Promise<any[]> {
  const res = await fetch(`/api/marketplace/inquiries?listingId=${listingId}`, {
    credentials: 'include',
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}
