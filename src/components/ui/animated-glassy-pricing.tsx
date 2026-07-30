import React from 'react';
import Link from 'next/link';
import { FeatureCard } from "@/components/ui/grid-feature-cards";
import { 
  Calculator, FileText, MapPin, Users, 
  Cloud, Download
} from 'lucide-react';

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round"
    className={className}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);


export interface PricingCardProps {
  planId: string;
  planName: string;
  description: string;
  price: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  buttonVariant?: 'primary' | 'secondary';
}

export const PricingCard = ({
  planId, planName, description, price, features, buttonText, isPopular = false, buttonVariant = 'primary'
}: PricingCardProps) => {
  const buttonHref = planId === 'free'
    ? '/register'
    : `/checkout?plan=${planId}`;
  const cardClasses = `
    backdrop-blur-[14px] bg-gradient-to-br rounded-2xl shadow-xl flex-1 max-w-xs px-7 py-8 flex flex-col transition-all duration-300
    from-black/5 to-black/0 border border-black/10
    dark:from-white/10 dark:to-white/5 dark:border-white/10 dark:backdrop-brightness-[0.91]
    ${isPopular ? 'md:scale-105 relative ring-2 ring-[var(--accent)]/30 dark:from-white/20 dark:to-white/10 dark:border-[var(--accent)]/40 shadow-2xl' : ''}
  `;
  const buttonClasses = `
    mt-auto w-full py-2.5 rounded-xl font-semibold text-[14px] transition font-sans
    ${buttonVariant === 'primary'
      ? 'bg-[var(--accent)] hover:opacity-90 text-black'
      : 'bg-black/10 hover:bg-black/20 text-foreground border border-black/20 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/20'
    }
  `;

  return (
    <div className={cardClasses.trim()}>
      {isPopular && (
        <div className="absolute -top-4 right-4 px-3 py-1 text-[12px] font-semibold rounded-full bg-[var(--accent)] text-black">
          Most Popular
        </div>
      )}
      <div className="mb-3">
        <h2 className="text-[48px] font-extralight tracking-[-0.03em] text-foreground font-display">{planName}</h2>
        <p className="text-[16px] text-foreground/70 mt-1 font-sans">{description}</p>
      </div>
      <div className="my-6 flex items-baseline gap-2 flex-wrap">
        <span className="text-[36px] font-extralight text-foreground font-display tracking-tight">{price}</span>
        <span className="text-[14px] text-foreground/70 font-sans">/mo</span>
      </div>
      <div className="card-divider w-full mb-5 h-px" style={{background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22) 50%, transparent)"}}></div>
      <ul className="flex flex-col gap-2 text-[14px] text-foreground/90 mb-6 font-sans">
        {features.map((feature, index) => (
          <li key={`${feature}-${index}`} className="flex items-center gap-2">
            <CheckIcon className="text-[var(--accent)] w-4 h-4" /> {feature}
          </li>
        ))}
      </ul>
      <Link href={buttonHref} className={buttonClasses.trim()}>{buttonText}</Link>
    </div>
  );
};


interface ModernPricingPageProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  plans: PricingCardProps[];
  children?: React.ReactNode;
}

export const ModernPricingPage = ({
  title,
  subtitle,
  plans,
  children,
}: ModernPricingPageProps) => {
  const metarduFeatures = [
    {
      title: '18+ Survey Tools',
      icon: Calculator,
      description: 'Traverse, leveling, COGO, curves, cross-sections and more built-in.',
    },
    {
      title: 'Professional Reports',
      icon: FileText,
      description: 'Generate PDF plans, bearing schedules, and traverse computations.',
    },
    {
      title: 'GPS Stakeout',
      icon: MapPin,
      description: 'Real-time stakeout mode with Bluetooth total station connection.',
    },
    {
      title: 'Team Collaboration',
      icon: Users,
      description: 'Work together with role-based access and real-time sync.',
    },
    {
      title: 'Cloud Sync',
      icon: Cloud,
      description: 'Your data synced across all devices, online and offline.',
    },
    {
      title: 'Export Anywhere',
      icon: Download,
      description: 'DXF, LandXML, GeoJSON, and CSV export for any workflow.',
    },
  ]

  return (
    <div className="bg-background text-foreground min-h-screen w-full overflow-x-hidden">
      <main className="relative w-full flex flex-col items-center px-4 py-16">
        <div className="w-full max-w-5xl mx-auto text-center mb-8">
          <h1 className="text-3xl sm:text-[40px] md:text-[64px] font-extralight leading-tight tracking-[-0.03em] bg-clip-text text-transparent bg-gradient-to-r from-foreground via-[var(--accent)] to-[var(--accent-dim)] font-display">
            {title}
          </h1>
          <p className="mt-3 text-[16px] md:text-[20px] text-foreground/80 max-w-2xl mx-auto font-sans">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 divide-x divide-dashed divide-border border border-dashed border-border rounded-2xl sm:grid-cols-2 md:grid-cols-3 w-full max-w-5xl mb-16">
          {metarduFeatures.map((feature, i) => (
            <FeatureCard key={`${feature}-${i}`} feature={feature} />
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-8 md:gap-6 justify-center items-center w-full max-w-4xl">
          {plans.map((plan) => <PricingCard key={plan.planName} {...plan} />)}
        </div>

        {children}
      </main>
    </div>
  );
};
