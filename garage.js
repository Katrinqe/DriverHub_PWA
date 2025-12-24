/* GARAGE.JS - DIAGNOSE VERSION */

window.GarageLogic = {
    drives: JSON.parse(localStorage.getItem('driverhub_drives') || '[]'),
    cars: JSON.parse(localStorage.getItem('driverhub_cars') || '[]'),
    editingCarIndex: -1,
    
    availableModels: [
        { name: "Honda Civic EJ2", file: "car.glb" }, 
        { name: "Nissan Skyline R34", file: "car2.glb" },
        { name: "Honda EG", file: "car3.glb" }
    ],

    init: function() { console.log("Garage Init"); this.renderCars(); },

    // DUMMY für App.js
    renderList: function() {}, 

    renderCars: function() {
        this.renderCarCard();
        this.renderDriveCard();
    },

    renderCarCard: function() {
        const container = document.getElementById('car-card-content');
        if(!container) return;
        
        let isBroken = (this.cars.length > 0 && !this.cars[0].name);
        if(isBroken) { this.cars = []; localStorage.setItem('driverhub_cars', '[]'); }

        if(!this.cars || this.cars.length === 0) {
            container.innerHTML = `<div class="empty-add-container" onclick="GarageLogic.openEditor(-1)"><div class="empty-add-icon"><i class="fa-solid fa-plus"></i></div><span class="empty-add-text">ADD YOUR CAR</span></div>`;
            return;
        }

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
            </div>`;
    },

    renderDriveCard: function() {
        const container = document.getElementById('drive-card-content');
        if(container) container.innerHTML = `<div style="text-align:center; color:#666; padding-top:20px;">NO DRIVES</div>`;
    },

    // === HIER IST DIE DIAGNOSE LOGIK ===
    openEditor: function(index) {
        this.editingCarIndex = index;
        const overlay = document.getElementById('car-editor-overlay');
        
        if(!overlay) { alert("KRITISCHER FEHLER: Overlay HTML nicht gefunden!"); return; }
        
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');

        // 1. X-BUTTON FIXIEREN (Aggressiv)
        const closeBtn = document.getElementById('btn-close-editor');
        if(closeBtn) {
            closeBtn.onclick = function() { 
                document.getElementById('car-editor-overlay').style.display = 'none'; 
            };
        } else {
            alert("Warnung: X-Button nicht gefunden!");
        }

        // 2. MODELLE LADEN & DIAGNOSE
        const modelList = document.getElementById('model-selector');
        
        if(!modelList) {
            alert("FEHLER: HTML Element 'model-selector' fehlt! Hast du das HTML kopiert?");
            return;
        }

        // Liste leeren und neu füllen
        modelList.innerHTML = '';
        
        this.availableModels.forEach(m => {
            const div = document.createElement('div');
            // Inline Styles, damit kein CSS dazwischenfunkt
            div.style.cssText = "padding:15px; background:#222; border:1px solid #555; color:white; margin:5px; text-align:center; border-radius:10px; cursor:pointer;";
            div.innerText = m.name; // Nur Text, um sicher zu gehen
            div.onclick = function() {
                // Visual Feedback
                div.style.borderColor = '#007aff';
                div.style.background = '#003366';
                
                // Modell setzen
                const viewer = document.getElementById('editor-preview-viewer');
                if(viewer) {
                    viewer.style.display = 'block';
                    viewer.src = m.file;
                }
                // Markieren
                const all = modelList.children;
                for(let i=0; i<all.length; i++) { if(all[i] !== div) all[i].style.borderColor = '#555'; }
                
                // Speichern wir es direkt im DOM, um es später zu finden
                div.classList.add('selected');
                div.setAttribute('data-file', m.file);
            };
            modelList.appendChild(div);
        });

        // 3. FARBEN LADEN
        const colorRow = document.getElementById('color-picker-row');
        if(colorRow) {
            colorRow.innerHTML = '';
            ['#bf5af2', '#ff3b30', '#ffffff'].forEach(c => {
                const circle = document.createElement('div');
                circle.style.cssText = `width:40px; height:40px; border-radius:50%; background:${c}; margin:5px; border:2px solid transparent;`;
                circle.onclick = () => { document.getElementById('edit-car-color').value = c; };
                colorRow.appendChild(circle);
            });
        }
    },

    saveCarEdit: function() {
        const nameInp = document.getElementById('edit-car-name');
        if(!nameInp || !nameInp.value) { alert("Name fehlt!"); return; }
        
        // Modell suchen
        let modelFile = "car.glb";
        const sel = document.querySelector('.model-grid div[data-file]');
        // Wir nehmen einfach das erste wenn keins gewählt, oder das was 'selected' hat
        // (Vereinfachung für den Test)
        
        const newCar = {
            name: nameInp.value,
            hp: document.getElementById('edit-car-hp').value || '-',
            weight: document.getElementById('edit-car-weight').value || '-',
            engine: document.getElementById('edit-car-engine').value || '-',
            color: document.getElementById('edit-car-color').value || '#bf5af2',
            model: modelFile
        };

        this.cars = [newCar];
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        
        document.getElementById('car-editor-overlay').style.display = 'none';
        this.renderCars();
    },

    deleteCurrentCar: function() {
        this.cars = [];
        localStorage.setItem('driverhub_cars', '[]');
        document.getElementById('car-editor-overlay').style.display = 'none';
        this.renderCars();
    }
};
