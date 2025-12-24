/* GARAGE.JS - FINAL FIXED VERSION */

// Hilfsfunktion: Lädt Daten sicher
function safeLoad(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item || item === "undefined" || item === "null") return [];
        return JSON.parse(item);
    } catch (e) {
        console.warn("Daten Fehler bei:", key);
        return [];
    }
}

// DAS HAUPT-OBJEKT
window.GarageLogic = {
    // Daten laden
    drives: safeLoad('driverhub_drives'),
    cars: safeLoad('driverhub_cars'),
    editingCarIndex: -1,
    
    // Modelle
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // Start-Funktion
    init: function() {
        console.log("Garage startet... Autos:", this.cars.length);
        this.renderCars();
        this.renderList();
    },

    // 1. SWIPER AUFBAUEN
    renderCars: function() {
        const container = document.getElementById('garage-swiper-container');
        if(!container) return;
        
        container.innerHTML = '';
        container.style.border = 'none'; 

        // AUTOS RENDERN
        this.cars.forEach((car, index) => {
            const slide = document.createElement('div');
            slide.className = 'car-slide interactive-element';
            
            const col = car.color || '#bf5af2';
            
            slide.style.setProperty('--theme-color', col);
            slide.style.setProperty('--theme-glow', col);

            slide.innerHTML = `
                <h1 style="font-style:italic; font-size:2.5rem; margin-bottom:0; text-shadow: 0 0 15px ${col}80">${car.name}</h1>
                
                <div id="car-model-wrapper" style="position:relative; width:100%; height:45vh; display:flex; align-items:center; justify-content:center;">
                    <div class="car-aura-bg"></div>
                    
                    <model-viewer 
                        src="${car.model}" 
                        camera-controls 
                        auto-rotate 
                        camera-orbit="45deg 75deg 105%" 
                        style="width: 100%; height: 100%; z-index:5;" 
                        shadow-intensity="1"
                        disable-zoom> </model-viewer>
                </div>

                <div class="car-specs-grid" style="z-index:10; background:rgba(0,0,0,0.5); backdrop-filter:blur(5px); border-radius:20px; padding:15px; margin-top:-20px; border:1px solid ${col}40;">
                    <div class="spec-item"><span class="lbl">ENGINE</span><span class="val" style="color:white;">${car.engine}</span></div>
                    <div class="spec-item"><span class="lbl">POWER</span><span class="val" style="color:${col};">${car.hp} <small>PS</small></span></div>
                    <div class="spec-item"><span class="lbl">WEIGHT</span><span class="val" style="color:white;">${car.weight} <small>KG</small></span></div>
                    <div class="spec-item"><span class="lbl">0-100</span><span class="val">--- <small>S</small></span></div>
                </div>

                <div class="best-track-display" style="border-color:${col}40; background:${col}10; margin-top:20px;">
                    <i class="fa-solid fa-trophy" style="color:#ffd700;"></i> <span>No Records</span>
                </div>
            `;
            
            // Long Press Logik
            let pressTimer;
            const start = () => { pressTimer = setTimeout(() => this.openEditor(index), 800); };
            const end = () => clearTimeout(pressTimer);
            
            const triggers = slide.querySelectorAll('h1, .car-specs-grid, .best-track-display');
            triggers.forEach(t => {
                t.addEventListener('touchstart', start); 
                t.addEventListener('touchend', end);
                t.addEventListener('mousedown', start); 
                t.addEventListener('mouseup', end);
            });
            
            container.appendChild(slide);
        });

        // ADD BUTTON (Hier war der Fehler - jetzt bereinigt!)
        const addCard = document.createElement('div');
        addCard.className = 'car-slide add-new-card interactive-element';
        addCard.style.scrollSnapAlign = 'center'; 
        addCard.innerHTML = `
            <div style="border: 2px dashed #333; border-radius: 20px; width: 80%; height: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111;">
                <i class="fa-solid fa-plus" style="font-size: 3rem; color: #333; margin-bottom: 20px;"></i>
                <h3 style="color: white;">ADD CAR</h3>
            </div>
        `;
        addCard.onclick = () => this.openEditor(-1);
        container.appendChild(addCard);
    },

    // 2. EDITOR ÖFFNEN
    openEditor: function(index) {
        this.editingCarIndex = index;
        
        let overlay = document.getElementById('car-editor-overlay');
        if(!overlay) { 
            console.error("Overlay fehlt!"); 
            return; 
        }
        
        document.body.appendChild(overlay);

        const previewViewer = document.getElementById('editor-preview-viewer');
        const modelList = document.getElementById('model-selector');
        
        if(modelList) {
            modelList.innerHTML = '';
            this.availableModels.forEach(m => {
                const div = document.createElement('div');
                div.className = 'model-option'; 
                div.innerHTML = `<span>${m.name}</span>`;
                div.style.cssText = "padding:10px; border:1px solid #444; margin:2px; color:#888; cursor:pointer; background:#222; border-radius:8px; text-align:center;";
                div.setAttribute('data-file', m.file); 

                div.onclick = () => {
                    document.querySelectorAll('.model-option').forEach(e => {
                        e.style.borderColor = '#444';
                        e.style.color = '#888';
                        e.style.background = '#222';
                        e.classList.remove('selected');
                    });
                    div.classList.add('selected');
                    div.style.borderColor = '#007aff';
                    div.style.color = 'white';
                    div.style.background = 'rgba(0, 122, 255, 0.2)';
                    if(previewViewer) previewViewer.src = m.file;
                };
                modelList.appendChild(div);
            });
        }

        const colorRow = document.getElementById('color-picker-row');
        if(colorRow) {
            colorRow.innerHTML = '';
            ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ff9f0a', '#ffffff'].forEach(c => {
                const circle = document.createElement('div');
                circle.className = 'color-swatch';
                circle.style.cssText = `width:35px; height:35px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid transparent; transition:transform 0.2s;`;
                circle.onclick = () => {
                    Array.from(colorRow.children).forEach(k => { k.style.transform = 'scale(1)'; k.style.borderColor = 'transparent'; });
                    circle.style.transform = 'scale(1.2)';
                    circle.style.borderColor = 'white';
                    document.getElementById('edit-car-color').value = c;
                };
                colorRow.appendChild(circle);
            });
        }

        if(index > -1 && this.cars[index]) {
            const car = this.cars[index];
            if(document.getElementById('edit-car-name')) document.getElementById('edit-car-name').value = car.name;
            if(document.getElementById('edit-car-hp')) document.getElementById('edit-car-hp').value = car.hp;
            if(document.getElementById('edit-car-weight')) document.getElementById('edit-car-weight').value = car.weight;
            if(document.getElementById('edit-car-engine')) document.getElementById('edit-car-engine').value = car.engine;
            if(document.getElementById('edit-car-color')) document.getElementById('edit-car-color').value = car.color;
            
            if(previewViewer) previewViewer.src = car.model;

            setTimeout(() => {
                const opt = document.querySelector(`.model-option[data-file="${car.model}"]`);
                if(opt) opt.click();
                
                const colorInp = document.getElementById('edit-car-color').value;
                const colDivs = colorRow ? Array.from(colorRow.children) : [];
                const match = colDivs.find(d => d.style.background.includes(colorInp)); 
                if(match) match.click();
            }, 50);

            if(document.getElementById('btn-delete-car')) document.getElementById('btn-delete-car').style.display = 'block';
        } else {
            if(document.getElementById('edit-car-name')) document.getElementById('edit-car-name').value = '';
            if(document.getElementById('edit-car-hp')) document.getElementById('edit-car-hp').value = '';
            if(document.getElementById('edit-car-weight')) document.getElementById('edit-car-weight').value = '';
            if(document.getElementById('edit-car-engine')) document.getElementById('edit-car-engine').value = '';
            if(document.getElementById('edit-car-color')) document.getElementById('edit-car-color').value = '#bf5af2';
            if(previewViewer) previewViewer.src = ''; 
            if(document.getElementById('btn-delete-car')) document.getElementById('btn-delete-car').style.display = 'none';
        }

        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
    },

    // SPEICHERN
    saveCarEdit: function() {
        const name = document.getElementById('edit-car-name').value;
        const hp = document.getElementById('edit-car-hp').value || '-';
        const weight = document.getElementById('edit-car-weight').value || '-';
        const engine = document.getElementById('edit-car-engine').value || '-';
        const color = document.getElementById('edit-car-color').value || '#bf5af2';
        
        const selectedModelDiv = document.querySelector('.model-option.selected');
        
        if(!name) { alert("Bitte gib einen Namen ein!"); return; }
        if(!selectedModelDiv) { alert("Bitte wähle ein Automodell aus (antippen)!"); return; }
        
        const modelFile = selectedModelDiv.getAttribute('data-file');

        const newCar = {
            name: name,
            hp: hp,
            weight: weight,
            engine: engine,
            color: color,
            model: modelFile
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
        if(confirm("Delete?")) {
            this.cars.splice(this.editingCarIndex, 1);
            this.saveCarsToStorage();
            this.closeEditor();
            this.renderCars();
        }
    },

    closeEditor: function() { 
        const overlay = document.getElementById('car-editor-overlay');
        if(overlay) {
            overlay.style.display = 'none';
        }
    },
    
    saveCarsToStorage: function() { localStorage.setItem('driverhub_cars', JSON.stringify(this.cars)); },

    // LISTE & HISTORY
    renderList: function() {
        const list = document.getElementById('garage-list');
        if(!list) return;
        list.innerHTML = '';
        this.drives.forEach((d, index) => {
            const card = document.createElement('div');
            card.className = 'drive-card';
            card.innerHTML = `<div class="dc-info"><h4>${new Date(d.date).toLocaleDateString()}</h4><p>${d.dist.toFixed(1)} km</p></div>`;
            card.onclick = () => this.openDetails(d);
            list.appendChild(card);
        });
    },

    saveDrive: function(d) { this.drives.unshift(d); this.saveDrivesToStorage(); this.renderList(); },
    saveDrivesToStorage: function() { localStorage.setItem('driverhub_drives', JSON.stringify(this.drives)); },
    showHistory: function() { document.getElementById('garage-list').scrollIntoView({ behavior: 'smooth' }); },

    openDetails: function(drive) {
        document.getElementById('detail-overlay').classList.remove('hidden');
        document.getElementById('det-dist').innerText = drive.dist.toFixed(2) + ' km';
        setTimeout(() => {
            if(!window.detailMap) {
                window.detailMap = L.map('detail-map').setView([50,10],13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.detailMap);
            }
            window.detailMap.eachLayer(l => l instanceof L.Polyline && window.detailMap.removeLayer(l));
            if(drive.path) {
                const p = L.polyline(drive.path.map(x=>[x.lat,x.lng]), {color:'#bf5af2'}).addTo(window.detailMap);
                window.detailMap.fitBounds(p.getBounds());
            }
        }, 200);
    },
    closeDetails: function() { document.getElementById('detail-overlay').classList.add('hidden'); }
};
