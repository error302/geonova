import Link from 'next/link'

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I create my first project?',
        a: 'After logging in, click "New Project" on your dashboard. Enter a name, location, UTM zone, and hemisphere. Click Create and you\'re ready to add points.'
      },
      {
        q: 'What is a UTM zone?',
        a: 'UTM (Universal Transverse Mercator) divides the world into 60 zones, each 6° wide. In Kenya, Uganda, Tanzania you\'re typically in zone 36 or 37. Check your survey brief or GPS for the correct zone.'
      },
      {
        q: 'How do I add survey points?',
        a: 'Open your project and click "Add Point". Enter the point name, Easting, Northing, and optionally Elevation. You can also import points from CSV.'
      },
      {
        q: 'Can I use METARDU offline?',
        a: 'Yes! METARDU works offline. Once loaded, you can perform all calculations without internet. Data syncs when you\'re back online.'
      }
    ]
  },
  {
    category: 'Calculations',
    questions: [
      {
        q: 'What precision does METARDU use?',
        a: 'METARDU follows N.N. Basak standards: distances to 2dp (cm), coordinates to 4dp (0.1mm), bearings in DDD°MM\'SS" format, and areas in m² to 4dp.'
      },
      {
        q: 'How does traverse adjustment work?',
        a: 'METARDU uses the Bowditch method to distribute linear misclosure proportionally to each leg based on its length. Results show: formula → substitution → result for every step.'
      },
      {
        q: 'Why does my leveling show "Check Failed"?',
        a: 'Leveling requires the arithmetic check to pass: ΣBS - ΣFS must equal Last RL - First RL. If it fails, there\'s an error in your field notes. Check your BS/FS values.'
      },
      {
        q: 'What\'s the difference between closed and open traverse?',
        a: 'Closed traverse starts and ends at the same point (or two known points). Open traverse ends at an unknown point. METARDU supports both with appropriate error reporting.'
      }
    ]
  },
  {
    category: 'Billing',
    questions: [
      {
        q: 'What\'s included in the Free plan?',
        a: 'Free plan includes: 1 project, up to 50 points, all 15 quick tools, basic PDF reports, CSV import, and offline calculations.'
      },
      {
        q: 'How do I upgrade to Pro?',
        a: 'Go to /pricing, select Pro, choose your currency, and complete payment via M-Pesa or card. Your upgrade is instant.'
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes, cancel anytime from your Account page. You\'ll keep Pro features until your billing period ends.'
      },
      {
        q: 'Do you offer student discounts?',
        a: 'Yes! Contact support@metardu.app with your student ID for 50% off any plan.'
      }
    ]
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'What browsers does METARDU support?',
        a: 'METARDU works best on Chrome, Firefox, Safari, and Edge (latest versions). For PWA installation, use Chrome on Android.'
      },
      {
        q: 'How do I install METARDU as an app?',
        a: 'Open metardu.app in Chrome on Android, tap the menu (three dots), and select "Add to Home Screen". iOS users can use Safari → Share → Add to Home Screen.'
      },
      {
        q: 'Can I export to AutoCAD?',
        a: 'Yes! Pro and Team plans include DXF export. Your survey points and lines export as AutoCAD-ready geometry.'
      },
      {
        q: 'How do I report a bug?',
        a: 'Click the Feedback button (bottom right) or email support@metardu.app. We\'re quick to fix issues!'
      }
    ]
  }
]

export default function FAQPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/docs" className="text-[var(--accent)] hover:underline mb-8 inline-block">
          ← Back to Documentation
        </Link>

        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">Frequently Asked Questions</h1>
        <p className="text-[var(--text-secondary)] text-lg mb-12">
          Find answers to common questions about METARDU
        </p>

        <div className="space-y-12">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{section.category}</h2>
              <div className="space-y-4">
                {section.questions.map((faq, i) => (
                  <details
                    key={i}
                    className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden"
                  >
                    <summary className="px-6 py-4 cursor-pointer text-[var(--text-primary)] font-medium hover:bg-[var(--bg-tertiary)]">
                      {faq.q}
                    </summary>
                    <div className="px-6 pb-4 text-[var(--text-secondary)]">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-[#E8841A]/20 to-transparent border border-[var(--accent)]/30 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Still Have Questions?</h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Can't find what you're looking for? We're here to help.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="mailto:support@metardu.app"
              className="px-6 py-3 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)]"
            >
              Contact Support
            </a>
            <Link
              href="/community"
              className="px-6 py-3 border border-[var(--accent)] text-[var(--accent)] font-semibold rounded-lg hover:bg-[var(--accent)]/10"
            >
              Join Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
