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
        addBtn.onclick = () => { this.openBrandSelector(); };
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
    // === NEW: BRAND SELECTOR FLOW           ===
    // ==========================================
    openBrandSelector: function() {
        const screen = document.getElementById('brand-selector-screen');
        if(screen) screen.classList.remove('hidden');
    },

   closeBrandSelector: function() {
        const screen = document.getElementById('brand-selector-screen');
        if(screen) screen.classList.add('hidden');
    },

    // ==========================================
    // === NEW: MODEL SELECTOR FLOW           ===
    // ==========================================
    
    openModelSelector: function(brandKey) {
        const screen = document.getElementById('model-selector-screen');
        if(!screen) return;
        
        const logoImg = document.getElementById('model-top-logo');
        if(logoImg) logoImg.src = brandKey + '.png'; 

        const grid = document.getElementById('model-grid-container');
        if(!grid) return;
        grid.innerHTML = ''; 
        
        let models = [];
        if(brandKey === 'honda') {
            // Reale Dummy-Daten für den Vibe
            models = [
                { 
                    name: "Civic EJ2", file: "car.glb", logo: "civic.png",
                    year: "1994", weight: 1025, engine: "1.5L D15B7",
                    ps: 101, nm: 133, pw: 10.1
                },
                { 
                    name: "Civic EK", file: "car3.glb", logo: "civic.png",
                    year: "1999", weight: 1040, engine: "1.4L D14A4",
                    ps: 90, nm: 124, pw: 11.5
                }
            ];
        }

        models.forEach((mod, idx) => {
            const delay = (idx * 0.1) + 's';
            const card = document.createElement('div');
            card.className = 'model-card';
            card.style.animationDelay = delay;
            
            // Balken-Mathematik (Max-Werte für visuelle Skala)
            const psPercent = Math.min(100, (mod.ps / 300) * 100); 
            const nmPercent = Math.min(100, (mod.nm / 400) * 100);
            // Power-to-Weight (Weniger ist besser. 15kg/ps = 0%, 3kg/ps = 100%)
            const pwPercent = Math.max(5, 100 - ((mod.pw - 3) / 12) * 100);

            // WICHTIG: camera-controls ist hier EINGESCHALTET! Der Nutzer kann das 3D-Modell in der Card drehen.
            card.innerHTML = `
                <div class="model-logo-stage">
                    <img src="${mod.logo}" alt="${mod.name}">
                </div>
                
                <div class="model-3d-box">
                    <model-viewer src="${mod.file}" auto-rotate camera-controls disable-zoom shadow-intensity="1" interaction-prompt="none" style="width:100%; height:100%;"></model-viewer>
                </div>
                
                <div class="model-specs-row">
                    <div class="model-spec-item"><label>CHASSIS</label><span>${mod.name}</span></div>
                    <div class="model-spec-item"><label>YEAR</label><span>${mod.year}</span></div>
                    <div class="model-spec-item"><label>WEIGHT</label><span>${mod.weight} kg</span></div>
                    <div class="model-spec-item"><label>ENGINE</label><span>${mod.engine}</span></div>
                </div>

                <div class="stat-bar-wrap">
                    <div class="stat-bar-header">POWER <span>${mod.ps} PS</span></div>
                    <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${psPercent}%;"></div></div>
                </div>
                
                <div class="stat-bar-wrap">
                    <div class="stat-bar-header">TORQUE <span>${mod.nm} NM</span></div>
                    <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${nmPercent}%;"></div></div>
                </div>
                
                <div class="stat-bar-wrap">
                    <div class="stat-bar-header">POWER-TO-WEIGHT <span>${mod.pw} kg/PS</span></div>
                    <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${pwPercent}%; background: linear-gradient(90deg, #0a84ff, #30d158);"></div></div>
                </div>
                
               <button class="btn-choose-model" onclick="GarageLogic.openStudio('${brandKey}', '${mod.logo}', '${mod.file}')">
                    CHOOSE MODEL
                </button>
            `;
            grid.appendChild(card);
        });
        
        screen.classList.remove('hidden');
    },

    closeModelSelector: function() {
        const screen = document.getElementById('model-selector-screen');
        if(screen) screen.classList.add('hidden');
        
        // Optional: Die 3D-Modelle entladen, um den RAM zu schonen, wenn der Screen zugeht
        const grid = document.getElementById('model-grid-container');
        if(grid) grid.innerHTML = '';
    },

// ==========================================
    // === NEW: TUNING STUDIO (AAA EDITOR)    ===
    // ==========================================
    
    currentStudioSetup: { h: 275, s: 85, l: 50, finish: 'glossy' },

    openStudio: function(brandKey, modelLogo, glbFile) {
        const screen = document.getElementById('studio-screen');
        if(!screen) return;
        
        document.getElementById('studio-model-logo').src = modelLogo;
        const viewer = document.getElementById('studio-model-viewer');
        viewer.src = glbFile;
        
        // Reset Tabs und UI
        this.switchStudioTab('paint', 0, document.querySelector('.pro-nav-item:first-child'));
       // So muss der Aufruf in openStudio aussehen:
this.setCarFinish('glossy', 0, document.querySelector('.finish-opt'), true);
        
        
        // Farbe init
        setTimeout(() => {
            this.initColorWheel(); // Startet die Mathe für den Kreis
            this.updateProColor();
        }, 300);// Kurz warten bis Modell da ist
        
        screen.classList.remove('hidden');
    },

    closeStudio: function() {
        const screen = document.getElementById('studio-screen');
        if(screen) screen.classList.add('hidden');
        document.getElementById('studio-model-viewer').src = ''; 
    },

    // Der Magische Tab Switcher (Bewegt die Pille)
    switchStudioTab: function(tabId, index, btnElement) {
        // Pille bewegen (Jeder Tab ist 25% breit)
        const pill = document.getElementById('nav-active-pill');
        if(pill) pill.style.transform = `translateX(${index * 100}%)`;

        // Text Farbe
        document.querySelectorAll('.pro-nav-item').forEach(el => el.classList.remove('active'));
        if(btnElement) btnElement.classList.add('active');
        
        // Content
        document.querySelectorAll('.studio-tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-' + tabId).classList.add('active');
    },

   // === DIE NEUE PRO FARB LOGIK (COLOR WHEEL) ===

    // Wird einmal aufgerufen, wenn das Studio öffnet
   // === DIE NEUE PRO FARB LOGIK (COLOR WHEEL) ===
    initColorWheel: function() {
        const wrapper = document.getElementById('color-wheel-wrapper');
        const thumb = document.getElementById('wheel-thumb');
        if(!wrapper || !thumb) return;

        let isDragging = false;
        const ringOffset = 62; 

        // FIX: Den Cursor beim Start sofort sichtbar auf den Kreis legen!
        let initialAngle = (this.currentStudioSetup.h - 90) * (Math.PI / 180);
        let initialTx = ringOffset * Math.cos(initialAngle);
        let initialTy = ringOffset * Math.sin(initialAngle);
        thumb.style.transform = `translate(calc(-50% + ${initialTx}px), calc(-50% + ${initialTy}px))`;

        const updateWheel = (e) => {
            const rect = wrapper.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;

            let dx = clientX - cx;
            let dy = clientY - cy;
            let angle = Math.atan2(dy, dx);
            
            let tx = ringOffset * Math.cos(angle);
            let ty = ringOffset * Math.sin(angle);
            thumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;

            let hue = (angle * 180 / Math.PI) + 90; 
            if (hue < 0) hue += 360;
            
            this.currentStudioSetup.h = hue;
            this.updateProColor();
        };

        wrapper.addEventListener('pointerdown', (e) => { 
            // FIX: Wenn der Klick auf der Mitte landet, ABRECHEN! Rad darf sich nicht bewegen!
            if(e.target.closest('#wheel-center-bg')) return; 
            
            isDragging = true; updateWheel(e); wrapper.setPointerCapture(e.pointerId); 
        });
        wrapper.addEventListener('pointermove', (e) => { if(isDragging) updateWheel(e); });
        wrapper.addEventListener('pointerup', (e) => { isDragging = false; wrapper.releasePointerCapture(e.pointerId); });
    },

    hslToRgb: function(h, s, l) {
        s /= 100; l /= 100;
        let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c/2, r = 0, g = 0, b = 0;
        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
        return [r + m, g + m, b + m];
    },

    rgbToHex: function(r, g, b) {
        const toHex = (x) => { const hex = Math.round(x * 255).toString(16); return hex.length === 1 ? '0' + hex : hex; };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    },

    // Rechnet einen HEX-Code in den Winkel für den Kreis und den Wert für den Slider um
    hexToHsl: function(hex) {
        let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) { return r + r + g + g + b + b; });
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return null; // Abbrechen, wenn es kein echtes Hex ist
        
        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;

        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) { h = s = 0; } 
        else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s * 100, l * 100];
    },

    // Wird aufgerufen, wenn du "Enter/Fertig" auf der Tastatur drückst
    applyManualHex: function(hexValue) {
        let hex = hexValue.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        
        const hsl = this.hexToHsl(hex);
        if (!hsl) {
            // Falls der Nutzer Quatsch eingetippt hat, setze es auf die aktuelle Farbe zurück
            this.updateProColor(); 
            return;
        }

        let h = hsl[0];
        let l = hsl[2];
        
        // 1. Speichere den neuen Winkel
        this.currentStudioSetup.h = h;
        
        // 2. Setze den Helligkeits-Slider (limitiert zwischen 15 und 85)
        let clampedL = Math.max(15, Math.min(85, l));
        document.getElementById('pro-light').value = clampedL;

        // 3. Setze den Ring auf dem Farbrad auf die korrekte Position
        const thumb = document.getElementById('wheel-thumb');
        if(thumb) {
            let angle = (h - 90) * (Math.PI / 180);
            let tx = 62 * Math.cos(angle);
            let ty = 62 * Math.sin(angle);
            thumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
        }

        // 4. Lade die Farbe aufs Auto
        this.updateProColor();
    },

updateProColor: function() {
        const hue = this.currentStudioSetup.h;
        const light = document.getElementById('pro-light').value;
        const rgb = this.hslToRgb(hue, 85, light); 
        const hexStr = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
        
       // UI Text & Center updaten (innerText ist wieder korrekt)
        document.getElementById('hue-val-disp').innerText = hexStr;
        document.getElementById('wheel-center-bg').style.background = hexStr;

        // FIX: Farbe DIREKT als Background setzen, das kapiert jeder Browser sofort!
        const slider = document.getElementById('pro-light');
        slider.style.background = `linear-gradient(to right, hsl(${hue}, 80%, 10%), hsl(${hue}, 85%, 50%), hsl(${hue}, 80%, 90%))`;

        this.applyRgbToCar(rgb[0], rgb[1], rgb[2]);
    },
    applyRgbToCar: function(r, g, b) {
        const viewer = document.getElementById('studio-model-viewer');
        if(!viewer || !viewer.model) return;

        const toLinear = (c) => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
        const colorArray = [toLinear(r), toLinear(g), toLinear(b), 1.0];

        const materials = viewer.model.materials;
        for (let i = 0; i < materials.length; i++) {
            const matName = materials[i].name ? materials[i].name.toLowerCase() : "";
            if (matName.includes("paint") || matName.includes("body") || matName.includes("carrosserie") || matName.includes("color") || i===0) {
                materials[i].pbrMetallicRoughness.setBaseColorFactor(colorArray);
            }
        }
    },

    // NEU: Segmentierter Slider für Finish
setCarFinish: function(type, index, btnElement, skipUIUpdate) {
        this.currentStudioSetup.finish = type;

        // Wir prüfen hier ganz genau: Ist ein btnElement da? 
        if(!skipUIUpdate && btnElement && btnElement.classList) {
            const pill = document.getElementById('finish-pill');
            if(pill) pill.style.transform = `translateX(${index * 100}%)`;
            
            document.querySelectorAll('.finish-opt').forEach(btn => btn.classList.remove('active'));
            btnElement.classList.add('active');
        }

        const viewer = document.getElementById('studio-model-viewer');
        if(!viewer || !viewer.model) return;

        let metallic = 0.0; let roughness = 0.5;
        if(type === 'glossy') { metallic = 0.3; roughness = 0.1; } 
        else if (type === 'metallic') { metallic = 0.9; roughness = 0.15; } 
        else if (type === 'matt') { metallic = 0.0; roughness = 0.8; }

        const materials = viewer.model.materials;
        for (let i = 0; i < materials.length; i++) {
            const matName = materials[i].name ? materials[i].name.toLowerCase() : "";
            if (matName.includes("paint") || matName.includes("body") || matName.includes("carrosserie") || matName.includes("color") || i===0) {
                materials[i].pbrMetallicRoughness.setMetallicFactor(metallic);
                materials[i].pbrMetallicRoughness.setRoughnessFactor(roughness);
            }
        }
    }, // Komma nicht vergessen!

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
                carCont.innerHTML = `<div onclick="GarageLogic.openBrandSelector()" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;"><div style="font-size:2rem; color:#555; border:2px dashed #444; border-radius:50%; width:60px; height:60px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;"><i class="fa-solid fa-plus"></i></div><span style="color:#888; font-weight:800; font-size:0.8rem; letter-spacing:1px;">ADD YOUR CAR</span></div>`;
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


    // === MODAL LOGIK ===
    openHexModal: function() {
        const modal = document.getElementById('hex-modal-overlay');
        const input = document.getElementById('modal-hex-input');
        const currentHex = document.getElementById('hue-val-disp').innerText;
        
        if(modal && input) {
            input.value = currentHex;
            modal.classList.remove('hidden');
            // Minimal warten, dann Input fokussieren -> öffnet Tastatur automatisch
            setTimeout(() => { input.focus(); }, 100); 
        }
    },

    closeHexModal: function() {
        const modal = document.getElementById('hex-modal-overlay');
        if(modal) modal.classList.add('hidden');
    },

    applyModalHex: function() {
        const input = document.getElementById('modal-hex-input');
        if(input) {
            this.applyManualHex(input.value); // Die Funktion von vorhin erledigt die Mathe
            this.closeHexModal();
        }
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



// === CAMERA COLOR DETECTION LOGIK ===
    cameraStream: null,
    scanInterval: null,
    lastScannedHex: '#FFFFFF',

    startAutoColorDetection: async function() {
        const overlay = document.getElementById('camera-color-overlay');
        const video = document.getElementById('camera-video-feed');

        // Fordert Zugriff auf die RÜCKKAMERA an
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" } 
            });
            video.srcObject = this.cameraStream;
            overlay.classList.remove('hidden');

            // Startet den Loop: Alle 100ms die Farbe auslesen
            this.scanInterval = setInterval(() => this.scanCenterPixel(), 100);
        } catch (err) {
            alert("Kamera-Zugriff verweigert oder auf diesem Gerät nicht verfügbar.");
            console.error(err);
        }
    },

    scanCenterPixel: function() {
        const video = document.getElementById('camera-video-feed');
        const canvas = document.getElementById('camera-canvas');
        const preview = document.getElementById('scanned-color-preview');
        
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Finde die exakte Mitte des Video-Feeds
        const vx = video.videoWidth / 2;
        const vy = video.videoHeight / 2;
        
        // PRO-TIPP: Wir lesen nicht 1 Pixel aus (zu viel Rauschen), 
        // sondern zeichnen einen 30x30 Pixel Bereich in unseren 1x1 Canvas. 
        // Der Browser berechnet dadurch automatisch die perfekte Durchschnittsfarbe!
        ctx.drawImage(video, vx - 15, vy - 15, 30, 30, 0, 0, 1, 1);
        
        const pixelData = ctx.getImageData(0, 0, 1, 1).data;
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        
        // RGB zu HEX umwandeln
        const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
        this.lastScannedHex = hex;
        
        // UI aktualisieren
        if(preview) preview.style.backgroundColor = hex;
    },

    stopCamera: function() {
        const overlay = document.getElementById('camera-color-overlay');
        
        // Kamera Hardware abschalten
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        
        // Scan-Loop stoppen
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        if(overlay) overlay.classList.add('hidden');
    },

    applyCameraColor: function() {
        const hex = this.lastScannedHex;
        this.stopCamera();
        
        // Wir recyceln unsere bombensichere Funktion vom manuellen Hex-Input!
        if(typeof this.applyManualHex === 'function') {
            this.applyManualHex(hex);
        } else {
            console.error("applyManualHex Funktion nicht gefunden!");
        }
    }
};



// === WICHTIG: STARTEN AM ENDE ===
// Hier wird die Logik erst ausgeführt, wenn alles geladen ist.
window.GarageLogic.init();
