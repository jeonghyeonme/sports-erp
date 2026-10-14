import { useAuth } from '../lib/use-auth';
import { AttendancePage } from './AttendancePage';
import { HqAttendancePage } from './HqAttendancePage';

// /attendance — 본사는 조회 전용 현황(HqAttendancePage), 지점 관리자·직원은 셀프서비스 + 관리(AttendancePage).
export function AttendanceEntry() {
  const { user } = useAuth();
  return user?.role === 'SUPER_ADMIN' ? <HqAttendancePage /> : <AttendancePage />;
}
