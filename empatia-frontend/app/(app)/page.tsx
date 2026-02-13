import { Header } from '@/components/header';
import {
  CallToActionSection,
  ContactSection,
  FoundersSection,
  MissionSection,
  OverviewSection,
} from '@/components/landing-sections';
import { VideoHero } from '@/components/video-hero-wrapper';

export default async function Page() {
  return (
    <main className="flex min-h-screen flex-col">
      <Header />

      {/* Hero Section - Video Loop */}
      <VideoHero />

      {/* Content Sections */}
      <OverviewSection id="overview" />
      <MissionSection id="mission" />
      <CallToActionSection id="voice-agent" />
      <FoundersSection id="founders" />
      <ContactSection id="contact" />
    </main>
  );
}
