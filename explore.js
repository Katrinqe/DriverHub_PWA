const ExploreLogic = {
    init: function() {
        // Hier kommen später die Event-Listener für Suche und Filter rein
        console.log("Explore Module Loaded");
        
        // Filter Buttons Logik (Visuell umschalten)
        document.querySelectorAll('.filter-chip').forEach(btn => {
            btn.onclick = () => {
                btn.classList.toggle('active');
                // Später: Hier API aufrufen (Tanken/Blitzer laden)
            };
        });
    },

    enter: function() {
        // Was passiert, wenn wir auf den MAP Tab klicken?
        console.log("Entering Explore Mode");

        // 1. Karte interaktiv machen
        if(map) {
            map.dragging.enable();
            map.touchZoom.enable();
            map.scrollWheelZoom.enable();
            
            // Rotation zurücksetzen (Norden oben), damit man die Karte lesen kann
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;
            
            // Zoom Controls könnten wir hier theoretisch einblenden, 
            // aber wir lassen es clean (Pinch to Zoom reicht).
        }
    },

    leave: function() {
        // Was passiert, wenn wir den Tab verlassen?
        console.log("Leaving Explore Mode");

        // Karte wieder sperren (für Home Screen Feeling)
        if(map) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();
            
            // Zurück zum User zentrieren
            if(typeof centerMapOnUser === 'function') centerMapOnUser();
        }
    }
};
