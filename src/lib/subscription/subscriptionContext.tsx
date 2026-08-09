'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { PlanId } from '@/lib/subscription/catalog'
import { canAccess as featureCanAccess, TIERS, type FeatureKey } from '@/lib/subscription/featureGates'

interface SubscriptionContextType {
  plan: PlanId
  isAdmin: boolean
  isTrialing: boolean
  trialDaysLeft: number
  canCreateProject: boolean
  canAddPoints: boolean
  hasFeature: (feature: string) => boolean
  projectCount: number
  loading: boolean
  refresh: () => void
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  plan: 'free',
  isAdmin: false,
  isTrialing: false,
  trialDaysLeft: 0,
  canCreateProject: true,
  canAddPoints: true,
  hasFeature: () => false,
  projectCount: 0,
  loading: true,
  refresh: () => {},
})

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [plan, setPlan] = useState<PlanId>('free')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [features, setFeatures] = useState<string[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const resetState = useCallback(() => {
    setPlan('free')
    setIsAdmin(false)
    setIsTrialing(false)
    setTrialDaysLeft(0)
    setFeatures([])
    setProjectCount(0)
  }, [])

  const loadSubscription = useCallback(async () => {
    if (!userId) {
      resetState()
      setLoading(false)
      return
    }

    try {
      // Use the server-side API which includes admin email detection
      const res = await fetch('/api/subscription', {
        cache: 'no-store',
        credentials: 'same-origin',
      })

      if (!res.ok) {
        resetState()
        setLoading(false)
        return
      }

      const data = (await res.json()) as { plan: string; isAdmin: boolean; status: string; trialEndsAt?: string; features?: string[] }

      resetState()

      setPlan(data.plan as PlanId)
      setIsAdmin(data.isAdmin === true)

      if (data.status === 'trial' && data.trialEndsAt) {
        setIsTrialing(true)
        const daysLeft = Math.ceil(
          (new Date(data.trialEndsAt).getTime() - Date.now()) / 86400000
        )
        setTrialDaysLeft(Math.max(0, daysLeft))
      }

      // Load tier features from the feature gates system
      const tierFeatures = TIERS[data.plan as PlanId]?.features || []
      setFeatures(tierFeatures.map(String))

      // Fetch project count separately (lightweight query)
      const countRes = await fetch('/api/subscription/project-count', {
        cache: 'no-store',
        credentials: 'same-origin',
      }).catch(() => null)

      if (countRes?.ok) {
        const countData = (await countRes.json()) as { count?: number }
        setProjectCount(countData.count || 0)
      }
    } catch {
      resetState()
    } finally {
      setLoading(false)
    }
  }, [resetState, userId])

  useEffect(() => {
    let active = true

    async function loadAuthSession() {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'same-origin',
        })

        if (!response.ok) {
          throw new Error(`Session request failed with ${response.status}`)
        }

        const session = await response.json()
        if (!active) return

        setUserId((session?.user as { id?: string } | undefined)?.id ?? null)
      } catch {
        if (!active) return
        setUserId(null)
      } finally {
        if (active) {
          setAuthResolved(true)
        }
      }
    }

    loadAuthSession()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!authResolved) return

    if (!userId) {
      resetState()
      setLoading(false)
      return
    }

    setLoading(true)
    void loadSubscription()
  }, [authResolved, loadSubscription, resetState, userId])

  // Admin always has full access, regardless of plan
  const canCreateProject = isAdmin || plan !== 'free' || projectCount < 1
  const canAddPoints = true

  function hasFeature(feature: string) {
    // Admin always has access to everything
    if (isAdmin) return true
    // Use the proper feature gates instead of granting all features to paid plans
    if (features.includes(feature)) return true
    // Check against the feature gates system for known feature keys
    if (TIERS[plan]?.features?.includes(feature as FeatureKey)) return true
    return featureCanAccess(plan, feature as FeatureKey)
  }

  return (
    <SubscriptionContext.Provider
      value={{
        plan,
        isAdmin,
        isTrialing,
        trialDaysLeft,
        canCreateProject,
        canAddPoints,
        hasFeature,
        projectCount,
        loading,
        refresh: loadSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => useContext(SubscriptionContext)
