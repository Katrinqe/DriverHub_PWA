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
        this.startTime = Date.now();
        this.startDist = 0;
        this.path = [];
        this.maxSpeed = 0; 
        this.lastSpeedCheck = 0;
        this.lastRecordedPoint = null;
        
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";
        document.getElementById('speed-limit').classList.add('hidden'); 

        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.updateTime();
        }, 1000);

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

        if (speed > this.maxSpeed) {
            this.maxSpeed = speed;
        }

        // SMART RECORDING (15m Threshold)
        let shouldRecord = false;
        const newLatLng = L.latLng(lat, lng);

        if (!this.lastRecordedPoint) {
            shouldRecord = true;
        } else {
            const dist = this.lastRecordedPoint.distanceTo(newLatLng); 
            if (dist > 15) { 
                shouldRecord = true;
            }
        }

        if (shouldRecord) {
            this.path.push({
                lat: lat,
                lng: lng,
                speed: speed,
                time: Date.now()
            });
            
            if (this.lastRecordedPoint) {
                const distKm = this.lastRecordedPoint.distanceTo(newLatLng) / 1000;
                this.startDist += distKm;
            }
            
            this.lastRecordedPoint = newLatLng;
        }

        document.getElementById('hud-speed').innerText = this.currentSpeed;
        document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);
        
        if (Date.now() - this.lastSpeedCheck > 5000) {
            this.lastSpeedCheck = Date.now();
            this.checkSpeedLimit(lat, lng);
        }
    },

    saveCrashData: function() {
        const data = {
            active: true,
            startTime: this.startTime,
            startDist: this.startDist,
            maxSpeed: this.maxSpeed,
            path: this.path
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
        }).catch(e => { });
    },

    stop: function() {
        clearInterval(this.interval);
        clearInterval(this.saveInterval);
        this.clearCrashData(); 

        // Berechnung
        const durationMs = Date.now() - this.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        const timeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        const avgSpeed = (durationMs > 0 && this.startDist > 0) ? Math.round(this.startDist / (durationMs/3600000)) : 0;

        if (window.NaviLogic) {
            window.NaviLogic.recordStats = {
                dist: this.startDist,
                startTime: this.startTime,
                path: this.path,
                maxSpeed: this.maxSpeed 
            };
        }
        
        // UI Update
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.startDist.toFixed(2);
        document.getElementById('sum-time').innerText = timeStr;
        document.getElementById('sum-max').innerText = this.maxSpeed; // Zeigt Top Speed im Summary an
        
        // Falls das Vergleichs-Element existiert, verstecken
        const compRow = document.getElementById('sum-comparison-row');
        if(compRow) compRow.classList.add('hidden'); 

        // Screen Switch (Sicherheitscheck)
        if(typeof switchScreen === 'function') {
            switchScreen('summary-screen');
        } else if(window.App && window.App.switchScreen) {
            window.App.switchScreen('summary-screen');
        }

        const globalNav = document.getElementById('global-nav');
        if(globalNav) globalNav.classList.add('hidden'); 
        
        // Karte sperren
        const mapEl = document.getElementById('background-map');
        if(mapEl) {
            mapEl.classList.remove('map-smooth-rotate');
            mapEl.classList.add('map-locked'); 
            mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
        }

        // Summary Mini-Map
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if(mapContainer) {
                if (window.summaryMapInstance) { window.summaryMapInstance.remove(); window.summaryMapInstance = null; }
                mapContainer.innerHTML = "";
                window.summaryMapInstance = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
                // Dark Mode Tiles fix
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    subdomains: 'abcd', maxZoom: 19
                }).addTo(window.summaryMapInstance);
                
                if (this.path.length > 1) {
                    const latLngs = this.path.map(p => [p.lat, p.lng]);
                    const line = L.polyline(latLngs, {color: '#bf5af2', weight: 4}).addTo(window.summaryMapInstance);
                    window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[40,40]});
                }
            }
        }, 300);

        // --- DER FIX FÜR DEN SAVE BUTTON ---
        document.getElementById('btn-save').onclick = () => {
            // 1. Daten direkt erstellen
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

            // 2. Direkt in LocalStorage speichern (keine Abhängigkeit von GarageLogic)
            let history = [];
            try {
                history = JSON.parse(localStorage.getItem('driverhub_drives') || "[]");
            } catch(e) {}
            history.unshift(driveData);
            localStorage.setItem('driverhub_drives', JSON.stringify(history));

            console.log("Drive saved manually:", driveData);

            // 3. Garage Liste aktualisieren (falls GarageLogic da ist)
            if(window.GarageLogic && typeof window.GarageLogic.loadList === 'function') {
                window.GarageLogic.loadList();
            }

            // 4. Zur Garage wechseln
            if(typeof switchScreen === 'function') {
                switchScreen('garage-screen');
                // Nav Icons updaten
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-home', 'active-map', 'active-garage'));
                const navG = document.getElementById('nav-garage');
                if(navG) navG.classList.add('active-garage');
                // Bottom Nav wieder zeigen
                if(globalNav) globalNav.classList.remove('hidden');
            }
        };

        // Discard Button
        document.getElementById('btn-discard').onclick = () => {
            if(typeof switchScreen === 'function') switchScreen('home-screen');
            if(globalNav) globalNav.classList.remove('hidden');
        }; 
    }
};
