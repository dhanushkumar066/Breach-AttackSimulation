import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/App';
import { bootstrapTheme } from '@/lib/theme';
import '@/index.css';

// Applied before the first paint so the stored theme never flashes the other one.
bootstrapTheme();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
