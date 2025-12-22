/* =========================================
   DRIVE LOGIC (VERSION 6.0 - DATA FREEZE FIX)
   ========================================= */

const DriverLogic = {
    interval: null,
    startTime: 0,
    startDist: 0,
    currentSpeed: 0,
    maxSpeed: 0, 
    path: [], 
    lastSpeedCheck: 0, 
    watchId: null, 

    start: function() {
        console.log("Drive Started");
        this.startTime = Date.now();
        this.startDist = 0;
        this.path = [];
        this.maxSpeed = 0; 
        this.lastSpeedCheck = 0;
        
        // UI Reset
        if(document.getElementById('hud-time')) document.getElementById('hud-time').innerText = "00:00";
        if(document.getElementById('hud-dist')) document.getElementById('hud-dist').innerText = "0.00";
        if(document.getElementById('hud-speed')) document.getElementById('hud-speed').innerText = "0";
        if(document.getElementById('speed-limit')) document.getElementById('speed-limit').classList.add('hidden');

        // Timer starten
        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.updateTime();
        }, 1000);

        // GPS starten
        if (navigator.geolocation) {
            if(this.watchId) navigator.geolocation.clearWatch(this.watchId);
            this.watchId = navigator.geolocation.watchPosition(
                pos => this.update(pos),
                err => console.warn("GPS Error", err),
                { enableHighAccuracy: true, maximumAge: 0 }
            );
        }
    },

    update: function(pos) {
        if (!this.startTime) return;
        
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        this.currentSpeed = speed;

        // Max Speed live tracken
        if (speed > this.maxSpeed) {
            this.maxSpeed = speed;
        }

        this.path.push({
            lat: lat,
            lng: lng,
            speed: speed,
            time: Date.now()
        });

        // Distanz berechnen
        if (this.path.length > 1) {
            const last = this.path[this.path.length - 2];
            const curr = this.path[this.path.length - 1];
            const p1 = L.latLng(last.lat, last.lng);
            const p2 = L.latLng(curr.lat, curr.lng);
            this.startDist += p1.distanceTo(p2) / 1000; 
        }

        // HUD Update
        if(document.getElementById('hud-speed')) document.getElementById('hud-speed').innerText = this.currentSpeed;
        if(document.getElementById('hud-dist')) document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);
        
        // Speed Limit alle 5 sek
        if (Date.now() - this.lastSpeedCheck > 5000) {
            this.lastSpeedCheck = Date.now();
            this.checkSpeedLimit(lat, lng);
        }
    },

    updateTime: function() {
        const diff = Date.now() - this.startTime;
        const totalSec = Math.floor(diff / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const el = document.getElementById('hud-time');
        if(el) el.innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    },

    checkSpeedLimit: function(lat, lng) {
        const query = `[out:json][timeout:5];way["maxspeed"](around:25,${lat},${lng});out tags;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        
        fetch(url).then(r => r.json()).then(data => {
            const el = document.getElementById('speed-limit');
            if(data.elements && data.elements.length > 0) {
                let max = data.elements[0].tags.maxspeed;
                if(max && !isNaN(parseInt(max))) {
                    el.querySelector('span').innerText = max;
                    el.classList.remove('hidden');
                } else { 
                    el.classList.add('hidden'); 
                }
            } else { 
                el.classList.add('hidden'); 
            }
        }).catch(e => { 
            const el = document.getElementById('speed-limit');
            if(el) el.classList.add('hidden');
        });
    },

    stop: function() {
        // 1. Sofort alles stoppen
        clearInterval(this.interval);
        if(this.watchId) navigator.geolocation.clearWatch(this.watchId);

        // 2. DATEN EINFRIEREN (SNAPSHOT ERSTELLEN)
        // Das ist der wichtigste Schritt: Wir speichern die Werte in lokalen Variablen,
        // auf die der Save-Button sicher zugreifen kann.
        
        const durationMs = Date.now() - this.startTime;
        const durationMin = Math.floor(durationMs / 60000); // Minuten
        const durationSec = Math.floor((durationMs % 60000) / 1000); // Sekunden
        
        // Zeit String formatieren ("05:30")
        const finalTimeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        
        // Werte kopieren
        const finalDist = parseFloat(this.startDist.toFixed(2)); // Als Zahl speichern
        const finalMax = this.maxSpeed;
        const finalPath = [...this.path]; // Echte Kopie des Pfades
        
        // Durchschnitt berechnen
        const avgSpeed = (durationMs > 0 && finalDist > 0) ? Math.round(finalDist / (durationMs/3600000)) : 0;

        console.log("Drive Stopped. Stats:", { finalDist, finalTimeStr, finalMax, avgSpeed });

        // 3. Summary Screen füllen (nur Anzeige)
        if(document.getElementById('sum-avg')) document.getElementById('sum-avg').innerText = avgSpeed;
        if(document.getElementById('sum-dist')) document.getElementById('sum-dist').innerText = finalDist.toFixed(2);
        if(document.getElementById('sum-time')) document.getElementById('sum-time').innerText = finalTimeStr;
        
        // UI Aufräumen
        const compRow = document.getElementById('sum-comparison-row');
        if(compRow) compRow.classList.add('hidden'); 
        const globNav = document.getElementById('global-nav');
        if(globNav) globNav.classList.add('hidden'); 
        
        // Map sperren
        const mapEl = document.getElementById('background-map');
        if(mapEl) {
            mapEl.classList.remove('map-smooth-rotate');
            mapEl.classList.add('map-locked'); 
            mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
        }

        // Summary Map (Miniatur)
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if(!mapContainer) return;
            if (window.summaryMapInstance) { window.summaryMapInstance.remove(); window.summaryMapInstance = null; }
            mapContainer.innerHTML = "";
            window.summaryMapInstance = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.summaryMapInstance);
            if (finalPath.length > 1) {
                const latLngs = finalPath.map(p => [p.lat, p.lng]);
                const line = L.polyline(latLngs, {color: '#bf5af2', weight: 4}).addTo(window.summaryMapInstance);
                window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[40,40]});
            } else if (finalPath.length > 0) {
                 window.summaryMapInstance.setView([finalPath[0].lat, finalPath[0].lng], 15);
            }
        }, 300);

        // Screen wechseln
        if(typeof switchScreen === 'function') switchScreen('summary-screen');

        // 4. SPEICHERN BUTTON (DER FIX)
        const saveBtn = document.getElementById('btn-save');
        if(saveBtn) {
            // Alten Listener entfernen (durch Überschreiben)
            saveBtn.onclick = () => {
                
                // Wir nutzen hier NUR die "final..." Variablen von oben!
                // Nicht mehr "this.startDist", weil das weg sein könnte.
                const rideData = { 
                    date: Date.now(), 
                    dist: finalDist,        // Nimm den Snapshot
                    time: finalTimeStr,     // Nimm den Snapshot
                    avg: avgSpeed,          // Nimm den Snapshot
                    max: finalMax,          // Nimm den Snapshot
                    path: finalPath 
                };

                // Speichern
                let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
                rides.unshift(rideData);
                localStorage.setItem('driverhub_rides', JSON.stringify(rides));
                
                // Garage updaten
                if(typeof GarageLogic !== 'undefined') {
                    GarageLogic.renderList();
                }
                
                if(typeof showGarage === 'function') showGarage(); 
            };
        }
        
        const discardBtn = document.getElementById('btn-discard');
        if(discardBtn && typeof showHome === 'function') discardBtn.onclick = showHome; 
    }
};
