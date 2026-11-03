import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// @ts-ignore - virtual module injected by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';
import { migrateLocalStorageToIDB } from './lib/storage/migrate';
import { requestStoragePersistence } from './lib/storage/persistence';

registerSW({ immediate: true });

// Background storage migration and persistence request on first launch
migrateLocalStorageToIDB().catch(console.error);
requestStoragePersistence().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
