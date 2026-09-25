import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import {
  AffectedReservations,
  AgeGroup,
  ApiEnvelope,
  FacilityRow,
  InstructorRow,
  PricingType,
  ProgramRow,
  ProgramStatus,
} from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const PRICING_LABEL: Record<PricingType, string> = {
  FREE_ACCESS: '자유이용',
  PAID_SESSION: '회차 예약',
  PT_PACKAGE: 'PT 패키지',
};

const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  ALL: '전체',
  CHILD: '유아동',
  TEEN: '청소년',
  ADULT: '성인',
  SENIOR: '시니어',
};

const STATUS_LABEL: Record<ProgramStatus, string> = {
  PREPARING: '준비중',
  RUNNING: '진행중',
  PAUSED: '휴강',
  ENDED: '종료',
};

// 07문서 §3-2 전이표 — 허용되지 않은 전이를 굳이 서버까지 보내지 않고 드롭다운에서부터 막는다.
const STATUS_TRANSITIONS: Record<ProgramStatus, ProgramStatus[]> = {
  PREPARING: ['RUNNING', 'ENDED'],
  RUNNING: ['PAUSED', 'ENDED'],
  PAUSED: ['RUNNING', 'ENDED'],
  ENDED: [],
};

interface ProgramForm {
  name: string;
  category: string;
  ageGroup: AgeGroup;
  pricingType: PricingType;
  price: string;
  capacity: string;
  facilityId: string;
  instructorId: string;
  startDate: string;
  endDate: string;
  description: string;
}

function toForm(p?: ProgramRow): ProgramForm {
  return {
    name: p?.name ?? '',
    category: p?.category ?? '',
    ageGroup: p?.ageGroup ?? 'ALL',
    pricingType: p?.pricingType ?? 'PAID_SESSION',
    price: p ? String(p.price) : '',
    capacity: p?.capacity != null ? String(p.capacity) : '',
    facilityId: p?.facilityId ?? '',
    instructorId: p?.instructorId ?? '',
    startDate: p?.startDate ?? '',
    endDate: p?.endDate ?? '',
    description: p?.description ?? '',
  };
}

function ProgramFormModal({
  branchId,
  program,
  onClose,
}: {
  branchId: string;
  program?: ProgramRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProgramForm>(toForm(program));
  const isEdit = !!program;
  const isFree = form.pricingType === 'FREE_ACCESS';

  const facilitiesQuery = useApiList<FacilityRow>(['facilities', branchId], `/facilities?branchId=${branchId}`);
  const instructorsQuery = useApiList<InstructorRow>(
    ['instructors', branchId],
    `/instructors?branchId=${branchId}`,
  );

  const saveMutation = useMutation<ProgramRow, AxiosError<ApiErrorBody>, ProgramForm>({
    mutationFn: async (dto) => {
      const payload = {
        name: dto.name,
        category: dto.category,
        ageGroup: dto.ageGroup,
        description: dto.description || undefined,
        pricingType: dto.pricingType,
        price: dto.pricingType === 'FREE_ACCESS' ? 0 : Number(dto.price || 0),
        capacity: dto.pricingType === 'FREE_ACCESS' ? undefined : dto.capacity ? Number(dto.capacity) : undefined,
        facilityId: dto.facilityId || undefined,
        instructorId: dto.instructorId || undefined,
        startDate: dto.startDate,
        endDate: dto.endDate || undefined,
      };
      if (isEdit) {
        return (await api.patch<ApiEnvelope<ProgramRow>>(`/programs/${program!.id}`, payload)).data.data!;
      }
      return (await api.post<ApiEnvelope<ProgramRow>>('/programs', payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.startDate) return;
    // ADR-PRG-01 — 회차 생성 시점이 아니라 여기서 바로 막아 원인-증상 거리를 줄인다(백엔드도 동일 검증).
    if (form.pricingType === 'PAID_SESSION' && !form.capacity) return;
    saveMutation.mutate(form);
  }

  return (
    <Modal title={isEdit ? '프로그램 수정' : '프로그램 등록'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>프로그램명 *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="field">
            <label>종목 *</label>
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>연령대</label>
            <select value={form.ageGroup} onChange={(e) => setForm((f) => ({ ...f, ageGroup: e.target.value as AgeGroup }))}>
              {(Object.keys(AGE_GROUP_LABEL) as AgeGroup[]).map((g) => (
                <option key={g} value={g}>
                  {AGE_GROUP_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>이용 방식</label>
            <select
              value={form.pricingType}
              onChange={(e) => setForm((f) => ({ ...f, pricingType: e.target.value as PricingType }))}
            >
              {(Object.keys(PRICING_LABEL) as PricingType[]).map((t) => (
                <option key={t} value={t}>
                  {PRICING_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>가격{isFree && ' (자유이용은 항상 무료)'}</label>
            <input
              type="number"
              min={0}
              value={isFree ? '0' : form.price}
              disabled={isFree}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>
              정원
              {isFree && ' (자유이용은 시설 정원으로 관리)'}
              {form.pricingType === 'PAID_SESSION' && ' *'}
            </label>
            <input
              type="number"
              min={1}
              value={isFree ? '' : form.capacity}
              disabled={isFree}
              required={form.pricingType === 'PAID_SESSION'}
              placeholder={isFree ? '-' : undefined}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>시설</label>
            <select value={form.facilityId} onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))}>
              <option value="">선택 안 함</option>
              {(facilitiesQuery.data ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>강사</label>
            <select
              value={form.instructorId}
              onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))}
            >
              <option value="">배정 안 함</option>
              {(instructorsQuery.data ?? [])
                .filter((i) => i.isActive)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>시작일 *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>종료일(선택 — 상시운영이면 비워둠)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>설명</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {saveMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(saveMutation.error)}
          </div>
        )}

        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={saveMutation.isPending}>
            {isEdit ? '저장' : '등록'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ADR-PRG-02 — 값만 내려주고 화면에서 안 보이면 ADR-BRD-01·ADR-FAC-01과 같은 문제가 재발하므로,
// PAUSED/ENDED 전이(상태 변경·삭제) 양쪽에서 이 알림을 공유한다.
function alertAffectedReservations(updated: ProgramRow & { affectedReservations?: AffectedReservations }): void {
  const affected = updated.affectedReservations;
  if (!affected || affected.count === 0) return;
  const names = affected.items.map((i) => `${i.memberName ?? '이름 미상'}(${i.date})`).join(', ');
  window.alert(
    `'${updated.name}' 프로그램에 앞으로 예정된 예약이 ${affected.count}건 있습니다: ${names}\n` +
      '자동 알림은 발송되지 않으니 직접 안내해주세요.',
  );
}

export function ProgramsPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useApiList<ProgramRow>(['programs'], '/programs');
  const [search, setSearch] = useState('');
  const [modalProgram, setModalProgram] = useState<ProgramRow | 'new' | null>(null);
  const queryClient = useQueryClient();
  const canManage = user?.role === 'BRANCH_ADMIN';

  // ADR-PRG-02 — 응답에 딸려오는 affectedReservations를 화면에서 즉시 보여줘야 "관리자가 즉시 인지"라는
  // 결정 취지가 실제로 성립한다(값만 내려주고 화면에서 안 보이면 ADR-BRD-01·ADR-FAC-01과 같은 문제가 재발).
  const statusMutation = useMutation<
    ProgramRow & { affectedReservations?: AffectedReservations },
    AxiosError<ApiErrorBody>,
    { id: string; status: ProgramStatus }
  >({
    mutationFn: async ({ id, status }) =>
      (
        await api.patch<ApiEnvelope<ProgramRow & { affectedReservations?: AffectedReservations }>>(
          `/programs/${id}/status`,
          { status },
        )
      ).data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      alertAffectedReservations(updated);
    },
  });

  // ADR-PRG-02 — ENDED(소프트 삭제)도 PAUSED와 같은 종류의 전이라 같은 안내가 필요하다.
  const endMutation = useMutation<
    ProgramRow & { affectedReservations?: AffectedReservations },
    AxiosError<ApiErrorBody>,
    string
  >({
    mutationFn: async (id) =>
      (await api.delete<ApiEnvelope<ProgramRow & { affectedReservations?: AffectedReservations }>>(`/programs/${id}`))
        .data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      alertAffectedReservations(updated);
    },
  });

  const groups = useMemo(() => {
    const all = groupByBranch(data ?? []);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>프로그램</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            07문서 기준 더미 데이터입니다. status와 pricingType이 실제로 구분되어 내려옵니다.
            지점별로 묶어서 보여줍니다(98개 지점 규모 대응 — 지점명으로 검색해 좁혀보세요).
          </p>
        </div>
        {canManage && user?.branchId && (
          <button
            className="btn-secondary primary"
            style={{ flexShrink: 0 }}
            onClick={() => setModalProgram('new')}
          >
            + 프로그램 등록
          </button>
        )}
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {(statusMutation.isError || endMutation.isError) && (
        <div className="forbidden-note">{apiErrorMessage(statusMutation.error ?? endMutation.error ?? null)}</div>
      )}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && (
        <div className="list-toolbar">
          <input
            className="search-input"
            placeholder="지점명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <div className="empty-state">표시할 프로그램이 없습니다.</div>
      )}
      {!isLoading && !isError && (data?.length ?? 0) > 0 && groups.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {!isError &&
        groups.map((group) => (
          <CollapsibleBranchSection
            key={group.branchId}
            branchName={group.branchName}
            count={group.rows.length}
            countLabel="개"
            defaultExpanded={autoExpand}
          >
            <table>
              <thead>
                <tr>
                  <th>프로그램명</th>
                  <th>종목</th>
                  <th>이용방식</th>
                  <th>가격</th>
                  <th>강사</th>
                  <th>상태</th>
                  <th>시작일</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((p) => {
                  const nextStatuses = STATUS_TRANSITIONS[p.status];
                  return (
                    <tr key={p.id}>
                      <td>
                        {canManage ? (
                          <button
                            className="branch-row-name"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                            onClick={() => setModalProgram(p)}
                          >
                            {p.name}
                          </button>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td>{p.category}</td>
                      <td>{PRICING_LABEL[p.pricingType]}</td>
                      <td>{p.price > 0 ? `${p.price.toLocaleString()}원` : '무료'}</td>
                      <td>{p.instructorName ?? '-'}</td>
                      <td>
                        {canManage && nextStatuses.length > 0 ? (
                          <select
                            className="role-select"
                            value={p.status}
                            disabled={statusMutation.isPending}
                            onChange={(e) =>
                              statusMutation.mutate({ id: p.id, status: e.target.value as ProgramStatus })
                            }
                          >
                            <option value={p.status}>{STATUS_LABEL[p.status]}</option>
                            {nextStatuses.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}(으)로 전환
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                        )}
                      </td>
                      <td>{p.startDate}</td>
                      {canManage && (
                        <td>
                          {p.status !== 'ENDED' && (
                            <button
                              className="btn-danger-outline"
                              disabled={endMutation.isPending}
                              onClick={() => endMutation.mutate(p.id)}
                            >
                              종료
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CollapsibleBranchSection>
        ))}

      {modalProgram && user?.branchId && (
        <ProgramFormModal
          branchId={user.branchId}
          program={modalProgram === 'new' ? undefined : modalProgram}
          onClose={() => setModalProgram(null)}
        />
      )}
    </>
  );
}
