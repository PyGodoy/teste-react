import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';


registerSW({
  onNeedRefresh() {
    console.log('Nova versão disponível! Atualize.');
  },
  onOfflineReady() {
    console.log('App pronto para uso offline.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
