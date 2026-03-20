/**
 * Survey Instrument Marketplace
 * Buy, sell, and rent survey equipment — persisted in localStorage.
 */

export type ListingType = 'sale' | 'rent' | 'wanted'
export type Condition = 'new' | 'excellent' | 'good' | 'fair' | 'for_parts'
export type InstrumentCategory = 'total_station' | 'gnss' | 'level' | 'theodolite' | 'edm' | 'drone' | 'accessories' | 'software' | 'other'
export type Currency = 'KES' | 'UGX' | 'TZS' | 'NGN' | 'USD' | 'GHS' | 'ZAR'

export interface InstrumentListing {
  id: string
  type: ListingType
  category: InstrumentCategory
  title: string
  brand: string
  model: string
  condition: Condition
  year?: number
  description: string
  price: number
  currency: Currency
  rentPeriod?: 'day' | 'week' | 'month'   // for rent listings
  location: string
  country: string
  sellerName: string
  sellerContact: string
  images: string[]    // base64 or URLs — kept empty initially
  postedAt: string
  sold: boolean
  userId?: string      // Supabase user ID of poster
  verified: boolean    // true if poster was Pro/Team at time of posting
}

export interface InquiryMessage {
  id: string
  listingId: string
  buyerName: string
  buyerContact: string
  message: string
  sentAt: string
}

const LISTING_KEY = 'geonova_instrument_listings'
const INQUIRY_KEY = 'geonova_instrument_inquiries'

function loadListings(): InstrumentListing[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LISTING_KEY) || '[]') } catch { return [] }
}
function saveListings(items: InstrumentListing[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LISTING_KEY, JSON.stringify(items))
}
function loadInquiries(): InquiryMessage[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(INQUIRY_KEY) || '[]') } catch { return [] }
}
function saveInquiries(items: InquiryMessage[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(INQUIRY_KEY, JSON.stringify(items))
}

export function getListings(filters?: {
  type?: ListingType
  category?: InstrumentCategory
  country?: string
  maxPrice?: number
}): InstrumentListing[] {
  let items = loadListings().filter(l => !l.sold)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  if (filters?.type) items = items.filter(l => l.type === filters.type)
  if (filters?.category) items = items.filter(l => l.category === filters.category)
  if (filters?.country) items = items.filter(l => l.country === filters.country)
  if (filters?.maxPrice) items = items.filter(l => l.price <= filters.maxPrice!)
  return items
}

export function searchListings(q: string): InstrumentListing[] {
  const query = q.toLowerCase()
  return loadListings().filter(l => !l.sold && (
    l.title.toLowerCase().includes(query) ||
    l.brand.toLowerCase().includes(query) ||
    l.model.toLowerCase().includes(query) ||
    l.description.toLowerCase().includes(query) ||
    l.location.toLowerCase().includes(query)
  ))
}

export function postListing(data: Omit<InstrumentListing, 'id' | 'postedAt' | 'sold' | 'verified'> & { verified?: boolean }): InstrumentListing {
  const listing: InstrumentListing = {
    ...data,
    id: `inst_${Date.now()}`,
    postedAt: new Date().toISOString(),
    sold: false,
    verified: data.verified ?? false,
  }
  saveListings([listing, ...loadListings()])
  return listing
}

export function markSold(id: string) {
  const items = loadListings()
  const idx = items.findIndex(l => l.id === id)
  if (idx !== -1) { items[idx] = { ...items[idx], sold: true }; saveListings(items) }
}

export function deleteListing(id: string) {
  saveListings(loadListings().filter(l => l.id !== id))
}

export function sendInquiry(data: Omit<InquiryMessage, 'id' | 'sentAt'>): InquiryMessage {
  const msg: InquiryMessage = { ...data, id: `inq_${Date.now()}`, sentAt: new Date().toISOString() }
  saveInquiries([...loadInquiries(), msg])
  return msg
}

export function getInquiriesFor(listingId: string): InquiryMessage[] {
  return loadInquiries().filter(m => m.listingId === listingId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

export const CATEGORIES: { id: InstrumentCategory; label: string }[] = [
  { id: 'total_station', label: 'Total Station' },
  { id: 'gnss',          label: 'GNSS / GPS Receiver' },
  { id: 'level',         label: 'Digital / Auto Level' },
  { id: 'theodolite',    label: 'Theodolite' },
  { id: 'edm',           label: 'EDM' },
  { id: 'drone',         label: 'Survey Drone / UAV' },
  { id: 'accessories',   label: 'Accessories & Prisms' },
  { id: 'software',      label: 'Software & Licences' },
  { id: 'other',         label: 'Other Equipment' },
]

export const CONDITIONS: { id: Condition; label: string; desc: string }[] = [
  { id: 'new',       label: 'New',        desc: 'Unused, in original packaging' },
  { id: 'excellent', label: 'Excellent',  desc: 'Barely used, like new condition' },
  { id: 'good',      label: 'Good',       desc: 'Normal wear, fully functional' },
  { id: 'fair',      label: 'Fair',       desc: 'Visible wear but works correctly' },
  { id: 'for_parts', label: 'For parts',  desc: 'Not fully functional, sold as-is' },
]

export const BRANDS = ['Leica','Trimble','Topcon','Sokkia','Nikon','GeoMax','Pentax','South','Hi-Target','DJI','senseFly','Other']
export const COUNTRIES = ['Kenya','Uganda','Tanzania','Nigeria','Ghana','South Africa','Rwanda','Ethiopia','Zambia','Zimbabwe','Other']
export const CURRENCIES: { id: Currency; symbol: string }[] = [
  { id: 'KES', symbol: 'KSh' }, { id: 'UGX', symbol: 'USh' }, { id: 'TZS', symbol: 'TSh' },
  { id: 'NGN', symbol: '₦' },   { id: 'GHS', symbol: 'GH₵' }, { id: 'ZAR', symbol: 'R' },
  { id: 'USD', symbol: '$' },
]

export function fmtPrice(amount: number, currency: Currency, rentPeriod?: string): string {
  const sym = CURRENCIES.find(c => c.id === currency)?.symbol ?? currency
  const base = `${sym} ${amount.toLocaleString()}`
  if (rentPeriod) return `${base} / ${rentPeriod}`
  return base
}
