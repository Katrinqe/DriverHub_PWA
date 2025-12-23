// TEST VERSION
window.GarageLogic = {
    init: function() {
        console.log("Garage ist da!");
        // Mach den Container rot, damit wir sehen, dass es klappt
        const container = document.getElementById('garage-swiper-container');
        if(container) {
            container.innerHTML = "<h2 style='color:white; padding:20px;'>VERBINDUNG ERFOLGREICH!</h2>";
            container.style.border = "2px solid green";
        }
    },
    // Leere Platzhalter damit app.js nicht meckert
    renderCars: function() {},
    renderList: function() {}
};
