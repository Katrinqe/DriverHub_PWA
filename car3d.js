import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; // Schutz vor Doppel-Start

function init3D() {
    // Wenn schon geladen, breche ab (wir wollen nicht 2 Autos laden)
    if (isInitialized) return;

    const container = document.getElementById('garage-car-stage');
    if (!container) return;
    
    // Sicherheitscheck: Hat der Container eine Größe?
    if (container.clientWidth === 0 || container.clientHeight === 0) {
        console.log("Container hidden, waiting...");
        return; 
    }

    isInitialized = true; // Markieren als "läuft"

    // Aufräumen
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
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    // 4. Licht
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xbf5af2, 2.0); 
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x007aff, 5.0);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.maxPolarAngle = Math.PI / 2;

    // --- PLATZHALTER (Drahtgitter Kugel) ---
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true });
    placeholderMesh = new THREE.Mesh(geometry, material);
    scene.add(placeholderMesh);

    // 6. Load Car
    const loader = new GLTFLoader();
    
    loader.load('car.glb', 
        function (gltf) {
            // SUCCESS
            if(placeholderMesh) scene.remove(placeholderMesh);

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
            // ERROR: Kugel wird rot
            if(placeholderMesh) {
                placeholderMesh.material.color.setHex(0xff0000); 
                controls.autoRotateSpeed = 10.0; 
            }
        }
    );

    // 7. Loop
    function animate() {
        requestAnimationFrame(animate);
        
        if(placeholderMesh && !carModel) {
            placeholderMesh.rotation.y += 0.01;
            placeholderMesh.rotation.x += 0.005;
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

// WICHTIG: Funktion global verfügbar machen!
window.startGarage3D = init3D;
