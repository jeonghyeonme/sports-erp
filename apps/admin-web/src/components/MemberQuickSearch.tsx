import { KeyboardEvent, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiPage } from '../lib/use-api-list';
import { MemberRow } from '../lib/types';

const LIMIT = 5;
const MIN_CHARS = 2;
const DELAY_MS = 300;

// D72 — 상단 바 회원 빠른 찾기. 기존 회원 목록 API(GET /members?q=&limit=)를 그대로 쓴다 — 지점 격리(D46)·
// 전화 마스킹(ADR-MEM-04)·권한(D60)은 서버가 본다. 글자마다 부르지 않도록 2자 이상, 0.3초 뒤에 묻는다.
export function MemberQuickSearch({ showBranch }: { showBranch: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const next = input.trim();
    const timer = setTimeout(() => setTerm(next.length >= MIN_CHARS ? next : ''), DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const params = new URLSearchParams({ q: term, page: '1', limit: String(LIMIT) });
  const { data, isFetching, isError } = useApiPage<MemberRow>(['members', 'quick', term], `/members?${params}`, {
    enabled: term.length >= MIN_CHARS,
  });
  const rows = term ? (data?.rows ?? []) : [];
  const total = term ? (data?.total ?? 0) : 0;
  const showList = open && input.trim().length >= MIN_CHARS;

  function reset() {
    setInput('');
    setTerm('');
    setOpen(false);
    setActive(-1);
  }

  function go(member: MemberRow) {
    reset();
    navigate(`/members/${member.id}`);
  }

  function showAll() {
    const q = input.trim();
    reset();
    navigate(`/members?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!rows.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(rows[active >= 0 ? active : 0]);
    }
  }

  return (
    <div className="quick-search">
      <input
        type="search"
        className="quick-search-input"
        placeholder="회원 찾기 — 이름 · 회원번호 · 전화"
        aria-label="회원 빠른 찾기"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={input}
        maxLength={50}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        // 결과를 누르는 동안 닫히지 않게 — 결과 쪽은 onMouseDown으로 고른다
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <div className="quick-search-panel">
          {isError && <div className="quick-search-note">회원을 불러오지 못했습니다.</div>}
          {!isError && term && !isFetching && rows.length === 0 && (
            <div className="quick-search-note">일치하는 회원이 없습니다.</div>
          )}
          {!isError && (!term || (isFetching && rows.length === 0)) && <div className="quick-search-note">찾는 중...</div>}
          {rows.length > 0 && (
            <ul id={listId} role="listbox" className="quick-search-list">
              {rows.map((m, i) => (
                <li
                  key={m.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'quick-search-item active' : 'quick-search-item'}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(m);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <strong>{m.name}</strong>
                  <span className="quick-search-meta">
                    {m.memberNo}
                    {m.phone ? ` · ${m.phone}` : ''}
                    {showBranch && m.branchName ? ` · ${m.branchName}` : ''}
                    {m.status !== 'ACTIVE' ? ` · ${m.status === 'DORMANT' ? '휴면' : '탈퇴'}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {total > rows.length && (
            <button
              type="button"
              className="quick-search-more"
              onMouseDown={(e) => {
                e.preventDefault();
                showAll();
              }}
            >
              회원 목록에서 모두 보기({total.toLocaleString()}건)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
