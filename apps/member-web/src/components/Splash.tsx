// 앱 시작 화면(log/094) — 저장된 세션을 되살리는 동안 아이콘과 이름을 보인다(홈 화면 앱의 스플래시와 이어지게).
export function Splash() {
  return (
    <div className="splash" aria-busy="true" aria-label="불러오는 중">
      <img src="/m/assets/icons/icon-192.png" alt="" width={72} height={72} className="splash-icon" />
      <span className="splash-name">스포이즘</span>
    </div>
  );
}
