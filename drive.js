/* =========================================
   DRIVE LOGIC (VERSION 9.0 - END BUTTON FIX)
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
    holdTimer: null, // Für den Button

    start: function() {
        console.log("Drive Started");
        this.startTime = Date.now();
        this.startDist = 0;
        this.path = [];
        this.maxSpeed = 0; 
        this.lastSpeedCheck = 0;
        
        // UI RESET (IDs aus HTML)
        if(document.getElementById('hud-time')) document.getElementById('hud-time').innerText = "00:00";
        if(document.getElementById('hud-dist')) document.getElementById('hud-dist').innerText = "0.00";
        if(document.getElementById('hud-speed')) document.getElementById('hud-speed').innerText = "0";
        if(document.getElementById('speed-limit')) document.getElementById('speed-limit').classList.add('hidden');

        // Map Rotation an
        const mapEl = document.getElementById('background-map');
        if(mapEl) mapEl.classList.add('map-smooth-rotate');

        // Button Logik starten (DAS FEHLTE!)
        this.initStopButton();

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

    // --- HIER IST DER FIX FÜR DEN BUTTON ---
    initStopButton: function() {
        const btn = document.getElementById('btn-stop'); // ID aus deiner HTML
        if(!btn) return;

        // Alten Button ersetzen um Events zu resetten
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        const startHold = (e) => {
            e.preventDefault(); 
            // Verhindert Scrollen auf Handy
            if(e.target.setPointerCapture && e.pointerId) e.target.setPointerCapture(e.pointerId);
            
            newBtn.classList.add('holding'); // Startet CSS Animation (falls vorhanden)
            
            // Nach 1.5 Sekunden stoppen
            this.holdTimer = setTimeout(() => {
                newBtn.classList.remove('holding');
                this.stop(); // STOPPT DIE FAHRT
            }, 1500);
        };

        const endHold = (e) => {
            e.preventDefault();
            clearTimeout(this.holdTimer);
            newBtn.classList.remove('holding');
        };

        // Pointer Events decken Touch und Maus ab
        newBtn.onpointerdown = startHold;
        newBtn.onpointerup = endHold;
        newBtn.onpointerleave = endHold;
        newBtn.onpointercancel = endHold;
        
        // Fallback für reine Touch-Geräte ohne Pointer-Support
        newBtn.ontouchstart = startHold;
        newBtn.ontouchend = endHold;
        newBtn.ontouchcancel = endHold;
    },

    update: function(pos) {
        if (!this.startTime) return;
        
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        this.currentSpeed = speed;

        if (speed > this.maxSpeed) this.maxSpeed = speed;

        this.path.push({
            lat: lat,
            lng: lng,
            speed: speed,
            time: Date.now()
        });

        // Distanz & Rotation
        if (this.path.length > 1) {
            const last = this.path[this.path.length - 2];
            const curr = this.path[this.path.length - 1];
            
            const p1 = L.latLng(last.lat, last.lng);
            const p2 = L.latLng(curr.lat, curr.lng);
            this.startDist += p1.distanceTo(p2) / 1000; 

            // Rotation
            const angle = this.getBearing(last.lat, last.lng, curr.lat, curr.lng);
            const mapEl = document.getElementById('background-map');
            if(mapEl && speed > 3) { 
                mapEl.style.transform = `translate(-50%, -50%) rotate(${-angle}deg)`;
            }
        }

        // Map Follow
        if(typeof App !== 'undefined' && App.map) {
            App.map.panTo([lat, lng]);
            if(App.userMarker) App.userMarker.setLatLng([lat, lng]);
        }

        // HUD Update
        if(document.getElementById('hud-speed')) document.getElementById('hud-speed').innerText = this.currentSpeed;
        if(document.getElementById('hud-dist')) document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);
        
        // Speed Limit
        if (Date.now() - this.lastSpeedCheck > 5000) {
            this.lastSpeedCheck = Date.now();
            this.checkSpeedLimit(lat, lng);
        }
    },

    updateTime: function() {
        const diff = Date.now() - this.startTime;
        const totalSec = Math.floor(diff / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const el = document.getElementById('hud-time');
        if(el) el.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    getBearing: function(startLat, startLng, destLat, destLng) {
        startLat = startLat * (Math.PI/180); startLng = startLng * (Math.PI/180);
        destLat = destLat * (Math.PI/180); destLng = destLng * (Math.PI/180);
        const y = Math.sin(destLng - startLng) * Math.cos(destLat);
        const x = Math.cos(startLat) * Math.sin(destLat) - Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
        let brng = Math.atan2(y, x);
        return ((brng * (180/Math.PI)) + 360) % 360;
    },

    checkSpeedLimit: function(lat, lng) {
        const query = `[out:json][timeout:5];way["maxspeed"](around:25,${lat},${lng});out tags;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        
        fetch(url).then(r => r.json()).then(data => {
            const el = document.getElementById('speed-limit');
            if(data.elements && data.elements.length > 0) {
                let max = data.elements[0].tags.maxspeed;
                if(max && !isNaN(parseInt(max))) {
                    const span = el.querySelector('span');
                    if(span) span.innerText = max;
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
        clearInterval(this.interval);
        if(this.watchId) navigator.geolocation.clearWatch(this.watchId);
        if(navigator.vibrate) navigator.vibrate([100, 50, 100]);

        // Snapshot
        const durationMs = Date.now() - this.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        const finalTimeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        
        const finalDist = parseFloat(this.startDist.toFixed(2));
        const finalMax = this.maxSpeed;
        const finalPath = [...this.path];
        const avgSpeed = (durationMs > 0 && finalDist > 0) ? Math.round(finalDist / (durationMs/3600000)) : 0;

        // Reset Map Rotation
        const mapEl = document.getElementById('background-map');
        if(mapEl) {
            mapEl.classList.remove('map-smooth-rotate');
            mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
        }

        // Summary Screen IDs (aus HTML)
        if(document.getElementById('sum-avg')) document.getElementById('sum-avg').innerText = avgSpeed;
        if(document.getElementById('sum-dist')) document.getElementById('sum-dist').innerText = finalDist.toFixed(2);
        if(document.getElementById('sum-time')) document.getElementById('sum-time').innerText = finalTimeStr;

        // Mini Map
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if(mapContainer) {
                if (window.summaryMapInstance) { window.summaryMapInstance.remove(); window.summaryMapInstance = null; }
                mapContainer.innerHTML = "";
                window.summaryMapInstance = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.summaryMapInstance);
                if (finalPath.length > 1) {
                    const latLngs = finalPath.map(p => [p.lat, p.lng]);
                    const line = L.polyline(latLngs, {color: '#bf5af2', weight: 4}).addTo(window.summaryMapInstance);
                    window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[40,40]});
                } else if(finalPath.length > 0) {
                    window.summaryMapInstance.setView([finalPath[0].lat, finalPath[0].lng], 15);
                }
            }
        }, 300);

        if(typeof App !== 'undefined') App.switchScreen('summary-screen');

        // SAVE BUTTON (ID aus HTML: btn-save)
        const saveBtn = document.getElementById('btn-save');
        if(saveBtn) {
            saveBtn.onclick = () => {
                const rideData = { 
                    date: Date.now(), 
                    dist: finalDist, 
                    time: finalTimeStr, 
                    avg: avgSpeed, 
                    max: finalMax, 
                    path: finalPath 
                };
                
                let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
                rides.unshift(rideData);
                localStorage.setItem('driverhub_rides', JSON.stringify(rides));
                
                if(typeof GarageLogic !== 'undefined') GarageLogic.renderList();
                if(typeof App !== 'undefined') App.switchScreen('home-screen'); 
            };
        }
        
        // DISCARD BUTTON (ID aus HTML: btn-discard)
        const discardBtn = document.getElementById('btn-discard');
        if(discardBtn && typeof App !== 'undefined') discardBtn.onclick = () => App.switchScreen('home-screen'); 
    }
};
