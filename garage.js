/* ========================================== */
/* === GARAGE.JS - FINAL V26 (THE VAULT) === */
/* ========================================== */

window.GarageLogic = {
    // === 1. DATA & VARIABLES ===
    drives: [],
    cars: [],
    activeDriveIndex: -1,
    editingCarIndex: -1,
    
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // === 2. INIT (DER SAFE START) ===
    init: function() {
        console.log("Garage V26 Init - Safety Mode Active");
        
        // --- A. DRIVES LADEN ---
        try {
            const rawDrives = localStorage.getItem('driverhub_drives');
            this.drives = rawDrives ? JSON.parse(rawDrives) : [];
        } catch (e) {
            console.error("Drives Load Error:", e);
            this.drives = [];
        }

        // --- B. CARS LADEN (MIT RETTUNGS-LOGIK) ---
        try {
            const rawCars = localStorage.getItem('driverhub_cars');
            let loadedCars = rawCars ? JSON.parse(rawCars) : [];

            // SAFETY FILTER: Entfernt "null" oder kaputte Objekte, behält aber echte Autos
            this.cars = loadedCars.filter(c => c && typeof c === 'object' && c.name);
            
            console.log(`Garage loaded: ${this.cars.length} cars found.`);

            // Wenn wir Müll gefiltert haben, speichern wir die saubere Liste sofort zurück
            if(loadedCars.length !== this.cars.length) {
                console.warn("Garage cleanup performed. Saving clean list.");
                this.saveCarsToStorage();
            }
            
        } catch (e) {
            console.error("CRITICAL: Garage Data Corrupt. Safety fallback.", e);
            // Im Fehlerfall NICHTS überschreiben, damit Daten bei Reload evtl. gerettet werden können
            this.cars = []; 
        }

        // --- C. UI STARTEN ---
        this.renderCars();
        // Falls wir auf der History Page sind:
        if(document.getElementById('drive-history-list')) this.renderHistoryList();

        // Button Bindings (Verzögert, damit DOM sicher da ist)
        setTimeout(() => {
            const carBtn = document.querySelector('#card-car-profile .card-header-btn');
            if(carBtn) {
                carBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.openDetailScreen(); };
                carBtn.style.cursor = "pointer";
            }
            const driveBtn = document.querySelector('#card-drive-history .card-header-btn');
            if(driveBtn) {
                driveBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.openHistoryScreen(); };
                driveBtn.style.cursor = "pointer";
            }
        }, 500);
    },

    // Zentraler Speicher-Helfer (Verhindert Schreibfehler)
    saveCarsToStorage: function() {
        if(!this.cars) return; 
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
    },

    // Alias Bridge
    showHistory: function() { this.openHistoryScreen(); },
    showCarDetails: function() { this.openDetailScreen(); },

    // Core Save Drive
    save: function(driveData) {
        if(!driveData) return;
        this.drives.unshift(driveData);
        localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
        if(document.getElementById('drive-card-content')) this.renderDriveCard();
    },

    // ==========================================
    // === SECTION 3: CAR DETAILS SCREEN ===
    // ==========================================

    openDetailScreen: function() {
        const screen = document.getElementById('car-details-screen');
        if(screen) {
            screen.classList.remove('hidden');
            this.renderDetailList();
        }
    },

    closeDetailScreen: function() {
        document.getElementById('car-details-screen').classList.add('hidden');
        this.renderCars();
    },

    renderDetailList: function() {
        const container = document.getElementById('car-details-list');
        if(!container) return;
        container.innerHTML = '';

        this.cars.forEach((car, index) => {
            const name = car.name || "Unknown Car";
            const isActive = (index === 0);
            const col = car.color || '#bf5af2';
            const acc = car.acceleration || '---';
            const hp = car.hp || '-';
            const weight = car.weight || '-';
            const engine = car.engine || '-';
            
            const html = `
            <div class="detail-card">
                <div class="detail-model-box">
                    <model-viewer src="${car.model}" auto-rotate camera-controls disable-zoom interaction-prompt="none" style="width:100%; height:100%;" shadow-intensity="1"></model-viewer>
                </div>
                <div class="detail-name">${name}</div>
                <div class="detail-stats-grid">
                    <div class="detail-stat"><label>ENGINE</label><span>${engine}</span></div>
                    <div class="detail-stat"><label>POWER</label><span style="color:${col}">${hp}<small>PS</small></span></div>
                    <div class="detail-stat"><label>WEIGHT</label><span>${weight}<small>KG</small></span></div>
                    <div class="detail-stat"><label>0-100</label><span>${acc}<small>S</small></span></div>
                </div>
                <div class="detail-extra-box">
                    <span class="detail-label">RECORDS</span>
                    <span style="font-size:0.8rem; color:#555;">NO RECORDS YET</span>
                </div>
                <div class="detail-actions">
                    <button class="action-btn ${isActive ? 'is-active' : ''}" onclick="GarageLogic.setActiveCar(${index})">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="action-btn" onclick="GarageLogic.openEditor(${index})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
            </div>`;
            
            const div = document.createElement('div');
            div.innerHTML = html;
            container.appendChild(div);
        });

        const addBtn = document.createElement('div');
        addBtn.className = 'detail-add-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> ADD ANOTHER CAR';
        addBtn.onclick = () => { this.openEditor(-1); };
        container.appendChild(addBtn);
    },

    setActiveCar: function(index) {
        if(!this.cars[index]) return;
        if(index === 0) return; // Ist schon aktiv

        const selectedCar = this.cars[index];
        this.cars.splice(index, 1); // Rausnehmen
        this.cars.unshift(selectedCar); // Vorne einfügen
        
        this.saveCarsToStorage();
        this.renderDetailList();
    },

    // ==========================================
    // === SECTION 4: CAR EDITOR ===
    // ==========================================

    openEditor: function(index) {
        const overlay = document.getElementById('final-overlay');
        if(!overlay) return;
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';

        this.renderModelList();
        this.renderColorList();
        
        let carToEdit = null;
        if(index > -1 && this.cars[index]) {
            carToEdit = this.cars[index];
            this.editingCarIndex = index;
        } else {
            this.editingCarIndex = -1;
        }

        if(carToEdit) {
            document.getElementById('final-name').value = carToEdit.name || "";
            document.getElementById('final-hp').value = carToEdit.hp || "";
            document.getElementById('final-weight').value = carToEdit.weight || "";
            document.getElementById('final-engine').value = carToEdit.engine || "";
            document.getElementById('final-color-input').value = carToEdit.color || "#bf5af2";
            if(document.getElementById('final-preview')) document.getElementById('final-preview').src = carToEdit.model;
            
            this.highlightColor(carToEdit.color || "#bf5af2");
            
            // Model Highlight
            const list = document.getElementById('final-model-list');
            if(list) Array.from(list.children).forEach(btn => {
                if(btn.getAttribute('data-file') === carToEdit.model) {
                    btn.classList.add('selected-model');
                    btn.style.borderColor='#007aff'; 
                    btn.style.color='white';
                }
            });
        } else {
            // Reset Fields
            document.getElementById('final-name').value = '';
            document.getElementById('final-hp').value = '';
            document.getElementById('final-weight').value = '';
            document.getElementById('final-engine').value = '';
            document.getElementById('final-color-input').value = '#bf5af2';
            if(document.getElementById('final-preview')) document.getElementById('final-preview').src = this.availableModels[0].file;
            this.highlightColor('#bf5af2');
        }
    },

    saveCarEdit: function() {
        const nameVal = document.getElementById('final-name').value;
        if(!nameVal || nameVal.trim() === "") { 
            alert("Please enter a name!"); 
            return; 
        }

        let modelFile = "car.glb";
        const selected = document.querySelector('.selected-model');
        if(selected) modelFile = selected.getAttribute('data-file');
        else if(this.editingCarIndex > -1 && this.cars[this.editingCarIndex]) modelFile = this.cars[this.editingCarIndex].model;
        else if(this.availableModels.length > 0) modelFile = this.availableModels[0].file;

        let currentAcc = '-';
        if(this.editingCarIndex > -1 && this.cars[this.editingCarIndex]) {
            currentAcc = this.cars[this.editingCarIndex].acceleration || '-';
        }

        const newCar = {
            name: nameVal,
            model: modelFile,
            hp: document.getElementById('final-hp').value || '-',
            weight: document.getElementById('final-weight').value || '-',
            engine: document.getElementById('final-engine').value || '-',
            acceleration: currentAcc,
            color: document.getElementById('final-color-input').value || '#bf5af2'
        };
        
        if(this.editingCarIndex > -1) {
            this.cars[this.editingCarIndex] = newCar;
        } else {
            this.cars.push(newCar);
        }

        this.saveCarsToStorage();
        
        document.getElementById('final-overlay').style.display = 'none';
        this.renderCars();
        if(!document.getElementById('car-details-screen').classList.contains('hidden')) {
            this.renderDetailList();
        }
    },

    deleteCurrentCar: function() {
        if(confirm("Delete?")) {
            if(this.editingCarIndex > -1) {
                this.cars.splice(this.editingCarIndex, 1);
            } else {
                this.cars = []; // Fallback bei Neuerstellung abbrechen
            }
            
            this.saveCarsToStorage();
            document.getElementById('final-overlay').style.display = 'none';
            this.renderCars();
            if(!document.getElementById('car-details-screen').classList.contains('hidden')) {
                this.renderDetailList();
            }
        }
    },

    renderModelList: function() {
        const list = document.getElementById('final-model-list');
        const viewer = document.getElementById('final-preview');
        if(!list) return;
        list.innerHTML = ''; 
        
        this.availableModels.forEach(model => {
            const btn = document.createElement('div');
            btn.style.cssText = "padding:12px; background:#222; border:1px solid #444; color:#888; border-radius:8px; text-align:center; cursor:pointer; font-size:0.8rem; font-family:sans-serif; transition:all 0.2s;";
            btn.innerText = model.name;
            btn.setAttribute('data-file', model.file);
            
            btn.onclick = () => {
                Array.from(list.children).forEach(c => {
                    c.style.borderColor = '#444'; c.style.color = '#888'; c.style.background = '#222'; c.classList.remove('selected-model');
                });
                btn.style.borderColor = '#007aff'; btn.style.color = 'white'; btn.style.background = 'rgba(0,122,255,0.2)';
                btn.classList.add('selected-model');
                if(viewer) viewer.src = model.file;
            };
            list.appendChild(btn);
        });
    },

    renderColorList: function() {
        const list = document.getElementById('final-color-list');
        if(!list) return;
        list.innerHTML = '';
        ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ff9f0a', '#ffffff'].forEach(c => {
            const div = document.createElement('div');
            div.style.cssText = `width:35px; height:35px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid transparent; flex-shrink:0; transition:transform 0.2s;`;
            div.setAttribute('data-color', c);
            div.onclick = () => {
                document.getElementById('final-color-input').value = c;
                this.highlightColor(c);
            };
            list.appendChild(div);
        });
    },

    highlightColor: function(color) {
        const list = document.getElementById('final-color-list');
        if(!list) return;
        Array.from(list.children).forEach(c => {
            c.style.borderColor = 'transparent'; c.style.transform = 'scale(1)';
            if(c.getAttribute('data-color') === color) {
                c.style.borderColor = 'white'; c.style.transform = 'scale(1.2)';
            }
        });
    },

    // ==========================================
    // === SECTION 5: HISTORY ===
    // ==========================================

    openHistoryScreen: function() {
        const screen = document.getElementById('drive-history-screen');
        if(screen) {
            screen.classList.remove('hidden');
            this.renderHistoryList();
        }
    },

    closeHistoryScreen: function() {
        document.getElementById('drive-history-screen').classList.add('hidden');
    },

    renderHistoryList: function() {
        const list = document.getElementById('drive-history-list');
        if(!list) return;
        list.innerHTML = '';

        // 1. Global Stats
        let totalKm = 0; let globalMax = 0; let avgSum = 0; let avgCount = 0;
        this.drives.forEach(d => {
            if(d.dist) totalKm += parseFloat(d.dist);
            let m = d.max !== undefined ? d.max : (d.maxSpeed || 0); if(m > globalMax) globalMax = m;
            let a = d.avg !== undefined ? d.avg : (d.avgSpeed || 0); if(a > 0) { avgSum += parseFloat(a); avgCount++; }
        });
        let globalAvg = avgCount > 0 ? Math.round(avgSum / avgCount) : 0;

        // Global Card
        const globalCard = document.createElement('div');
        globalCard.className = 'global-stats-card';
        globalCard.innerHTML = `
            <div class="global-header">LIFETIME STATISTICS</div>
            <div class="global-grid">
                <div class="global-item"><label>TOTAL DIST</label><span>${totalKm.toFixed(1)}<small style="font-size:0.8rem; color:#888;"> km</small></span></div>
                <div class="global-item"><label>MAX SPEED</label><span style="color:#30d158;">${Math.round(globalMax)}<small style="font-size:0.8rem; color:#888;"> km/h</small></span></div>
                <div class="global-item"><label>AVG SPEED</label><span>${globalAvg}<small style="font-size:0.8rem; color:#888;"> km/h</small></span></div>
            </div>`;
        list.appendChild(globalCard);

        if(this.drives.length === 0) {
            list.innerHTML += `<div style="text-align:center; color:#666; margin-top:20px;">NO RECORDED DRIVES</div>`;
            return;
        }

        this.drives.forEach((d, index) => {
            const dist = d.dist ? d.dist.toFixed(1) : "0.0";
            let mv = Math.round(d.max !== undefined ? d.max : (d.maxSpeed || 0));
            let av = Math.round(d.avg !== undefined ? d.avg : (d.avgSpeed || 0));
            let ts = d.time || "---";
            if(!d.time && d.duration) { const sec = Math.round(d.duration/1000); const m = Math.floor(sec/60); const s = sec%60; ts = `${m}m ${s}s`; }
            
            const div = document.createElement('div');
            div.className = 'history-card-wrapper';
            div.innerHTML = `
                <div class="history-header"><span>${new Date(d.date).toLocaleDateString()}</span><span>VIEW DETAILS <i class="fa-solid fa-chevron-right"></i></span></div>
                <div class="h-split">
                    <div class="h-left"><div id="hist-map-${index}" class="h-map-mini"></div></div>
                    <div class="h-right">
                        <div class="h-stat"><label>TIME</label><span>${ts}</span></div>
                        <div class="h-stat"><label>DIST</label><span>${dist}<small>km</small></span></div>
                        <div class="h-stat"><label>AVG</label><span>${av}<small>km/h</small></span></div>
                        <div class="h-stat"><label>MAX</label><span style="color:#30d158;">${mv}<small>km/h</small></span></div>
                    </div>
                </div>`;
            div.onclick = () => { this.openDriveDetail(index); };
            list.appendChild(div);

            setTimeout(() => {
                if(d.path && d.path.length > 0) {
                    const mid = `hist-map-${index}`;
                    if(document.getElementById(mid)) {
                        const m = L.map(mid, { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false });
                        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(m);
                        const ln = L.polyline(d.path.map(p => [p.lat, p.lng]), {color:'#bf5af2', weight:3}).addTo(m);
                        m.fitBounds(ln.getBounds(), {padding:[5,5]});
                    }
                }
            }, 100 + (index * 50));
        });
    },

    openDriveDetail: function(index) {
        this.activeDriveIndex = index;
        const d = this.drives[index];
        const screen = document.getElementById('drive-detail-view');
        if(!screen) return;
        screen.classList.remove('hidden');

        const dist = d.dist ? d.dist.toFixed(2) : "0.00";
        let mv = Math.round(d.max !== undefined ? d.max : (d.maxSpeed || 0));
        let av = Math.round(d.avg !== undefined ? d.avg : (d.avgSpeed || 0));
        let ts = d.time || "---";
        if(!d.time && d.duration) { const sec = Math.round(d.duration/1000); const m = Math.floor(sec/60); const s = sec%60; ts = `${m}m ${s}s`; }

        document.getElementById('dd-time').innerText = ts;
        document.getElementById('dd-dist').innerText = dist + " km";
        document.getElementById('dd-avg').innerText = av + " km/h";
        document.getElementById('dd-max').innerText = mv + " km/h";
        document.getElementById('dd-date').innerText = new Date(d.date).toLocaleString();

        setTimeout(() => {
            if(this.detailMap) { this.detailMap.remove(); this.detailMap = null; }
            if(d.path && d.path.length > 0) {
                 this.detailMap = L.map('detail-map-canvas', { zoomControl:false, attributionControl:false });
                 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.detailMap);
                 const line = L.polyline(d.path.map(p => [p.lat, p.lng]), {color:'#bf5af2', weight:4}).addTo(this.detailMap);
                 this.detailMap.invalidateSize(); 
                 this.detailMap.fitBounds(line.getBounds(), {padding:[20,20]});
            }
        }, 300);
        this.drawSpeedGraph(d.path);
    },

    closeDriveDetail: function() {
        document.getElementById('drive-detail-view').classList.add('hidden');
    },

    deleteDrive: function() {
        if(confirm("Delete this drive?")) {
            this.drives.splice(this.activeDriveIndex, 1);
            localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
            this.closeDriveDetail();
            this.renderHistoryList();
            this.renderDriveCard();
        }
    },

    drawSpeedGraph: function(pathData) {
        const cvs = document.getElementById('speed-graph-canvas');
        if(!cvs || !pathData || pathData.length < 2) return;
        const r = cvs.parentElement.getBoundingClientRect();
        cvs.width = r.width * 2; cvs.height = r.height * 2;
        const ctx = cvs.getContext('2d'); ctx.scale(2, 2);
        const pts = pathData.map(p => p.speed || 0);
        const max = Math.max(...pts, 10);
        const w = r.width; const h = r.height; const sx = w / (pts.length - 1);
        ctx.clearRect(0, 0, w, h); ctx.lineWidth = 2; ctx.lineJoin = 'round';
        const g = ctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, '#30d158'); g.addColorStop(0.5, '#ffd60a'); g.addColorStop(1, '#ff3b30');
        ctx.strokeStyle = g; ctx.beginPath();
        pts.forEach((v, i) => {
            const x = i * sx;
            const y = h - ((v / max) * (h * 0.8));
            if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fillStyle = "rgba(255, 255, 255, 0.05)"; ctx.fill();
    },

    // ==========================================
    // === SECTION 6: DASHBOARD ===
    // ==========================================

    renderCars: function() {
        const carCont = document.getElementById('car-card-content');
        if(carCont) {
            const headerBtn = document.querySelector('#card-car-profile .card-header-btn');
            
            // CHECK: Haben wir überhaupt ein Auto?
            if(!this.cars || this.cars.length === 0) {
                if(headerBtn) headerBtn.style.display='none';
                carCont.innerHTML = `<div onclick="GarageLogic.openEditor(-1)" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;"><div style="font-size:2rem; color:#555; border:2px dashed #444; border-radius:50%; width:60px; height:60px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;"><i class="fa-solid fa-plus"></i></div><span style="color:#888; font-weight:800; font-size:0.8rem; letter-spacing:1px;">ADD YOUR CAR</span></div>`;
            } else {
                if(headerBtn) headerBtn.style.display='flex';
                // Safety Fallback für UI
                const c = this.cars[0] || {name: 'Error', model:'car.glb', color:'#bf5af2'};
                const col = c.color || '#bf5af2';
                const acc = c.acceleration || '---';
                
                carCont.innerHTML = `
                <div class="card-split-left" style="border-right-color:${col}30;">
                    <div style="width:100%; height:80%;"><model-viewer src="${c.model}" auto-rotate camera-controls disable-zoom style="width:100%; height:100%;" shadow-intensity="1" interaction-prompt="none"></model-viewer></div>
                    <div class="mini-car-name">${c.name}</div>
                </div>
                <div class="card-split-right" style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; align-content:center;">
                    <div class="d-stat"><label>ENGINE</label><span>${c.engine||'-'}</span></div>
                    <div class="d-stat"><label>POWER</label><span style="color:${col};">${c.hp||'-'}<small>PS</small></span></div>
                    <div class="d-stat"><label>WEIGHT</label><span>${c.weight||'-'}<small>KG</small></span></div>
                    <div class="d-stat"><label>0-100</label><span>${acc}<small>S</small></span></div>
                </div>`;
            }
        }
        this.renderDriveCard();
    },

    renderDriveCard: function() {
        const driveCont = document.getElementById('drive-card-content');
        if(!driveCont) return;
        if(this.drives.length === 0) {
            driveCont.innerHTML = `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#666;"><i class="fa-solid fa-road" style="font-size:1.5rem; margin-bottom:10px; opacity:0.5;"></i><span style="font-size:0.7rem; font-weight:800; letter-spacing:1px; opacity:0.7;">NO RECENT DRIVES</span></div>`;
        } else {
            const d = this.drives[0];
            const dist = d.dist ? d.dist.toFixed(1) : "0.0";
            let mv = Math.round(d.max !== undefined ? d.max : (d.maxSpeed || 0));
            let av = Math.round(d.avg !== undefined ? d.avg : (d.avgSpeed || 0));
            let ts = d.time || "---";
            if(!d.time && d.duration) { const sec = Math.round(d.duration/1000); const m = Math.floor(sec/60); const s = sec%60; ts = `${m}m ${s}s`; }

            driveCont.innerHTML = `
            <div class="card-split-left" style="padding:0; border:none;"><div id="mini-map-canvas" class="mini-map-box"></div></div>
            <div class="card-split-right" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; align-content:center; padding-top:10px;">
                <div class="d-stat"><label>TIME</label><span>${ts}</span></div>
                <div class="d-stat"><label>DIST</label><span>${dist}<small>km</small></span></div>
                <div class="d-stat"><label>AVG SPEED</label><span>${av}<small>km/h</small></span></div>
                <div class="d-stat"><label>MAX SPEED</label><span style="color:#30d158;">${mv}<small>km/h</small></span></div>
                <div style="grid-column: span 2; font-size:0.6rem; color:#555; text-align:right; margin-top:5px;">${new Date(d.date).toLocaleDateString()}</div>
            </div>`;
            setTimeout(() => {
                if(document.getElementById('mini-map-canvas') && d.path) {
                    if(this.miniMap) this.miniMap.remove();
                    this.miniMap = L.map('mini-map-canvas', { zoomControl:false, attributionControl:false });
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.miniMap);
                    const p = L.polyline(d.path.map(x=>[x.lat,x.lng]), {color:'#bf5af2', weight:3}).addTo(this.miniMap);
                    this.miniMap.fitBounds(p.getBounds(), {padding:[10,10]});
                }
            }, 300);
        }
    }
};

// === WICHTIG: STARTEN AM ENDE ===
// Hier wird die Logik erst ausgeführt, wenn alles geladen ist.
window.GarageLogic.init();
