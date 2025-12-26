/* PERF.JS - FINAL MAP & PULSE FIX */

window.PerfLogic = {
    map: null,
    currentMode: 'track',

    init: function() {
        console.log("PerfLogic Init");
        this.setupTabs();
    },

    onScreenShow: function() {
        if (!this.map) {
            this.loadMap();
        } else {
            setTimeout(() => { this.map.invalidateSize(); }, 200);
        }
    },

    loadMap: function() {
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false
        }).setView([49.4521, 11.0767], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);
    },

    setupTabs: function() {
        const tabs = document.querySelectorAll('.psn-item');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentMode = tab.innerText.toLowerCase();
            };
        });
    },

    selectTrack: function(trackId) {
        if(!this.map) return;

        const overlay = document.getElementById('perf-map-overlay-text');
        overlay.classList.remove('hidden');
        overlay.innerText = "LOADING TRACK...";
        
        // Simuliere Ladezeit
        setTimeout(() => {
            const start = [49.4521, 11.0767]; 
            const end = [49.4600, 11.0800];
            
            this.map.invalidateSize();
            
            // Animation sanfter machen
            this.map.flyTo(start, 14, { duration: 1.0 });

            setTimeout(() => {
                // Alte Layer entfernen
                this.map.eachLayer((layer) => { if (!layer._url) this.map.removeLayer(layer); });

                // DOTS ERSTELLEN (Jetzt mit CSS Klasse für Animation!)
                const greenIcon = L.divIcon({ 
                    className: 'dummy', // Leaflet braucht eine Klasse, wir nutzen html
                    html: '<div class="pulsing-dot-green"></div>',
                    iconSize: [20,20], iconAnchor: [10,10]
                });
                
                const redIcon = L.divIcon({ 
                    className: 'dummy',
                    html: '<div class="pulsing-dot-red"></div>',
                    iconSize: [20,20], iconAnchor: [10,10]
                });

                L.marker(start, {icon: greenIcon}).addTo(this.map);
                L.marker(end, {icon: redIcon}).addTo(this.map);
                
                // Linie
                L.polyline([start, [49.455, 11.078], end], {color: '#ff3b30', weight: 4}).addTo(this.map);

                overlay.innerText = "START YOUR RACE";
            }, 1100);
        }, 100);
    }
};

PerfLogic.init();
