import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; 

function init3D() {
    // WICHTIG: Wir suchen jetzt nach dem Container, den garage.js erstellt hat
    // ID muss mit garage.js übereinstimmen!
    const container = document.getElementById('hero-3d-stage');
    
    if (!container) {
        // Falls garage.js noch nicht fertig gerendert hat, versuchen wir es kurz später nochmal
        setTimeout(init3D, 100);
        return;
    }

    // Wenn der Container 0 Höhe hat (versteckt), abbrechen
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    // Reset Flag wenn wir neu starten (damit er neu lädt wenn man Tab wechselt)
    isInitialized = true;

    // Aufräumen (falls alte Canvas da ist)
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    
    // 2. Camera (Noch etwas näher ran für den "Fetten" Look)
    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.5, 1.5, 4.0); 
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 4. Licht (Studio)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2); 
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x007aff, 4.0); 
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // 5. Controls (Manuell drehbar!)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false; // Manuell
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Boden-Limit

    // --- Platzhalter (Kugel) ---
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
            // SCALE UP: 4.5 damit es satt drin steht
            const scale = 4.5 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            // Positionierung im Container
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 0.8; // Leicht tiefer
            carModel.position.z = -center.z * scale;

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

    // 7. Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        
        if(placeholderMesh && !carModel) {
            placeholderMesh.rotation.y += 0.02;
        }

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

// Funktionen für Detail-Ansicht (Ausblenden)
function hideCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '0';
}

function showCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '1';
}

// Global verfügbar machen
window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
