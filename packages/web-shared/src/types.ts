// admin-web·member-web이 함께 쓰는 응답 값 타입 — api `src/common/api-response.types.ts`(와 schema.prisma enum)와 같은 값.
// 화면마다 다른 응답 모양(AuthUser·ApiEnvelope 등)은 각 앱 lib/types.ts에 둔다.
export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';
export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';
export type AgeGroup = 'ALL' | 'CHILD' | 'TEEN' | 'ADULT' | 'SENIOR';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'FAILED' | 'REFUNDED';
export type ReservationStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
