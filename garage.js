/* =========================================
   GARAGE LOGIC (VERSION 3.0 - SAVING & DESIGN FIX)
   ========================================= */

const GarageLogic = {
    
    // 1. HAUPTFUNKTION: LISTE BAUEN
    renderList: function() {
        const listContainer = document.getElementById('garage-list');
        if (!listContainer) return;

        listContainer.innerHTML = ""; // Liste leeren

        // Daten aus dem Speicher holen
        const rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];

        // Statistiken oben updaten
        this.updateStats(rides);

        // Fall: Keine Fahrten vorhanden
        if (rides.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:40px; color:#444;">
                    <i class="fa-solid fa-car-side" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>Noch keine Fahrten gespeichert.</p>
                </div>`;
            return;
        }

        // Fahrten rendern (Neueste zuerst)
        rides.forEach((ride, index) => {
            // Datum formatieren
            const dateObj = new Date(ride.date);
            const dateStr = dateObj.toLocaleDateString('de-DE'); // z.B. 22.12.2025
            const timeStr = dateObj.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}); // z.B. 14:30

            // HTML Element erstellen (Mit deinen CSS Klassen!)
            const item = document.createElement('div');
            item.className = "drive-card"; // Dein Style
            
            // Inhalt füllen
            item.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr} • ${timeStr}</h4>
                    <p>Dauer: ${ride.time} min • Max: ${ride.max} km/h</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="dc-km">${ride.dist.toFixed(1)} km</div>
                    <button class="btn-delete-drive" data-index="${index}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // EVENT: Karte anklicken (Details)
            item.onclick = (e) => {
                // Verhindern, dass Löschen-Button auch Details öffnet
                if (e.target.closest('.btn-delete-drive')) return;
                
                // Hier könnte man später ein Detail-Overlay öffnen
                alert(`Fahrt Details:\nDurchschnitt: ${ride.avg} km/h\nMax Speed: ${ride.max} km/h\nStrecke: ${ride.dist.toFixed(2)} km`);
            };

            // EVENT: Löschen Button
            const deleteBtn = item.querySelector('.btn-delete-drive');
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Klick bubbling verhindern
                this.deleteRide(index);
            };

            listContainer.appendChild(item);
        });
    },

    // 2. STATISTIKEN BERECHNEN (Total KM, etc.)
    updateStats: function(rides) {
        let totalDist = 0;
        let maxSpeedAll = 0;

        rides.forEach(r => {
            totalDist += r.dist;
            if (r.max > maxSpeedAll) maxSpeedAll = r.max;
        });

        // IDs müssen in deiner HTML existieren (z.B. in .garage-total-card)
        // Falls nicht, werden diese Zeilen einfach ignoriert (kein Absturz)
        const elTotalKm = document.getElementById('stat-total-km');
        const elTotalRides = document.getElementById('stat-total-drives');
        const elMaxSpeed = document.getElementById('stat-max-speed');

        if (elTotalKm) elTotalKm.innerText = totalDist.toFixed(0);
        if (elTotalRides) elTotalRides.innerText = rides.length;
        if (elMaxSpeed) elMaxSpeed.innerText = maxSpeedAll;
    },

    // 3. FAHRT SPEICHERN (Wird von DriverLogic aufgerufen)
    save: function(data) {
        // Alte Daten holen
        let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
        
        // Neue Fahrt vorne anfügen
        rides.unshift(data);
        
        // Speichern
        localStorage.setItem('driverhub_rides', JSON.stringify(rides));
        
        // Ansicht aktualisieren
        this.renderList();
    },

    // 4. FAHRT LÖSCHEN
    deleteRide: function(index) {
        if (confirm("Diese Fahrt wirklich löschen?")) {
            let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
            
            // Element am Index entfernen
            rides.splice(index, 1);
            
            // Update speichern
            localStorage.setItem('driverhub_rides', JSON.stringify(rides));
            
            // Neu malen
            this.renderList();
        }
    }
};

// Autostart wenn Datei geladen ist
document.addEventListener('DOMContentLoaded', () => {
    GarageLogic.renderList();
});
