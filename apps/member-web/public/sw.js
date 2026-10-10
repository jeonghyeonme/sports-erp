/* 스포이즘 회원 앱 service worker(log/094, D45).
 * - 화면 파일만 캐시한다. api(/api/*)는 절대 캐시하지 않는다 — 예약·결제·혼잡도가 오래된 값으로 보이면 안 된다.
 * - 화면 진입(navigation): 네트워크 먼저, 실패(오프라인)면 저장해 둔 /m/ 셸을 준다. 셸이 뜨면 화면이 "연결 없음"을 알린다.
 * - /m/assets/*: Vite가 파일 이름에 해시를 붙여 내용이 바뀌면 이름도 바뀐다 — 캐시 먼저(한 번 받으면 다시 안 받음).
 * - 이 파일은 /m/sw.js에 있어야 범위가 /m/ 전체가 된다. Worker run_worker_first에서 빼 두었다(무료 한도, D45).
 */
const CACHE = 'spoism-member-v1';
const SHELL = '/m/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/m/')) return; // api·관리자 웹은 손대지 않는다

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(SHELL, res.clone()));
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  if (url.pathname.startsWith('/m/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
