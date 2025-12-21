import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, placeholderMesh;
let isInitialized = false; 
let animationId = null;

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    if (!container) { requestAnimationFrame(init3D); return; }
    if (container.childElementCount === 0) { isInitialized = false; }
    if (isInitialized) return;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    isInitialized = true;
    while(container.firstChild) { container.removeChild(container.firstChild); }

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.01);
    
    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.5, 1.2, 4.5); 
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // RUNTERGEDREHT
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 8.0); // RUNTERGEDREHT
    spotLight.position.set(5, 8, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add(spotLight);

    const rimLight = new THREE.SpotLight(0x007aff, 10.0); // RUNTERGEDREHT
    rimLight.position.set(-5, 5, -5);
    rimLight.lookAt(0,0,0);
    scene.add(rimLight);
    
    const planeGeo = new THREE.CircleGeometry(10, 64);
    const planeMat = new THREE.MeshStandardMaterial({ 
        color: 0x050505, 
        roughness: 0.1, 
        metalness: 0.8,
    });
    const floor = new THREE.Mesh(planeGeo, planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85; 
    floor.receiveShadow = true;
    scene.add(floor);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = false; 
    
    // FIX: NUR HORIZONTALES DREHEN (LOCK Y)
    controls.minPolarAngle = Math.PI / 2 - 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;

    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true });
    placeholderMesh = new THREE.Mesh(geometry, material);
    scene.add(placeholderMesh);

    const loader = new GLTFLoader();
    
    loader.load('car.glb', 
        function (gltf) {
            if(placeholderMesh) scene.remove(placeholderMesh);

            carModel = gltf.scene;
            const box = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // FIX: SCALE DOWN (3.5)
            const scale = 3.5 / maxDim; 
            carModel.scale.set(scale, scale, scale);
            
            carModel.position.x = -center.x * scale;
            carModel.position.y = -box.min.y * scale - 0.85; 
            carModel.position.z = -center.z * scale;

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
        }, 
        undefined, 
        function (error) {
            if(placeholderMesh) placeholderMesh.material.color.setHex(0xff0000); 
        }
    );

    function animate() {
        animationId = requestAnimationFrame(animate);
        if(placeholderMesh && !carModel) { placeholderMesh.rotation.y += 0.02; }
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
