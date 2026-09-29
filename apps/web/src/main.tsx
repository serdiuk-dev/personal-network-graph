import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthBoundary } from './auth/AuthBoundary';
import './style.css';

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <AuthBoundary><App /></AuthBoundary>
  </React.StrictMode>
);
