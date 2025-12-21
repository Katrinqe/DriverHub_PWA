import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, studioModel;
let isInitialized = false; 

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // Retry Logik, falls DOM noch nicht bereit
    if (!container) { requestAnimationFrame(init3D); return; }
    
    // Check ob Container sichtbar ist
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    // Reset bei neuem Aufruf
    if (container.childElementCount === 0) isInitialized = false;
    if (isInitialized) return;

    isInitialized = true;
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Sicherstellen, dass Hintergrund schwarz ist
    
    // 2. Camera - WICHTIG: Näher ran, damit wir IM Tunnel sind, nicht dahinter!
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(2.5, 1.0, 3.5); // Viel näher dran als vorher
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // ToneMapping anpassen für helleres Bild
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.0; // Sehr hell eingestellt
    container.appendChild(renderer.domElement);

    // 4. LICHT (Sicherheits-Setup)
    // Hemisphere Light: Macht ALLES hell, keine Schatten, nur Sichtbarkeit
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Spotlights für Glanz
    const spotLight = new THREE.SpotLight(0xffffff, 10.0);
    spotLight.position.set(5, 10, 5);
    scene.add(spotLight);

    const blueRim = new THREE.SpotLight(0x007aff, 20.0);
    blueRim.position.set(-5, 2, -5);
    scene.add(blueRim);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    // Eingeschränkte Rotation, damit man nicht unter den Boden guckt
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    // 6. LOADER SYSTEM (Entkoppelt!)
    const loader = new GLTFLoader();
    
    // A: STUDIO LADEN
    loader.load('studio.glb', 
        (gltf) => {
            console.log("Studio geladen");
            studioModel = gltf.scene;
            // Skalierung und Position anpassen
            studioModel.scale.set(1, 1, 1);
            studioModel.position.set(0, -0.5, 0); // Leicht absenken
            scene.add(studioModel);
        },
        undefined,
        (error) => {
            console.error("Studio Fehler:", error);
            // Falls Studio fehlschlägt, fügen wir einen simplen Boden hinzu, damit das Auto nicht schwebt
            const grid = new THREE.GridHelper(20, 20, 0x555555, 0x222222);
            grid.position.y = -0.5;
            scene.add(grid);
        }
    );

    // B: AUTO LADEN (Unabhängig vom Studio!)
    loader.load('car.glb', 
        (gltf) => {
            console.log("Auto geladen");
            carModel = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.8 / maxDim; // Gute Größe
            carModel.scale.set(scale, scale, scale);
            
            // Auto auf den Boden stellen (wichtig!)
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 0.5; // Selbe Höhe wie Studio-Boden
            carModel.position.z = -center.z * scale;

            // Material-Boost für Glanz
            carModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.envMapIntensity = 2.0; 
                    child.material.needsUpdate = true;
                }
            });

            scene.add(carModel);
        },
        undefined,
        (error) => {
            console.error("Auto Fehler:", error);
            // Roter Würfel als Fehler-Indikator
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
        }
    );

    // 7. Loop
    function animate() {
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

// Funktionen für UI
function hideCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '0';
}

function showCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '1';
    // Eventuell neu rendern falls Kontext verloren ging
    init3D();
}

// Global verfügbar machen
window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
