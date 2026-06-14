import { useEffect, useState } from 'react';

export function useTelegram() {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor('#8B1A1A');
      webApp.setBackgroundColor('#FAF7F2');
      setTg(webApp);
      setUser(webApp.initDataUnsafe?.user || null);
    }
    setReady(true);
  }, []);

  return { tg, user, ready, isTelegram: Boolean(tg?.initData) };
}
