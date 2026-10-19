import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { configureSite } from '@estateflow/site';
import App from './App';
import { getServerUrl } from './lib/api';
import { initNative } from './lib/platform';
import { startNetworkWatch } from './lib/network';

configureSite({ apiUrl: getServerUrl });
startNetworkWatch();
void initNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
