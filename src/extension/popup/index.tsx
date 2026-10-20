import React from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';
import App from './App';

const rootElement = document.getElementById('popup-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
