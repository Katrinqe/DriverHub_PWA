/* ========================================== */
/* === SERVICE WORKER (HINTERGRUND-SERVER) == */
/* ========================================== */

self.addEventListener('install', (e) => {
    self.skipWaiting(); 
});
self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'TEST_ALARM') {
        const price = event.data.price;
        const delay = event.data.delay;

        setTimeout(() => {
            self.registration.showNotification('🔥 Preis-Alarm erreicht!', {
                body: `Dein eingestellter Preis von ${price}€ ist jetzt verfügbar.`,
                vibrate: [200, 100, 200], 
                requireInteraction: true  
            });
        }, delay);
    }
});
