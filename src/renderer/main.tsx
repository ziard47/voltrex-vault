import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { vaultTheme } from './theme';
import { VaultProvider } from './context/VaultContext';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root DOM element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider theme={vaultTheme}>
      <CssBaseline />
      <VaultProvider>
        <App />
      </VaultProvider>
    </ThemeProvider>
  </React.StrictMode>
);
