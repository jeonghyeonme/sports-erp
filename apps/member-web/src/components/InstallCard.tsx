import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ShareIcon } from './Icons';
import { isIos, isStandalone, useInstallPrompt } from '../lib/pwa';

const DISMISS_KEY = 'spoism.installCard.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// 홈의 "앱으로 설치" 카드(log/094) — 이미 앱으로 열었거나 닫았으면 보이지 않는다.
// 안드로이드 크롬: 버튼 한 번으로 설치. 아이폰 사파리: 설치 API가 없어 "공유 → 홈 화면에 추가"를 안내한다.
export function InstallCard() {
  const { canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const ios = isIos();

  if (dismissed || isStandalone() || (!canInstall && !ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 저장소를 못 쓰면 이번 방문 동안만 숨긴다 */
    }
  };

  return (
    <section className="install-card">
      <img className="install-icon" src="/m/assets/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-text">
        <strong>앱으로 설치하기</strong>
        <span>홈 화면 아이콘으로 바로 열고, 주소창 없이 크게 볼 수 있어요.</span>
      </div>
      <div className="install-actions">
        <button type="button" className="primary-button small" onClick={() => (ios ? setShowIosGuide(true) : void install())}>
          설치
        </button>
        <button type="button" className="text-button" onClick={dismiss}>
          닫기
        </button>
      </div>
      {showIosGuide && (
        <BottomSheet title="홈 화면에 추가하기" onClose={() => setShowIosGuide(false)}>
          <ol className="install-steps">
            <li>
              사파리 아래쪽의 <ShareIcon /> <strong>공유</strong> 버튼을 누릅니다.
            </li>
            <li>
              목록을 올려 <strong>홈 화면에 추가</strong>를 누릅니다.
            </li>
            <li>
              오른쪽 위 <strong>추가</strong>를 누르면 홈 화면에 스포이즘 아이콘이 생깁니다.
            </li>
          </ol>
          <div className="sheet-actions">
            <button type="button" className="primary-button" onClick={() => setShowIosGuide(false)}>
              확인
            </button>
          </div>
        </BottomSheet>
      )}
    </section>
  );
}
