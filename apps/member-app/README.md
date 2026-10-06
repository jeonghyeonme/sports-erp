# member-app (회원용 네이티브 앱) — 만들지 않음

회원 기능은 네이티브 앱(React Native) 대신 **모바일 웹**으로 만든다([D40](../../docs/decisions/D40.md)).
관리자 웹과 같은 React + Vite·공유 타입(`packages/types`)을 쓰고, 같은 Cloudflare Worker로 배포한다.
대상 지점은 수도권 83곳이다. 모바일 웹을 착수하면 이 폴더는 정리한다.
