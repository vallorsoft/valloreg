import { setRequestLocale } from 'next-intl/server';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';
import { Hero } from '@/components/landing/Hero';
import { Problem } from '@/components/landing/Problem';
import { Solution } from '@/components/landing/Solution';
import { Features } from '@/components/landing/Features';
import { DashboardPreview } from '@/components/landing/DashboardPreview';
import { Benefits } from '@/components/landing/Benefits';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { PlanComparison } from '@/components/landing/PlanComparison';
import { Faq } from '@/components/landing/Faq';
import { Contact } from '@/components/landing/Contact';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <MarketingHeader />
      <main>
        {/* 1 */}
        <Hero />
        {/* 2 */}
        <Problem />
        {/* 3 */}
        <Solution />
        {/* 4 */}
        <Features />
        {/* 5 */}
        <DashboardPreview />
        {/* 6 */}
        <Benefits />
        {/* 7 */}
        <Testimonials />
        {/* 8 */}
        <Pricing />
        {/* 8b */}
        <PlanComparison />
        {/* 9 */}
        <Faq />
        {/* 10 */}
        <Contact />
      </main>
      <MarketingFooter />
    </>
  );
}
