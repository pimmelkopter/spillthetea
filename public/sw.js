// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body,
        icon: data.icon || '/favicon.ico',
        badge: data.icon || '/favicon.ico',
        data: { url: data.url },
        tag: 'spillthetea-notification',
        requireInteraction: false,
        silent: false
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.notification.data.url) {
        event.waitUntil(
            clients.matchAll().then(function(clientList) {
                // Try to focus existing tab first
                for (let client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
        );
    }
});

// Optional: Background sync for offline functionality
self.addEventListener('sync', function(event) {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

function doBackgroundSync() {
    // Placeholder for future offline functionality
    return Promise.resolve();
}