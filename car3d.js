import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel;

function init3D() {
    const container = document.getElementById('garage-car-stage');
    if (!container) return;

    // 1. Scene Setup
    scene = new THREE.Scene();
    
    // 2. Camera
    // (FOV, Aspect, Near, Far)
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3, 1.5, 4); // Schräg vorne oben

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // Alpha true = Transparenter Hintergrund
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 4. Licht (Wichtig für Glanz)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Grundhelligkeit
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    
    const spotLight = new THREE.SpotLight(0x007aff, 5); // Blaues Effektlicht von hinten
    spotLight.position.set(-5, 5, -5);
    scene.add(spotLight);

    // 5. Controls (Drehen mit Finger)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // Kein Reinzoomen
    controls.enablePan = false;  // Kein Verschieben
    controls.autoRotate = true;  // Langsames Drehen
    controls.autoRotateSpeed = 2.0;

    // 6. Load Car
    const loader = new GLTFLoader();
    loader.load('car.glb', function (gltf) {
        carModel = gltf.scene;
        
        // Auto zentrieren und skalieren
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Skalierung anpassen, damit es ins Bild passt
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3.5 / maxDim; // 3.5 ist ein guter Wert für die Stage
        carModel.scale.set(scale, scale, scale);
        
        // Pivot korrigieren (damit es sich um die Mitte dreht)
        carModel.position.x = -center.x * scale;
        carModel.position.y = -center.y * scale - 0.5; // Leicht nach unten ziehen
        carModel.position.z = -center.z * scale;

        scene.add(carModel);

    }, undefined, function (error) {
        console.error('An error happened loading the car:', error);
    });

    // 7. Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize Handler
    window.addEventListener('resize', () => {
        if(!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Starten, sobald das DOM da ist
document.addEventListener("DOMContentLoaded", () => {
    // Kurze Verzögerung, damit Container sicher da ist
    setTimeout(init3D, 100);
});
