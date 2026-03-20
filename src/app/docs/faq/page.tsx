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
        q: 'Can I use GeoNova offline?',
        a: 'Yes! GeoNova works offline. Once loaded, you can perform all calculations without internet. Data syncs when you\'re back online.'
      }
    ]
  },
  {
    category: 'Calculations',
    questions: [
      {
        q: 'What precision does GeoNova use?',
        a: 'GeoNova follows N.N. Basak standards: distances to 2dp (cm), coordinates to 4dp (0.1mm), bearings in DDD°MM\'SS" format, and areas in m² to 4dp.'
      },
      {
        q: 'How does traverse adjustment work?',
        a: 'GeoNova uses the Bowditch method to distribute linear misclosure proportionally to each leg based on its length. Results show: formula → substitution → result for every step.'
      },
      {
        q: 'Why does my leveling show "Check Failed"?',
        a: 'Leveling requires the arithmetic check to pass: ΣBS - ΣFS must equal Last RL - First RL. If it fails, there\'s an error in your field notes. Check your BS/FS values.'
      },
      {
        q: 'What\'s the difference between closed and open traverse?',
        a: 'Closed traverse starts and ends at the same point (or two known points). Open traverse ends at an unknown point. GeoNova supports both with appropriate error reporting.'
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
        a: 'Yes! Contact support@geonova.app with your student ID for 50% off any plan.'
      }
    ]
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'What browsers does GeoNova support?',
        a: 'GeoNova works best on Chrome, Firefox, Safari, and Edge (latest versions). For PWA installation, use Chrome on Android.'
      },
      {
        q: 'How do I install GeoNova as an app?',
        a: 'Open geonova.app in Chrome on Android, tap the menu (three dots), and select "Add to Home Screen". iOS users can use Safari → Share → Add to Home Screen.'
      },
      {
        q: 'Can I export to AutoCAD?',
        a: 'Yes! Pro and Team plans include DXF export. Your survey points and lines export as AutoCAD-ready geometry.'
      },
      {
        q: 'How do I report a bug?',
        a: 'Click the Feedback button (bottom right) or email support@geonova.app. We\'re quick to fix issues!'
      }
    ]
  }
]

export default function FAQPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/docs" className="text-[#E8841A] hover:underline mb-8 inline-block">
          ← Back to Documentation
        </Link>

        <h1 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h1>
        <p className="text-gray-400 text-lg mb-12">
          Find answers to common questions about GeoNova
        </p>

        <div className="space-y-12">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="text-2xl font-bold text-white mb-6">{section.category}</h2>
              <div className="space-y-4">
                {section.questions.map((faq, i) => (
                  <details
                    key={i}
                    className="bg-[#111] rounded-xl border border-[#222] overflow-hidden"
                  >
                    <summary className="px-6 py-4 cursor-pointer text-white font-medium hover:bg-[#1a1a1a]">
                      {faq.q}
                    </summary>
                    <div className="px-6 pb-4 text-gray-400">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-[#E8841A]/20 to-transparent border border-[#E8841A]/30 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Still Have Questions?</h2>
          <p className="text-gray-400 mb-6">
            Can't find what you're looking for? We're here to help.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="mailto:support@geonova.app"
              className="px-6 py-3 bg-[#E8841A] text-black font-semibold rounded-lg hover:bg-[#d47619]"
            >
              Contact Support
            </a>
            <Link
              href="/community"
              className="px-6 py-3 border border-[#E8841A] text-[#E8841A] font-semibold rounded-lg hover:bg-[#E8841A]/10"
            >
              Join Community
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
