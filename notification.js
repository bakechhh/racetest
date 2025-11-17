/*
    プッシュ通知管理
    - 通知許可リクエスト
    - 通知送信
*/

// ====================
// 通知許可リクエスト
// ====================
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('[Notification] This browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        console.log('[Notification] Permission already granted');
        return true;
    }

    if (Notification.permission === 'denied') {
        console.warn('[Notification] Permission denied');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('[Notification] Permission:', permission);
        return permission === 'granted';
    } catch (error) {
        console.error('[Notification] Permission request failed:', error);
        return false;
    }
}

// ====================
// 通知送信（テスト用）
// ====================
async function sendTestNotification() {
    const granted = await requestNotificationPermission();
    
    if (!granted) {
        alert('通知の許可が必要です。ブラウザの設定から通知を許可してください。');
        return;
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Service Worker経由で通知を送信
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification('競馬AI予測システム', {
                body: 'テスト通知です。PWAが正常に動作しています。',
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'test-notification',
                requireInteraction: false
            });
        });
    } else {
        // 通常の通知（Service Workerが利用できない場合）
        new Notification('競馬AI予測システム', {
            body: 'テスト通知です。PWAが正常に動作しています。',
            icon: '/icons/icon-192.png'
        });
    }
}

// ====================
// レース開始前通知（将来の拡張用）
// ====================
async function scheduleRaceNotification(raceInfo) {
    const granted = await requestNotificationPermission();
    
    if (!granted) {
        return;
    }

    // 実装例：レース開始5分前に通知
    const raceTime = new Date(raceInfo.startTime);
    const notificationTime = new Date(raceTime.getTime() - 5 * 60 * 1000); // 5分前
    const now = new Date();
    
    if (notificationTime > now) {
        const delay = notificationTime.getTime() - now.getTime();
        
        setTimeout(() => {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.showNotification('レース開始まもなく', {
                        body: `${raceInfo.raceName}が5分後に開始します`,
                        icon: '/icons/icon-192.png',
                        badge: '/icons/icon-192.png',
                        vibrate: [200, 100, 200, 100, 200],
                        tag: `race-${raceInfo.raceId}`,
                        requireInteraction: true,
                        actions: [
                            { action: 'view', title: '詳細を見る' },
                            { action: 'close', title: '閉じる' }
                        ]
                    });
                });
            }
        }, delay);
        
        console.log(`[Notification] Scheduled notification for ${raceInfo.raceName} at ${notificationTime}`);
    }
}

// ====================
// オッズ変動通知（将来の拡張用）
// ====================
async function notifyOddsChange(horseInfo) {
    const granted = await requestNotificationPermission();
    
    if (!granted) {
        return;
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification('オッズ変動', {
                body: `${horseInfo.horseName}のオッズが${horseInfo.oldOdds}倍→${horseInfo.newOdds}倍に変動しました`,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                vibrate: [200, 100, 200],
                tag: `odds-${horseInfo.horseNumber}`,
                requireInteraction: false
            });
        });
    }
}

// ====================
// AI分析完了通知
// ====================
async function notifyAIAnalysisComplete(raceInfo) {
    // 通知許可がない場合は何もしない
    if (Notification.permission !== 'granted') {
        console.log('[Notification] Permission not granted, skipping AI analysis notification');
        return;
    }

    const raceName = raceInfo.raceName || 'レース';
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification('AI分析完了', {
                body: `${raceName}の分析が完了しました。タップして結果を確認してください。`,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'ai-analysis-complete',
                data: {
                    action: 'view-ai-result',
                    raceInfo: raceInfo
                }
            });
            console.log(`[Notification] AI analysis complete notification sent for ${raceName}`);
        });
    } else {
        // Service Workerが利用できない場合は通常の通知
        new Notification('AI分析完了', {
            body: `${raceName}の分析が完了しました。`,
            icon: '/icons/icon-192.png'
        });
        console.log(`[Notification] AI analysis complete notification sent (fallback) for ${raceName}`);
    }
}

// ====================
// グローバルに公開
// ====================
window.requestNotificationPermission = requestNotificationPermission;
window.sendTestNotification = sendTestNotification;
window.scheduleRaceNotification = scheduleRaceNotification;
window.notifyOddsChange = notifyOddsChange;
window.notifyAIAnalysisComplete = notifyAIAnalysisComplete;
