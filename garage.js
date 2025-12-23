/* GARAGE.JS - FIXED & COMPLETE */

function safeLoad(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item || item === "undefined" || item === "null") return [];
        return JSON.parse(item);
    } catch (e) {
        console.warn("Resetting data for:", key);
        return [];
    }
}

const GarageLogic = {
    // Daten laden
    drives: safeLoad('driverhub_drives'),
    cars: safeLoad('driverhub_cars'),
    editingCarIndex: -1,
    
    // Modelle
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34 GTR", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    // Start
    init: function() {
        console.log("Garage gestartet!");
        this.renderCars();
        this.renderList();
    },

    // Swiper rendern
    renderCars: function() {
        const container = document.getElementById('garage-swiper-container');
        if(!container) return;
        container.innerHTML = '';

        this.cars.forEach((car, index) => {
            const slide = document.createElement('div');
            slide.className = 'car-slide interactive-element';
            const themeColor = car.color || '#bf5af2';
            
            slide.style.setProperty('--theme-color', themeColor);
            slide.style.setProperty('--theme-glow', themeColor + '40');

            slide.innerHTML = `
                <h1 id="car-name" style="text-shadow: 0 0 15px ${themeColor}80">${car.name || 'Car'}</h1>
                <div id="car-model-wrapper" style="pointer-events: none;"> 
                    <model-viewer src="${car.model}" auto-rotate camera-orbit="45deg 75deg 105%" style="width: 100%; height: 100%;" disable-zoom shadow-intensity="1"></model-viewer>
                </div>
                <div class="car-specs-grid">
                    <div class="spec-item"><span class="lbl">ENGINE</span><span class="val">${car.engine || '-'}</span></div>
                    <div class="spec-item"><span class="lbl">POWER</span><span class="val">${car.hp || '0'} <small>PS</small></span></div>
                    <div class="spec-item"><span class="lbl">WEIGHT</span><span class="val">${car.weight || '0'} <small>KG</small></span></div>
                    <div class="spec-item"><span class="lbl">0-100</span><span class="val">--- <small>S</small></span></div>
                </div>
                <div class="best-track-display" style="border-color:${themeColor}40; background:${themeColor}10">
                    <i class="fa-solid fa-trophy" style="color:#ffd700;"></i> <span>No Records</span>
                </div>
                <div style="position:absolute; bottom:10px; font-size:0.6rem; color:#666;">Hold to Edit</div>
            `;
            
            let pressTimer;
            const startPress = () => { pressTimer = setTimeout(() => this.openEditor(index), 800); };
            const endPress = () => clearTimeout(pressTimer);
            slide.addEventListener('touchstart', startPress);
            slide.addEventListener('touchend', endPress);
            slide.addEventListener('mousedown', startPress);
            slide.addEventListener('mouseup', endPress);
            
            container.appendChild(slide);
        });

        // Add Button
        const addCard = document.createElement('div');
        addCard.className = 'car-slide add-new-card';
        addCard.innerHTML = `<i class="fa-solid fa-plus add-new-icon"></i><h3>ADD CAR</h3>`;
        addCard.onclick = () => this.openEditor(-1);
        container.appendChild(addCard);
    },

    // Editor Öffnen
    openEditor: function(index) {
        this.editingCarIndex = index;
        document.getElementById('car-editor-overlay').classList.remove('hidden');
        
        const nameInp = document.getElementById('edit-car-name');
        const hpInp = document.getElementById('edit-car-hp');
        const weightInp = document.getElementById('edit-car-weight');
        const engineInp = document.getElementById('edit-car-engine');
        const colorInp = document.getElementById('edit-car-color');
        const delBtn = document.getElementById('btn-delete-car');
        const modelList = document.getElementById('model-selector');
        
        // Models
        modelList.innerHTML = '';
        this.availableModels.forEach(m => {
            const div = document.createElement('div');
            div.className = 'model-option';
            div.innerHTML = `<span>${m.name}</span> <i class="fa-solid fa-car"></i>`;
            div.onclick = () => {
                document.querySelectorAll('.model-option').forEach(e => e.classList.remove('selected'));
                div.classList.add('selected');
                div.dataset.file = m.file;
            };
            modelList.appendChild(div);
        });

        // Colors
        const colorRow = document.getElementById('color-picker-row');
        colorRow.innerHTML = '';
        ['#bf5af2', '#ff3b30', '#30d158', '#0a84ff', '#ff9f0a', '#ffffff'].forEach(c => {
            const circle = document.createElement('div');
            circle.className = 'color-swatch';
            circle.style.background = c;
            circle.onclick = () => {
                document.querySelectorAll('.color-swatch').forEach(e => e.classList.remove('selected'));
                circle.classList.add('selected');
                colorInp.value = c;
            };
            colorRow.appendChild(circle);
        });

        if(index > -1) {
            const car = this.cars[index];
            nameInp.value = car.name;
            hpInp.value = car.hp;
            weightInp.value = car.weight;
            engineInp.value = car.engine;
            colorInp.value = car.color;
            delBtn.style.display = 'block';
            // Selektieren
            setTimeout(() => {
                const m = Array.from(document.querySelectorAll('.model-option')).find(el => el.dataset.file === car.model);
                if(m) m.classList.add('selected');
                const c = Array.from(document.querySelectorAll('.color-swatch')).find(el => el.style.background.includes(car.color));
                if(c) c.classList.add('selected');
            }, 50);
        } else {
            nameInp.value = ''; hpInp.value = ''; weightInp.value = ''; engineInp.value = ''; colorInp.value = '#bf5af2';
            delBtn.style.display = 'none';
        }
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

    closeEditor: function() { document.getElementById('car-editor-overlay').classList.add('hidden'); },
    saveCarsToStorage: function() { localStorage.setItem('driverhub_cars', JSON.stringify(this.cars)); },

    // Liste
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

    // Details
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
/* HIER IST DAS WICHTIGE ENDE! */
