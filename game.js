// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size to fill screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const scoreElement = document.getElementById('score');
const healthValueElement = document.getElementById('healthValue');
const healthBarFillElement = document.getElementById('healthBarFill');

// Input State
const keyState = {
    left: false,
    right: false,
    up: false,
    down: false
};

function resetKeyState() {
    keyState.left = false;
    keyState.right = false;
    keyState.up = false;
    keyState.down = false;
}

// Game State
let gameState = 'menu'; // menu, playing, gameOver
let score = 0;
let health = 100;
let lastTime = 0;
let enemySpawnTimer = 0;
let enemySpawnInterval = 2000; // spawn enemy every 2 seconds

// Game Objects
let player = null;
let bullets = [];
let enemies = [];
let explosions = [];
let powerUps = [];

// Touch Controls
let touchX = 0;
let touchY = 0;
let isTouching = false;

// Player Class (Airplane)
class Player {
    constructor() {
        this.width = 50;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 0.45; // pixels per millisecond
        this.color = '#4facfe';
        this.fireRate = 300; // milliseconds between shots (lower = faster)
        this.dualShot = false; // whether to shoot two bullets
    }

    update(deltaTime) {
        const step = this.speed * deltaTime;
        let moveX = 0;
        let moveY = 0;

        if (keyState.left) moveX -= 1;
        if (keyState.right) moveX += 1;
        if (keyState.up) moveY -= 1;
        if (keyState.down) moveY += 1;

        if (moveX !== 0 || moveY !== 0) {
            const length = Math.hypot(moveX, moveY) || 1;
            this.x += (moveX / length) * step;
            this.y += (moveY / length) * step;
        } else if (isTouching) {
            const targetX = touchX - this.width / 2;
            const targetY = touchY - this.height / 2;
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distance = Math.hypot(dx, dy);

            if (distance > step) {
                this.x += (dx / distance) * step;
                this.y += (dy / distance) * step;
            } else {
                this.x = targetX;
                this.y = targetY;
            }
        }

        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Airplane body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(-this.width / 3, this.height / 2);
        ctx.lineTo(0, this.height / 3);
        ctx.lineTo(this.width / 3, this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Airplane wings
        ctx.fillStyle = '#3a8bcd';
        ctx.fillRect(-this.width / 2, -5, this.width / 4, 10);
        ctx.fillRect(this.width / 4, -5, this.width / 4, 10);

        // Cockpit
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -this.height / 4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    shoot() {
        const centerX = this.x + this.width / 2;
        if (this.dualShot) {
            // Shoot two bullets side by side
            bullets.push(new Bullet(centerX - 12, this.y, -1));
            bullets.push(new Bullet(centerX + 12, this.y, -1));
        } else {
            bullets.push(new Bullet(centerX, this.y, -1));
        }
    }

    upgradeFireRate() {
        this.fireRate = Math.max(100, this.fireRate - 50); // Increase fire rate (decrease delay)
    }

    enableDualShot() {
        this.dualShot = true;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Bullet Class
class Bullet {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 5;
        this.height = 15;
        this.speed = 8;
        this.direction = direction; // -1 for up (player), 1 for down (enemy)
        this.color = direction === -1 ? '#ffd700' : '#ff4444';
    }

    update() {
        this.y += this.speed * this.direction;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);

        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }

    isOffScreen() {
        return this.y < 0 || this.y > canvas.height;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Enemy Class (Space Vehicle)
class Enemy {
    constructor() {
        this.width = 45;
        this.height = 35;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = 2 + Math.random() * 2;
        this.shootTimer = 0;
        this.shootInterval = 1500 + Math.random() * 1000;
        this.color = `hsl(${Math.random() * 60 + 300}, 70%, 50%)`; // Purple/pink colors
    }

    update() {
        this.y += this.speed;
        this.shootTimer += 16; // Assuming ~60fps

        // Enemy shoots at player
        if (this.shootTimer >= this.shootInterval) {
            this.shoot();
            this.shootTimer = 0;
            this.shootInterval = 1500 + Math.random() * 1000;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Enemy spaceship body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2);
        ctx.lineTo(-this.width / 3, -this.height / 2);
        ctx.lineTo(0, -this.height / 3);
        ctx.lineTo(this.width / 3, -this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Enemy wings
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-this.width / 2, 0, this.width / 4, 8);
        ctx.fillRect(this.width / 4, 0, this.width / 4, 8);
        ctx.globalAlpha = 1.0;

        // Enemy core/glow
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(0, this.height / 4, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    shoot() {
        bullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 1));
    }

    isOffScreen() {
        return this.y > canvas.height;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Explosion Effect
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.life = 30;

        // Create particles
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                color: `hsl(${Math.random() * 60}, 100%, 50%)`,
                size: Math.random() * 5 + 2
            });
        }
    }

    update() {
        this.life--;
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.2; // gravity
        });
    }

    draw() {
        this.particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    isDead() {
        return this.life <= 0;
    }
}

// PowerUp Class
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 40; // Increased size for better visibility
        this.height = 40;
        this.speed = 2; // Slightly faster
        this.type = type; // 'fireRate' or 'dualShot'
        this.rotation = 0;
        this.pulse = 0;
    }

    update() {
        this.y += this.speed;
        this.rotation += 0.05;
        this.pulse += 0.1;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        const pulseScale = 1 + Math.sin(this.pulse) * 0.1;
        const glowColor = this.type === 'fireRate' ? '#ff9800' : '#00bcd4';

        // Draw glow effect
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2 * pulseScale * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.rotate(this.rotation);

        if (this.type === 'fireRate') {
            // Fire rate power-up - orange/red color
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width / 2);
            gradient.addColorStop(0, '#ffeb3b');
            gradient.addColorStop(0.5, '#ff9800');
            gradient.addColorStop(1, '#ff6f00');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2 * pulseScale, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ff6f00';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw lightning bolt shape
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-3, -8);
            ctx.lineTo(2, -8);
            ctx.lineTo(-2, 0);
            ctx.lineTo(3, 0);
            ctx.lineTo(-1, 8);
            ctx.lineTo(-4, 8);
            ctx.lineTo(1, 0);
            ctx.lineTo(-3, 0);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'dualShot') {
            // Dual shot power-up - blue/cyan color
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width / 2);
            gradient.addColorStop(0, '#81d4fa');
            gradient.addColorStop(0.5, '#00bcd4');
            gradient.addColorStop(1, '#0097a7');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2 * pulseScale, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#0097a7';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw two bullets
            ctx.fillStyle = '#fff';
            ctx.fillRect(-8, -6, 4, 12);
            ctx.fillRect(4, -6, 4, 12);

            // Add circles on bullets
            ctx.fillStyle = '#00bcd4';
            ctx.beginPath();
            ctx.arc(-6, -4, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(6, -4, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    isOffScreen() {
        return this.y > canvas.height;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Collision Detection
function checkCollision(obj1, obj2) {
    const rect1 = obj1.getBounds();
    const rect2 = obj2.getBounds();

    return rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y;
}

// Game Functions
function initGame() {
    player = new Player();
    bullets = [];
    enemies = [];
    explosions = [];
    powerUps = [];
    score = 0;
    health = 100;
    enemySpawnTimer = 0;
    isTouching = false;
    resetKeyState();
    updateUI();
}

// Spawn power-up when enemy is killed
function spawnPowerUp(x, y) {
    // 60% chance to spawn a power-up (increased for better gameplay)
    if (Math.random() < 0.6) {
        const types = ['fireRate', 'dualShot'];
        const type = types[Math.floor(Math.random() * types.length)];
        powerUps.push(new PowerUp(x, y, type));
    }
}

function updateGame(deltaTime) {
    if (gameState !== 'playing') return;

    // Update player
    player.update(deltaTime);

    // Spawn enemies
    enemySpawnTimer += deltaTime;
    if (enemySpawnTimer >= enemySpawnInterval) {
        enemies.push(new Enemy());
        enemySpawnTimer = 0;
        // Increase difficulty over time
        enemySpawnInterval = Math.max(800, enemySpawnInterval - 20);
    }

    // Update bullets (iterate backwards to safely remove items)
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].isOffScreen()) {
            bullets.splice(i, 1);
        }
    }

    // Update enemies (iterate backwards to safely remove items)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();

        // Check collision with player
        if (checkCollision(player, enemy)) {
            const enemyX = enemy.x + enemy.width / 2;
            const enemyY = enemy.y + enemy.height / 2;
            health -= 10;
            explosions.push(new Explosion(enemyX, enemyY));
            spawnPowerUp(enemyX, enemyY);
            enemies.splice(i, 1);
            updateUI();
            if (health <= 0) {
                gameOver();
                return;
            }
            continue;
        }

        // Check if enemy is off screen
        if (enemy.isOffScreen()) {
            enemies.splice(i, 1);
        }
    }

    // Check bullet collisions (iterate backwards)
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (bullet.direction === -1) { // Player bullet
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (checkCollision(bullet, enemy)) {
                    const enemyX = enemy.x + enemy.width / 2;
                    const enemyY = enemy.y + enemy.height / 2;
                    explosions.push(new Explosion(enemyX, enemyY));
                    spawnPowerUp(enemyX, enemyY);
                    enemies.splice(j, 1);
                    bullets.splice(i, 1);
                    score += 10;
                    updateUI();
                    break; // Bullet hit an enemy, remove it and continue
                }
            }
        } else { // Enemy bullet
            if (checkCollision(bullet, player)) {
                health -= 5;
                bullets.splice(i, 1);
                updateUI();
                if (health <= 0) {
                    gameOver();
                    return;
                }
            }
        }
    }

    // Update explosions (iterate backwards to safely remove items)
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].update();
        if (explosions[i].isDead()) {
            explosions.splice(i, 1);
        }
    }

    // Update power-ups (iterate backwards to safely remove items)
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.update();

        // Check collision with player (with slightly larger collision box for easier collection)
        const powerUpBounds = powerUp.getBounds();
        const playerBounds = player.getBounds();

        // Expand collision box by 5 pixels for easier collection
        const expandedBounds = {
            x: powerUpBounds.x - 5,
            y: powerUpBounds.y - 5,
            width: powerUpBounds.width + 10,
            height: powerUpBounds.height + 10
        };

        const expandedPlayerBounds = {
            x: playerBounds.x - 5,
            y: playerBounds.y - 5,
            width: playerBounds.width + 10,
            height: playerBounds.height + 10
        };

        if (expandedBounds.x < expandedPlayerBounds.x + expandedPlayerBounds.width &&
            expandedBounds.x + expandedBounds.width > expandedPlayerBounds.x &&
            expandedBounds.y < expandedPlayerBounds.y + expandedPlayerBounds.height &&
            expandedBounds.y + expandedBounds.height > expandedPlayerBounds.y) {

            if (powerUp.type === 'fireRate') {
                player.upgradeFireRate();
            } else if (powerUp.type === 'dualShot') {
                player.enableDualShot();
            }
            powerUps.splice(i, 1);
            // Visual feedback - add a small explosion
            explosions.push(new Explosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2));
        } else if (powerUp.isOffScreen()) {
            powerUps.splice(i, 1);
        }
    }
}

function drawGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw stars background
    drawStars();

    if (gameState === 'playing' && player) {
        // Draw game objects
        player.draw();

        bullets.forEach(bullet => bullet.draw());
        enemies.forEach(enemy => enemy.draw());
        // Draw power-ups
        powerUps.forEach(powerUp => {
            powerUp.draw();
        });
        explosions.forEach(explosion => explosion.draw());
    }
}

// Draw stars background
const stars = [];
function initStars() {
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

function drawStars() {
    ctx.fillStyle = '#fff';
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// UI Updates
function updateUI() {
    if (scoreElement) {
        scoreElement.textContent = score;
    }

    const clampedHealth = Math.max(0, Math.min(100, Math.round(health)));
    if (healthValueElement) {
        healthValueElement.textContent = clampedHealth + '%';
    }

    if (healthBarFillElement) {
        healthBarFillElement.style.width = clampedHealth + '%';
        if (clampedHealth <= 25) {
            healthBarFillElement.style.background = 'linear-gradient(90deg, #ff5252, #ff1744)';
        } else if (clampedHealth <= 50) {
            healthBarFillElement.style.background = 'linear-gradient(90deg, #ffc107, #ff9800)';
        } else {
            healthBarFillElement.style.background = 'linear-gradient(90deg, #4caf50, #8bc34a)';
        }
    }
}

function gameOver() {
    gameState = 'gameOver';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
    document.getElementById('gameInfo').style.display = 'none';
}

// Event Listeners
document.getElementById('startBtn').addEventListener('click', () => {
    gameState = 'playing';
    document.getElementById('gameInfo').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    initGame();
    initStars();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    gameState = 'playing';
    document.getElementById('gameInfo').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    initGame();
    initStars();
});

// Touch Controls
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = touch.clientX - rect.left;
    touchY = touch.clientY - rect.top;
    isTouching = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = touch.clientX - rect.left;
    touchY = touch.clientY - rect.top;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouching = false;
});

// Mouse controls for desktop testing
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    touchX = e.clientX - rect.left;
    touchY = e.clientY - rect.top;
    isTouching = true;
});

canvas.addEventListener('mousemove', (e) => {
    if (isTouching) {
        const rect = canvas.getBoundingClientRect();
        touchX = e.clientX - rect.left;
        touchY = e.clientY - rect.top;
    }
});

canvas.addEventListener('mouseup', () => {
    isTouching = false;
});

// Keyboard controls
const KEY_BINDINGS = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down'
};

function handleKeyChange(event, isPressed) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const action = KEY_BINDINGS[key] || KEY_BINDINGS[event.key];
    if (action) {
        event.preventDefault();
        keyState[action] = isPressed;
        if (isPressed) {
            isTouching = false;
        }
    }
}

document.addEventListener('keydown', (event) => {
    handleKeyChange(event, true);

    if ((event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') && gameState === 'playing' && player) {
        event.preventDefault();
        player.shoot();
    }
});

document.addEventListener('keyup', (event) => {
    handleKeyChange(event, false);
});

// Shoot button
document.getElementById('shootBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'playing' && player) {
        player.shoot();
    }
});

document.getElementById('shootBtn').addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (gameState === 'playing' && player) {
        player.shoot();
    }
});

// Auto-shoot for player
let autoShootTimer = 0;
function autoShoot(deltaTime) {
    if (gameState === 'playing' && player) {
        autoShootTimer += deltaTime;
        if (autoShootTimer >= player.fireRate) {
            player.shoot();
            autoShootTimer = 0;
        }
    }
}

// Game Loop
function gameLoop(currentTime) {
    if (lastTime === 0) {
        lastTime = currentTime;
    }
    const deltaTime = Math.min(currentTime - lastTime, 100); // Cap deltaTime to prevent large jumps
    lastTime = currentTime;

    updateGame(deltaTime);
    drawGame();
    autoShoot(deltaTime);

    requestAnimationFrame(gameLoop);
}

// Initialize stars
initStars();

// Start game loop
requestAnimationFrame(gameLoop);
