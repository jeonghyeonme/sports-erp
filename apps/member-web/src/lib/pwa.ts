import { useEffect, useState } from 'react';

// PWA(log/094, D45) — service worker 등록, 온라인 상태, "앱 설치" 안내에 쓰는 작은 도구들.

export function registerServiceWorker() {
  // 개발 서버(vite)에서는 등록하지 않는다 — 캐시가 코드 수정을 가린다.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/m/sw.js', { scope: '/m/' }).catch((err: unknown) => {
      console.warn('service worker 등록 실패', err);
    });
  });
}

/** 홈 화면 아이콘으로 열었는지(주소창 없는 앱 모드) — 이미 설치했으면 설치 안내를 띄우지 않는다. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** 아이폰·아이패드 사파리 — 설치 버튼 API가 없어 "공유 → 홈 화면에 추가"를 그림으로 안내한다. */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// beforeinstallprompt는 페이지가 뜨자마자 한 번만 온다 — 화면이 마운트되기 전에 놓치지 않게 모듈 로드 시점에 받아 둔다.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // 브라우저 기본 미니 배너 대신 홈의 설치 카드로 안내한다
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** 안드로이드 크롬 등 — 설치할 수 있으면 install()이 생긴다. 사용자가 누를 때만 부른다. */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<boolean> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    canInstall: deferred !== null,
    install: async () => {
      if (!deferred) return false;
      const ev = deferred;
      deferred = null;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      listeners.forEach((l) => l());
      return outcome === 'accepted';
    },
  };
}
