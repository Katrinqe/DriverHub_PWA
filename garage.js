/* GARAGE.JS - COMPLETE VERSION 
  Includes: Car Management (Slider), Editor, Drive History, LocalStorage
*/

const GarageLogic = {
    // --- DATEN SPEICHER ---
    // Lädt Fahrten und Autos aus dem Speicher oder startet leer
    drives: JSON.parse(localStorage.getItem('driverhub_drives')) || [],
    cars: JSON.parse(localStorage.getItem('driverhub_cars')) || [],
    
    // Status-Variable: Welches Auto wird gerade bearbeitet? (-1 = Neues erstellen)
    editingCarIndex: -1,
    
    // HIER DEINE 3D DATEIEN EINTRAGEN
    // Achte darauf, dass die Dateien wirklich so heißen und im Ordner liegen!
    availableModels: [
        { name: "Nissan Skyline R34", file: "r34.glb" }, 
        { name: "Porsche 911 GT3", file: "porsche.glb" },
        { name: "Ford Mustang", file: "mustang.glb" }
    ],

    // --- STARTUP ---
    init: function() {
        console.log("Garage initializing...");
        this.renderCars();
        this.renderList();
    },

    // ============================================================
    // TEIL 1: CAR MANAGEMENT (SWIPER & EDITOR)
    // ============================================================

    renderCars: function() {
        const container = document.getElementById('garage-swiper-container');
        if(!container) return; // Sicherheits-Check
        container.innerHTML = '';

        // 1. Alle gespeicherten Autos als Karten rendern
        this.cars.forEach((car, index) => {
            const slide = document.createElement('div');
            slide.className = 'car-slide interactive-element';
            
            // CSS Variablen für dynamische Farben setzen
            slide.style.setProperty('--theme-color', car.color);
            slide.style.setProperty('--theme-glow', car.color + '40'); // 40 hex = ca 25% Transparenz

            slide.innerHTML = `
                <h1 id="car-name" style="text-shadow: 0 0 15px ${car.color}80">${car.name}</h1>
                
                <div id="car-model-wrapper" style="pointer-events: none;"> 
                    <model-viewer 
                        src="${car.model}" 
                        auto-rotate 
                        camera-orbit="45deg 75deg 105%"
                        style="width: 100%; height: 100%;"
                        disable-zoom 
                        shadow-intensity="1"
                    ></model-viewer>
                </div>

                <div class="car-specs-grid">
                    <div class="spec-item"><span class="lbl">ENGINE</span><span class="val">${car.engine}</span></div>
                    <div class="spec-item"><span class="lbl">POWER</span><span class="val">${car.hp} <small>PS</small></span></div>
                    <div class="spec-item"><span class="lbl">WEIGHT</span><span class="val">${car.weight} <small>KG</small></span></div>
                    <div class="spec-item"><span class="lbl">0-100</span><span class="val">--- <small>S</small></span></div>
                </div>

                <div class="best-track-display" style="border-color:${car.color}40; background:${car.color}10">
                    <i class="fa-solid fa-trophy" style="color:#ffd700;"></i> 
                    <span>No Track Records yet</span>
                </div>
                
                <div style="position:absolute; bottom:10px; font-size:0.6rem; color:#666; text-transform:uppercase; letter-spacing:1px;">Hold to Edit</div>
            `;

            // --- LOGIK FÜR GEDRÜCKT HALTEN (Long Press) ---
            let pressTimer;
            
            // Touch (Handy)
            slide.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => this.openEditor(index), 800); // Nach 0.8s öffnen
            });
            slide.addEventListener('touchend', () => clearTimeout(pressTimer));
            
            // Maus (PC)
            slide.addEventListener('mousedown', () => {
                pressTimer = setTimeout(() => this.openEditor(index), 800);
            });
            slide.addEventListener('mouseup', () => clearTimeout(pressTimer));

            container.appendChild(slide);
        });

        // 2. Die "Add New" Karte am Ende
        const addCard = document.createElement('div');
        addCard.className = 'car-slide add-new-card';
        addCard.innerHTML = `
            <i class="fa-solid fa-plus add-new-icon"></i>
            <h3>ADD YOUR CAR</h3>
            <p style="color:#666; font-size:0.8rem;">Tap to create profile</p>
        `;
        addCard.onclick = () => this.openEditor(-1); // -1 signalisiert: NEUES Auto
        container.appendChild(addCard);
    },

    openEditor: function(index) {
        this.editingCarIndex = index;
        const overlay = document.getElementById('car-editor-overlay');
        overlay.classList.remove('hidden');
        
        // Elemente holen
        const nameInp = document.getElementById('edit-car-name');
        const hpInp = document.getElementById('edit-car-hp');
        const weightInp = document.getElementById('edit-car-weight');
        const engineInp = document.getElementById('edit-car-engine');
        const colorInp = document.getElementById('edit-car-color');
        const delBtn = document.getElementById('btn-delete-car');

        // Modell-Liste aufbauen
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

        // Farb-Palette aufbauen
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

        // Füllen oder Leeren
        if(index > -1) {
            // BEARBEITEN
            const car = this.cars[index];
            nameInp.value = car.name;
            hpInp.value = car.hp;
            weightInp.value = car.weight;
            engineInp.value = car.engine;
            colorInp.value = car.color;
            delBtn.style.display = 'block'; // Löschen erlauben
            
            // Vorauswahl (kleine Verzögerung für DOM rendering)
            setTimeout(() => {
                // Modell markieren
                const modOpt = Array.from(document.querySelectorAll('.model-option')).find(d => d.dataset.file === car.model);
                if(modOpt) modOpt.classList.add('selected');
                
                // Farbe markieren
                const colOpt = Array.from(document.querySelectorAll('.color-swatch')).find(d => d.style.background.includes(car.color) || d.style.background === car.color);
                if(colOpt) colOpt.classList.add('selected');
            }, 50);

        } else {
            // NEU ERSTELLEN
            nameInp.value = '';
            hpInp.value = '';
            weightInp.value = '';
            engineInp.value = '';
            colorInp.value = '#bf5af2'; // Standard Lila
            delBtn.style.display = 'none'; // Löschen nicht möglich bei neuem
        }
    },

    saveCarEdit: function() {
        // Daten auslesen
        const name = document.getElementById('edit-car-name').value;
        const hp = document.getElementById('edit-car-hp').value;
        const weight = document.getElementById('edit-car-weight').value;
        const engine = document.getElementById('edit-car-engine').value;
        const color = document.getElementById('edit-car-color').value;
        
        // Validierung
        const selectedModelDiv = document.querySelector('.model-option.selected');
        if(!name || !selectedModelDiv) {
            alert("Please provide a Name and select a Model!");
            return;
        }
        
        const modelFile = selectedModelDiv.dataset.file;
        const modelName = selectedModelDiv.querySelector('span').innerText; // Nur zur Info

        // Objekt bauen
        const newCar = {
            name, hp, weight, engine, color,
            model: modelFile,
            modelName: modelName // Speichern wir optional mit
        };

        // Speichern
        if(this.editingCarIndex > -1) {
            this.cars[this.editingCarIndex] = newCar; // Update
        } else {
            this.cars.push(newCar); // Neu
        }

        this.saveCarsToStorage();
        this.closeEditor();
        this.renderCars(); // Slider neu aufbauen
    },

    deleteCurrentCar: function() {
        if(confirm("Really delete this car from your garage?")) {
            this.cars.splice(this.editingCarIndex, 1);
            this.saveCarsToStorage();
            this.closeEditor();
            this.renderCars();
        }
    },

    closeEditor: function() {
        document.getElementById('car-editor-overlay').classList.add('hidden');
    },

    saveCarsToStorage: function() {
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
    },

    // ============================================================
    // TEIL 2: DRIVE HISTORY (LISTE UNTEN)
    // ============================================================

    renderList: function() {
        const list = document.getElementById('garage-list');
        if(!list) return;
        list.innerHTML = '';
        
        let totalKm = 0;
        let maxSpeed = 0;
        let totalTimeMin = 0;

        // Wir iterieren durch alle gespeicherten Fahrten
        this.drives.forEach((d, index) => {
            totalKm += d.dist;
            if(d.max > maxSpeed) maxSpeed = d.max;
            totalTimeMin += d.time;

            const card = document.createElement('div');
            card.className = 'drive-card';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString().slice(0,5);

            // HTML für eine Fahrt in der Liste
            card.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr} <small style="color:#888;">${timeStr}</small></h4>
                    <p>${d.time.toFixed(1)} min | Avg: ${d.avg.toFixed(1)} km/h</p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="dc-km">${d.dist.toFixed(2)} km</div>
                    <button class="btn-delete-drive" style="background:transparent; border:none; color:#666;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Klick auf Karte öffnet Details
            card.onclick = (e) => {
                // Verhindern, dass der Löschen-Button das Event auslöst
                if(!e.target.closest('.btn-delete-drive')) this.openDetails(d);
            };
            
            // Löschen Button Logik
            const delBtn = card.querySelector('.btn-delete-drive');
            delBtn.onclick = (e) => {
                e.stopPropagation(); // Klick nicht an Karte weitergeben
                this.deleteDrive(index);
            };

            list.appendChild(card);
        });

        // Global Stats (optional, falls wir sie anzeigen wollen)
        // Hier updaten wir die versteckten Felder falls nötig
        const elKm = document.getElementById('total-km');
        if(elKm) elKm.innerText = totalKm.toFixed(1);
    },

    saveDrive: function(driveData) {
        // Wird von navi.js aufgerufen nach der Fahrt
        this.drives.unshift(driveData); // Neue Fahrt oben hin
        this.saveDrivesToStorage();
        this.renderList();
    },

    deleteDrive: function(index) {
        if(confirm("Delete this drive record?")) {
            this.drives.splice(index, 1);
            this.saveDrivesToStorage();
            this.renderList();
        }
    },
    
    saveDrivesToStorage: function() {
        localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
    },

    // ============================================================
    // TEIL 3: DETAILS & NAVIGATION
    // ============================================================

    showHistory: function() {
        // Scrollt zur Liste runter
        const list = document.getElementById('garage-list');
        list.scrollIntoView({ behavior: 'smooth' });
    },

    openDetails: function(drive) {
        // Overlay anzeigen
        const overlay = document.getElementById('detail-overlay');
        overlay.classList.remove('hidden');

        // Daten füllen
        document.getElementById('det-date').innerText = new Date(drive.date).toLocaleString();
        document.getElementById('det-dist').innerText = drive.dist.toFixed(2) + ' km';
        document.getElementById('det-time').innerText = drive.time.toFixed(1) + ' min';
        document.getElementById('det-avg').innerText = drive.avg.toFixed(1);
        document.getElementById('det-max').innerText = drive.max.toFixed(1);

        // Map zeichnen (verzögert damit Container sichtbar ist)
        setTimeout(() => {
            if(!window.detailMap) {
                window.detailMap = L.map('detail-map').setView([50, 10], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 19
                }).addTo(window.detailMap);
            }
            
            // Alte Layer entfernen
            window.detailMap.eachLayer((layer) => {
                if (layer instanceof L.Polyline || layer instanceof L.Marker) {
                    window.detailMap.removeLayer(layer);
                }
            });

            if(drive.path && drive.path.length > 0) {
                const latlngs = drive.path.map(p => [p.lat, p.lng]);
                const polyline = L.polyline(latlngs, {color: '#bf5af2', weight: 4}).addTo(window.detailMap);
                window.detailMap.fitBounds(polyline.getBounds());
            }
        }, 200);
        
        // Chart zeichnen (Placeholder Logic)
        this.renderChart(drive);
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    },

    renderChart: function(drive) {
        // Chart.js Logik hier (vereinfacht)
        const ctx = document.getElementById('speedChart').getContext('2d');
        
        // Falls alter Chart existiert, zerstören
        if(window.mySpeedChart) window.mySpeedChart.destroy();

        // Daten vorbereiten (Speed über Zeit)
        // Wir nehmen an drive.path hat speed daten, sonst 0
        const labels = drive.path ? drive.path.map((_, i) => i) : [];
        const data = drive.path ? drive.path.map(p => p.speed || 0) : [];

        window.mySpeedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speed (km/h)',
                    data: data,
                    borderColor: '#bf5af2',
                    backgroundColor: 'rgba(191, 90, 242, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: false },
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.1)' } 
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
};

// Auto-Init entfernen wir hier, damit wir es in main.js kontrolliert aufrufen können,
// ODER du fügst am Ende deiner index.html hinzu: 
// <script>GarageLogic.init();</script>
