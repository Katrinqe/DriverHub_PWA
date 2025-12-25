/* GARAGE.JS - FINAL V15 (Save Fix) */

window.GarageLogic = {
    // 1. DATEN LADEN
    drives: JSON.parse(localStorage.getItem('driverhub_drives') || '[]'),
    cars: JSON.parse(localStorage.getItem('driverhub_cars') || '[]'),
    
    // 2. MODELLE
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // 3. START
    init: function() {
        console.log("Garage V15 Init");
        this.renderCars();
    },

    // === WICHTIG: DIE FEHLENDE SAVE-FUNKTION ===
    // Damit drive.js die Fahrt hier abliefern kann
    save: function(driveData) {
        if(!driveData) return;
        
        // 1. Vorne anfügen
        this.drives.unshift(driveData);
        
        // 2. Speichern
        localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
        
        // 3. UI sofort aktualisieren
        this.renderDriveCard();
        
        console.log("Fahrt in Garage gespeichert!", driveData);
    },

    // 4. EDITOR ÖFFNEN
    openEditor: function() {
        const overlay = document.getElementById('final-overlay');
        if(!overlay) { alert("Fehler: #final-overlay fehlt!"); return; }
        
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';

        // A) LISTEN FÜLLEN
        this.renderModelList();
        this.renderColorList();
        
        // B) WERTE FÜLLEN
        if(this.cars.length > 0) {
            const c = this.cars[0];
            document.getElementById('final-name').value = c.name;
            document.getElementById('final-hp').value = c.hp;
            document.getElementById('final-weight').value = c.weight;
            document.getElementById('final-engine').value = c.engine;
            document.getElementById('final-color-input').value = c.color;
            
            const viewer = document.getElementById('final-preview');
            if(viewer) viewer.src = c.model;
            
            // Markierungen setzen
            const list = document.getElementById('final-model-list');
            Array.from(list.children).forEach(btn => {
                if(btn.getAttribute('data-file') === c.model) {
                    btn.classList.add('selected-model');
                    btn.style.borderColor = '#007aff';
                    btn.style.color = 'white';
                }
            });
            this.highlightColor(c.color);

        } else {
            // Reset
            document.getElementById('final-name').value = '';
            document.getElementById('final-hp').value = '';
            document.getElementById('final-weight').value = '';
            document.getElementById('final-engine').value = '';
            document.getElementById('final-color-input').value = '#bf5af2';
            document.getElementById('final-preview').src = '';
            this.highlightColor('#bf5af2');
        }
    },

    // 5. HELPER: LISTEN
    renderModelList: function() {
        const list = document.getElementById('final-model-list');
        const viewer = document.getElementById('final-preview');
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
        Array.from(list.children).forEach(c => {
            c.style.borderColor = 'transparent'; c.style.transform = 'scale(1)';
            if(c.getAttribute('data-color') === color) {
                c.style.borderColor = 'white'; c.style.transform = 'scale(1.2)';
            }
        });
    },

    // 6. SPEICHERN (Auto Editor)
    saveCarEdit: function() {
        const nameVal = document.getElementById('final-name').value;
        if(!nameVal) { alert("Bitte Namen eingeben!"); return; }

        let modelFile = "car.glb";
        const selected = document.querySelector('.selected-model');
        if(selected) {
            modelFile = selected.getAttribute('data-file');
        } else if(this.cars.length > 0) {
            modelFile = this.cars[0].model; 
        }

        const newCar = {
            name: nameVal,
            model: modelFile,
            hp: document.getElementById('final-hp').value || '-',
            weight: document.getElementById('final-weight').value || '-',
            engine: document.getElementById('final-engine').value || '-',
            color: document.getElementById('final-color-input').value || '#bf5af2'
        };
        
        this.cars = [newCar];
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        
        document.getElementById('final-overlay').style.display = 'none';
        this.renderCars();
    },

    deleteCurrentCar: function() {
        if(confirm("Alles löschen?")) {
            this.cars = [];
            localStorage.setItem('driverhub_cars', '[]');
            document.getElementById('final-overlay').style.display = 'none';
            this.renderCars();
        }
    },

    // 7. DASHBOARD RENDERN
    renderCars: function() {
        // === CARD 1: AUTO ===
        const carCont = document.getElementById('car-card-content');
        if(carCont) {
            if(this.cars.length === 0 || !this.cars[0].name) {
                if(document.querySelector('#card-car-profile .card-header-btn')) 
                    document.querySelector('#card-car-profile .card-header-btn').style.display='none';
                
                carCont.innerHTML = `
                <div onclick="GarageLogic.openEditor()" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;">
                    <div style="font-size:2rem; color:#555; border:2px dashed #444; border-radius:50%; width:60px; height:60px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;"><i class="fa-solid fa-plus"></i></div>
                    <span style="color:#888; font-weight:800; font-size:0.8rem; letter-spacing:1px;">ADD YOUR CAR</span>
                </div>`;
            } else {
                if(document.querySelector('#card-car-profile .card-header-btn')) 
                    document.querySelector('#card-car-profile .card-header-btn').style.display='flex';
                const c = this.cars[0];
                const col = c.color || '#bf5af2';
                
                carCont.innerHTML = `
                <div class="card-split-left" style="border-right-color:${col}30;">
                    <div style="width:100%; height:80%;"><model-viewer src="${c.model}" auto-rotate camera-controls disable-zoom style="width:100%; height:100%;" shadow-intensity="1" interaction-prompt="none"></model-viewer></div>
                    <div class="mini-car-name">${c.name}</div>
                </div>
                <div class="card-split-right">
                    <div class="d-stat"><label>ENGINE</label><span>${c.engine}</span></div>
                    <div class="d-stat"><label>POWER</label><span style="color:${col};">${c.hp}<small>PS</small></span></div>
                    <div class="d-stat"><label>WEIGHT</label><span>${c.weight}<small>KG</small></span></div>
                    <div class="d-stat"><label>0-100</label><span>---<small>S</small></span></div>
                </div>`;
            }
        }

        // === CARD 2: FAHRTEN ===
        const driveCont = document.getElementById('drive-card-content');
        if(driveCont) {
            if(this.drives.length === 0) {
                driveCont.innerHTML = `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#666;">
                    <i class="fa-solid fa-road" style="font-size:1.5rem; margin-bottom:10px; opacity:0.5;"></i>
                    <span style="font-size:0.7rem; font-weight:800; letter-spacing:1px; opacity:0.7;">NO RECENT DRIVES</span>
                </div>`;
            } else {
                const d = this.drives[0];
                const dist = d.dist ? d.dist.toFixed(1) : "0.0";
                const max = d.maxSpeed ? Math.round(d.maxSpeed) : 0;

                driveCont.innerHTML = `
                <div class="card-split-left" style="padding:0; border:none;"><div id="mini-map-canvas" class="mini-map-box"></div></div>
                <div class="card-split-right">
                    <div class="d-stat"><label>MAX SPEED</label><span style="color:#30d158;">${max}<small>km/h</small></span></div>
                    <div class="d-stat"><label>DISTANCE</label><span>${dist}<small>km</small></span></div>
                    <div class="d-stat"><label>DATE</label><span>${new Date(d.date).toLocaleDateString()}</span></div>
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
    },
    
    // Dummy für app.js
    renderList: function() {}
};
