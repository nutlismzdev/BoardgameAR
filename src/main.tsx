import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { hydrateFromCache } from '@/core/content';
import { ErrorBoundary } from '@/components/ErrorBoundary';

hydrateFromCache();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
