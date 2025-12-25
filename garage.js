/* GARAGE.JS - FINAL V13 (Hardcoded ID Fix) */

window.GarageLogic = {
    // 1. DATEN
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
        console.log("Garage V13 Init");
        this.renderCars();
    },

    // 4. EDITOR ÖFFNEN
    openEditor: function() {
        const overlay = document.getElementById('final-overlay');
        if(!overlay) { alert("Fehler: #final-overlay fehlt in index.html!"); return; }
        
        // Nach vorne holen & anzeigen
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';

        // Listen füllen
        this.renderModelList();
        
        // Werte resetten oder laden
        if(this.cars.length > 0) {
            document.getElementById('final-name').value = this.cars[0].name;
            document.getElementById('final-preview').src = this.cars[0].model;
        } else {
            document.getElementById('final-name').value = '';
            document.getElementById('final-preview').src = '';
        }
    },

    // 5. MODELLE IN DIE LISTE RENDERN
    renderModelList: function() {
        const list = document.getElementById('final-model-list');
        const viewer = document.getElementById('final-preview');
        
        if(!list) { alert("Fehler: #final-model-list fehlt!"); return; }
        
        list.innerHTML = ''; // Liste leeren
        
        this.availableModels.forEach(model => {
            const btn = document.createElement('div');
            // Inline Styles damit es sofort gut aussieht
            btn.style.cssText = "padding:10px; background:#222; border:1px solid #555; color:#aaa; border-radius:8px; text-align:center; cursor:pointer; font-size:0.8rem; font-family:sans-serif;";
            btn.innerText = model.name;
            
            btn.onclick = () => {
                // Alle resetten
                Array.from(list.children).forEach(child => {
                    child.style.borderColor = '#555';
                    child.style.color = '#aaa';
                    child.classList.remove('selected-model');
                });
                // Klick Highlight
                btn.style.borderColor = '#007aff';
                btn.style.color = 'white';
                btn.classList.add('selected-model');
                
                // Vorschau updaten
                if(viewer) viewer.src = model.file;
                
                // Wir speichern den Filename direkt im Element
                btn.setAttribute('data-file', model.file);
            };
            
            list.appendChild(btn);
        });
    },

    // 6. SPEICHERN
    saveCarEdit: function() {
        const nameVal = document.getElementById('final-name').value;
        if(!nameVal) { alert("Name fehlt!"); return; }

        // Welches Modell ist gewählt?
        let modelFile = "car.glb";
        const selected = document.querySelector('.selected-model');
        if(selected) {
            modelFile = selected.getAttribute('data-file');
        } else if(this.cars.length > 0) {
            modelFile = this.cars[0].model; // Altes behalten
        }

        // Speichern
        const newCar = {
            name: nameVal,
            model: modelFile,
            hp: "---", weight: "---", engine: "---", color: "#bf5af2" // Dummys
        };
        
        this.cars = [newCar];
        localStorage.setItem('driverhub_cars', JSON.stringify(this.cars));
        
        // Schließen & Neu malen
        document.getElementById('final-overlay').style.display = 'none';
        this.renderCars();
    },

    deleteCurrentCar: function() {
        this.cars = [];
        localStorage.setItem('driverhub_cars', '[]');
        document.getElementById('final-overlay').style.display = 'none';
        this.renderCars();
    },

    // 7. DASHBOARD RENDERN (Schönes "No Drives")
    renderCars: function() {
        // CAR CARD
        const carCont = document.getElementById('car-card-content');
        if(carCont) {
            // Wenn kein Auto oder Name leer -> Add Button
            if(this.cars.length === 0 || !this.cars[0].name) {
                if(document.querySelector('#card-car-profile .card-header-btn')) 
                    document.querySelector('#card-car-profile .card-header-btn').style.display='none';
                
                carCont.innerHTML = `
                <div onclick="GarageLogic.openEditor()" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;">
                    <div style="font-size:2rem; color:#555; border:2px dashed #444; border-radius:50%; width:60px; height:60px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;"><i class="fa-solid fa-plus"></i></div>
                    <span style="color:#888; font-weight:800; font-size:0.8rem;">ADD YOUR CAR</span>
                </div>`;
            } else {
                // Auto da
                if(document.querySelector('#card-car-profile .card-header-btn')) 
                    document.querySelector('#card-car-profile .card-header-btn').style.display='flex';
                const c = this.cars[0];
                carCont.innerHTML = `
                <div class="card-split-left" style="border-right-color:#bf5af2;">
                    <div style="width:100%; height:80%;"><model-viewer src="${c.model}" auto-rotate camera-controls disable-zoom style="width:100%; height:100%;" shadow-intensity="1"></model-viewer></div>
                    <div class="mini-car-name">${c.name}</div>
                </div>
                <div class="card-split-right"><div class="d-stat"><label>INFO</label><span>Ready</span></div></div>`;
            }
        }

        // DRIVE CARD
        const driveCont = document.getElementById('drive-card-content');
        if(driveCont) {
            if(this.drives.length === 0) {
                driveCont.innerHTML = `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#666;">
                    <i class="fa-solid fa-road" style="font-size:1.5rem; margin-bottom:10px; opacity:0.5;"></i>
                    <span style="font-size:0.7rem; font-weight:800; letter-spacing:1px; opacity:0.7;">NO RECENT DRIVES</span>
                </div>`;
            } else {
                // Hier würde die Fahrt gerendert werden (wie vorher)
                driveCont.innerHTML = "<div>Drive Data</div>";
            }
        }
    },
    
    // Dummy
    renderList: function() {}
};
