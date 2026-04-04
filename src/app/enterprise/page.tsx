'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Users, Globe, Cloud, Shield, BookOpen, Mail, Check, ArrowRight } from 'lucide-react'

export default function EnterprisePage() {
  const [contactForm, setContactForm] = useState({
    organizationName: '',
    type: '',
    size: '',
    email: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // In production, send to API
    setSubmitted(true)
  }

  const features = [
    {
      icon: Building2,
      title: 'White-Label',
      description: 'Rebrand the platform as your organization',
      items: ['Custom domain', 'Your logo & colors', 'Branded reports']
    },
    {
      icon: Shield,
      title: 'Government Licensing',
      description: 'Special features for public sector',
      items: ['Audit trails', 'Bulk exports', 'SSO integration']
    },
    {
      icon: BookOpen,
      title: 'University API',
      description: 'Integrate into surveying courses',
      items: ['Student management', 'Assignment templates', 'Auto-grading']
    },
    {
      icon: Cloud,
      title: 'Cloud Rendering',
      description: 'Large-scale project rendering',
      items: ['1000+ points', 'PDF/SVG export', 'Background processing']
    }
  ]

  const plans = [
    {
      name: 'Pro',
      price: 'KES 4,999',
      period: '/month',
      features: ['5 projects', 'All survey tools', 'Online services', 'Email support'],
      cta: 'Get Started',
      highlight: false
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: ['Unlimited projects', 'White-label', 'API access', 'Priority support', 'SSO', 'Audit logs'],
      cta: 'Contact Sales',
      highlight: true
    },
    {
      name: 'Government',
      price: 'Custom',
      period: '',
      features: ['Bulk licensing', 'Audit trails', 'Data residency', 'Custom reports', 'Dedicated support'],
      cta: 'Contact Sales',
      highlight: false
    }
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero */}
      <div className="bg-gradient-to-b from-sky-900 to-sky-800 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Metardu Enterprise
          </h1>
          <p className="text-xl text-sky-100 mb-8 max-w-2xl mx-auto">
            Survey infrastructure for organizations. White-label, government licensing, 
            university programs, and cloud rendering at scale.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="#features" className="px-6 py-3 bg-white text-sky-900 rounded-lg font-medium hover:bg-sky-50">
              Explore Features
            </Link>
            <Link href="#contact" className="px-6 py-3 border border-white text-white rounded-lg font-medium hover:bg-white/10">
              Contact Sales
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Enterprise Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature: any) => (
              <div key={feature.title} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
                <feature.icon className="w-10 h-10 text-sky-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">{feature.description}</p>
                <ul className="space-y-1">
                  {feature.items.map((item: any) => (
                    <li key={item} className="text-sm flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="py-16 bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Pricing Plans</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan: any) => (
              <div 
                key={plan.name} 
                className={`bg-[var(--bg-card)] border rounded-xl p-8 ${
                  plan.highlight ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-[var(--border-color)]'
                }`}
              >
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-[var(--text-muted)]">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature: any) => (
                    <li key={feature} className="text-sm flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link 
                  href={plan.price === 'KES 4,999' ? '/checkout' : '#contact'}
                  className={`block w-full py-2 text-center rounded-lg font-medium ${
                    plan.highlight 
                      ? 'bg-sky-600 text-white hover:bg-sky-700' 
                      : 'border border-[var(--border-color)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-sky-600">50+</p>
              <p className="text-[var(--text-muted)]">Survey Firms</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-sky-600">5</p>
              <p className="text-[var(--text-muted)]">County Governments</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-sky-600">8</p>
              <p className="text-[var(--text-muted)]">Universities</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-sky-600">10K+</p>
              <p className="text-[var(--text-muted)]">Surveys Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div id="contact" className="py-16 bg-[var(--bg-secondary)]">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Contact Sales</h2>
          <p className="text-center text-[var(--text-muted)] mb-8">
            Get a custom quote for your organization
          </p>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-green-800 mb-2">Thank you!</h3>
              <p className="text-green-700">Our team will contact you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={contactForm.organizationName}
                  onChange={e => setContactForm({ ...contactForm, organizationName: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Organization Type</label>
                  <select
                    required
                    value={contactForm.type}
                    onChange={e => setContactForm({ ...contactForm, type: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Select type</option>
                    <option value="SURVEY_FIRM">Survey Firm</option>
                    <option value="GOVERNMENT">Government</option>
                    <option value="UNIVERSITY">University</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Team Size</label>
                  <select
                    required
                    value={contactForm.size}
                    onChange={e => setContactForm({ ...contactForm, size: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10 users</option>
                    <option value="11-50">11-50 users</option>
                    <option value="51-100">51-100 users</option>
                    <option value="100+">100+ users</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 flex items-center justify-center gap-2"
              >
                Send Inquiry
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
