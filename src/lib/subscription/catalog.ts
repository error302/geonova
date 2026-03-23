export type CurrencyCode =
  | 'KES'
  | 'UGX'
  | 'TZS'
  | 'NGN'
  | 'GHS'
  | 'ZAR'
  | 'INR'
  | 'IDR'
  | 'BRL'
  | 'AUD'
  | 'GBP'
  | 'EUR'
  | 'USD'

export type PlanId = 'free' | 'pro' | 'team' | 'firm' | 'enterprise'

export interface PlanCatalogEntry {
  id: PlanId
  name: string
  prices: Record<CurrencyCode, number>
  features: string[]
  billingInterval: 'monthly'
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: 'free',
    name: 'Free',
    billingInterval: 'monthly',
    prices: {
      KES: 0,
      UGX: 0,
      TZS: 0,
      NGN: 0,
      GHS: 0,
      ZAR: 0,
      INR: 0,
      IDR: 0,
      BRL: 0,
      AUD: 0,
      GBP: 0,
      EUR: 0,
      USD: 0,
    },
    features: [
      'All quick calculation tools',
      '1 survey project',
      'Up to 50 survey points',
      'Basic PDF report',
      'CSV import',
      'Offline calculations',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    billingInterval: 'monthly',
    prices: {
      KES: 500,
      UGX: 15000,
      TZS: 10000,
      NGN: 2000,
      GHS: 50,
      ZAR: 75,
      INR: 350,
      IDR: 65000,
      BRL: 20,
      AUD: 6,
      GBP: 3,
      EUR: 4,
      USD: 4,
    },
    features: [
      'Unlimited projects',
      'Unlimited survey points',
      'Full professional PDF reports',
      'DXF export',
      'LandXML export',
      'Report share link',
      'GPS Stakeout mode',
      'Process notes',
      'Priority support',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    billingInterval: 'monthly',
    prices: {
      KES: 2000,
      UGX: 60000,
      TZS: 40000,
      NGN: 8000,
      GHS: 200,
      ZAR: 280,
      INR: 1300,
      IDR: 230000,
      BRL: 75,
      AUD: 22,
      GBP: 12,
      EUR: 14,
      USD: 15,
    },
    features: [
      'Everything in Pro',
      '5 team members',
      'Real-time collaboration',
      'Role-based access',
      'Version history',
      'Audit trail',
      'Branded reports',
      'Dedicated support',
    ],
  },
  {
    id: 'firm',
    name: 'Firm',
    billingInterval: 'monthly',
    prices: {
      KES: 5000,
      UGX: 150000,
      TZS: 100000,
      NGN: 20000,
      GHS: 500,
      ZAR: 700,
      INR: 3500,
      IDR: 580000,
      BRL: 190,
      AUD: 55,
      GBP: 30,
      EUR: 35,
      USD: 38,
    },
    features: [
      'Everything in Team',
      '20 team members',
      'Custom integrations',
      'API access',
      'White-label license',
      'Bulk export',
      'Advanced analytics',
      'Dedicated account manager',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    billingInterval: 'monthly',
    prices: {
      KES: 15000,
      UGX: 450000,
      TZS: 300000,
      NGN: 60000,
      GHS: 1500,
      ZAR: 2100,
      INR: 10500,
      IDR: 1740000,
      BRL: 570,
      AUD: 165,
      GBP: 90,
      EUR: 105,
      USD: 115,
    },
    features: [
      'Everything in Firm',
      'Unlimited team members',
      'On-premise deployment option',
      'Custom development',
      'SLA guarantee',
      '24/7 phone support',
      'Training sessions',
      'Regional data residency',
    ],
  },
]

export function getPlan(planId: string): PlanCatalogEntry | null {
  const found = PLAN_CATALOG.find((p) => p.id === planId)
  return found ?? null
}

export function getPlanPrice(planId: PlanId, currency: CurrencyCode): number {
  const plan = getPlan(planId)
  if (!plan) return 0
  return plan.prices[currency] ?? 0
}

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  'KES',
  'UGX',
  'TZS',
  'NGN',
  'GHS',
  'ZAR',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'IDR',
  'BRL',
  'AUD',
]

