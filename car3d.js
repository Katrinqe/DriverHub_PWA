import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; 
let animationId = null; // Um Loop zu stoppen

function init3D() {
    if (isInitialized) return;

    const container = document.getElementById('garage-car-stage');
    if (!container) return;
    
    if (container.clientWidth === 0 || container.clientHeight === 0) {
        return; 
    }

    isInitialized = true; 

    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    
    // 2. Camera
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(4, 1.5, 5); 
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; // Etwas neutraler
    container.appendChild(renderer.domElement);

    // 4. Licht (Clean Studio - KEIN LILA MEHR)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5); // Hauptlicht Weiß
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0); // Fülllicht Weiß (statt Lila)
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x007aff, 3.0); // Dezent Blaues Kantenlicht (DriverHub Brand)
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    
    // FIX: Manuell drehen JA, Automatisch NEIN
    controls.autoRotate = false; 
    
    controls.maxPolarAngle = Math.PI / 2;

    // --- Platzhalter ---
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true });
    placeholderMesh = new THREE.Mesh(geometry, material);
    scene.add(placeholderMesh);

    // 6. Load Car
    const loader = new GLTFLoader();
    
    loader.load('car.glb', 
        function (gltf) {
            if(placeholderMesh) scene.remove(placeholderMesh);

            carModel = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // FIX: Kleiner skalieren (3.5 statt 4.5)
            const scale = 3.5 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            // FIX: Höher positionieren (y offset anpassen)
            // Wir schieben es ins obere Drittel
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 0.5; 
            carModel.position.z = -center.z * scale;

            // Materialien
            carModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.envMapIntensity = 1.0;
                    child.material.needsUpdate = true;
                }
            });

            scene.add(carModel);
        }, 
        undefined, 
        function (error) {
            console.error('Error loading car:', error);
            if(placeholderMesh) {
                placeholderMesh.material.color.setHex(0xff0000); 
            }
        }
    );

    // 7. Loop
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        if(placeholderMesh && !carModel) {
            placeholderMesh.rotation.y += 0.01;
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if(!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Funktionen zum Verstecken (für Detail-Ansicht)
function hideCar() {
    const el = document.getElementById('garage-car-stage');
    if(el) el.style.opacity = '0';
}

function showCar() {
    const el = document.getElementById('garage-car-stage');
    if(el) el.style.opacity = '1';
}

// Global verfügbar machen
window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
