import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; 

// --- HTML Elements (Same) ---
const scoreDisplay = document.getElementById('score-display');
const coinDisplay = document.getElementById('coin-display');
const gameOverScreen = document.getElementById('game-over-screen');
const restartButton = document.getElementById('restart-button');
const finalScoreDisplay = document.getElementById('final-score');
const finalCoinsDisplay = document.getElementById('final-coins');
const jumpSound = document.getElementById('jump-sound');
const coinSound = document.getElementById('coin-sound');
const crashSound = document.getElementById('crash-sound');

let score = 0, coinCount = 0, isGameOver = false;
const clock = new THREE.Clock(); 
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); 
camera.position.y = 3; 
camera.position.z = 5;

// --- Game Variables (Same) ---
const trackSpeed = 0.2, trackLength = 30, trackWidth = 5;
const lanes = [-1.5, 0, 1.5];
const gravity = -0.025;
const playerGroundY = 0.5; 
const rollDuration = 30;
const playerNormalScale = 1.0; 
const playerRollScale = 0.5;  

// --- Player Variables ---
let player; 
let mixer = null; 
let currentLane = 1, targetLaneX = lanes[currentLane];
let velocityY = 0, isGrounded = true;
let isRolling = false, rollTimer = 0;

// --- Player Group (Same) ---
player = new THREE.Group();
player.position.y = playerGroundY;
scene.add(player);
player.scale.set(playerNormalScale, playerNormalScale, playerNormalScale);
camera.lookAt(player.position); 

// --- LOADER (GLTF / .glb) ---
const gltfLoader = new GLTFLoader();

gltfLoader.load(
    'Untitled.glb', // Aapki 30MB wali .glb file ka naam
    function (gltf) {
        console.log("GLB model loaded");
        const model = gltf.scene; 
        
        // Model ko seedha track par dekhne ke liye ghumaya
        model.rotation.y = Math.PI; 

        player.add(model);
        
        // --- Animation Setup ---
        mixer = new THREE.AnimationMixer(model);
        const animations = gltf.animations; 
        
        if (animations && animations.length) {
            console.log("Animations found:", animations.length);
            const runAction = mixer.clipAction(animations[0]); 
            runAction.play();
        } else {
            console.warn("Is GLB model mein koi animation nahi mili!");
        }
    },
    function (xhr) { 
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
     },
    function (error) { 
        console.log('Error loading GLB file:', error);
        alert('Error: Could not load GLB file. Check console.');
    }
);

// --- Track (Same) ---
const trackGeometry = new THREE.BoxGeometry(trackWidth, 1, trackLength);
const trackSegment1 = new THREE.Mesh(trackGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
trackSegment1.position.y = -0.5; trackSegment1.position.z = 0;
scene.add(trackSegment1);
const trackSegment2 = new THREE.Mesh(trackGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
trackSegment2.position.y = -0.5; trackSegment2.position.z = -trackLength;
scene.add(trackSegment2);

// --- Controls (Same) ---
let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
const swipeThreshold = 50, swipeThresholdY = 50; 
function handleTouchStart(event) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
}
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
        if (swipeDistanceX > swipeThreshold) {
            if (currentLane < 2) currentLane++;
        } else if (swipeDistanceX < -swipeThreshold) {
            if (currentLane > 0) currentLane--;
        }
        targetLaneX = lanes[currentLane];
    } else {
        if (swipeDistanceY < -swipeThresholdY) { jump(); } 
        else if (swipeDistanceY > swipeThresholdY) { roll(); }
    }
}
function jump() {
    if (isGrounded) { 
        velocityY = 0.4; 
        isGrounded = false;
        // jumpSound.play();
    }
}
function roll() {
    if (isGrounded && !isRolling) {
        isRolling = true; rollTimer = rollDuration;
        player.scale.y = playerRollScale; // Roll scale
        player.position.y = playerGroundY / 2; // Adjust position for roll
    }
}
window.addEventListener('touchstart', handleTouchStart);
window.addEventListener('touchend', handleTouchEnd);


// --- Obstacles & Coins (Same) ---
const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
const groundObstacleGeometry = new THREE.BoxGeometry(1, 1, 1);
const airObstacleGeometry = new THREE.BoxGeometry(1, 0.5, 1); 
const obstacles = []; 
const coinGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const coinMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const coins = []; 
let animationId = null; 
let obstacleInterval, coinInterval;
function spawnObstacle() {
    if (isGameOver) return;
    const obstacleType = Math.floor(Math.random() * 2);
    const randomLane = Math.floor(Math.random() * 3);
    let obstacle;
    if (obstacleType === 0) {
        obstacle = new THREE.Mesh(groundObstacleGeometry, obstacleMaterial);
        obstacle.position.y = 0.5;
    } else {
        obstacle = new THREE.Mesh(airObstacleGeometry, obstacleMaterial);
        obstacle.position.y = 1.25;
    }
    obstacle.position.x = lanes[randomLane];
    obstacle.position.z = -trackLength;
    scene.add(obstacle); obstacles.push(obstacle);
}
function spawnCoin() {
    if (isGameOver) return;
    const randomLane = Math.floor(Math.random() * 3);
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);
    coin.position.x = lanes[randomLane];
    coin.position.y = 0.5; 
    coin.position.z = -trackLength;
    scene.add(coin); coins.push(coin);
}

// --- Collision Functions (Same) ---
function checkObstacleCollision(obstacle) {
    if (!player) return false; 
    const playerBox = new THREE.Box3().setFromObject(player);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);
    return playerBox.intersectsBox(obstacleBox);
}
function checkCoinCollision(coin) {
    if (!player) return false;
    const playerBox = new THREE.Box3().setFromObject(player);
    const coinBox = new THREE.Box3().setFromObject(coin);
    return playerBox.intersectsBox(coinBox);
}

// --- Game Over (Same) ---
function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    clearInterval(obstacleInterval);
    clearInterval(coinInterval);
    // crashSound.play();
    finalScoreDisplay.innerText = `Score: ${score}`;
    finalCoinsDisplay.innerText = `Coins: ${coinCount}`;
    gameOverScreen.style.display = 'flex';
}

// --- Restart Game (Same) ---
function restartGame() {
    score = 0; coinCount = 0; isGameOver = false;
    
    if (player) {
        player.position.set(0, playerGroundY, 0);
        player.scale.set(playerNormalScale, playerNormalScale, playerNormalScale);
        currentLane = 1; targetLaneX = lanes[currentLane];
        isGrounded = true; isRolling = false;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) { scene.remove(obstacles[i]); }
    obstacles.length = 0;
    for (let i = coins.length - 1; i >= 0; i--) { scene.remove(coins[i]); }
    coins.length = 0;
    scoreDisplay.innerText = `Score: 0`;
    coinDisplay.innerText = `Coins: 0`;
    gameOverScreen.style.display = 'none';
    startGame();
}
restartButton.addEventListener('click', restartGame);


// --- Game Loop (Updated) ---
function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta(); 
    trackSegment1.position.z += trackSpeed;
    trackSegment2.position.z += trackSpeed;
    if (trackSegment1.position.z >= trackLength) trackSegment1.position.z -= (trackLength * 2);
    if (trackSegment2.position.z >= trackLength) trackSegment2.position.z -= (trackLength * 2);

    if (player && player.children.length > 0) {
        player.position.x = THREE.MathUtils.lerp(player.position.x, targetLaneX, 0.1);
        if (isRolling) {
            rollTimer--;
            if (rollTimer <= 0) {
                isRolling = false;
                player.scale.y = playerNormalScale;
                player.position.y = playerGroundY;
            }
        }
        if (!isGrounded && !isRolling) {
            velocityY += gravity;
            player.position.y += velocityY;
            if (player.position.y <= playerGroundY) {
                player.position.y = playerGroundY;
                velocityY = 0;
                isGrounded = true;
            }
        }
    }
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.position.z += trackSpeed;
        if (obstacle.position.z > camera.position.z) {
            scene.remove(obstacle); obstacles.splice(i, 1);
        }
        if (checkObstacleCollision(obstacle)) {
            gameOver(); return; 
        }
    }
    
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.position.z += trackSpeed;
        if (coin.position.z > camera.position.z) {
            scene.remove(coin); coins.splice(i, 1);
        }
        if (checkCoinCollision(coin)) {
            coinCount++;
            coinDisplay.innerText = `Coins: ${coinCount}`;
            scene.remove(coin);
            coins.splice(i, 1);
            // coinSound.play();
        }
    }
    
    if (!isGameOver) {
        score++; 
        scoreDisplay.innerText = `Score: ${score}`;
    }
    
    if (mixer) {
        mixer.update(delta);
    }
    
    renderer.render(scene, camera);
}

// --- Start Game (Game Over Delay FIX) ---
function startGame() {
    // Obstacle spawn ko 5 second delay kar do
    setTimeout(() => {
        obstacleInterval = setInterval(spawnObstacle, 2000);
    }, 5000); 
    
    coinInterval = setInterval(spawnCoin, 1000);
    animate();
}
startGame();

// --- Resize Function (Same) ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
