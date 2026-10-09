import { useEffect } from 'react';
import { Role } from '../lib/types';
import { ScreenHelp } from '../lib/help-content';
import { errorHint } from '../lib/error-hints';

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '본사 관리자',
  BRANCH_ADMIN: '지점 관리자',
  STAFF: '지점 직원',
  MEMBER: '회원',
};

// 화면별 도움말(log/089) — 오른쪽에서 열리는 패널. 화면을 가리지 않게 배경 막(overlay)을 두지 않고, 열린 채로 화면을 계속 쓸 수 있다.
// ① 이 화면에서 하는 일(내 역할 기준 단계) ② 자주 나는 오류와 해결(error-hints.ts와 같은 문구).
export function HelpPanel({ help, role, onClose }: { help: ScreenHelp | undefined; role: Role; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const steps = help ? [...(help.common ?? []), ...(help.byRole?.[role] ?? [])] : [];
  const errors = help ? help.errors.filter((code) => errorHint(code)) : [];

  return (
    <aside className="help-panel" role="complementary" aria-label="화면 도움말">
      <div className="help-panel-head">
        <h3>{help ? `${help.title} 도움말` : '도움말'}</h3>
        <button type="button" className="help-close" onClick={onClose} aria-label="도움말 닫기">
          ✕
        </button>
      </div>
      {!help ? (
        <p className="help-summary">이 화면의 도움말은 아직 없습니다.</p>
      ) : (
        <div className="help-panel-body">
          <p className="help-summary">{help.summary}</p>
          <section>
            <h4>
              이 화면에서 하는 일 <span className="role-badge">{ROLE_LABEL[role]}</span>
            </h4>
            {steps.length > 0 ? (
              <ol className="help-steps">
                {steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="help-summary">이 역할은 이 화면에서 조회만 합니다.</p>
            )}
          </section>
          {errors.length > 0 && (
            <section>
              <h4>자주 나는 오류</h4>
              <dl className="help-errors">
                {errors.map((code) => (
                  <div key={code}>
                    <dt>{code}</dt>
                    <dd>{errorHint(code)}</dd>
                  </div>
                ))}
              </dl>
              <p className="help-foot">오류가 나면 문구 아래 "해결:" 줄에도 같은 안내가 나옵니다.</p>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
