import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel, parkingModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    // Aufräumen
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    // Dunkler Nebel für Atmosphäre
    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    // 2. CAMERA
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    
    // Position: Etwas tiefer für den "Garage"-Look
    const isMobile = aspect < 1.0;
    camera.position.set(0, 1.4, isMobile ? 12.0 : 8.0); 
    camera.lookAt(0, 0.8, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Wichtig für realistische Materialien
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Mischung aus Umgebungslicht und Spots)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight);

    // Hauptlicht von Oben (Sonne/Deckenleuchte)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    // Schatten-Auflösung hochdrehen
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Fill Light von vorne
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(0, 2, 10);
    scene.add(fillLight);

    // 5. INTERACTION
    const onMouseDown = (e) => { isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY }; };
    const onMouseMove = (e) => {
        if(isDragging && carModel) {
            const deltaMove = { x: e.offsetX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01; 
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    };
    const onMouseUp = () => { isDragging = false; };

    const onTouchStart = (e) => { 
        e.preventDefault(); isDragging = true; 
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }; 
    };
    const onTouchMove = (e) => {
        e.preventDefault();
        if(isDragging && carModel) {
            const deltaMove = { x: e.touches[0].clientX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };
    const onTouchEnd = (e) => { e.preventDefault(); isDragging = false; };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, {passive: false});
    container.addEventListener('touchmove', onTouchMove, {passive: false});
    container.addEventListener('touchend', onTouchEnd, {passive: false});

    // 6. LOADER
    const loader = new GLTFLoader();

    // A. PARKING GARAGE LADEN
    loader.load('parking.glb', (gltf) => {
        parkingModel = gltf.scene;
        
        // --- AUTO-SCALING LOGIC ---
        // Wir messen die Garage aus
        const box = new THREE.Box3().setFromObject(parkingModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Zielbreite: Wir wollen, dass die Szene etwa 25 Einheiten breit ist
        // (Damit genug Platz für das Auto ist)
        let scaleFactor = 25.0 / size.x;
        if(!isFinite(scaleFactor) || scaleFactor === 0) scaleFactor = 1.0;

        parkingModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Zentrieren: Boden auf 0
        parkingModel.position.x = -center.x * scaleFactor;
        parkingModel.position.y = -box.min.y * scaleFactor; 
        parkingModel.position.z = -center.z * scaleFactor;

        // Materialien aktivieren (Schatten empfangen)
        parkingModel.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                if(child.material) {
                    // Beton-Look verstärken falls nötig
                    child.material.side = THREE.DoubleSide;
                    // Falls die Textur zu dunkel ist:
                    // child.material.emissiveIntensity = 0.2; 
                }
            }
        });

        scene.add(parkingModel);
        console.log("Parking loaded. Scaled by:", scaleFactor);

        // B. AUTO LADEN (Erst wenn Garage da ist)
        loader.load('car.glb', (carGltf) => {
            carModel = carGltf.scene;
            
            const carBox = new THREE.Box3().setFromObject(carModel);
            const carCenter = carBox.getCenter(new THREE.Vector3());
            const carSize = carBox.getSize(new THREE.Vector3());
            
            // Auto Größe anpassen (ca. 4.5 Einheiten lang, passt gut in die 25er Garage)
            const maxDim = Math.max(carSize.x, carSize.y, carSize.z);
            const carScale = 4.5 / maxDim; 
            
            carModel.scale.set(carScale, carScale, carScale);
            
            // Auto auf den Boden stellen
            carModel.position.x = -carCenter.x * carScale;
            carModel.position.y = -carBox.min.y * carScale + 0.05; // Leicht über Boden
            carModel.position.z = -carCenter.z * carScale;

            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) {
                        // Starker Glanz, damit es im Betonraum gut aussieht
                        child.material.envMapIntensity = 1.5; 
                        child.material.needsUpdate = true;
                    }
                }
            });
            scene.add(carModel);
        });

    }, undefined, (error) => {
        console.error("Parking Error:", error);
        // Falls Garage nicht lädt, fügen wir zur Sicherheit einen Boden ein
        const grid = new THREE.GridHelper(20, 20, 0x555555, 0x222222);
        scene.add(grid);
    });

    // Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Resize
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            if(newAspect < 1.0) camera.position.z = 12.0; 
            else camera.position.z = 8.0;
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
