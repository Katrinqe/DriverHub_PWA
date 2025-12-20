import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; 
let animationId = null;

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // WENN Container nicht da, versuchen wir es später nochmal
    if (!container) {
        // requestAnimationFrame ist besser als Timeout für UI Wartezeiten
        requestAnimationFrame(init3D);
        return;
    }

    // FIX: VERSCHWINDEN-BUG
    // Wenn der Container leer ist (weil Garage neu gerendert wurde),
    // müssen wir zwingend neu initialisieren, egal was isInitialized sagt.
    if (container.childElementCount === 0) {
        isInitialized = false;
    }

    if (isInitialized) return;

    // Check auf Größe
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    isInitialized = true;

    // Aufräumen (Doppelt hält besser)
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    // Weniger Nebel, damit es klarer wirkt
    scene.fog = new THREE.FogExp2(0x000000, 0.01);
    
    // 2. Camera
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.8, 1.6, 4.5); 
    
    // 3. Renderer (High Power)
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // HELLERES TONE MAPPING
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.7; // Hochgedreht von 1.0
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING UPDATE (Make it POP!)
    // Basis-Helligkeit deutlich hoch
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
    scene.add(ambientLight);

    // Hauptlicht (Sonne)
    const spotLight = new THREE.SpotLight(0xffffff, 15.0);
    spotLight.position.set(5, 10, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add(spotLight);

    // NEU: Frontal-Licht (Damit man das Auto auch sieht!)
    const frontLight = new THREE.DirectionalLight(0xffffff, 5.0);
    frontLight.position.set(0, 2, 10); // Direkt von vorne
    scene.add(frontLight);

    // Rim Light (Blau - Style)
    const rimLight = new THREE.SpotLight(0x007aff, 20.0); 
    rimLight.position.set(-5, 5, -5);
    rimLight.lookAt(0,0,0);
    scene.add(rimLight);
    
    // 5. Floor (Glossy Black)
    const planeGeo = new THREE.CircleGeometry(10, 64);
    const planeMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, // Etwas heller als reines Schwarz für Reflektionen
        roughness: 0.05, 
        metalness: 0.9,
    });
    const floor = new THREE.Mesh(planeGeo, planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85; 
    floor.receiveShadow = true;
    scene.add(floor);

    // 6. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false; 
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    // --- Platzhalter ---
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x555555, wireframe: true });
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
            carModel.position.y = -box.min.y * scale - 0.85; 
            carModel.position.z = -center.z * scale;

            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) {
                        // Material heller machen, falls Textur zu dunkel ist
                        child.material.envMapIntensity = 2.0; 
                        child.material.metalness = 0.7; // Etwas weniger Metall = mehr Farbe
                        child.material.roughness = 0.2; // Mehr Glanz
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

    // 8. Loop
    function animate() {
        animationId = requestAnimationFrame(animate);
        
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
    // Sicherheits-Check beim Wieder-Anzeigen
    init3D();
}

window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
