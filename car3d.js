import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, studioModel, debugCube;
let isInitialized = false; 

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    if (!container) { requestAnimationFrame(init3D); return; }
    
    // Check if visible
    if (container.clientWidth === 0) return;

    if (isInitialized) return;
    isInitialized = true;

    // Clean
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111); // Dunkelgrau für Debugging (damit man sieht dass Canvas da ist)

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.5, 1.5, 4.5); 

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = false;

    // --- DEBUG CUBE (ROT) ---
    // Damit wir sehen, ob Three.js läuft!
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    debugCube = new THREE.Mesh(geo, mat);
    scene.add(debugCube);

    // 6. Loader
    const loader = new GLTFLoader();

    // Load Studio
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        studioModel.scale.set(1, 1, 1);
        studioModel.position.set(0, -0.5, 0);
        scene.add(studioModel);
        console.log("Studio Loaded");
    }, undefined, (e) => console.error(e));

    // Load Car
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3.5 / maxDim; 
        
        carModel.scale.set(scale, scale, scale);
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale - 0.5; 
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.0;
                child.material.needsUpdate = true;
            }
        });

        scene.add(carModel);
        
        // Debug Cube weg, wenn Auto da
        if(debugCube) debugCube.visible = false;
        
    }, undefined, (e) => {
        console.error("Car Error", e);
        // Wenn Auto fehlt, bleibt der rote Würfel!
    });

    // Loop
    function animate() {
        requestAnimationFrame(animate);
        
        if(debugCube && debugCube.visible) {
            debugCube.rotation.x += 0.02;
            debugCube.rotation.y += 0.02;
        }

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

// Global Hook
window.startGarage3D = init3D;
// Starte sofort, da Container jetzt hardcoded ist
setTimeout(init3D, 500);
