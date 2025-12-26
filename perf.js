/* PERF.JS - FINAL MAP FIX */

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
            // WICHTIG: Map reparieren, wenn sie wieder sichtbar wird
            setTimeout(() => {
                this.map.invalidateSize();
            }, 200);
        }
    },

    loadMap: function() {
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false
        }).setView([49.4521, 11.0767], 13); // Nürnberg

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
            
            this.map.invalidateSize(); // Sicherheitshalber
            this.map.flyTo(start, 14, { duration: 1.5 });

            setTimeout(() => {
                // Alte Layer weg
                this.map.eachLayer((layer) => { if (!layer._url) this.map.removeLayer(layer); });

                // DOTS ERSTELLEN (Inline Styles für Sicherheit)
                const greenIcon = L.divIcon({ 
                    className: 'custom-div-icon',
                    html: '<div style="width:15px;height:15px;background:#30d158;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #30d158;"></div>',
                    iconSize: [15,15], iconAnchor: [7,7]
                });
                const redIcon = L.divIcon({ 
                    className: 'custom-div-icon',
                    html: '<div style="width:15px;height:15px;background:#ff3b30;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #ff3b30;"></div>',
                    iconSize: [15,15], iconAnchor: [7,7]
                });

                L.marker(start, {icon: greenIcon}).addTo(this.map);
                L.marker(end, {icon: redIcon}).addTo(this.map);
                L.polyline([start, [49.455, 11.078], end], {color: '#ff3b30', weight: 4}).addTo(this.map);

                overlay.innerText = "START YOUR RACE";
            }, 1600);
        }, 100);
    }
};

PerfLogic.init();
