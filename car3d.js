import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; 
let time = 0; // Für Animation

function init3D() {
    if (isInitialized) return;

    const container = document.getElementById('hero-3d-stage');
    if (!container) return;
    
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    isInitialized = true;

    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    // Leichter Nebel für Tiefe (verschmilzt Boden mit Hintergrund)
    scene.fog = new THREE.FogExp2(0x000000, 0.03);
    
    // 2. Camera
    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(4.5, 1.8, 5.5); // Etwas weiter weg für cineastischen Look
    
    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; // Schatten an!
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. THE SHOWROOM LIGHTING (Dramatic)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Sehr dunkel
    scene.add(ambientLight);

    // Key Light (Von oben vorne links)
    const spotLight = new THREE.SpotLight(0xffffff, 10.0);
    spotLight.position.set(5, 8, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add(spotLight);

    // Rim Light (Von hinten rechts, Blau, betont Kanten)
    const rimLight = new THREE.SpotLight(0x007aff, 15.0); 
    rimLight.position.set(-5, 5, -5);
    rimLight.lookAt(0,0,0);
    scene.add(rimLight);
    
    // Fill Light (Bodenreflexion simulieren)
    const rectAreaLight = new THREE.DirectionalLight(0xffffff, 1.0);
    rectAreaLight.position.set(0, -5, 2);
    scene.add(rectAreaLight);

    // 5. THE GLOSSY FLOOR (Black Glass)
    const planeGeo = new THREE.CircleGeometry(10, 64);
    const planeMat = new THREE.MeshStandardMaterial({ 
        color: 0x050505, 
        roughness: 0.1, 
        metalness: 0.8,
    });
    const floor = new THREE.Mesh(planeGeo, planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85; // Höhe anpassen
    floor.receiveShadow = true;
    scene.add(floor);

    // 6. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false; 
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Nicht unter Boden

    // --- Platzhalter ---
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true });
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
            const scale = 4.2 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 0.85; // Auf Boden setzen
            carModel.position.z = -center.z * scale;

            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) {
                        child.material.envMapIntensity = 1.2; // Mehr Glanz
                        child.material.needsUpdate = true;
                    }
                }
            });

            scene.add(carModel);
        }, 
        undefined, 
        function (error) {
            console.error('Error loading car:', error);
            if(placeholderMesh) placeholderMesh.material.color.setHex(0xff0000); 
        }
    );

    // 8. Loop (mit Breathing Animation)
    function animate() {
        requestAnimationFrame(animate);
        time += 0.005;

        // Camera Breathing (Subtile Bewegung wenn User nicht interagiert)
        // Wir bewegen das Licht leicht, das sieht cool aus auf dem Lack
        rimLight.position.x = Math.sin(time) * 5;
        rimLight.position.z = Math.cos(time) * -5;

        if(placeholderMesh && !carModel) {
            placeholderMesh.rotation.y += 0.02;
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

function hideCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '0';
}

function showCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '1';
}

window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
