import { useOnline } from '../lib/pwa';

// 오프라인 안내(사용자 결정 2026-10-10, log/094) — 화면 파일은 캐시로 뜨지만 데이터는 받지 못한다는 것을 알린다.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      인터넷에 연결되어 있지 않습니다. 연결되면 다시 불러옵니다.
    </div>
  );
}
