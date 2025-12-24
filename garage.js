/* GARAGE.JS - FINAL "SELF-BUILD" VERSION */

window.GarageLogic = {
    // 1. DATEN
    drives: JSON.parse(localStorage.getItem('driverhub_drives') || '[]'),
    cars: JSON.parse(localStorage.getItem('driverhub_cars') || '[]'),
    editingCarIndex: -1,
    
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // 2. START
    init: function() {
        console.log("Garage Self-Build Init");
        this.injectEditorHTML(); // Baut das Fenster und CSS neu!
        this.renderCars();
    },

    // 3. FENSTER BAUEN (Der Trick!)
    injectEditorHTML: function() {
        // Alte Fenster löschen, falls vorhanden
        const old = document.getElementById('car-editor-overlay');
        if(old) old.remove();

        // Styles injecten
        const style = document.createElement('style');
        style.innerHTML = `
            #car-editor-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:99999; align-items:center; justify-content:center; }
            .editor-card { width:90%; max-width:400px; background:#111; border:1px solid #333; border-radius:20px; padding:20px; display:flex; flex-direction:column; max-height:90vh; pointer-events:auto; }
            .model-option { padding:10px; border:1px solid #444; margin:2px; color:#888; cursor:pointer; background:#222; border-radius:8px; text-align:center; font-family:sans-serif; font-size:0.8rem; }
            .model-option.selected { border-color:#007aff; color:white; background:rgba(0,122,255,0.2); }
            .input-group { margin-bottom:15px; }
            .input-group label { color:#666; font-size:0.7rem; font-weight:bold; display:block; margin-bottom:5px; }
            .input-group input { width:100%; background:#222; border:1px solid #444; color:white; padding:12px; border-radius:10px; box-sizing:border-box; }
        `;
        document.head.appendChild(style);

        // HTML injecten
        const html = `
        <div id="car-editor-overlay">
            <div class="editor-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:white; margin:0; font-family:sans-serif; font-style:italic;">CAR PROFILE</h2>
                    <button onclick="GarageLogic.closeEditor()" style="background:transparent; border:1px solid #333; color:white; width:35px; height:35px; border-radius:50%; font-size:1.2rem; cursor:pointer;">✕</button>
                </div>
                
                <div style="overflow-y:auto;">
                    <div style="width:100%; height:180px; background:#222; border-radius:15px; margin-bottom:20px; overflow:hidden;">
                        <model-viewer id="js-editor-preview" src="" auto-rotate camera-controls disable-zoom style="width:100%; height:100%;" shadow-intensity="1"></model-viewer>
                    </div>

                    <div class="input-group">
                        <label>NICKNAME</label>
                        <input type="text" id="js-edit-name" placeholder="Name...">
                    </div>

                    <div class="input-group">
                        <label>CHOOSE MODEL</label>
                        <div id="js-model-list" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"></div>
                    </div>

                    <div style="display:flex; gap:10px;">
                        <div class="input-group" style="flex:1;"><label>HP</label><input type="number" id="js-edit-hp"></div>
                        <div class="input-group" style="flex:1;"><label>WEIGHT</label><input type="number" id="js-edit-weight"></div>
                    </div>
                    <div class="input-group"><label>ENGINE</label><input type="text" id="js-edit-engine"></div>

                    <div class="input-group">
                        <label>COLOR</label>
                        <div id="js-color-list" style="display:flex; gap:10px; justify-content:center;"></div>
                        <input type="hidden" id="js-edit-color">
                    </div>

                    <button onclick="GarageLogic.saveCarEdit()" style="width:100%; background:#007aff; color:white; border:none; padding:15px; border-radius:12px; font-weight:bold; margin-bottom:10px; cursor:pointer;">SAVE CAR</button>
                    <button id="js-btn-delete" onclick="GarageLogic.deleteCurrentCar()" style="width:100%; background:transparent; border:1px solid #ff3b30; color:#ff3b30; padding:10px; border-radius:12px; font-weight:bold; cursor:pointer;">DELETE</button>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // 4. EDITOR ÖFFNEN & FÜLLEN
    openEditor: function(index) {
        this.editingCarIndex = index;
        const overlay = document.getElementById('car-editor-overlay');
        overlay.style.display = 'flex';

        // A) MODELLE FÜLLEN
        const list = document.getElementById('js-model-list');
        const viewer = document.getElementById('js-editor-preview');
        list.innerHTML = '';
        
        this.availableModels.forEach(m => {
            const div = document.createElement('div');
            div.className = 'model-option';
            div.innerText = m.name;
            div.onclick = () => {
                // Styles resetten
                Array.from(list.children).forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                viewer.src = m.file;
                div.setAttribute('data-file', m.file);
            };
            list.appendChild(div);
        });

        // B) FARBEN FÜLLEN
        const cList = document.getElementById('js-color-list');
        cList.innerHTML = '';
        ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ffffff'].forEach(c => {
            const div = document.createElement('div');
            div.style.cssText = `width:35px; height:35px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid transparent;`;
            div.onclick = () => {
                document.getElementById('js-edit-color').value = c;
                Array.from(cList.children).forEach(k => k.style.borderColor='transparent');
                div.style.borderColor='white';
            };
            cList.appendChild(div);
        });

        // C) DATEN SETZEN
        if(index > -1 && this.cars[0]) {
            const c = this.cars[0];
            document.getElementById('js-edit-name').value = c.name;
            document.getElementById('js-edit-hp').value = c.hp;
            document.getElementById('js-edit-weight').value = c.weight;
            document.getElementById('js-edit-engine').value = c.engine;
            viewer.src = c.model;
            document.getElementById('js-btn-delete').style.display = 'block';
        } else {
            document.getElementById('js-edit-name').value = '';
            document.getElementById('js-edit-hp').value = '';
            document.getElementById('js-edit-weight').value = '';
            document.getElementById('js-edit-engine').value = '';
            viewer.src = '';
            document.getElementById('js-btn-delete').style.display = 'none';
        }
    },

    saveCarEdit: function() {
        const name = document.getElementById('js-edit-name').value;
        if(!name) { alert("Bitte Namen eingeben!"); return; }

        // Modell finden
        let modelFile = "car.glb";
        const sel = document.querySelector('.model-option.selected');
        if(sel) modelFile = sel.getAttribute('data-file');
        else if(this.cars.length > 0) modelFile = this.cars[0].model;

        const newCar = {
            name: name,
            hp: document.getElementById('js-edit-hp').value || '-',
            weight: document.getElementById('js-edit-weight').value || '-',
            engine: document.getElementById('js-edit-engine').value || '-',
            color: document.getElementById('js-edit-color').value || '#bf5af2',
            model: modelFile
        };

        this.cars = [newCar];
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        this.closeEditor();
        this.renderCars();
    },

    closeEditor: function() {
        document.getElementById('car-editor-overlay').style.display = 'none';
    },

    deleteCurrentCar: function() {
        this.cars = [];
        localStorage.setItem('driverhub_cars', '[]');
        this.closeEditor();
        this.renderCars();
    },

    // 5. RENDER DASHBOARD
    renderCars: function() {
        this.renderCarCard();
        this.renderDriveCard();
    },
    renderList: function() {}, // Dummy

    renderCarCard: function() {
        const container = document.getElementById('car-card-content');
        if(!container) return;
        
        let isBroken = (this.cars.length > 0 && !this.cars[0].name);
        if(isBroken || this.cars.length === 0) {
            document.querySelector('#card-car-profile .card-header-btn').style.display = 'none';
            container.innerHTML = `<div class="empty-add-container" onclick="GarageLogic.openEditor(-1)"><div class="empty-add-icon"><i class="fa-solid fa-plus"></i></div><span class="empty-add-text">ADD YOUR CAR</span></div>`;
            return;
        }

        document.querySelector('#card-car-profile .card-header-btn').style.display = 'flex';
        const car = this.cars[0];
        const col = car.color || '#bf5af2';
        container.innerHTML = `
            <div class="card-split-left" style="border-right-color: ${col}30;">
                <div style="width:100%; height:80%;"><model-viewer src="${car.model}" auto-rotate camera-controls disable-zoom interaction-prompt="none" style="width:100%; height:100%;" shadow-intensity="1"></model-viewer></div>
                <div class="mini-car-name">${car.name}</div>
            </div>
            <div class="card-split-right">
                <div class="d-stat"><label>ENGINE</label><span>${car.engine}</span></div>
                <div class="d-stat"><label>POWER</label><span style="color:${col};">${car.hp}<small>PS</small></span></div>
                <div class="d-stat"><label>WEIGHT</label><span>${car.weight}<small>KG</small></span></div>
            </div>`;
    },

    renderDriveCard: function() {
        const container = document.getElementById('drive-card-content');
        if(!container) return;
        if(this.drives.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#666; padding-top:20px;">NO DRIVES</div>`;
            return;
        }
        const d = this.drives[0];
        container.innerHTML = `
            <div class="card-split-left" style="padding:0; border:none;"><div id="mini-map-canvas" class="mini-map-box"></div></div>
            <div class="card-split-right">
                <div class="d-stat"><label>DIST</label><span>${d.dist.toFixed(1)} km</span></div>
                <div class="d-stat"><label>DATE</label><span>${new Date(d.date).toLocaleDateString()}</span></div>
            </div>`;
        setTimeout(() => {
            if(document.getElementById('mini-map-canvas') && d.path) {
                if(this.miniMap) this.miniMap.remove();
                this.miniMap = L.map('mini-map-canvas', { zoomControl:false, attributionControl:false });
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.miniMap);
                const p = L.polyline(d.path.map(x=>[x.lat,x.lng]), {color:'#bf5af2'}).addTo(this.miniMap);
                this.miniMap.fitBounds(p.getBounds());
            }
        }, 300);
    },
    showHistory: function() { alert("Bald verfügbar!"); },
    openCarDetails: function() { this.openEditor(0); }
};
