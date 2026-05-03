'use client';


import { MainApp } from '@/containers/MainApp';
import { AudioProcessingErrorBoundary } from '@/components/AudioProcessingErrorBoundary';

export default function Home() {
  return (
    <AudioProcessingErrorBoundary>
      <MainApp />
    </AudioProcessingErrorBoundary>
  );
}
