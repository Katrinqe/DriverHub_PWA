const DriverLogic = {
    interval: null,
    saveInterval: null, 
    startTime: 0,
    startDist: 0,
    currentSpeed: 0,
    maxSpeed: 0, 
    path: [], 
    lastSpeedCheck: 0,
    lastRecordedPoint: null, 

    start: function() {
        console.log("Drive started");
        this.startTime = Date.now();
        this.startDist = 0;
        this.path = [];
        this.maxSpeed = 0; 
        this.lastSpeedCheck = 0;
        this.lastRecordedPoint = null;
        
        // UI Reset
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";
        document.getElementById('speed-limit').classList.add('hidden'); 

        // Timer starten
        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.updateTime();
        }, 1000);

        // Auto-Save starten
        if(this.saveInterval) clearInterval(this.saveInterval);
        this.saveInterval = setInterval(() => {
            this.saveCrashData();
        }, 30000);
    },

    update: function(pos) {
        if (!this.startTime) return;
        
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        this.currentSpeed = speed;

        if (speed > this.maxSpeed) this.maxSpeed = speed;

        // Recording Logic
        let shouldRecord = false;
        const newLatLng = L.latLng(lat, lng);

        if (!this.lastRecordedPoint) {
            shouldRecord = true;
        } else {
            const dist = this.lastRecordedPoint.distanceTo(newLatLng); 
            if (dist > 15) shouldRecord = true;
        }

        if (shouldRecord) {
            this.path.push({ lat: lat, lng: lng, speed: speed, time: Date.now() });
            
            if (this.lastRecordedPoint) {
                const distKm = this.lastRecordedPoint.distanceTo(newLatLng) / 1000;
                this.startDist += distKm;
            }
            this.lastRecordedPoint = newLatLng;
        }

        // HUD Update
        document.getElementById('hud-speed').innerText = this.currentSpeed;
        document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);
        
        // Speed Limit Check (alle 5 sek)
        if (Date.now() - this.lastSpeedCheck > 5000) {
            this.lastSpeedCheck = Date.now();
            this.checkSpeedLimit(lat, lng);
        }
    },

    saveCrashData: function() {
        const data = {
            active: true, startTime: this.startTime, startDist: this.startDist,
            maxSpeed: this.maxSpeed, path: this.path
        };
        localStorage.setItem('driverhub_crash_save', JSON.stringify(data));
    },

    clearCrashData: function() {
        localStorage.removeItem('driverhub_crash_save');
    },

    updateTime: function() {
        const diff = Date.now() - this.startTime;
        const totalSec = Math.floor(diff / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        document.getElementById('hud-time').innerText = 
            `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    },

    checkSpeedLimit: function(lat, lng) {
        // Nur Simple Fetch, kein komplexer Logic-Block der crashen kann
        const query = `[out:json][timeout:5];way["maxspeed"](around:25,${lat},${lng});out tags;`;
        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('speed-limit');
                if(data.elements && data.elements.length > 0 && data.elements[0].tags.maxspeed) {
                    let max = parseInt(data.elements[0].tags.maxspeed);
                    if(!isNaN(max)) {
                        el.querySelector('span').innerText = max;
                        el.classList.remove('hidden');
                        return;
                    }
                }
                el.classList.add('hidden');
            }).catch(() => {});
    },

    // --- STOP & SUMMARY LOGIC ---
    stop: function() {
        console.log("STOPPING DRIVE...");
        
        // 1. Alles stoppen
        clearInterval(this.interval);
        clearInterval(this.saveInterval);
        this.clearCrashData(); 

        // 2. Werte berechnen
        const durationMs = Date.now() - this.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        const timeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        const avgSpeed = (durationMs > 0 && this.startDist > 0) ? Math.round(this.startDist / (durationMs/3600000)) : 0;

        // 3. UI Update (Summary Card füllen)
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.startDist.toFixed(2);
        document.getElementById('sum-time').innerText = timeStr;
        document.getElementById('sum-max').innerText = this.maxSpeed; 

        // 4. SCREEN WECHSEL (Hart codiert, damit es funktioniert)
        // Alle Screens ausblenden
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('active');
        });
        
        // Summary Screen einblenden
        const summaryScreen = document.getElementById('summary-screen');
        summaryScreen.classList.remove('hidden');
        summaryScreen.classList.add('active'); // Für CSS opacity transition
        
        // Bottom Nav weg
        document.getElementById('global-nav').classList.add('hidden');

        // 5. Map Fixieren & Mini-Map bauen
        const mapEl = document.getElementById('background-map');
        if(mapEl) {
            mapEl.classList.remove('map-smooth-rotate');
            mapEl.classList.add('map-locked');
            mapEl.style.transform = 'translate(-50%, -50%) rotate(0deg)';
        }

        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if(mapContainer) {
                // Alte Map killen falls vorhanden
                if (window.summaryMapInstance) { 
                    window.summaryMapInstance.remove(); 
                    window.summaryMapInstance = null; 
                }
                mapContainer.innerHTML = "";
                
                // Neue Map erstellen
                window.summaryMapInstance = L.map('summary-map', { 
                    zoomControl: false, 
                    attributionControl: false,
                    dragging: false,
                    scrollWheelZoom: false 
                });
                
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    maxZoom: 19
                }).addTo(window.summaryMapInstance);

                if (this.path.length > 0) {
                    const latLngs = this.path.map(p => [p.lat, p.lng]);
                    const line = L.polyline(latLngs, {color: '#bf5af2', weight: 4}).addTo(window.summaryMapInstance);
                    window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[20,20]});
                } else {
                    // Fallback Location falls keine GPS Punkte
                    window.summaryMapInstance.setView([51.1657, 10.4515], 6);
                }
            }
        }, 100);

        // 6. SAVE BUTTON LOGIK (Hier direkt definiert)
        const btnSave = document.getElementById('btn-save');
        // Klonen um alte Event Listener zu löschen
        const newBtnSave = btnSave.cloneNode(true);
        btnSave.parentNode.replaceChild(newBtnSave, btnSave);

        newBtnSave.onclick = () => {
            // Daten speichern
            const driveData = {
                id: Date.now(),
                date: new Date().toLocaleDateString('de-DE'),
                timestamp: new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}),
                dist: parseFloat(this.startDist.toFixed(2)),
                duration: timeStr,
                avg: avgSpeed,
                max: this.maxSpeed,
                path: this.path
            };

            let history = JSON.parse(localStorage.getItem('driverhub_drives') || "[]");
            history.unshift(driveData);
            localStorage.setItem('driverhub_drives', JSON.stringify(history));

            // Zur Garage wechseln
            document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
            document.getElementById('garage-screen').classList.remove('hidden');
            document.getElementById('global-nav').classList.remove('hidden');
            
            // Garage Tab aktiv setzen
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-home', 'active-map', 'active-garage'));
            document.getElementById('nav-garage').classList.add('active-garage');

            // Garage Liste neu laden
            if(window.GarageLogic) window.GarageLogic.loadList();
        };

        // 7. DISCARD BUTTON LOGIK
        const btnDiscard = document.getElementById('btn-discard');
        const newBtnDiscard = btnDiscard.cloneNode(true);
        btnDiscard.parentNode.replaceChild(newBtnDiscard, btnDiscard);
        
        newBtnDiscard.onclick = () => {
            location.reload(); // Einfachste Methode um alles zu resetten
        };
    }
};

// Initialisierung: CLICK BINDING (Das hat gefehlt!)
document.addEventListener('DOMContentLoaded', () => {
    const btnStop = document.getElementById('btn-stop');
    if(btnStop) {
        // Harter Klick-Listener, keine Animation, keine Spielereien.
        btnStop.onclick = () => {
            DriverLogic.stop();
        };
    }
});
