alert("HALLO! ICH BIN DA!");

function safeLoad(key) { 
    // ... hier kommt dein normaler Code von vorhin ...

/* GARAGE.JS - SAFE MODE (UNZERSTÖRBAR) */

// 1. Diese Hilfsfunktion verhindert den Absturz bei kaputten Daten!
function safeLoad(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item || item === "undefined" || item === "null") return [];
        return JSON.parse(item);
    } catch (e) {
        console.warn("Daten waren beschädigt. Reset durchgeführt für:", key);
        return []; // Gibt leeres Array zurück statt abzustürzen
    }
}

const GarageLogic = {
    // --- DATEN SPEICHER (Jetzt sicher!) ---
    // Wir nutzen safeLoad statt JSON.parse direkt
    drives: safeLoad('driverhub_drives'),
    cars: safeLoad('driverhub_cars'),
    
    editingCarIndex: -1,
    
    // DEINE MODELLE (Dateinamen prüfen!)
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34 GTR", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // --- STARTUP ---
    init: function() {
        alert("INIT GESTARTET! Autos: " + this.cars.length); // Test 2: Startet die Logik?
        console.log("Garage startet... Autos geladen:", this.cars.length);
        this.renderCars();
        this.renderList();
    },

    // ============================================================
    // TEIL 1: CAR MANAGEMENT
    // ============================================================

    renderCars: function() {
        const container = document.getElementById('garage-swiper-container');
        if(!container) return;
        container.innerHTML = '';

        // 1. Gespeicherte Autos rendern
        this.cars.forEach((car, index) => {
            const slide = document.createElement('div');
            slide.className = 'car-slide interactive-element';
            
            // Fallback falls Farbe fehlt
            const themeColor = car.color || '#bf5af2';
            slide.style.setProperty('--theme-color', themeColor);
            slide.style.setProperty('--theme-glow', themeColor + '40');

            slide.innerHTML = `
                <h1 id="car-name" style="text-shadow: 0 0 15px ${themeColor}80">${car.name || 'Unbenannt'}</h1>
                
                <div id="car-model-wrapper" style="pointer-events: none;"> 
                    <model-viewer 
                        src="${car.model}" 
                        alt="${car.name}"
                        auto-rotate 
                        camera-orbit="45deg 75deg 105%"
                        style="width: 100%; height: 100%;"
                        disable-zoom 
                        shadow-intensity="1"
                        loading="eager"
                    ></model-viewer>
                </div>

                <div class="car-specs-grid">
                    <div class="spec-item"><span class="lbl">ENGINE</span><span class="val">${car.engine || '-'}</span></div>
                    <div class="spec-item"><span class="lbl">POWER</span><span class="val">${car.hp || '0'} <small>PS</small></span></div>
                    <div class="spec-item"><span class="lbl">WEIGHT</span><span class="val">${car.weight || '0'} <small>KG</small></span></div>
                    <div class="spec-item"><span class="lbl">0-100</span><span class="val">--- <small>S</small></span></div>
                </div>

                <div class="best-track-display" style="border-color:${themeColor}40; background:${themeColor}10">
                    <i class="fa-solid fa-trophy" style="color:#ffd700;"></i> 
                    <span>No Track Records yet</span>
                </div>
                
                <div style="position:absolute; bottom:10px; font-size:0.6rem; color:#666; text-transform:uppercase; letter-spacing:1px;">Hold to Edit</div>
            `;

            // Long Press Logic
            let pressTimer;
            const startPress = () => { pressTimer = setTimeout(() => this.openEditor(index), 800); };
            const endPress = () => clearTimeout(pressTimer);
            
            slide.addEventListener('touchstart', startPress);
            slide.addEventListener('touchend', endPress);
            slide.addEventListener('mousedown', startPress);
            slide.addEventListener('mouseup', endPress);

            container.appendChild(slide);
        });

        // 2. "Add New" Karte (MUSS immer erscheinen)
        const addCard = document.createElement('div');
        addCard.className = 'car-slide add-new-card';
        addCard.innerHTML = `
            <i class="fa-solid fa-plus add-new-icon"></i>
            <h3>ADD YOUR CAR</h3>
            <p style="color:#666; font-size:0.8rem;">Tap to create profile</p>
        `;
        addCard.onclick = () => this.openEditor(-1);
        container.appendChild(addCard);
    },

    openEditor: function(index) {
        this.editingCarIndex = index;
        document.getElementById('car-editor-overlay').classList.remove('hidden');
        
        // Inputs holen
        const nameInp = document.getElementById('edit-car-name');
        const hpInp = document.getElementById('edit-car-hp');
        const weightInp = document.getElementById('edit-car-weight');
        const engineInp = document.getElementById('edit-car-engine');
        const colorInp = document.getElementById('edit-car-color');
        const delBtn = document.getElementById('btn-delete-car');

        // Model Selector neu bauen
        const modelList = document.getElementById('model-selector');
        modelList.innerHTML = '';
        this.availableModels.forEach(m => {
            const div = document.createElement('div');
            div.className = 'model-option';
            div.innerHTML = `<span>${m.name}</span> <i class="fa-solid fa-car"></i>`;
            div.onclick = () => {
                document.querySelectorAll('.model-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                div.dataset.file = m.file;
            };
            modelList.appendChild(div);
        });

        // Color Picker neu bauen
        const colors = ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ff9f0a', '#ffffff', '#e0e0e0'];
        const colorRow = document.getElementById('color-picker-row');
        colorRow.innerHTML = '';
        colors.forEach(c => {
            const circle = document.createElement('div');
            circle.className = 'color-swatch';
            circle.style.background = c;
            circle.onclick = () => {
                document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
                circle.classList.add('selected');
                colorInp.value = c;
            };
            colorRow.appendChild(circle);
        });

        if(index > -1) {
            // Bearbeiten: Daten füllen
            const car = this.cars[index];
            nameInp.value = car.name;
            hpInp.value = car.hp;
            weightInp.value = car.weight;
            engineInp.value = car.engine;
            colorInp.value = car.color;
            delBtn.style.display = 'block';
            
            // Auswahl visualisieren
            setTimeout(() => {
                const modOpt = Array.from(document.querySelectorAll('.model-option')).find(d => d.dataset.file === car.model);
                if(modOpt) modOpt.classList.add('selected');
                
                const colOpt = Array.from(document.querySelectorAll('.color-swatch')).find(d => d.style.background.includes(car.color) || d.style.background === car.color);
                if(colOpt) colOpt.classList.add('selected');
            }, 50);
        } else {
            // Neu: Alles leeren
            nameInp.value = ''; hpInp.value = ''; weightInp.value = ''; engineInp.value = '';
            colorInp.value = '#bf5af2';
            delBtn.style.display = 'none';
        }
    },

    saveCarEdit: function() {
        const name = document.getElementById('edit-car-name').value;
        const hp = document.getElementById('edit-car-hp').value;
        const weight = document.getElementById('edit-car-weight').value;
        const engine = document.getElementById('edit-car-engine').value;
        const color = document.getElementById('edit-car-color').value;
        
        const selectedModelDiv = document.querySelector('.model-option.selected');
        if(!name || !selectedModelDiv) {
            alert("Bitte Namen eingeben und Modell wählen!");
            return;
        }
        
        const newCar = {
            name, hp, weight, engine, color,
            model: selectedModelDiv.dataset.file,
            modelName: selectedModelDiv.querySelector('span').innerText
        };

        if(this.editingCarIndex > -1) {
            this.cars[this.editingCarIndex] = newCar;
        } else {
            this.cars.push(newCar);
        }

        this.saveCarsToStorage();
        this.closeEditor();
        this.renderCars();
    },

    deleteCurrentCar: function() {
        if(confirm("Auto wirklich löschen?")) {
            this.cars.splice(this.editingCarIndex, 1);
            this.saveCarsToStorage();
            this.closeEditor();
            this.renderCars();
        }
    },

    closeEditor: function() { document.getElementById('car-editor-overlay').classList.add('hidden'); },
    saveCarsToStorage: function() { localStorage.setItem('driverhub_cars', JSON.stringify(this.cars)); },

    // --- DRIVE HISTORY ---
    renderList: function() {
        const list = document.getElementById('garage-list');
        if(!list) return;
        list.innerHTML = '';
        
        this.drives.forEach((d, index) => {
            const card = document.createElement('div');
            card.className = 'drive-card';
            const dateStr = new Date(d.date).toLocaleDateString();
            
            card.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr}</h4>
                    <p>${d.time.toFixed(1)} min | Avg: ${d.avg.toFixed(1)} km/h</p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="dc-km">${d.dist.toFixed(2)} km</div>
                    <button class="btn-delete-drive" style="background:transparent; border:none; color:#666;"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            const delBtn = card.querySelector('.btn-delete-drive');
            delBtn.onclick = (e) => { e.stopPropagation(); this.deleteDrive(index); };
            card.onclick = (e) => { if(!e.target.closest('.btn-delete-drive')) this.openDetails(d); };
            list.appendChild(card);
        });
    },

    saveDrive: function(d) { this.drives.unshift(d); this.saveDrivesToStorage(); this.renderList(); },
    deleteDrive: function(i) { if(confirm("Löschen?")) { this.drives.splice(i, 1); this.saveDrivesToStorage(); this.renderList(); } },
    saveDrivesToStorage: function() { localStorage.setItem('driverhub_drives', JSON.stringify(this.drives)); },
    showHistory: function() { document.getElementById('garage-list').scrollIntoView({ behavior: 'smooth' }); },
    
    // Details (Overlay)
    openDetails: function(drive) {
        document.getElementById('detail-overlay').classList.remove('hidden');
        document.getElementById('det-date').innerText = new Date(drive.date).toLocaleString();
        document.getElementById('det-dist').innerText = drive.dist.toFixed(2) + ' km';
        document.getElementById('det-time').innerText = drive.time.toFixed(1) + ' min';
        
        // Map Logik
        setTimeout(() => {
            if(!window.detailMap) {
                window.detailMap = L.map('detail-map').setView([50, 10], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '' }).addTo(window.detailMap);
            }
            window.detailMap.eachLayer(l => { if (l instanceof L.Polyline || l instanceof L.Marker) window.detailMap.removeLayer(l); });
            if(drive.path && drive.path.length > 0) {
                const latlngs = drive.path.map(p => [p.lat, p.lng]);
                const poly = L.polyline(latlngs, {color: '#bf5af2', weight: 4}).addTo(window.detailMap);
                window.detailMap.fitBounds(poly.getBounds());
            }
        }, 200);
    },
    closeDetails: function() { document.getElementById('detail-overlay').classList.add('hidden'); }
};
