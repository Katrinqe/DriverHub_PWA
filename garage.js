/* GARAGE.JS - FINAL V20 (Details Page) */

window.GarageLogic = {
    // 1. DATEN
    drives: JSON.parse(localStorage.getItem('driverhub_drives') || '[]'),
    cars: JSON.parse(localStorage.getItem('driverhub_cars') || '[]'),
    
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    init: function() {
        console.log("Garage V20 Init");
        this.renderCars();
        
        // Klick-Listener für die "VIEW CAR DETAILS" Card im Dashboard
        // Wir suchen die Card erst, wenn alles geladen ist
        setTimeout(() => {
            const btn = document.querySelector('#card-car-profile .card-header-btn');
            if(btn) {
                // Den alten Listener entfernen wir nicht explizit, wir überschreiben onclick oft.
                // Aber besser: Wir setzen das Onclick direkt im HTML oder hier hart.
                btn.onclick = (e) => {
                    e.stopPropagation(); // Verhindert Klicks darunter
                    this.openDetailScreen();
                };
            }
        }, 1000);
    },

    // ==========================================
    // === NEU: DETAIL SCREEN LOGIC ===
    // ==========================================

    openDetailScreen: function() {
        const screen = document.getElementById('car-details-screen');
        if(screen) {
            screen.classList.remove('hidden');
            this.renderDetailList(); // Liste bauen
        }
    },

    closeDetailScreen: function() {
        const screen = document.getElementById('car-details-screen');
        if(screen) screen.classList.add('hidden');
        this.renderCars(); // Hauptdashboard updaten (falls sich was geändert hat)
    },

    // Baut die lange Liste mit den großen Cards
    renderDetailList: function() {
        const container = document.getElementById('car-details-list');
        if(!container) return;
        container.innerHTML = '';

        // 1. Loop durch alle Autos
        this.cars.forEach((car, index) => {
            const col = car.color || '#bf5af2';
            const acc = car.acceleration || '---';
            
            // Ist das Auto gerade das Hauptauto (Index 0)?
            const isActive = (index === 0);
            const checkColor = isActive ? '#30d158' : '#666'; // Grün oder Grau

            const html = `
            <div class="detail-card">
                <div class="detail-model-box">
                     <model-viewer src="${car.model}" auto-rotate camera-controls disable-zoom interaction-prompt="none" style="width:100%; height:100%;" shadow-intensity="1"></model-viewer>
                </div>
                
                <div class="detail-name">${car.name}</div>

                <div class="detail-stats-grid">
                    <div class="detail-stat"><label>ENGINE</label><span>${car.engine}</span></div>
                    <div class="detail-stat"><label>POWER</label><span style="color:${col}">${car.hp}<small>PS</small></span></div>
                    <div class="detail-stat"><label>WEIGHT</label><span>${car.weight}<small>KG</small></span></div>
                    <div class="detail-stat"><label>0-100</label><span>${acc}<small>S</small></span></div>
                </div>

                <div class="detail-extra-box">
                    <span class="detail-label">RECORDS</span>
                    <span style="font-size:0.8rem; color:#555;">NO RECORDS YET</span>
                </div>

                <div class="detail-extra-box" style="border-bottom:none;">
                    <span class="detail-label">ACCELERATION GRAPH</span>
                    <div class="detail-graph-placeholder">
                        Coming Soon (Performance Page)
                    </div>
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
            
            // Als HTML Element einfügen
            const div = document.createElement('div');
            div.innerHTML = html;
            container.appendChild(div);
        });

        // 2. Add Car Button ganz unten
        const addBtn = document.createElement('div');
        addBtn.className = 'detail-add-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> ADD ANOTHER CAR';
        addBtn.onclick = () => {
            this.openEditor(-1); // -1 heißt: Neues Auto erstellen
        };
        container.appendChild(addBtn);
    },

    // Setzt ein Auto an die erste Stelle (Hauptauto)
    setActiveCar: function(index) {
        if(index === 0) return; // Ist schon aktiv

        // Wir tauschen das gewählte Auto an Position 0
        const selectedCar = this.cars[index];
        this.cars.splice(index, 1); // Rausnehmen
        this.cars.unshift(selectedCar); // Vorne einfügen
        
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        
        // Liste neu rendern (damit der Haken grün wird)
        this.renderDetailList();
    },

    // ==========================================
    // === EXISTING LOGIC (Unchanged mostly) ===
    // ==========================================

    save: function(driveData) {
        if(!driveData) return;
        const GL = window.GarageLogic; 
        GL.drives.unshift(driveData);
        localStorage.setItem('driverhub_drives', JSON.stringify(GL.drives));
        if(document.getElementById('drive-card-content')) {
            GL.renderDriveCard();
        }
    },

    openEditor: function(index) {
        // Falls wir im Detail-Screen sind, merken wir uns das? 
        // Egal, Editor legt sich eh drüber.
        
        const overlay = document.getElementById('final-overlay');
        if(!overlay) { alert("Error: Overlay missing"); return; }
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';

        this.renderModelList();
        this.renderColorList();
        
        // Auto laden (Index oder neu)
        // ACHTUNG: Wenn Index -1 (Neu), alles leer.
        // Wenn Index >= 0, Auto laden.
        
        let carToEdit = null;
        if(index > -1 && this.cars[index]) {
            carToEdit = this.cars[index];
            this.editingCarIndex = index; // Speichern wir uns
        } else {
            this.editingCarIndex = -1; // Neues Auto
        }

        if(carToEdit) {
            document.getElementById('final-name').value = carToEdit.name;
            document.getElementById('final-hp').value = carToEdit.hp;
            document.getElementById('final-weight').value = carToEdit.weight;
            document.getElementById('final-engine').value = carToEdit.engine;
            document.getElementById('final-color-input').value = carToEdit.color;
            if(document.getElementById('final-preview')) document.getElementById('final-preview').src = carToEdit.model;
            
            const list = document.getElementById('final-model-list');
            Array.from(list.children).forEach(btn => {
                if(btn.getAttribute('data-file') === carToEdit.model) {
                    btn.classList.add('selected-model');
                    btn.style.borderColor = '#007aff'; btn.style.color = 'white';
                }
            });
            this.highlightColor(carToEdit.color);
        } else {
            // Reset
            document.getElementById('final-name').value = '';
            document.getElementById('final-hp').value = '';
            document.getElementById('final-weight').value = '';
            document.getElementById('final-engine').value = '';
            document.getElementById('final-color-input').value = '#bf5af2';
            if(document.getElementById('final-preview')) document.getElementById('final-preview').src = '';
            this.highlightColor('#bf5af2');
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

    saveCarEdit: function() {
        const nameVal = document.getElementById('final-name').value;
        if(!nameVal) { alert("Bitte Namen eingeben!"); return; }

        let modelFile = "car.glb";
        const selected = document.querySelector('.selected-model');
        if(selected) modelFile = selected.getAttribute('data-file');
        else if(this.editingCarIndex > -1) modelFile = this.cars[this.editingCarIndex].model; // Altes Modell nutzen
        else if(this.cars.length > 0) modelFile = this.cars[0].model; // Fallback

        // Alten Wert für Acc behalten, falls vorhanden
        let currentAcc = '-';
        if(this.editingCarIndex > -1 && this.cars[this.editingCarIndex].acceleration) {
            currentAcc = this.cars[this.editingCarIndex].acceleration;
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
        
        // Speichern oder Updaten
        if(this.editingCarIndex > -1) {
            this.cars[this.editingCarIndex] = newCar; // Update
        } else {
            this.cars.push(newCar); // Neu
        }

        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        document.getElementById('final-overlay').style.display = 'none';
        
        // Alles refreshen
        this.renderCars();
        
        // Falls der Detail Screen offen ist, den auch refreshen
        if(!document.getElementById('car-details-screen').classList.contains('hidden')) {
            this.renderDetailList();
        }
    },

    deleteCurrentCar: function() {
        if(confirm("Löschen?")) {
            if(this.editingCarIndex > -1) {
                this.cars.splice(this.editingCarIndex, 1);
            } else {
                this.cars = []; // Fallback Alles löschen (alte Logik)
            }
            
            localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
            document.getElementById('final-overlay').style.display = 'none';
            this.renderCars();
             // Falls der Detail Screen offen ist, den auch refreshen
            if(!document.getElementById('car-details-screen').classList.contains('hidden')) {
                this.renderDetailList();
            }
        }
    },

    renderCars: function() {
        // Update Onclick Event for Header Button
        const headerBtn = document.querySelector('#card-car-profile .card-header-btn');
        if(headerBtn) {
            headerBtn.onclick = (e) => {
                e.stopPropagation();
                this.openDetailScreen();
            };
        }

        const carCont = document.getElementById('car-card-content');
        if(carCont) {
            if(this.cars.length === 0 || !this.cars[0].name) {
                if(headerBtn) headerBtn.style.display='none';
                carCont.innerHTML = `<div onclick="GarageLogic.openEditor(-1)" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;"><div style="font-size:2rem; color:#555; border:2px dashed #444; border-radius:50%; width:60px; height:60px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;"><i class="fa-solid fa-plus"></i></div><span style="color:#888; font-weight:800; font-size:0.8rem; letter-spacing:1px;">ADD YOUR CAR</span></div>`;
            } else {
                if(headerBtn) headerBtn.style.display='flex';
                const c = this.cars[0];
                const col = c.color || '#bf5af2';
                const acc = c.acceleration || '---';
                carCont.innerHTML = `
                <div class="card-split-left" style="border-right-color:${col}30;">
                    <div style="width:100%; height:80%;"><model-viewer src="${c.model}" auto-rotate camera-controls disable-zoom style="width:100%; height:100%;" shadow-intensity="1" interaction-prompt="none"></model-viewer></div>
                    <div class="mini-car-name">${c.name}</div>
                </div>
                <div class="card-split-right" style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; align-content:center;">
                    <div class="d-stat"><label>ENGINE</label><span>${c.engine}</span></div>
                    <div class="d-stat"><label>POWER</label><span style="color:${col};">${c.hp}<small>PS</small></span></div>
                    <div class="d-stat"><label>WEIGHT</label><span>${c.weight}<small>KG</small></span></div>
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
            
            let maxVal = 0;
            if(d.max !== undefined) maxVal = Math.round(d.max);
            else if(d.maxSpeed !== undefined) maxVal = Math.round(d.maxSpeed);

            let avgStr = "---";
            if(d.avg !== undefined) avgStr = Math.round(d.avg);
            else if(d.avgSpeed !== undefined) avgStr = Math.round(d.avgSpeed);

            let timeStr = "---";
            if(d.time) { timeStr = d.time; } 
            else if(d.duration) {
                const sec = Math.round(d.duration / 1000); 
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                timeStr = `${m}m ${s}s`;
            }

            driveCont.innerHTML = `
            <div class="card-split-left" style="padding:0; border:none;"><div id="mini-map-canvas" class="mini-map-box"></div></div>
            <div class="card-split-right" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; align-content:center; padding-top:10px;">
                <div class="d-stat"><label>TIME</label><span>${timeStr}</span></div>
                <div class="d-stat"><label>DIST</label><span>${dist}<small>km</small></span></div>
                <div class="d-stat"><label>AVG SPEED</label><span>${avgStr}<small>km/h</small></span></div>
                <div class="d-stat"><label>MAX SPEED</label><span style="color:#30d158;">${maxVal}<small>km/h</small></span></div>
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
    },
    renderList: function() {}
};
