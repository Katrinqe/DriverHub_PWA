const ExploreLogic = {
    init: function() {
        console.log("Explore Module Loaded");
        
        document.querySelectorAll('.filter-chip').forEach(btn => {
            btn.onclick = () => {
                btn.classList.toggle('active');
            };
        });

        // NEU: Recenter Button Logik
        const btnRecenter = document.getElementById('btn-explore-recenter');
        if(btnRecenter) {
            btnRecenter.onclick = () => {
                if(map && userMarker) {
                    // Sanft zurückfliegen
                    map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
                }
            };
        }
    },

    enter: function() {
        console.log("Entering Explore Mode");
        if(map) {
            map.dragging.enable();
            map.touchZoom.enable();
            map.scrollWheelZoom.enable();
            
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;
        }
    },

    leave: function() {
        console.log("Leaving Explore Mode");
        if(map) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();
            
            // Wenn man die Map verlässt, einmal sanft zurück zum User (aber ohne Zoom Reset!)
            if(typeof centerMapOnUser === 'function') {
                // Hier rufen wir nicht centerMapOnUser() direkt auf, weil das oft hart zoomt.
                // Wir machen nur ein panTo über das Objekt
                if(typeof userMarker !== 'undefined' && userMarker) {
                    map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
                }
            }
        }
    }
};
