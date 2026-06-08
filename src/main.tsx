import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Apply saved dark mode preference on load
const savedStore = localStorage.getItem('family-finance-store');
if (savedStore) {
  try {
    const parsed = JSON.parse(savedStore);
    if (parsed?.state?.isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    // ignore parse errors
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
