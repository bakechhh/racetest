const CACHE_NAME = 'keiba-ai-v1';
const urlsToCache = [
  '/keiba-index/',
  '/keiba-index/index.html',
  '/keiba-index/app.js',
  '/keiba-index/data-loader.js',
  '/keiba-index/manifest.json',
  '/keiba-index/notification.js',
  'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js'
];

// インストール時：静的ファイルをキャッシュ
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ時：キャッシュファーストで応答（オフライン対応）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Gemini APIはキャッシュをスキップ（明示的にcache: 'no-store'を追加）
  if (url.hostname.includes('generativelanguage.googleapis.com')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        mode: 'cors'
      })
    );
    return;
  }
  
  // OpenAI APIはキャッシュをスキップ
  if (url.hostname.includes('api.openai.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // その他の外部APIリクエストは常にネットワーク経由
  if (url.origin !== location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // JSONデータとオッズデータは常に最新を取得（キャッシュしない）
  if (url.pathname.includes('/data/') || url.pathname.includes('/odds/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(event.request);
        })
    );
    return;
  }

  // その他のリソース（自分のサイトの静的ファイル）はキャッシュファースト
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('[Service Worker] Serving from cache:', event.request.url);
          return response;
        }
        
        console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then((response) => {
          // 有効なレスポンス（200 OK）のみキャッシュ
          // エラーレスポンス（4xx, 5xx）はキャッシュしない
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
  );
});

// プッシュ通知受信時
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'レース情報が更新されました',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'keiba-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('競馬AI予測システム', options)
  );
});

// 通知クリック時
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  const notificationData = event.notification.data;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 既に開いているウィンドウがあればフォーカス
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // AI分析タブに切り替えるメッセージを送信
            if (notificationData && notificationData.action === 'view-ai-result') {
              client.postMessage({
                action: 'switch-to-ai-tab'
              });
            }
            return client.focus();
          }
        }
        // 開いているウィンドウがなければ新しく開く
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
  );
});
