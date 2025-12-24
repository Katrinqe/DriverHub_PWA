/* GARAGE.JS - FINAL VERSION */

// Hilfsfunktion: Lädt Daten sicher, ohne Absturz
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
        
        // Sauber machen (auch den grünen Test-Rahmen entfernen falls noch da)
        container.innerHTML = '';
        container.style.border = 'none'; 

        // Autos rendern
        this.cars.forEach((car, index) => {
            const slide = document.createElement('div');
            slide.className = 'car-slide interactive-element';
            const col = car.color || '#bf5af2';
            
            slide.style.setProperty('--theme-color', col);
            slide.style.setProperty('--theme-glow', col + '40');

            slide.innerHTML = `
                <h1 id="car-name" style="text-shadow: 0 0 15px ${col}80">${car.name}</h1>
                <div id="car-model-wrapper" style="pointer-events: none;"> 
                    <model-viewer src="${car.model}" auto-rotate camera-orbit="45deg 75deg 105%" style="width: 100%; height: 100%;" disable-zoom shadow-intensity="1"></model-viewer>
                </div>
                <div class="car-specs-grid">
                    <div class="spec-item"><span class="lbl">ENGINE</span><span class="val">${car.engine}</span></div>
                    <div class="spec-item"><span class="lbl">POWER</span><span class="val">${car.hp} <small>PS</small></span></div>
                    <div class="spec-item"><span class="lbl">WEIGHT</span><span class="val">${car.weight} <small>KG</small></span></div>
                    <div class="spec-item"><span class="lbl">0-100</span><span class="val">--- <small>S</small></span></div>
                </div>
                <div class="best-track-display" style="border-color:${col}40; background:${col}10">
                    <i class="fa-solid fa-trophy" style="color:#ffd700;"></i> <span>No Records</span>
                </div>
                <div style="position:absolute; bottom:10px; font-size:0.6rem; color:#666;">Hold to Edit</div>
            `;
            
            // Long Press
            let pressTimer;
            const start = () => { pressTimer = setTimeout(() => this.openEditor(index), 800); };
            const end = () => clearTimeout(pressTimer);
            slide.addEventListener('touchstart', start); slide.addEventListener('touchend', end);
            slide.addEventListener('mousedown', start); slide.addEventListener('mouseup', end);
            
            container.appendChild(slide);
        });

        // Add Button
        const addCard = document.createElement('div');
        // WICHTIG: "interactive-element" hinzufügen, sonst ist der Button taub!
        addCard.className = 'car-slide add-new-card interactive-element';
        addCard.innerHTML = `<i class="fa-solid fa-plus add-new-icon"></i><h3>ADD CAR</h3>`;
        addCard.onclick = () => this.openEditor(-1);
        
        container.appendChild(addCard);
    },

    // 2. EDITOR ÖFFNEN
    openEditor: function(index) {
        this.editingCarIndex = index;
        
        // ELEMENT HOLEN
        const overlay = document.getElementById('car-editor-overlay');
        if (!overlay) return;

        // WICHTIG: Modelle laden, BEVOR wir anzeigen!
        const modelList = document.getElementById('model-selector');
        modelList.innerHTML = ''; // Erst leeren
        
        this.availableModels.forEach(m => {
            const div = document.createElement('div');
            div.className = 'model-option';
            // Kleines Styling direkt hier, falls CSS fehlt
            div.style.padding = "10px";
            div.style.border = "1px solid #444";
            div.style.borderRadius = "8px";
            div.style.cursor = "pointer";
            div.style.textAlign = "center";
            div.style.background = "#222";
            div.style.color = "#fff";
            
            div.innerHTML = `<span>${m.name}</span>`;
            
            div.onclick = () => {
                // Auswahllogik
                document.querySelectorAll('.model-option').forEach(e => {
                    e.style.borderColor = '#444';
                    e.style.color = '#fff';
                    e.classList.remove('selected');
                });
                div.classList.add('selected');
                div.style.borderColor = '#007aff'; // Blaues Highlight
                div.style.color = '#007aff';
                div.dataset.file = m.file;
            };
            modelList.appendChild(div);
        });

        // Farben laden
        const colorRow = document.getElementById('color-picker-row');
        colorRow.innerHTML = '';
        ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ff9f0a', '#ffffff'].forEach(c => {
            const circle = document.createElement('div');
            circle.style.width = "30px";
            circle.style.height = "30px";
            circle.style.borderRadius = "50%";
            circle.style.background = c;
            circle.style.cursor = "pointer";
            circle.style.border = "2px solid transparent";
            
            circle.onclick = () => {
                document.querySelectorAll('.color-row div').forEach(e => e.style.transform = 'scale(1)');
                circle.style.transform = 'scale(1.2)';
                document.getElementById('edit-car-color').value = c;
            };
            colorRow.appendChild(circle);
        });

        // Felder füllen (wenn Bearbeiten) oder leeren (wenn Neu)
        if(index > -1) {
            const car = this.cars[index];
            document.getElementById('edit-car-name').value = car.name;
            document.getElementById('edit-car-hp').value = car.hp;
            document.getElementById('edit-car-weight').value = car.weight;
            document.getElementById('edit-car-engine').value = car.engine;
            document.getElementById('edit-car-color').value = car.color;
            document.getElementById('btn-delete-car').style.display = 'block';
        } else {
            // Alles leeren für neues Auto
            document.getElementById('edit-car-name').value = '';
            document.getElementById('edit-car-hp').value = '';
            document.getElementById('edit-car-weight').value = '';
            document.getElementById('edit-car-engine').value = '';
            document.getElementById('edit-car-color').value = '#bf5af2';
            document.getElementById('btn-delete-car').style.display = 'none';
        }

        // ENDLICH ANZEIGEN:
        overlay.style.display = 'flex'; 
    },

    saveCarEdit: function() {
        const name = document.getElementById('edit-car-name').value;
        const hp = document.getElementById('edit-car-hp').value;
        const weight = document.getElementById('edit-car-weight').value;
        const engine = document.getElementById('edit-car-engine').value;
        const color = document.getElementById('edit-car-color').value;
        const modEl = document.querySelector('.model-option.selected');

        if(!name || !modEl) { alert("Name & Model missing!"); return; }

        const newCar = {
            name, hp, weight, engine, color,
            model: modEl.dataset.file
        };

        if(this.editingCarIndex > -1) this.cars[this.editingCarIndex] = newCar;
        else this.cars.push(newCar);

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

    // SCHLIESSEN
    closeEditor: function() { 
        const overlay = document.getElementById('car-editor-overlay');
        if(overlay) {
            overlay.style.display = 'none'; // Verstecken
        }
    },
    saveCarsToStorage: function() { localStorage.setItem('driverhub_cars', JSON.stringify(this.cars)); },

    // 3. LISTE & HISTORY
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
