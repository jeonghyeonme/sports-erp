import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useLoad } from '../lib/use-load';
import { describeError, errorCode } from '../lib/errors';
import { isMinor, PHONE_RE, todayKst } from '../lib/format';
import { ApiEnvelope, LoginResult } from '../lib/types';

const MIN_PASSWORD = 8; // RegisterMemberDto @MinLength(8)

interface PublicBranch {
  id: string;
  name: string;
  region: string;
}

interface Form {
  region: string;
  branchId: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  email: string;
  password: string;
  confirm: string;
  guardianConsent: boolean;
}

const EMPTY: Form = {
  region: '',
  branchId: '',
  name: '',
  phone: '',
  birthDate: '',
  gender: '',
  email: '',
  password: '',
  confirm: '',
  guardianConsent: false,
};

// 새 가입(POST /members/register, ADR-MEM-02). 사용자 결정(log/092):
// - 지점은 공개 목록(GET /branches/public, ADR-MEM-05)에서 지역 → 지점으로 고른다. 계약 종료 지점은 목록에 없다.
// - 연락처·생년월일은 화면에서 필수(API는 선택) — 지점이 연락할 수 있고, 미성년 동의를 빠뜨리지 않게.
// 성공하면 응답의 세션으로 바로 로그인한다(/auth/login을 다시 부르지 않는다). 이 화면의 요청은 목록 1회 + 가입 1회다.
export function SignupPage() {
  const { user, startSession } = useAuth();
  const branches = useLoad<PublicBranch[]>('/branches/public');
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const all = branches.data ?? [];
  const regions = [...new Set(all.map((b) => b.region))];
  const inRegion = all.filter((b) => b.region === form.region);
  const minor = isMinor(form.birthDate);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!form.branchId) return setError('다닐 지점을 골라 주세요.');
    if (!name) return setError('이름을 입력해 주세요.');
    if (!PHONE_RE.test(phone)) return setError('연락처를 010-1234-5678 형식으로 입력해 주세요.');
    if (!form.birthDate) return setError('생년월일을 입력해 주세요.');
    if (form.birthDate > todayKst()) return setError('생년월일이 오늘보다 늦습니다.');
    if (minor && !form.guardianConsent) return setError('만 19세 미만은 법정대리인 동의에 체크해야 합니다.');
    if (!email) return setError('이메일을 입력해 주세요.');
    if (form.password.length < MIN_PASSWORD) return setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
    if (form.password !== form.confirm) return setError('비밀번호 확인이 일치하지 않습니다.');

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<ApiEnvelope<LoginResult>>('/members/register', {
        branchId: form.branchId,
        name,
        phone,
        birthDate: form.birthDate,
        gender: form.gender || undefined,
        email,
        password: form.password,
        guardianConsent: minor ? true : undefined,
      });
      startSession(res.data.data!);
    } catch (err) {
      setError(
        errorCode(err) === 'BRANCH_TERMINATED'
          ? '이 지점은 위탁운영 계약이 끝나 새 회원을 받지 않습니다. 다른 지점을 골라 주세요.'
          : describeError(err, '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-header">
        <p className="login-brand">스포이즘</p>
        <h1>회원 가입</h1>
        <p className="muted">
          지점에서 이미 등록하셨다면 <Link to="/link">회원번호로 연결</Link>해 주세요.
        </p>
      </header>

      <form className="form" onSubmit={submit} noValidate>
        {branches.error ? (
          <div className="form-error" role="alert">
            {describeError(branches.error, '지점 목록을 불러오지 못했습니다.')}{' '}
            <button type="button" className="text-button" onClick={branches.reload}>
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <label className="field">
              <span>지역</span>
              <select
                value={form.region}
                onChange={(e) => set({ region: e.target.value, branchId: '' })}
                disabled={branches.loading}
              >
                <option value="">{branches.loading ? '불러오는 중…' : '지역 선택'}</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>다닐 지점</span>
              <select value={form.branchId} onChange={(e) => set({ branchId: e.target.value })} disabled={!form.region}>
                <option value="">{form.region ? '지점 선택' : '지역을 먼저 고르세요'}</option>
                {inRegion.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="field">
          <span>이름</span>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
        </label>
        <label className="field">
          <span>연락처</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </label>
        <label className="field">
          <span>생년월일</span>
          <input
            type="date"
            max={todayKst()}
            value={form.birthDate}
            onChange={(e) => set({ birthDate: e.target.value, guardianConsent: false })}
          />
        </label>
        <label className="field">
          <span>성별(선택)</span>
          <select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">선택 안 함</option>
            <option value="M">남성</option>
            <option value="F">여성</option>
          </select>
        </label>
        {minor && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.guardianConsent}
              onChange={(e) => set({ guardianConsent: e.target.checked })}
            />
            <span>만 19세 미만입니다. 법정대리인(부모님 등)의 동의를 받았습니다.</span>
          </label>
        )}

        <label className="field">
          <span>이메일(로그인 아이디)</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </label>
        <label className="field">
          <span>비밀번호({MIN_PASSWORD}자 이상)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set({ password: e.target.value })}
          />
        </label>
        <label className="field">
          <span>비밀번호 확인</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set({ confirm: e.target.value })}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={submitting || branches.loading}>
          {submitting ? '가입 중…' : '가입하기'}
        </button>
      </form>

      <p className="login-links">
        이미 계정이 있나요? <Link to="/login">로그인</Link>
      </p>
    </div>
  );
}
