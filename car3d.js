import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, studioModel, debugCube;
let isInitialized = false; 

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    if (!container) { requestAnimationFrame(init3D); return; }
    if (container.childElementCount === 0) isInitialized = false;
    if (isInitialized) return;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    isInitialized = true;
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    // DEBUG: Hintergrund Grau statt Schwarz, damit wir den Container sehen!
    scene.background = new THREE.Color(0x1a1a1a); 
    
    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(3.0, 1.5, 4.0); // Standard Position
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; 
    container.appendChild(renderer.domElement);

    // 4. Licht (Massiv hell)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
    scene.add(ambientLight);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = true; // Zoom erlaubt zum Testen!
    controls.autoRotate = false;

    // --- DEBUG WÜRFEL (ROT) ---
    // Wenn du diesen Würfel siehst, läuft Three.js korrekt!
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    debugCube = new THREE.Mesh(geo, mat);
    debugCube.position.set(0, 0, 0);
    scene.add(debugCube);

    // 6. Loader
    const loader = new GLTFLoader();
    
    // A: STUDIO LADEN & SKALIEREN
    loader.load('studio.glb', 
        (gltf) => {
            studioModel = gltf.scene;
            
            // AUTO-SCALE LOGIC FÜR STUDIO
            const box = new THREE.Box3().setFromObject(studioModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Wir wollen, dass das Studio etwa 20 Einheiten breit ist
            const maxDim = Math.max(size.x, size.y, size.z);
            let scaleFactor = 1.0;
            if (maxDim > 0) {
                scaleFactor = 20.0 / maxDim;
            }
            
            studioModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
            
            // Zentrieren
            studioModel.position.x = -center.x * scaleFactor;
            studioModel.position.y = -box.min.y * scaleFactor - 1.0; // Bodenlevel
            studioModel.position.z = -center.z * scaleFactor;

            scene.add(studioModel);
            console.log("Studio loaded and scaled:", scaleFactor);
        },
        undefined,
        (err) => { console.error("Studio Fail", err); }
    );

    // B: AUTO LADEN
    loader.load('car.glb', 
        (gltf) => {
            carModel = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            const scale = 4.0 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 1.0; 
            carModel.position.z = -center.z * scale;

            // Materialien boosten
            carModel.traverse((child) => {
                if(child.isMesh && child.material) {
                    child.material.envMapIntensity = 2.0;
                    child.material.needsUpdate = true;
                }
            });

            scene.add(carModel);
            
            // Debug Cube weg, wenn Auto da ist
            if(debugCube) debugCube.visible = false;
        },
        undefined,
        (err) => { console.error("Car Fail", err); }
    );

    function animate() {
        requestAnimationFrame(animate);
        
        // Debug Cube drehen
        if(debugCube && debugCube.visible) {
            debugCube.rotation.x += 0.02;
            debugCube.rotation.y += 0.02;
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize Handler
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

// Global UI Helper
function hideCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '0';
}
function showCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '1';
    init3D();
}

window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
