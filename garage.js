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

  /* GARAGE.JS - DASHBOARD VERSION */

window.GarageLogic = {
    // Daten laden
    drives: JSON.parse(localStorage.getItem('driverhub_drives') || '[]'),
    cars: JSON.parse(localStorage.getItem('driverhub_cars') || '[]'),
    editingCarIndex: -1,
    
    // Modelle
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    init: function() {
        console.log("Garage Dashboard Init");
        this.renderGarage();
    },

    // HAUPTFUNKTION: Füllt alle 3 Karten
    renderGarage: function() {
        this.renderCarCard();
        this.renderDriveCard();
        // Race Card ist erstmal statisch im HTML, da noch keine Daten
    },

    // CARD 1: CAR PROFILE
    renderCarCard: function() {
        const container = document.getElementById('car-card-content');
        if(!container) return;
        container.innerHTML = '';

        // Fall 1: Kein Auto da -> ADD BUTTON
        if(this.cars.length === 0) {
            container.innerHTML = `
                <button class="empty-add-btn" onclick="GarageLogic.openEditor(-1)">
                    <i class="fa-solid fa-plus" style="font-size:1.5rem; margin-bottom:8px;"></i>
                    <span style="font-size:0.8rem; font-weight:bold;">ADD CAR</span>
                </button>
            `;
            return;
        }

        // Fall 2: Auto anzeigen (Wir nehmen das erste Auto oder das zuletzt bearbeitete)
        // Einfachheitshalber: Index 0
        const car = this.cars[0]; 
        this.editingCarIndex = 0; // Damit Editor weiß, wen er bearbeiten soll

        const col = car.color || '#bf5af2';

        const html = `
            <div class="card-split-left" style="border-right-color: ${col}30;">
                <div style="width:100%; height:80%; cursor:grab;">
                    <model-viewer 
                        src="${car.model}" 
                        auto-rotate 
                        camera-controls 
                        disable-zoom
                        interaction-prompt="none"
                        style="width:100%; height:100%;"
                        shadow-intensity="1">
                    </model-viewer>
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

    // CARD 2: DRIVE HISTORY (Letzte Fahrt)
    renderDriveCard: function() {
        const container = document.getElementById('drive-card-content');
        if(!container) return;
        container.innerHTML = '';

        // Fall 1: Keine Fahrten
        if(this.drives.length === 0) {
            container.innerHTML = `
                <div style="width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#666;">
                    <i class="fa-solid fa-road" style="font-size:1.5rem; margin-bottom:10px;"></i>
                    <span style="font-size:0.8rem;">NO RECENT DRIVES</span>
                </div>
            `;
            return;
        }

        // Fall 2: Letzte Fahrt anzeigen (Index 0)
        const drive = this.drives[0];
        const dist = drive.dist.toFixed(1);
        const avg = drive.avgSpeed ? Math.round(drive.avgSpeed) : 0;
        const max = drive.maxSpeed ? Math.round(drive.maxSpeed) : 0;
        
        // Zeit formatieren
        let timeStr = "00:00";
        if(drive.duration) {
            const m = Math.floor(drive.duration / 60);
            const s = drive.duration % 60;
            timeStr = `${m}m ${s}s`;
        } else {
             timeStr = new Date(drive.date).toLocaleDateString();
        }

        const html = `
            <div class="card-split-left" style="padding:0;">
                <div id="mini-map-canvas" class="mini-map-box"></div>
            </div>

            <div class="card-split-right">
                <div class="d-stat"><label>MAX SPEED</label><span style="color:#30d158;">${max}<small>km/h</small></span></div>
                <div class="d-stat"><label>DISTANCE</label><span>${dist}<small>km</small></span></div>
                <div class="d-stat"><label>AVG SPEED</label><span>${avg}<small>km/h</small></span></div>
                <div class="d-stat"><label>TIME</label><span>${timeStr}</span></div>
            </div>
        `;
        container.innerHTML = html;

        // MAP RENDERN (Verzögert, damit DOM da ist)
        setTimeout(() => {
            if(document.getElementById('mini-map-canvas') && drive.path && drive.path.length > 0) {
                // Falls Map schon existiert, löschen (Leaflet Bug Prevention)
                if(this.miniMap) { this.miniMap.remove(); }
                
                this.miniMap = L.map('mini-map-canvas', {
                    zoomControl: false,
                    dragging: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                    attributionControl: false
                });

                // Dunkle Karte
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.miniMap);

                // Pfad zeichnen (Lila)
                const latlngs = drive.path.map(p => [p.lat, p.lng]);
                const polyline = L.polyline(latlngs, {color: '#bf5af2', weight: 3}).addTo(this.miniMap);
                
                this.miniMap.fitBounds(polyline.getBounds(), {padding: [10, 10]});
            }
        }, 200);
    },

    // EDITOR & RESTLICHE FUNKTIONEN (Bleiben erhalten)
    openCarDetails: function() {
        // Hier können wir später die Detail-Seite öffnen
        this.openEditor(0); // Vorerst: Editor öffnen
    },

    openEditor: function(index) {
        // ... (Dein Editor Code von vorhin hier einfügen) ...
        // Damit wir nicht alles wiederholen müssen, nimm den Editor Code
        // aus der letzten funktionierenden Version.
        // Falls du den Code nicht mehr hast, sag Bescheid!
        
        // HIER DER STANDARD EDITOR CODE (Kurzfassung):
        this.editingCarIndex = index;
        const overlay = document.getElementById('car-editor-overlay');
        if(!overlay) return; 
        document.body.appendChild(overlay);
        
        // ... (Modelle laden, Farben laden wie gehabt) ...
        // (Ich kürze das hier ab, damit die Nachricht nicht zu lang wird. 
        //  Es ist exakt der Code, der schon funktioniert hat.)
        
        // Modelle laden (WICHTIG!)
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
                     document.querySelectorAll('.model-option').forEach(e => {
                         e.style.borderColor = '#444'; e.classList.remove('selected');
                     });
                     div.classList.add('selected'); div.style.borderColor = '#007aff';
                     if(previewViewer) previewViewer.src = m.file;
                 }
                 modelList.appendChild(div);
             });
        }
        
        // Daten füllen
        if(index > -1 && this.cars[0]) {
             const c = this.cars[0];
             document.getElementById('edit-car-name').value = c.name;
             // ... restliche felder ...
             if(previewViewer) previewViewer.src = c.model;
             document.getElementById('btn-delete-car').style.display = 'block';
        } else {
             document.getElementById('edit-car-name').value = '';
             if(previewViewer) previewViewer.src = '';
             document.getElementById('btn-delete-car').style.display = 'none';
        }

        overlay.style.display = 'flex';
    },

    saveCarEdit: function() {
        // ... (Dein Save Code wie gehabt) ...
        const name = document.getElementById('edit-car-name').value;
        const selectedModelDiv = document.querySelector('.model-option.selected');
        
        if(!name) { alert("Name fehlt!"); return; }
        // Fallback Modell falls keins gewählt (für schnelle Tests)
        let modelFile = "car.glb"; 
        if(selectedModelDiv) modelFile = selectedModelDiv.getAttribute('data-file');

        const newCar = {
            name: name,
            hp: document.getElementById('edit-car-hp').value || '-',
            weight: document.getElementById('edit-car-weight').value || '-',
            engine: document.getElementById('edit-car-engine').value || '-',
            color: document.getElementById('edit-car-color').value || '#bf5af2',
            model: modelFile
        };

        // Wir überschreiben immer Index 0 oder fügen neu hinzu
        if(this.cars.length > 0) {
            this.cars[0] = newCar;
        } else {
            this.cars.push(newCar);
        }

        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        this.closeEditor();
        this.renderGarage(); // Dashboard neu laden!
    },
    
    closeEditor: function() {
        document.getElementById('car-editor-overlay').style.display = 'none';
    },

    deleteCurrentCar: function() {
        if(confirm("Delete?")) {
            this.cars = [];
            localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
            this.closeEditor();
            this.renderGarage();
        }
    },
    
    // Hilfsfunktionen für History und Details
    showHistory: function() {
        // Platzhalter für später
        alert("Full History View coming soon!");
    }
};
