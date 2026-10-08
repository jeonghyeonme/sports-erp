import { FormEvent, ReactNode, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { ApiEnvelope, Enrollment, MemberProfile, PTPackage } from '../lib/types';

// 연락처 형식 — 서버는 형식을 검사하지 않으므로 화면에서 흔한 실수만 막는다(휴대폰·지역번호, 하이픈 선택).
const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

// 내 정보 — GET /members/:id 1회(이름·연락처·지점 + 수강 중·PT 잔여 요약, ADR-MEM-03).
// 수강·PT 목록은 펼칠 때만 1회씩 부른다. 수정은 이름·연락처만(B1-3 사용자 결정) — 담당 직원·메모는 서버가 막는다.
export function MyInfoPage() {
  const { user, renameUser } = useAuth();
  const memberId = user?.memberId ?? '';
  const profile = useLoad<MemberProfile>(`/members/${encodeURIComponent(memberId)}`);
  const [editing, setEditing] = useState<{ name: string; phone: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openEnrollments, setOpenEnrollments] = useState(false);
  const [openPT, setOpenPT] = useState(false);
  const enrollments = useLoad<Enrollment[]>(openEnrollments ? `/members/${encodeURIComponent(memberId)}/enrollments` : null);
  const pts = useLoad<PTPackage[]>(openPT ? `/members/${encodeURIComponent(memberId)}/pt-sessions` : null);

  const p = profile.data;

  // 편집 폼은 "수정" 누를 때 채운다(조회 데이터를 effect로 state에 복사하지 않는다 — admin-web CLAUDE.md).
  const startEdit = () => {
    if (!p) return;
    setEditing({ name: p.name, phone: p.phone ?? '' });
    setFormError(null);
    setNotice(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const name = editing.name.trim();
    const phone = editing.phone.trim();
    if (!name) return setFormError('이름을 입력하세요.');
    if (phone && !PHONE_RE.test(phone)) return setFormError('연락처를 010-1234-5678 형식으로 입력하세요.');
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.patch<ApiEnvelope<MemberProfile>>(`/members/${encodeURIComponent(memberId)}`, { name, phone });
      const updated = res.data.data!;
      // 수정 응답에는 요약(수강·PT)이 없다 — 기존 요약은 그대로 두고 바뀐 칸만 덮는다.
      profile.mutate((cur) => ({ ...cur, name: updated.name, phone: updated.phone }));
      renameUser(updated.name);
      setEditing(null);
      setNotice('내 정보를 저장했습니다.');
    } catch (err) {
      setFormError(describeError(err, '저장하지 못했습니다. 잠시 후 다시 시도하세요.'));
    } finally {
      setSaving(false);
    }
  };

  if (profile.loading) return <p className="muted center">불러오는 중…</p>;
  if (profile.error || !p) {
    return (
      <div className="panel error-panel" role="alert">
        <p>{describeError(profile.error, '내 정보를 불러오지 못했습니다.')}</p>
        <button type="button" className="secondary-button" onClick={profile.reload}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>내 정보</h1>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {editing ? (
        <form className="panel form" onSubmit={save} noValidate>
          <label className="field">
            <span>이름</span>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoComplete="name" />
          </label>
          <label className="field">
            <span>연락처</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="010-1234-5678"
              value={editing.phone}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
            />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="sheet-actions">
            <button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>
              취소
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <section className="panel stack-sm">
          <dl className="summary">
            <dt>이름</dt>
            <dd>{p.name}</dd>
            <dt>연락처</dt>
            <dd>{p.phone || '등록 안 됨'}</dd>
            <dt>등록 지점</dt>
            <dd>{p.branchName}</dd>
            <dt>회원번호</dt>
            <dd>{p.memberNo}</dd>
            <dt>가입일</dt>
            <dd>{p.joinedAt.slice(0, 10)}</dd>
          </dl>
          <button type="button" className="secondary-button" onClick={startEdit}>
            이름·연락처 수정
          </button>
        </section>
      )}

      <section className="panel stack-sm">
        <div className="card-head">
          <h2 className="card-title">수강 중 {p.enrollmentCount ?? 0}건</h2>
          <button type="button" className="text-button" onClick={() => setOpenEnrollments(!openEnrollments)}>
            {openEnrollments ? '접기' : '내역 보기'}
          </button>
        </div>
        {openEnrollments && (
          <LoadList state={enrollments} empty="수강 내역이 없습니다.">
            {(enrollments.data ?? []).map((e) => (
              <li key={e.id} className="info-row">
                <span>{e.programName}</span>
                <span className="muted">
                  {e.status === 'ACTIVE' ? '수강 중' : e.status === 'COMPLETED' ? '수료' : '취소'}
                  {e.expiresAt && ` · ~${e.expiresAt}`}
                </span>
              </li>
            ))}
          </LoadList>
        )}
      </section>

      <section className="panel stack-sm">
        <div className="card-head">
          <h2 className="card-title">PT 남은 횟수 {p.ptRemainingTotal ?? 0}회</h2>
          <button type="button" className="text-button" onClick={() => setOpenPT(!openPT)}>
            {openPT ? '접기' : '내역 보기'}
          </button>
        </div>
        {openPT && (
          <LoadList state={pts} empty="PT 이용권이 없습니다.">
            {(pts.data ?? []).map((t) => (
              <li key={t.id} className="info-row">
                <span>{t.programName}</span>
                <span className="muted">
                  {t.remainingSessions} / {t.totalSessions}회 남음 · {t.purchasedAt} 구매
                </span>
              </li>
            ))}
          </LoadList>
        )}
      </section>
    </div>
  );
}

function LoadList({
  state,
  empty,
  children,
}: {
  state: { loading: boolean; error?: unknown; data?: unknown[] };
  empty: string;
  children: ReactNode;
}) {
  if (state.loading) return <p className="muted">불러오는 중…</p>;
  if (state.error) return <p className="form-error">{describeError(state.error, '불러오지 못했습니다.')}</p>;
  if (!state.data?.length) return <p className="muted">{empty}</p>;
  return <ul className="list">{children}</ul>;
}
