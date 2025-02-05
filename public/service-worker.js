import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nova versão disponível! Atualizar agora?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App pronto para uso offline.');
  },
});
