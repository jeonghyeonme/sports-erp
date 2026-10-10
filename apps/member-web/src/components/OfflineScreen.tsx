import { useEffect } from 'react';
import { useAuth } from '../lib/use-auth';

// 오프라인으로 앱을 열었을 때(log/094, 사용자 결정 "앱 화면은 뜨고 연결 없음 안내") — 저장된 로그인은 그대로 두고,
// 연결이 돌아오면 자동으로 다시 시도한다. 데이터는 캐시하지 않으므로(예약·결제가 옛 값으로 보이지 않게) 여기서 멈춘다.
export function OfflineScreen() {
  const { retryRestore } = useAuth();
  useEffect(() => {
    window.addEventListener('online', retryRestore);
    return () => window.removeEventListener('online', retryRestore);
  }, [retryRestore]);

  return (
    <div className="splash offline-screen">
      <img src="/m/assets/icons/icon-192.png" alt="" width={72} height={72} className="splash-icon still" />
      <strong>인터넷에 연결되어 있지 않습니다</strong>
      <span>연결되면 자동으로 다시 불러옵니다.</span>
      <button type="button" className="secondary-button" onClick={retryRestore}>
        다시 시도
      </button>
    </div>
  );
}
