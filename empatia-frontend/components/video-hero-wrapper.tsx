'use client';

import dynamic from 'next/dynamic';

const VideoHero = dynamic(() => import('@/components/video-hero').then((mod) => mod.VideoHero), {
  ssr: false,
});

export { VideoHero };
