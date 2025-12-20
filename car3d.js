import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel;

function init3D() {
    const container = document.getElementById('garage-car-stage');
    if (!container) return;

    // Aufräumen falls schon was da ist
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    
    // 2. Camera (Bessere Perspektive: Tiefer und näher)
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(4, 1.5, 5); 
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Performance Limit
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; // Heller
    container.appendChild(renderer.domElement);

    // 4. Licht (Studio Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xbf5af2, 1.5); // Lila Garage-Glow von der Seite
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x007aff, 5.0); // Blaues Kantenlicht von hinten
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.maxPolarAngle = Math.PI / 2; // Nicht unter den Boden gucken

    // 6. Load Car
    const loader = new GLTFLoader();
    
    // WICHTIG: Dateiname muss stimmen!
    loader.load('car.glb', 
        function (gltf) {
            carModel = gltf.scene;
            
            // Auto Box berechnen
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Skalierung: Fülle den Container gut aus
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 4.5 / maxDim; // Größer als vorher
            carModel.scale.set(scale, scale, scale);
            
            // Zentrieren (Pivot unten mitte)
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 0.8; // Leicht absenken für "Bodenhaftung"
            carModel.position.z = -center.z * scale;

            // Materialien optimieren (Glanz)
            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) {
                        child.material.envMapIntensity = 1.0;
                        child.material.needsUpdate = true;
                    }
                }
            });

            scene.add(carModel);
            console.log("Car loaded successfully");
        }, 
        undefined, 
        function (error) {
            console.error('Error loading car:', error);
            // FALLBACK: Roter Würfel, damit man sieht, dass 3D generell geht
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
        }
    );

    // 7. Animation
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        if(!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Start
document.addEventListener("DOMContentLoaded", () => {
    // Warten bis Screen sichtbar ist, sonst falsche Größe
    setTimeout(init3D, 500);
});
