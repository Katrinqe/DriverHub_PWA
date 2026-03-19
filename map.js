document.addEventListener('DOMContentLoaded', () => {
    const btnNewExplore = document.getElementById('nav-new-explore');
    const newExploreScreen = document.getElementById('new-explore-screen');

    if (btnNewExplore && newExploreScreen) {
        btnNewExplore.addEventListener('click', () => {
            // 1. Alle Screens ausblenden
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
                screen.classList.add('hidden');
            });

            // 2. Alle Nav-Buttons deaktivieren
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active-home', 'active-garage', 'active-map', 'active-perf');
                nav.style.color = '#666'; // Reset Farbe
                nav.style.textShadow = 'none';
            });

            // 3. Unseren neuen Screen anzeigen
            newExploreScreen.classList.remove('hidden');
            newExploreScreen.classList.add('active');

            // 4. Unseren Button aktivieren (z.B. in der Map-Farbe Grün)
            btnNewExplore.style.color = '#30d158';
            btnNewExplore.style.textShadow = '0 0 15px rgba(48, 209, 88, 0.6)';
        });
    }
});
