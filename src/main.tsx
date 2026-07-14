import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { hydrateFromCache } from '@/core/content';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { preloadAllCardArt } from '@/core/cardAssets';

hydrateFromCache();

const scheduleCardPreload = () => void preloadAllCardArt().catch(() => {});
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(scheduleCardPreload, { timeout: 2500 });
} else {
  globalThis.setTimeout(scheduleCardPreload, 1200);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
