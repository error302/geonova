'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const DashboardSearch = dynamic(
  () => import('@/components/dashboard/DashboardSearch').then(m => m.default || m),
  { ssr: false }
);

export type Page = 'home' | 'dashboard' | 'projects' | 'pricing' | 'community' | 'account' | 'survey-marks';

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const [, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: { page: Page; label: string }[] = [
    { page: 'dashboard', label: 'Dashboard' },
    { page: 'projects', label: 'Projects' },
    { page: 'survey-marks', label: 'Survey Marks' },
    { page: 'community', label: 'Community' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            {/* Logo - LEFT ONLY */}
            <div className="flex items-center gap-8">
              <button
                onClick={() => onNavigate('home')}
                className="flex items-center gap-2 group"
              >
                <div className="flex items-center">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="28" height="28" rx="6" fill="#f97316" />
                    <path d="M14 6L22 10V18L14 22L6 18V10L14 6Z" stroke="white" strokeWidth="1.5" fill="none" />
                    <circle cx="14" cy="14" r="3" fill="white" />
                  </svg>
                  <span className="ml-2 text-lg font-bold tracking-tight" style={{ color: '#f97316' }}>
                    METARDU
                  </span>
                </div>
              </button>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => onNavigate(item.page)}
                    className="px-3 py-1.5 text-sm rounded-md transition-colors"
                    style={{
                      color: currentPage === item.page ? '#f97316' : 'rgba(255,255,255,0.6)',
                      backgroundColor: currentPage === item.page ? 'rgba(249,115,22,0.1)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage !== item.page) e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                    }}
                    onMouseLeave={(e) => {
                      if (currentPage !== item.page) e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right side - Search, Language, Profile */}
            <div className="flex items-center gap-3">
              {/* Search — functional DashboardSearch component */}
              <div className="hidden sm:flex items-center">
                <DashboardSearch />
              </div>

              {/* Language */}
              <button className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                EN
              </button>

              {/* Divider */}
              <div className="hidden lg:block h-5 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

              {/* User Profile */}
              <button
                onClick={() => onNavigate('account')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: '#f97316' }}>
                  S
                </div>
                <span className="hidden md:block text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Surveyor
                </span>
              </button>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-md transition-colors"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {mobileMenuOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {/* Mobile Search */}
              <div className="px-3 pb-3">
                <DashboardSearch />
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => {
                      onNavigate(item.page);
                      setMobileMenuOpen(false);
                    }}
                    className="text-left px-3 py-2 text-sm rounded-md transition-colors"
                    style={{
                      color: currentPage === item.page ? '#f97316' : 'rgba(255,255,255,0.6)',
                      backgroundColor: currentPage === item.page ? 'rgba(249,115,22,0.1)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    onNavigate('pricing');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left px-3 py-2 text-sm rounded-md transition-colors"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Pricing
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
