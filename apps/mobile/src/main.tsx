import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../web/src/App';
import '../../web/src/style.css';
import '../../web/src/workspace.css';
import './mobile.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <div className="prototype-shell">
    <div className="prototype-banner">Prototype · Synthetic contacts · Saving disabled</div>
    <App />
  </div>
</React.StrictMode>);
