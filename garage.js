/* GARAGE.JS - FINAL V8 (Compatible Fix) */

window.GarageLogic = {
    // 1. DATEN
    drives: JSON.parse(localStorage.getItem('driverhub_drives') || '[]'),
    cars: JSON.parse(localStorage.getItem('driverhub_cars') || '[]'),
    editingCarIndex: -1,
    
    // 2. MODELLE
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // 3. START
    init: function() {
        console.log("Garage Init...");
        this.renderCars(); // Hier hieß es vorher renderGarage -> Fehler!
    },

    // 4. HAUPTFUNKTION (Jetzt wieder renderCars, damit app.js glücklich ist)
    renderCars: function() {
        this.renderCarCard();
        this.renderDriveCard();
    },

    // === CARD 1: CAR PROFILE ===
    renderCarCard: function() {
        const container = document.getElementById('car-card-content');
        if(!container) return;
        container.innerHTML = '';

        const headerBtn = document.querySelector('#card-car-profile .card-header-btn');

        // Check auf kaputte Daten
        let isBroken = false;
        if(this.cars && this.cars.length > 0) {
            if(!this.cars[0].name || this.cars[0].name.trim() === "") {
                isBroken = true;
                this.cars = []; 
                localStorage.setItem('driverhub_cars', '[]');
            }
        }

        // ADD BUTTON ZEIGEN
        if(!this.cars || this.cars.length === 0 || isBroken) {
            if(headerBtn) headerBtn.style.display = 'none';
            container.innerHTML = `
                <div class="empty-add-container" onclick="GarageLogic.openEditor(-1)">
                    <div class="empty-add-icon"><i class="fa-solid fa-plus"></i></div>
                    <span class="empty-add-text">ADD YOUR CAR</span>
                </div>
            `;
            return;
        }

        // AUTO ANZEIGEN
        if(headerBtn) headerBtn.style.display = 'flex';
        const car = this.cars[0]; 
        this.editingCarIndex = 0; 
        const col = car.color || '#bf5af2';

        const html = `
            <div class="card-split-left" style="border-right-color: ${col}30;">
                <div style="width:100%; height:80%; cursor:grab;">
                    <model-viewer src="${car.model}" auto-rotate camera-controls disable-zoom interaction-prompt="none" style="width:100%; height:100%;" shadow-intensity="1"></model-viewer>
                </div>
                <div class="mini-car-name">${car.name}</div>
            </div>
            <div class="card-split-right">
                <div class="d-stat"><label>ENGINE</label><span>${car.engine}</span></div>
                <div class="d-stat"><label>POWER</label><span style="color:${col};">${car.hp}<small>PS</small></span></div>
                <div class="d-stat"><label>WEIGHT</label><span>${car.weight}<small>KG</small></span></div>
                <div class="d-stat"><label>0-100</label><span>---<small>S</small></span></div>
            </div>
        `;
        container.innerHTML = html;
    },

    // === CARD 2: DRIVE HISTORY ===
    renderDriveCard: function() {
        const container = document.getElementById('drive-card-content');
        if(!container) return;
        container.innerHTML = '';

        if(this.drives.length === 0) {
            container.innerHTML = `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#666;">
                    <i class="fa-solid fa-road" style="font-size:1.5rem; margin-bottom:10px;"></i>
                    <span style="font-size:0.7rem; font-weight:800;">NO RECENT DRIVES</span>
                </div>
            `;
            return;
        }

        const drive = this.drives[0];
        const dist = drive.dist ? drive.dist.toFixed(1) : "0.0";
        const max = drive.maxSpeed ? Math.round(drive.maxSpeed) : 0;
        
        container.innerHTML = `
            <div class="card-split-left" style="padding:0; border:none;">
                <div id="mini-map-canvas" class="mini-map-box"></div>
            </div>
            <div class="card-split-right">
                <div class="d-stat"><label>MAX SPEED</label><span style="color:#30d158;">${max}<small>km/h</small></span></div>
                <div class="d-stat"><label>DISTANCE</label><span>${dist}<small>km</small></span></div>
                <div class="d-stat"><label>DATE</label><span>${new Date(drive.date).toLocaleDateString()}</span></div>
            </div>
        `;

        setTimeout(() => {
            if(document.getElementById('mini-map-canvas') && drive.path && drive.path.length > 0) {
                if(this.miniMap) { this.miniMap.remove(); }
                this.miniMap = L.map('mini-map-canvas', { zoomControl: false, dragging: false, attributionControl: false });
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.miniMap);
                const latlngs = drive.path.map(p => [p.lat, p.lng]);
                const polyline = L.polyline(latlngs, {color: '#bf5af2', weight: 3}).addTo(this.miniMap);
                this.miniMap.fitBounds(polyline.getBounds(), {padding: [10, 10]});
            }
        }, 300);
    },

    // === EDITOR FUNKTIONEN ===
    openEditor: function(index) {
        this.editingCarIndex = index;
        const overlay = document.getElementById('car-editor-overlay');
        
        // HIER IST DER CHECK: Wenn Overlay fehlt, passiert nichts!
        if(!overlay) { 
            alert("FEHLER: Editor-Code fehlt in index.html!"); 
            return; 
        }
        
        document.body.appendChild(overlay); 

        // Modelle laden
        const modelList = document.getElementById('model-selector');
        const previewViewer = document.getElementById('editor-preview-viewer');
        if(modelList) {
            modelList.innerHTML = '';
            this.availableModels.forEach(m => {
                const div = document.createElement('div');
                div.className = 'model-option';
                div.innerHTML = `<span>${m.name}</span>`;
                div.style.cssText = "padding:10px; border:1px solid #444; margin:2px; color:#888; cursor:pointer; background:#222; border-radius:8px; text-align:center;";
                div.setAttribute('data-file', m.file);
                div.onclick = () => {
                    document.querySelectorAll('.model-option').forEach(e => {e.style.borderColor='#444'; e.style.color='#888'; e.classList.remove('selected');});
                    div.classList.add('selected'); div.style.borderColor='#007aff'; div.style.color='white';
                    if(previewViewer) previewViewer.src = m.file;
                };
                modelList.appendChild(div);
            });
        }

        // Farben laden
        const colorRow = document.getElementById('color-picker-row');
        if(colorRow) {
            colorRow.innerHTML = '';
            ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ffffff'].forEach(c => {
                const circle = document.createElement('div');
                circle.style.cssText = `width:35px; height:35px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid transparent;`;
                circle.onclick = () => {
                    document.getElementById('edit-car-color').value = c;
                    Array.from(colorRow.children).forEach(k => k.style.borderColor='transparent');
                    circle.style.borderColor='white';
                };
                colorRow.appendChild(circle);
            });
        }

        // Felder füllen
        if(index > -1 && this.cars[0]) {
             const c = this.cars[0];
             document.getElementById('edit-car-name').value = c.name;
             document.getElementById('edit-car-hp').value = c.hp;
             document.getElementById('edit-car-weight').value = c.weight;
             document.getElementById('edit-car-engine').value = c.engine;
             if(previewViewer) previewViewer.src = c.model;
             if(document.getElementById('btn-delete-car')) document.getElementById('btn-delete-car').style.display = 'block';
        } else {
             document.getElementById('edit-car-name').value = '';
             document.getElementById('edit-car-hp').value = '';
             document.getElementById('edit-car-weight').value = '';
             document.getElementById('edit-car-engine').value = '';
             if(previewViewer) previewViewer.src = '';
             if(document.getElementById('btn-delete-car')) document.getElementById('btn-delete-car').style.display = 'none';
        }
        
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
    },

    saveCarEdit: function() {
        const name = document.getElementById('edit-car-name').value;
        const selectedModelDiv = document.querySelector('.model-option.selected');
        
        if(!name) { alert("Bitte gib einen Namen ein!"); return; }
        
        let modelFile = "car.glb"; 
        if(selectedModelDiv) modelFile = selectedModelDiv.getAttribute('data-file');
        else if(this.cars.length > 0) modelFile = this.cars[0].model; 

        const newCar = {
            name: name,
            hp: document.getElementById('edit-car-hp').value || '-',
            weight: document.getElementById('edit-car-weight').value || '-',
            engine: document.getElementById('edit-car-engine').value || '-',
            color: document.getElementById('edit-car-color').value || '#bf5af2',
            model: modelFile
        };

        if(this.cars.length > 0) this.cars[0] = newCar;
        else this.cars.push(newCar);

        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        this.closeEditor();
        this.renderCars();
    },

    closeEditor: function() {
        const overlay = document.getElementById('car-editor-overlay');
        if(overlay) overlay.style.display = 'none';
    },
    deleteCurrentCar: function() {
        if(confirm("Löschen?")) {
            this.cars = [];
            localStorage.setItem('driverhub_cars', '[]');
            this.closeEditor();
            this.renderCars();
        }
    },
    showHistory: function() { alert("Kommt bald!"); },
    openCarDetails: function() { this.openEditor(0); }
};
