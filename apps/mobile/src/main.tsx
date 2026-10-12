import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../web/src/App';
import '../../web/src/style.css';
import '../../web/src/workspace.css';
import './mobile.css';
import { AuthBoundary } from './MobileAuth';
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <div className="prototype-shell">
    <div className="prototype-banner">Connected preview · Contact create/edit enabled</div>
    <AuthBoundary><App /></AuthBoundary>
  </div>
</React.StrictMode>);
