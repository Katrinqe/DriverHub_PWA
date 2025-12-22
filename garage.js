/* =========================================
   GARAGE LOGIC (FULL RESTORE: SAVING + DETAILS + STATS)
   ========================================= */

const GarageLogic = {
    detailMap: null, // Variable für die Map im Detail-Screen

    // 1. LISTE LADEN & RENDERN
    renderList: function() {
        const listContainer = document.getElementById('garage-list');
        if (!listContainer) return;

        listContainer.innerHTML = "";
        
        // Daten laden
        const rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
        
        // Header Statistik berechnen
        this.updateHeaderStats(rides);

        if (rides.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:50px; color:#555;">No drives saved yet.</div>`;
            return;
        }

        // Liste bauen
        rides.forEach((ride, index) => {
            const dateObj = new Date(ride.date);
            const dateStr = dateObj.toLocaleDateString('de-DE');
            const timeStr = dateObj.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});

            const item = document.createElement('div');
            item.className = "drive-card"; // Dein Design
            item.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr} • ${timeStr}</h4>
                    <p>${ride.time} min • Max ${ride.max} km/h</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="dc-km">${ride.dist.toFixed(1)} km</div>
                    <button class="btn-delete-drive" data-index="${index}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // KLICK EVENT: DETAIL ANSICHT ÖFFNEN
            item.onclick = (e) => {
                if(e.target.closest('.btn-delete-drive')) return;
                this.openDetailView(ride);
            };

            // LÖSCHEN EVENT
            item.querySelector('.btn-delete-drive').onclick = (e) => {
                e.stopPropagation();
                this.deleteRide(index);
            };

            listContainer.appendChild(item);
        });
    },

    // 2. HEADER STATISTIK UPDATEN
    updateHeaderStats: function(rides) {
        let totalDist = 0;
        let maxSpeed = 0;

        rides.forEach(r => {
            totalDist += r.dist;
            if(r.max > maxSpeed) maxSpeed = r.max;
        });

        // Wir suchen die Elemente im HTML. 
        // WICHTIG: Damit das geht, müssen wir sicherstellen, dass wir die richtigen Elemente treffen.
        // Ich nutze hier querySelector, der auf deine CSS-Klassen passt.
        
        const stats = document.querySelectorAll('.g-stat span');
        if(stats.length >= 2) {
            // Annahme: Erstes Element ist Total Drives, Zweites ist Total KM
            // Falls in deinem HTML die Reihenfolge anders ist, tausche diese Zeilen.
            stats[0].innerText = rides.length;      // Anzahl Fahrten
            stats[1].innerText = totalDist.toFixed(0); // Gesamt KM
        }
    },

    // 3. DETAIL VIEW (OVERLAY MIT MAP)
    openDetailView: function(ride) {
        const overlay = document.getElementById('detail-overlay');
        if(!overlay) return;

        // Overlay sichtbar machen
        overlay.classList.remove('hidden'); 
        // Falls du CSS nutzt, das display:none macht, hier sicherstellen:
        overlay.style.display = 'flex';

        // Stats im Detail-Screen füllen
        // Wir suchen die .d-stat-box .val Elemente
        const statValues = overlay.querySelectorAll('.d-stat-box .val');
        if(statValues.length >= 3) {
            statValues[0].innerText = ride.avg + " km/h"; // Avg
            statValues[1].innerText = ride.max + " km/h"; // Max
            statValues[2].innerText = ride.dist.toFixed(1) + " km"; // Dist
        }

        // Datum im Header
        const headerTitle = overlay.querySelector('.detail-header h3');
        if(headerTitle) {
            const d = new Date(ride.date);
            headerTitle.innerText = d.toLocaleDateString() + " " + d.toLocaleTimeString();
        }

        // Close Button Logic
        const closeBtn = overlay.querySelector('.close-detail-btn');
        if(closeBtn) {
            closeBtn.onclick = () => {
                overlay.style.display = 'none';
            };
        }

        // --- MAP RENDERN ---
        // Altes Map-Objekt löschen, falls vorhanden
        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }

        // Map Container leeren
        const mapContainer = document.getElementById('detail-map');
        mapContainer.innerHTML = "";

        // Map init
        this.detailMap = L.map('detail-map', { 
            zoomControl: false, 
            attributionControl: false,
            dragging: true 
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.detailMap);

        // Pfad zeichnen
        if (ride.path && ride.path.length > 0) {
            const latLngs = ride.path.map(p => [p.lat, p.lng]);
            
            // Linie zeichnen (Lila wie im Design)
            const polyline = L.polyline(latLngs, {
                color: '#bf5af2', 
                weight: 4,
                opacity: 0.9
            }).addTo(this.detailMap);

            // Map auf die Linie zentrieren
            // Timeout wichtig, damit CSS Animation fertig ist (sonst falsche Größe)
            setTimeout(() => {
                this.detailMap.invalidateSize();
                this.detailMap.fitBounds(polyline.getBounds(), {padding: [30,30]});
            }, 300);
        }
    },

    // 4. SPEICHERN (Wird von DriverLogic aufgerufen)
    save: function(data) {
        let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
        rides.unshift(data);
        localStorage.setItem('driverhub_rides', JSON.stringify(rides));
        this.renderList();
    },

    // 5. LÖSCHEN
    deleteRide: function(index) {
        if(confirm("Delete this drive?")) {
            let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
            rides.splice(index, 1);
            localStorage.setItem('driverhub_rides', JSON.stringify(rides));
            this.renderList();
        }
    }
};

// Initialisieren
document.addEventListener('DOMContentLoaded', () => {
    GarageLogic.renderList();
});
