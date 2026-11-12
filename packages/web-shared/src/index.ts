// admin-web·member-web 공유 코드(D78). 두 앱이 같은 내용을 따로 들고 "고치면 둘 다 고친다"던 것을 여기 한 벌로 둔다.
// Vite·tsc가 이 TS 원본을 앱 소스처럼 그대로 컴파일한다(빌드 단계 없음). api는 쓰지 않는다(Nest 빌드·Lambda 번들 밖).
export * from './types';
export * from './password-rule';
export * from './slow-requests';
export * from './rich-content';
export { SlowRequestNotice } from './SlowRequestNotice';
