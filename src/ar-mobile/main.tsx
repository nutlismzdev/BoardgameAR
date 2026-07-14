import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GoldArPage } from './GoldArPage';
import '@/styles.css';

ReactDOM.createRoot(document.getElementById('ar-root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoldArPage />
    </ErrorBoundary>
  </React.StrictMode>
);
