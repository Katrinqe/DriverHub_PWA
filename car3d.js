import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, studioModel;
let isInitialized = false; 

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    if (!container) { requestAnimationFrame(init3D); return; }
    if (container.childElementCount === 0) { isInitialized = false; }
    if (isInitialized) return;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    isInitialized = true;
    while(container.firstChild) { container.removeChild(container.firstChild); }

    scene = new THREE.Scene();
    // Kein Nebel mehr, Studio ist zu
    
    // Camera Setup (Weitwinkel für Tunnel-Effekt)
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 6.0); // Zentral davor
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Licht (An Tunnel angepasst)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight);

    // Deckenlicht Simulieren (Lange Streifen von oben)
    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 5, 0);
    scene.add(topLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;

    // Load Studio & Car Sequence
    const loader = new GLTFLoader();
    
    // 1. Load Studio
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        // Studio skalieren wenn nötig
        studioModel.scale.set(1, 1, 1);
        studioModel.position.set(0, -1, 0); // Bodenlevel
        scene.add(studioModel);

        // 2. Load Car
        loader.load('car.glb', (carGltf) => {
            carModel = carGltf.scene;
            
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // Scale Car
            const scale = 3.8 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 1.0; // Auf Studio Boden
            carModel.position.z = -center.z * scale; // Im Tunnel

            carModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.envMapIntensity = 1.5;
                    child.material.needsUpdate = true;
                }
            });
            scene.add(carModel);
        });
    });

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

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
