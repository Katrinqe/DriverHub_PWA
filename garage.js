// --- GARAGE.JS ---
let detailMapInstance = null;

const GarageLogic = {
    // 1. RENDERN DER LISTE
    render: function() {
        const list = document.getElementById('garage-list');
        list.innerHTML = ''; // Liste leeren
        
        // Daten holen
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        
        // Stats oben updaten
        document.getElementById('total-drives').innerText = saved.length;
        let km = 0; 
        saved.forEach(r => km += r.dist);
        document.getElementById('total-km').innerText = km.toFixed(1);

        // Wenn leer
        if (saved.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#555; margin-top:50px;">No drives yet.</p>';
            return;
        }

        // Liste bauen (Neueste zuerst)
        saved.reverse().forEach((ride, index) => {
            const realIndex = saved.length - 1 - index; // Wichtig für Löschen/Details

            const div = document.createElement('div');
            div.className = 'drive-card';
            div.innerHTML = `
                <div class="dc-info" onclick="GarageLogic.showDetails(${realIndex})">
                    <h4>${new Date(ride.date).toLocaleDateString()}</h4>
                    <p>${ride.time} &bull; ${ride.avg} km/h Ø</p>
                </div>
                <div class="dc-right">
                    <span class="dc-km">${ride.dist.toFixed(2)} km</span>
                    <button class="btn-delete-drive" onclick="GarageLogic.deleteDrive(${realIndex}, event)">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    // 2. SPEICHERN (Hier lag oft das Problem)
    save: function(data) {
        console.log("Speichere Fahrt...", data); // Debugging
        try {
            const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
            saved.push(data);
            localStorage.setItem('driverhub_rides', JSON.stringify(saved));
            console.log("Gespeichert!");
            return true;
        } catch (e) {
            console.error("Fehler beim Speichern:", e);
            alert("Speicherfehler! Speicher voll?");
            return false;
        }
    },

    // 3. LÖSCHEN
    deleteDrive: function(index, event) {
        if(event) event.stopPropagation(); // Verhindert, dass sich Details öffnen
        
        if(!confirm("Fahrt wirklich löschen?")) return;
        
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        saved.splice(index, 1);
        localStorage.setItem('driverhub_rides', JSON.stringify(saved));
        this.render(); // Neu laden
    },

    // 4. DETAILS ANZEIGEN
    showDetails: function(index) {
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        const ride = saved[index];
        
        if(!ride) return;

        const overlay = document.getElementById('detail-overlay');
        overlay.classList.remove('hidden');

        document.getElementById('det-date').innerText = new Date(ride.date).toLocaleString();
        document.getElementById('det-dist').innerText = ride.dist.toFixed(2) + " km";
        document.getElementById('det-avg').innerText = ride.avg + " km/h";
        document.getElementById('det-time').innerText = ride.time;

        // Map Initialisierung (Lazy Load)
        if (!detailMapInstance) {
            detailMapInstance = L.map('detail-map', {
                zoomControl: false,
                attributionControl: false
            }).setView([0,0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMapInstance);
        }
        
        // Karte aufräumen
        detailMapInstance.eachLayer((layer) => {
            if(layer instanceof L.Polyline && !(layer instanceof L.TileLayer)) {
                layer.remove();
            }
        });

        // Linie zeichnen
        if (ride.path && ride.path.length > 0) {
            const line = L.polyline(ride.path, {color: '#007aff', weight: 4}).addTo(detailMapInstance);
            detailMapInstance.fitBounds(line.getBounds(), {padding:[50,50]});
        }
        
        // Fix für Render-Bug bei Hidden Elements
        setTimeout(() => detailMapInstance.invalidateSize(), 200);
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
