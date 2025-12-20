import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; 

function init3D() {
    // Wir schauen, ob der neue Container im Hero-Bereich existiert
    const container = document.getElementById('car-canvas-container');
    if (!container) return; // Warten, bis Garage gerendert ist

    // Check, ob wir schon laufen (um Mehrfach-Init zu vermeiden)
    // ABER: Wenn der Container leer ist (weil wir die Garage neu gebaut haben), müssen wir neu initen.
    if (container.childNodes.length > 0) return;

    isInitialized = true;

    // 1. Scene
    scene = new THREE.Scene();
    
    // 2. Camera (Winkel angepasst für den Hero-Blick)
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.5, 2.0, 4.5); 
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 4. Licht (Showroom Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0); 
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5); 
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x007aff, 4.0); 
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // 5. PODEST (Grid Helper) - Damit es nicht schwebt
    // Ein Gitter, 10x10 Einheiten, Farbe Grau/Dunkelgrau
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    grid.position.y = -1.0; // Unter das Auto schieben
    // Gitter leicht ausblenden (Transparenz Trick via Material Zugriff geht bei Helper schwer, daher Farbe dunkel)
    scene.add(grid);
    
    // Ein Schein (Glow) unter dem Auto
    const geoFloor = new THREE.CircleGeometry(4, 32);
    const matFloor = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const floor = new THREE.Mesh(geoFloor, matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.01;
    scene.add(floor);


    // 6. Controls (MANUELL DREHBAR)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false; // Manuell!
    
    // Begrenzen, damit man nicht unter den Boden guckt
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // --- Platzhalter ---
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true });
    placeholderMesh = new THREE.Mesh(geometry, material);
    scene.add(placeholderMesh);

    // 7. Load Car
    const loader = new GLTFLoader();
    
    loader.load('car.glb', 
        function (gltf) {
            if(placeholderMesh) scene.remove(placeholderMesh);

            carModel = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            // Skalierung anpassen für den neuen Container
            const scale = 3.2 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            // Zentrieren
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 1.0; // Auf das Grid setzen
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

    // 8. Loop
    function animate() {
        requestAnimationFrame(animate);
        
        if(placeholderMesh && !carModel) {
            placeholderMesh.rotation.y += 0.01;
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize Handler spezifisch für den Container
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

// Global verfügbar machen
window.startGarage3D = init3D;
