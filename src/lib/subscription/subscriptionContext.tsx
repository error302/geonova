'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SubscriptionContextType {
  plan: 'free' | 'pro' | 'team'
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
  isTrialing: false,
  trialDaysLeft: 0,
  canCreateProject: true,
  canAddPoints: true,
  hasFeature: () => false,
  projectCount: 0,
  loading: true,
  refresh: () => {}
})

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<'free' | 'pro' | 'team'>('free')
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [features, setFeatures] = useState<string[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscription()
  }, [])

  async function loadSubscription() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (sub) {
      setPlan(sub.plan_id as any)
      setFeatures(sub.features || [])
      
      if (sub.status === 'trial') {
        setIsTrialing(true)
        const daysLeft = Math.ceil(
          (new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000
        )
        setTrialDaysLeft(Math.max(0, daysLeft))
      }
    }

    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setProjectCount(count || 0)
    setLoading(false)
  }

  const canCreateProject = plan !== 'free' || projectCount < 1
  const canAddPoints = true

  function hasFeature(feature: string) {
    if (plan === 'pro' || plan === 'team') return true
    return features.includes(feature)
  }

  return (
    <SubscriptionContext.Provider value={{
      plan, isTrialing, trialDaysLeft,
      canCreateProject, canAddPoints,
      hasFeature, projectCount, loading,
      refresh: loadSubscription
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => useContext(SubscriptionContext)
