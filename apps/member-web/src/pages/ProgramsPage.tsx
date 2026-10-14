import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { won } from '../lib/format';
import { AgeGroup, Program } from '../lib/types';
import { SkeletonList } from '../components/Skeleton';

const AGE_GROUP_LABEL: Record<AgeGroup, string> = { ALL: '전체 연령', CHILD: '유아동', TEEN: '청소년', ADULT: '성인', SENIOR: '시니어' };
// 강사프로그램게시 ADR-PRG-04 — 시간대는 오늘 이후 회차의 시작 시각(오전 ~12시, 오후 12~18시, 저녁 18시~).
const TIME_BAND_LABEL = { MORNING: '오전', AFTERNOON: '오후', EVENING: '저녁' } as const;
type TimeBand = keyof typeof TIME_BAND_LABEL;

// 예약하기 1단계 — 운영 중 프로그램 목록. 호출 1회(GET /programs?status=RUNNING). 지점은 서버가 본인 지점으로 강제한다
// (BranchScopeGuard). 회차 예약을 받는 것은 PAID_SESSION뿐이다(api reservation.service NOT_RESERVABLE).
// 필터(ADR-PRG-04): 종목·연령대는 받은 목록을 화면에서 거른다(호출 0회, design-constants ⑩). 시간대는 회차를 봐야 해서
// 고를 때만 서버에 timeBand를 실어 한 번 더 부른다.
export function ProgramsPage() {
  const [category, setCategory] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | ''>('');
  const [timeBand, setTimeBand] = useState<TimeBand | ''>('');
  const { data, error, loading, reload } = useLoad<Program[]>(
    `/programs?status=RUNNING${timeBand ? `&timeBand=${timeBand}` : ''}`,
  );

  if (loading) return <SkeletonList />;
  if (error) {
    return (
      <div className="panel error-panel" role="alert">
        <p>{describeError(error, '프로그램 목록을 불러오지 못했습니다.')}</p>
        <button type="button" className="secondary-button" onClick={reload}>
          다시 시도
        </button>
      </div>
    );
  }

  const loaded = data ?? [];
  // 고른 종목이 시간대 결과에 없어도 선택지에서 사라지지 않게 함께 둔다.
  const categories = [...new Set([...loaded.map((p) => p.category), ...(category ? [category] : [])])].sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );
  // 연령대 "전체(ALL)" 프로그램은 어느 연령대를 골라도 보인다.
  const programs = loaded.filter(
    (p) => (!category || p.category === category) && (!ageGroup || p.ageGroup === ageGroup || p.ageGroup === 'ALL'),
  );
  const filtered = category !== '' || ageGroup !== '' || timeBand !== '';
  const reservable = programs.filter((p) => p.pricingType === 'PAID_SESSION');
  const others = programs.filter((p) => p.pricingType !== 'PAID_SESSION');

  return (
    <div className="stack">
      <h1>예약하기</h1>
      <div className="filter-row">
        <label className="field">
          <span>종목</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>연령대</span>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup | '')}>
            <option value="">전체</option>
            {(Object.keys(AGE_GROUP_LABEL) as AgeGroup[])
              .filter((g) => g !== 'ALL')
              .map((g) => (
                <option key={g} value={g}>
                  {AGE_GROUP_LABEL[g]}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>시간대</span>
          <select value={timeBand} onChange={(e) => setTimeBand(e.target.value as TimeBand | '')}>
            <option value="">전체</option>
            {(Object.keys(TIME_BAND_LABEL) as TimeBand[]).map((b) => (
              <option key={b} value={b}>
                {TIME_BAND_LABEL[b]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {reservable.length === 0 && (
        <p className="panel empty-state">
          {filtered ? '조건에 맞는 예약 프로그램이 없습니다.' : '지금 예약할 수 있는 프로그램이 없습니다.'}
        </p>
      )}
      <ul className="list">
        {reservable.map((p) => (
          <li key={p.id}>
            {/* 다음 화면이 프로그램 정보를 다시 부르지 않도록 넘겨 준다(호출 수 절약). */}
            <Link to={`/programs/${p.id}`} state={{ program: p }} className="panel program-card">
              <span className="program-name">{p.name}</span>
              <span className="muted">
                {p.category}
                {p.ageGroup !== 'ALL' && ` · ${AGE_GROUP_LABEL[p.ageGroup]}`}
                {p.instructorName && ` · ${p.instructorName}`}
              </span>
              <span className="program-price">{p.price > 0 ? `회당 ${won(p.price)}` : '무료'}</span>
            </Link>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">예약 없이 이용</h2>
          <ul className="list">
            {others.map((p) => (
              <li key={p.id} className="panel program-card is-static">
                <span className="program-name">{p.name}</span>
                <span className="muted">
                  {p.pricingType === 'FREE_ACCESS' ? '운영 시간에 바로 이용하세요.' : '담당 트레이너와 일정을 잡습니다.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
