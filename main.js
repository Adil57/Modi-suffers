import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; 
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; // ⬅️ NEW: DRACO IMPORT

// --- HTML Elements ---
const scoreDisplay = document.getElementById('score-display');
const coinDisplay = document.getElementById('coin-display');
const gameOverScreen = document.getElementById('game-over-screen');
const restartButton = document.getElementById('restart-button');
const finalScoreDisplay = document.getElementById('final-score');
const finalCoinsDisplay = document.getElementById('final-coins');
const jumpSound = document.getElementById('jump-sound');
const coinSound = document.getElementById('coin-sound');
const crashSound = document.getElementById('crash-sound');

// --- Three.js Setup ---
let score = 0, coinCount = 0, isGameOver = false;
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background to see the model better
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 4);
camera.lookAt(0, 0.5, 0);

// --- Game Constants ---
let currentTrackSpeed = 0.2;
const trackLength = 30, trackWidth = 5;
const lanes = [-1.5, 0, 1.5];
const gravity = -0.025;
const playerGroundY = 0.5;
const rollDurationFrames = 30;
const playerNormalScale = 1.0;
const playerRollScale = 0.5;

// --- Player Variables ---
let player;
let mixer = null;
let currentLane = 1, targetLaneX = lanes[currentLane];
let velocityY = 0, isGrounded = true;
let isRolling = false, rollTimer = 0;

// --- Player Group ---
player = new THREE.Group();
player.position.y = playerGroundY;
scene.add(player);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = false;
scene.add(directionalLight);

// --- GLTF Loader & DRACO Setup ---
const gltfLoader = new GLTFLoader();

// 1. DRACO Setup
const dracoLoader = new DRACOLoader();
// Yeh path Three.js ke 'draco/' folder ko point karna chahiye
dracoLoader.setDecoderPath('draco/'); 
gltfLoader.setDRACOLoader(dracoLoader); // DRACOLoader provided to GLTFLoader

gltfLoader.load(
    'compress.glb', // Corrected file name
    function (gltf) {
        console.log("GLB model loaded successfully!");
        const model = gltf.scene; 
        
        // Debug: Log model information
        console.log("Model children count:", model.children.length);
        
        // Ensure all materials use correct color space and log details
        model.traverse((child) => {
            if (child.isMesh) {
                console.log("Found mesh:", child.name);
                console.log("Material:", child.material);
                
                if (child.material) {
                    // Log texture information
                    if (child.material.map) {
                        console.log("Has texture map:", child.material.map);
                        child.material.map.colorSpace = THREE.SRGBColorSpace;
                    } else {
                        console.log("No texture map, color:", child.material.color);
                    }
                    child.material.needsUpdate = true;
                }
            }
        });
        
        model.rotation.y = Math.PI; 
        player.add(model);
        player.scale.set(playerNormalScale, playerNormalScale, playerNormalScale);
        
        console.log("Player position:", player.position);
        console.log("Player scale:", player.scale);
        
        // Animation Setup
        mixer = new THREE.AnimationMixer(model);
        const animations = gltf.animations; 
        if (animations && animations.length) {
            console.log("Found", animations.length, "animations");
            const runAction = mixer.clipAction(animations[0]); 
            runAction.play();
        }
    },
    undefined,
    function (error) { 
        console.error('Error loading GLB file:', error);
        alert('Error: Could not load compress.glb. Check console.');
    }
);

// --- Track ---
const trackGeometry = new THREE.BoxGeometry(trackWidth, 1, trackLength);
const trackMaterial1 = new THREE.MeshBasicMaterial({ color: 0x888888 });
const trackMaterial2 = new THREE.MeshBasicMaterial({ color: 0x666666 });

const trackSegment1 = new THREE.Mesh(trackGeometry, trackMaterial1);
trackSegment1.position.y = -0.5; trackSegment1.position.z = 0;
scene.add(trackSegment1);
const trackSegment2 = new THREE.Mesh(trackGeometry, trackMaterial2);
trackSegment2.position.y = -0.5; trackSegment2.position.z = -trackLength;
scene.add(trackSegment2);

// --- Controls ---
let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
const swipeThreshold = 50, swipeThresholdY = 50;

function handleTouchStart(event) { touchStartX = event.touches[0].clientX; touchStartY = event.touches[0].clientY; }
function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].clientX;
    touchEndY = event.changedTouches[0].clientY;
    handleSwipe();
}
function handleSwipe() {
    if (!isGrounded || isRolling || isGameOver) return;
    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = touchEndY - touchStartY;
    
    if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY)) {
        if (swipeDistanceX > swipeThreshold && currentLane < 2) currentLane++;
        else if (swipeDistanceX < -swipeThreshold && currentLane > 0) currentLane--;
        targetLaneX = lanes[currentLane];
    } else {
        if (swipeDistanceY < -swipeThresholdY) { jump(); } 
        else if (swipeDistanceY > swipeThresholdY) { roll(); }
    }
}
function jump() {
    if (isGrounded) { 
        velocityY = 0.35; 
        isGrounded = false;
        // jumpSound.play();
    }
}
function roll() {
    if (isGrounded && !isRolling) {
        isRolling = true;
        rollTimer = rollDurationFrames;
        player.scale.y = playerRollScale;
        player.position.y = playerGroundY / 2;
    }
}
window.addEventListener('touchstart', handleTouchStart);
window.addEventListener('touchend', handleTouchEnd);

// --- Keyboard Controls (for laptop/desktop) ---
window.addEventListener('keydown', (event) => {
    if (isGameOver) return;
    
    switch(event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (currentLane > 0) {
                currentLane--;
                targetLaneX = lanes[currentLane];
            }
            event.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (currentLane < 2) {
                currentLane++;
                targetLaneX = lanes[currentLane];
            }
            event.preventDefault();
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case ' ':
            jump();
            event.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
        case 'Shift':
            roll();
            event.preventDefault();
            break;
    }
});

// --- Mouse Controls (for laptop/desktop) ---
let mouseStartX = 0, mouseStartY = 0, mouseEndX = 0, mouseEndY = 0;
let isMouseDown = false;

function handleMouseDown(event) {
    isMouseDown = true;
    mouseStartX = event.clientX;
    mouseStartY = event.clientY;
}

function handleMouseUp(event) {
    if (!isMouseDown) return;
    isMouseDown = false;
    mouseEndX = event.clientX;
    mouseEndY = event.clientY;
    handleMouseSwipe();
}

function handleMouseSwipe() {
    if (isGameOver) return;
    const swipeDistanceX = mouseEndX - mouseStartX;
    const swipeDistanceY = mouseEndY - mouseStartY;
    
    // Require minimum distance for mouse swipes
    if (Math.abs(swipeDistanceX) < 30 && Math.abs(swipeDistanceY) < 30) return;
    
    if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY)) {
        if (swipeDistanceX > swipeThreshold && currentLane < 2) {
            currentLane++;
            targetLaneX = lanes[currentLane];
        } else if (swipeDistanceX < -swipeThreshold && currentLane > 0) {
            currentLane--;
            targetLaneX = lanes[currentLane];
        }
    } else {
        if (swipeDistanceY < -swipeThresholdY) {
            jump();
        } else if (swipeDistanceY > swipeThresholdY) {
            roll();
        }
    }
}

window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mouseup', handleMouseUp);


// --- Obstacles & Coins ---
const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const groundObstacleGeometry = new THREE.BoxGeometry(1, 1, 1);
const airObstacleGeometry = new THREE.BoxGeometry(1, 0.5, 1); 
const obstacles = []; 
const coinGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
const coinMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });
const coins = []; 
let animationId = null; 
let obstacleInterval, coinInterval;

function spawnObstacle() {
    if (isGameOver) return;
    const obstacleType = Math.floor(Math.random() * 3);
    const randomLane = Math.floor(Math.random() * 3);
    let obstacle;
    
    if (obstacleType === 0) {
        obstacle = new THREE.Mesh(groundObstacleGeometry, obstacleMaterial);
        obstacle.position.y = 0.5;
    } else if (obstacleType === 1) {
        obstacle = new THREE.Mesh(airObstacleGeometry, obstacleMaterial);
        obstacle.position.y = 1.25;
    } else {
        obstacle = new THREE.Mesh(groundObstacleGeometry, obstacleMaterial);
        obstacle.position.y = 1.5;
    }

    obstacle.position.x = lanes[randomLane];
    obstacle.position.z = -trackLength;
    scene.add(obstacle); obstacles.push(obstacle);
}

function spawnCoin() {
    if (isGameOver) return;
    const randomLane = Math.floor(Math.random() * 3);
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);
    coin.rotation.x = Math.PI / 2;
    coin.position.x = lanes[randomLane];
    coin.position.y = 0.75; 
    coin.position.z = -trackLength;
    scene.add(coin); coins.push(coin);
}

// --- Collision Functions (Rolling-aware) ---
function getPlayerBoundingBox() {
    const box = new THREE.Box3();
    const size = new THREE.Vector3(
        player.scale.x * 1, 
        player.scale.y * 1, 
        player.scale.z * 1
    );
    const center = new THREE.Vector3(
        player.position.x,
        player.position.y + size.y / 2,
        player.position.z
    );
    box.setFromCenterAndSize(center, size);
    return box;
}

function checkObstacleCollision(obstacle) {
    if (!player) return false;
    const playerBox = getPlayerBoundingBox();
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);
    return playerBox.intersectsBox(obstacleBox);
}

function checkCoinCollision(coin) {
    if (!player) return false;
    const playerBox = getPlayerBoundingBox();
    const coinBox = new THREE.Box3().setFromObject(coin);
    return playerBox.intersectsBox(coinBox);
}

// --- Game Over ---
function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    clearInterval(obstacleInterval);
    clearInterval(coinInterval);
    // crashSound.play();
    finalScoreDisplay.innerText = `Score: ${Math.floor(score)}`;
    finalCoinsDisplay.innerText = `Coins: ${coinCount}`;
    gameOverScreen.style.display = 'flex';
}

// --- Restart Game ---
function restartGame() {
    score = 0; coinCount = 0; isGameOver = false;
    currentTrackSpeed = 0.2;

    if (player) {
        player.position.set(0, playerGroundY, 0);
        player.scale.set(playerNormalScale, playerNormalScale, playerNormalScale);
        currentLane = 1; targetLaneX = lanes[currentLane];
        isGrounded = true; isRolling = false;
        velocityY = 0;
    }

    // Cleanup
    obstacles.forEach(o => scene.remove(o)); obstacles.length = 0;
    coins.forEach(c => scene.remove(c)); coins.length = 0;
    
    scoreDisplay.innerText = `Score: 0`;
    coinDisplay.innerText = `Coins: 0`;
    gameOverScreen.style.display = 'none';
    startGame();
}
restartButton.addEventListener('click', restartGame);

// --- Game Loop ---
function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta(); 

    // Track Movement
    trackSegment1.position.z += currentTrackSpeed;
    trackSegment2.position.z += currentTrackSpeed;
    if (trackSegment1.position.z >= trackLength) trackSegment1.position.z -= (trackLength * 2);
    if (trackSegment2.position.z >= trackLength) trackSegment2.position.z -= (trackLength * 2);

    // Player Logic
    if (player && player.children.length > 0) {
        player.position.x = THREE.MathUtils.lerp(player.position.x, targetLaneX, 0.15);

        // Rolling countdown
        if (isRolling) {
            rollTimer--;
            if (rollTimer <= 0) {
                isRolling = false;
                player.scale.y = playerNormalScale;
                player.position.y = playerGroundY;
            }
        }

        // Jump/Gravity
        if (!isGrounded) {
            velocityY += gravity;
            player.position.y += velocityY;
            if (player.position.y <= playerGroundY) {
                player.position.y = playerGroundY;
                velocityY = 0;
                isGrounded = true;
            }
        }
    }

    // Obstacle/Coin Movement, Collision & Cleanup
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += currentTrackSpeed;
        if (obstacle.position.z > camera.position.z + 1) {
            scene.remove(obstacle); obstacles.splice(i, 1);
            continue;
        }
        if (!isGameOver && checkObstacleCollision(obstacle)) {
            gameOver(); return;
        }
    }

    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.position.z += currentTrackSpeed;
        coin.rotation.y += 0.05;
        if (coin.position.z > camera.position.z + 1) {
            scene.remove(coin); coins.splice(i, 1);
            continue;
        }
        if (!isGameOver && checkCoinCollision(coin)) {
            coinCount++;
            coinDisplay.innerText = `Coins: ${coinCount}`;
            scene.remove(coin);
            coins.splice(i, 1);
            // coinSound.play();
        }
    }

    // Score & Difficulty Update
    if (!isGameOver) {
        score += 1; 
        scoreDisplay.innerText = `Score: ${Math.floor(score)}`;
        // currentTrackSpeed += 0.00005; 
    }

    // Animation Mixer Update
    if (mixer) {
        mixer.update(delta);
    }

    renderer.render(scene, camera);
}

// --- Start Game ---
function startGame() {
    setTimeout(() => {
        obstacleInterval = setInterval(spawnObstacle, 2000);
    }, 5000);
    coinInterval = setInterval(spawnCoin, 1200);
    animate();
}
startGame();

// --- Resize Function ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
        
