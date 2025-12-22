/* =========================================
   DRIVE LOGIC (VERSION 11 - FORCE SWITCH)
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
    holdTimer: null,

    start: function() {
        console.log("Drive Started");
        this.startTime = Date.now();
        this.startDist = 0;
        this.path = [];
        this.maxSpeed = 0; 
        
        // UI Reset
        if(document.getElementById('hud-time')) document.getElementById('hud-time').innerText = "00:00";
        if(document.getElementById('hud-dist')) document.getElementById('hud-dist').innerText = "0.00";
        if(document.getElementById('hud-speed')) document.getElementById('hud-speed').innerText = "0";
        if(document.getElementById('speed-limit')) document.getElementById('speed-limit').classList.add('hidden');

        // Map Rotation an
        const mapEl = document.getElementById('background-map');
        if(mapEl) mapEl.classList.add('map-smooth-rotate');

        this.activateStopButton();

        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.updateTime(), 1000);

        if (navigator.geolocation) {
            if(this.watchId) navigator.geolocation.clearWatch(this.watchId);
            this.watchId = navigator.geolocation.watchPosition(
                pos => this.update(pos),
                err => console.warn("GPS Error", err),
                { enableHighAccuracy: true, maximumAge: 0 }
            );
        }
    },

    activateStopButton: function() {
        const btn = document.getElementById('btn-stop');
        if(!btn) return;

        // Reset Events
        btn.onpointerdown = null; btn.onpointerup = null; btn.onpointercancel = null; btn.onpointerleave = null;
        btn.ontouchstart = null; btn.ontouchend = null;

        const startHold = (e) => {
            if(e.cancelable) e.preventDefault();
            if(e.target.setPointerCapture && e.pointerId) e.target.setPointerCapture(e.pointerId);
            btn.classList.add('holding');
            
            this.holdTimer = setTimeout(() => {
                btn.classList.remove('holding');
                this.stop(); 
            }, 1500);
        };

        const endHold = (e) => {
            if(e.cancelable) e.preventDefault();
            clearTimeout(this.holdTimer);
            btn.classList.remove('holding');
        };

        btn.onpointerdown = startHold;
        btn.onpointerup = endHold;
        btn.onpointercancel = endHold;
        btn.onpointerleave = endHold;
        btn.ontouchstart = startHold;
        btn.ontouchend = endHold;
        btn.ontouchcancel = endHold;
    },

    update: function(pos) {
        if (!this.startTime) return;
        
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        this.currentSpeed = speed;

        if (speed > this.maxSpeed) this.maxSpeed = speed;

        this.path.push({lat, lng, speed, time: Date.now()});

        if (this.path.length > 1) {
            const last = this.path[this.path.length - 2];
            const curr = this.path[this.path.length - 1];
            
            const p1 = L.latLng(last.lat, last.lng);
            const p2 = L.latLng(curr.lat, curr.lng);
            this.startDist += p1.distanceTo(p2) / 1000; 

            const angle = this.getBearing(last.lat, last.lng, curr.lat, curr.lng);
            const mapEl = document.getElementById('background-map');
            if(mapEl && speed > 3) { 
                mapEl.style.transform = `translate(-50%, -50%) rotate(${-angle}deg)`;
            }
        }

        if(typeof App !== 'undefined' && App.map) {
            App.map.panTo([lat, lng]);
            if(App.userMarker) App.userMarker.setLatLng([lat, lng]);
        }

        if(document.getElementById('hud-speed')) document.getElementById('hud-speed').innerText = this.currentSpeed;
        if(document.getElementById('hud-dist')) document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);
        
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
                } else { el.classList.add('hidden'); }
            } else { el.classList.add('hidden'); }
        }).catch(() => {});
    },

    // --- STOP & FORCE SWITCH ---
    stop: function() {
        console.log("STOPPING DRIVE NOW");
        
        clearInterval(this.interval);
        if(this.watchId) navigator.geolocation.clearWatch(this.watchId);
        if(navigator.vibrate) navigator.vibrate([100, 50, 100]);

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

        // Fülle Summary (Sicherheits-Check: existiert Element?)
        if(document.getElementById('sum-avg')) document.getElementById('sum-avg').innerText = avgSpeed;
        if(document.getElementById('sum-dist')) document.getElementById('sum-dist').innerText = finalDist.toFixed(2);
        if(document.getElementById('sum-time')) document.getElementById('sum-time').innerText = finalTimeStr;
        
        // Hide Comparison Row
        const compRow = document.getElementById('sum-comparison-row');
        if(compRow) compRow.classList.add('hidden');

        // Mini Map
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if(mapContainer) {
                mapContainer.innerHTML = "<div id='mini-map' style='width:100%;height:100%;'></div>";
                window.summaryMapInstance = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
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

        // --- DER FIX: SCREEN WECHSEL ERZWINGEN ---
        // Wir verlassen uns NICHT auf App.switchScreen, falls das kaputt ist.
        // Wir machen es manuell über die Klassen.
        
        // 1. Alle Screens verstecken
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        
        // 2. Summary Screen anzeigen
        const summaryScreen = document.getElementById('summary-screen');
        if(summaryScreen) {
            summaryScreen.classList.remove('hidden');
            summaryScreen.classList.add('active');
            console.log("Forced switch to Summary Screen");
        } else {
            alert("Fehler: Summary Screen nicht gefunden!");
        }

        // SAVE BUTTON
        const saveBtn = document.getElementById('btn-save');
        if(saveBtn) {
            saveBtn.onclick = () => {
                const rideData = { date: Date.now(), dist: finalDist, time: finalTimeStr, avg: avgSpeed, max: finalMax, path: finalPath };
                
                let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
                rides.unshift(rideData);
                localStorage.setItem('driverhub_rides', JSON.stringify(rides));
                
                if(typeof GarageLogic !== 'undefined') GarageLogic.renderList();
                
                // Manuell nach Hause
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('home-screen').classList.remove('hidden');
                document.getElementById('home-screen').classList.add('active');
            };
        }
        
        // DISCARD BUTTON
        const discardBtn = document.getElementById('btn-discard');
        if(discardBtn) {
            discardBtn.onclick = () => {
                // Manuell nach Hause
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('home-screen').classList.remove('hidden');
                document.getElementById('home-screen').classList.add('active');
            };
        }
    }
};
