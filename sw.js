self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'TEST_ALARM') {
        const price = event.data.price;
        
        // Das U-Boot wartet 20 Sekunden im Hintergrund
        setTimeout(() => {
            self.registration.showNotification('🔥 Preis-Alarm erreicht!', {
                body: `Dein eingestellter Preis von ${price}€ ist da.`,
                requireInteraction: true  
            });
        }, event.data.delay);
    }
});
