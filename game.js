// game.js - Main game logic for FurboGame

// ==================== GAME INITIALIZATION ====================
class FurboGame {
    constructor() {
        // Game State
        this.gameState = 'MENU'; // MENU, PLAYING, GAME_OVER
        this.score = 0;
        this.gameTime = 0;
        this.playerName = '';
        this.isRegistered = false;
        
        // Chain State
        this.fogoProvider = null;
        this.fogoSession = null;
        this.playerPubkey = null;
        this.programId = null;
        
        // Performance Tracking
        this.performanceStats = {
            movesSent: 0,
            shotsSent: 0,
            pendingTransactions: 0,
            confirmationTimes: [],
            avgConfirmation: 0,
            successRate: 1.0,
            chainSpeed: 0
        };
        
        // Game Objects
        this.player = null;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.keysPressed = {};
        
        // Timing
        this.lastFrameTime = 0;
        this.lastEnemySpawn = 0;
        this.lastShotTime = 0;
        this.lastMoveUpdate = 0;
        
        // DOM Elements
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.initializeElements();
        
        // Load images
        this.loadImages();
        
        // Initialize Fogo Sessions
        this.initializeFogoSessions();
        
        // Start game loop
        this.gameLoop();
        
        // Update stats periodically
        setInterval(() => this.updateDashboard(), 1000);
    }
    
    // ==================== DOM ELEMENT INITIALIZATION ====================
    initializeElements() {
        this.elements = {
            score: document.getElementById('score'),
            time: document.getElementById('time'),
            chainStatus: document.getElementById('chainStatus'),
            sessionStatus: document.querySelector('.session-status span'),
            statusIndicator: document.querySelector('.status-indicator'),
            walletAddress: document.getElementById('walletAddress'),
            sessionAddress: document.getElementById('sessionAddress'),
            walletInfo: document.getElementById('walletInfo'),
            leaderboardList: document.getElementById('leaderboardList'),
            movesSent: document.getElementById('movesSent'),
            shotsSent: document.getElementById('shotsSent'),
            avgConfirm: document.getElementById('avgConfirm'),
            successRate: document.getElementById('successRate'),
            pendingTx: document.getElementById('pendingTx'),
            speedBar: document.getElementById('speedBar'),
            logBox: document.getElementById('logBox'),
            connectBtn: document.getElementById('connectBtn'),
            registerBtn: document.getElementById('registerBtn'),
            startBtn: document.getElementById('startBtn'),
            resetBtn: document.getElementById('resetBtn'),
            playerName: document.getElementById('playerName'),
            benchmarkBtn: document.getElementById('benchmarkBtn')
        };
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Connect button
        this.elements.connectBtn.addEventListener('click', () => this.connectFogoSession());
        
        // Register button
        this.elements.registerBtn.addEventListener('click', () => this.registerPlayer());
        
        // Start game button
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        
        // Reset button
        this.elements.resetBtn.addEventListener('click', () => this.resetGame());
        
        // Benchmark button
        this.elements.benchmarkBtn?.addEventListener('click', () => this.runBenchmark());
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Player name input
        this.elements.playerName.addEventListener('input', (e) => {
            this.elements.registerBtn.disabled = e.target.value.length < 3;
        });
    }
    
    // ==================== FOGO SESSIONS INITIALIZATION ====================
    async initializeFogoSessions() {
        try {
            // Check if FogoSessions is available
            if (typeof FogoSessions === 'undefined') {
                this.log('❌ Fogo Sessions SDK not loaded');
                return;
            }
            
            // Initialize provider
            this.fogoProvider = new FogoSessions.FogoSessionProvider({
                network: FogoSessions.Network.Mainnet,
                sponsor: window.FURBO_GAME_CONFIG.SESSIONS.SPONSOR,
                domain: window.FURBO_GAME_CONFIG.DOMAIN,
                tokens: window.FURBO_GAME_CONFIG.SESSIONS.TOKENS,
                defaultRequestedLimits: window.FURBO_GAME_CONFIG.SESSIONS.DEFAULT_LIMITS
            });
            
            // Get initial session state
            const sessionState = this.fogoProvider.useSession();
            this.updateSessionUI(sessionState);
            
            // Listen for session changes
            this.fogoProvider.onSessionChange((newState) => {
                this.updateSessionUI(newState);
            });
            
            this.log('✅ Fogo Sessions initialized');
            
        } catch (error) {
            this.log(`❌ Fogo Sessions init error: ${error.message}`);
        }
    }
    
    updateSessionUI(sessionState) {
        if (sessionState.type === FogoSessions.SessionStateType.Established) {
            // Connected
            this.fogoSession = sessionState;
            this.playerPubkey = sessionState.walletPublicKey;
            this.programId = new solanaWeb3.PublicKey(window.FURBO_GAME_CONFIG.PROGRAM_ID);
            
            // Update UI
            this.elements.sessionStatus.textContent = 'Connected';
            this.elements.statusIndicator.className = 'status-indicator connected';
            this.elements.chainStatus.textContent = '🟢 Connected to Fogo Mainnet';
            this.elements.chainStatus.className = 'chain-status connected';
            this.elements.walletAddress.textContent = this.playerPubkey.toString().slice(0, 8) + '...';
            this.elements.sessionAddress.textContent = sessionState.sessionPublicKey.toString().slice(0, 8) + '...';
            this.elements.walletInfo.style.display = 'block';
            this.elements.connectBtn.textContent = 'Manage Session';
            this.elements.registerBtn.disabled = !this.elements.playerName.value;
            
            this.log(`✅ Fogo Session connected: ${this.playerPubkey.toString().slice(0, 16)}...`);
            
        } else {
            // Not connected
            this.fogoSession = null;
            this.playerPubkey = null;
            
            // Update UI
            this.elements.sessionStatus.textContent = 'Disconnected';
            this.elements.statusIndicator.className = 'status-indicator';
            this.elements.chainStatus.textContent = '🔴 Not Connected';
            this.elements.chainStatus.className = 'chain-status';
            this.elements.walletInfo.style.display = 'none';
            this.elements.connectBtn.textContent = '🎮 Connect Fogo Session';
            this.elements.registerBtn.disabled = true;
        }
    }
    
    async connectFogoSession() {
        if (!this.fogoProvider) {
            this.log('⚠️ Fogo Sessions not initialized yet');
            return;
        }
        
        const sessionState = this.fogoProvider.useSession();
        
        if (sessionState.type === FogoSessions.SessionStateType.NotEstablished) {
            try {
                this.log('🔄 Establishing Fogo Session...');
                await sessionState.establish();
            } catch (error) {
                this.log(`❌ Session establishment failed: ${error.message}`);
            }
        } else if (sessionState.type === FogoSessions.SessionStateType.Established) {
            this.log('📱 Session management would open here');
            // In real implementation, SDK opens a modal
        }
    }
    
    // ==================== GAME LOGIC ====================
    loadImages() {
        // Create placeholder images (in real game, load actual images)
        this.playerImage = this.createPlaceholderImage(70, 80, '#00d4ff', '▲');
        this.enemyImage = this.createPlaceholderImage(50, 50, '#ff416c', '☠️');
        this.bulletImage = this.createPlaceholderImage(8, 20, '#ffde59', '➤');
    }
    
    createPlaceholderImage(width, height, color, text) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        
        // Draw border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);
        
        // Draw text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width / 2, height / 2);
        
        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    }
    
    startGame() {
        if (this.gameState === 'PLAYING') return;
        
        if (!this.fogoSession) {
            this.log('⚠️ Please connect Fogo Session first');
            return;
        }
        
        if (!this.isRegistered && this.elements.playerName.value) {
            this.registerPlayer();
        }
        
        // Initialize player
        this.player = {
            x: this.canvas.width / 2 - 35,
            y: this.canvas.height - 100,
            width: 70,
            height: 80,
            speed: 8
        };
        
        // Reset game state
        this.score = 0;
        this.gameTime = 0;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.keysPressed = {};
        
        this.gameState = 'PLAYING';
        this.elements.startBtn.textContent = '⏸️ PAUSE';
        this.log('🚀 Game started!');
    }
    
    resetGame() {
        this.gameState = 'MENU';
        this.score = 0;
        this.gameTime = 0;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        
        this.elements.startBtn.textContent = '🚀 START GAME';
        this.updateUI();
        this.log('🔄 Game reset');
    }
    
    handleKeyDown(e) {
        if (this.gameState !== 'PLAYING') return;
        
        this.keysPressed[e.code] = true;
        
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            // Send movement to chain if real-time movement is enabled
            if (window.FURBO_GAME_CONFIG.FEATURES.REAL_TIME_MOVEMENT) {
                this.sendMoveToChain(e.code);
            }
        }
        
        if (e.code === 'Space') {
            e.preventDefault();
            this.shoot();
        }
    }
    
    handleKeyUp(e) {
        this.keysPressed[e.code] = false;
    }
    
    shoot() {
        if (this.gameState !== 'PLAYING') return;
        
        const now = Date.now();
        if (now - this.lastShotTime < window.FURBO_GAME_CONFIG.GAME.FIRE_RATE) return;
        
        this.lastShotTime = now;
        
        // Create bullet
        this.bullets.push({
            x: this.player.x + this.player.width / 2 - 4,
            y: this.player.y - 20,
            width: 8,
            height: 20,
            speed: 15
        });
        
        // Send shoot transaction to chain
        this.sendShootToChain();
        
        // Create muzzle flash particles
        this.createParticles(this.player.x + this.player.width / 2, this.player.y, 10, '#ffff00');
    }
    
    sendMoveToChain(direction) {
        if (!this.fogoSession || !this.playerPubkey) return;
        
        this.performanceStats.movesSent++;
        this.performanceStats.pendingTransactions++;
        this.updatePerformanceDashboard();
        
        const moveData = {
            action: 'move',
            direction: direction,
            playerX: this.player.x,
            playerY: this.player.y,
            timestamp: Date.now()
        };
        
        this.sendTransaction(moveData, 'move')
            .then(() => {
                this.performanceStats.pendingTransactions--;
                this.updatePerformanceDashboard();
            })
            .catch(() => {
                this.performanceStats.pendingTransactions--;
                this.updatePerformanceDashboard();
            });
    }
    
    sendShootToChain() {
        if (!this.fogoSession || !this.playerPubkey) return;
        
        this.performanceStats.shotsSent++;
        this.performanceStats.pendingTransactions++;
        this.updatePerformanceDashboard();
        
        const shootData = {
            action: 'shoot',
            playerX: this.player.x,
            playerY: this.player.y,
            timestamp: Date.now()
        };
        
        this.sendTransaction(shootData, 'shoot')
            .then(() => {
                this.performanceStats.pendingTransactions--;
                this.updatePerformanceDashboard();
            })
            .catch(() => {
                this.performanceStats.pendingTransactions--;
                this.updatePerformanceDashboard();
            });
    }
    
    async sendTransaction(data, type) {
        if (!this.fogoSession || !this.playerPubkey) {
            throw new Error('No active session');
        }
        
        const startTime = performance.now();
        
        try {
            const instruction = new solanaWeb3.TransactionInstruction({
                keys: [
                    { pubkey: this.playerPubkey, isSigner: true, isWritable: true },
                    { pubkey: this.programId, isSigner: false, isWritable: false }
                ],
                programId: this.programId,
                data: Buffer.from(JSON.stringify(data))
            });
            
            const signature = await this.fogoSession.sendTransaction([instruction]);
            const confirmTime = performance.now() - startTime;
            
            // Update performance stats
            this.performanceStats.confirmationTimes.push(confirmTime);
            if (this.performanceStats.confirmationTimes.length > 100) {
                this.performanceStats.confirmationTimes.shift();
            }
            
            this.performanceStats.avgConfirmation = 
                this.performanceStats.confirmationTimes.reduce((a, b) => a + b, 0) / 
                this.performanceStats.confirmationTimes.length;
            
            // Calculate chain speed (transactions per second)
            const recentTransactions = this.performanceStats.movesSent + this.performanceStats.shotsSent;
            this.performanceStats.chainSpeed = Math.min(recentTransactions / 10, 100);
            
            this.log(`✅ ${type} confirmed in ${confirmTime.toFixed(0)}ms`);
            return signature;
            
        } catch (error) {
            this.log(`❌ ${type} failed: ${error.message}`);
            throw error;
        }
    }
    
    // ==================== GAME LOOP ====================
    gameLoop(timestamp = 0) {
        const deltaTime = timestamp - this.lastFrameTime || 0;
        this.lastFrameTime = timestamp;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.drawBackground();
        
        if (this.gameState === 'PLAYING') {
            this.updateGame(deltaTime);
            this.drawGame();
        } else {
            this.drawMenu();
        }
        
        // Draw particles (always)
        this.updateParticles(deltaTime);
        this.drawParticles();
        
        // Draw UI
        this.drawUI();
        
        // Continue game loop
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
    
    updateGame(deltaTime) {
        // Update game time
        this.gameTime += deltaTime;
        
        // Update player movement
        if (this.keysPressed['ArrowLeft']) {
            this.player.x = Math.max(0, this.player.x - this.player.speed);
        }
        if (this.keysPressed['ArrowRight']) {
            this.player.x = Math.min(this.canvas.width - this.player.width, 
                                    this.player.x + this.player.speed);
        }
        
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.y -= bullet.speed;
            
            // Remove bullets that are off screen
            if (bullet.y + bullet.height < 0) {
                this.bullets.splice(i, 1);
                continue;
            }
            
            // Check collision with enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                if (this.checkCollision(bullet, enemy)) {
                    // Remove bullet and enemy
                    this.bullets.splice(i, 1);
                    this.enemies.splice(j, 1);
                    
                    // Add score
                    this.score += 100;
                    
                    // Create explosion particles
                    this.createParticles(enemy.x + enemy.width / 2, 
                                        enemy.y + enemy.height / 2, 
                                        20, '#ff0000');
                    
                    break;
                }
            }
        }
        
        // Spawn enemies
        if (Date.now() - this.lastEnemySpawn > window.FURBO_GAME_CONFIG.GAME.ENEMY_SPAWN_RATE) {
            this.spawnEnemy();
            this.lastEnemySpawn = Date.now();
        }
        
        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.y += enemy.speed;
            
            // Remove enemies that are off screen
            if (enemy.y > this.canvas.height) {
                this.enemies.splice(i, 1);
                continue;
            }
            
            // Check collision with player
            if (this.checkCollision(this.player, enemy)) {
                this.gameOver();
                break;
            }
        }
        
        // Update score with time bonus
        if (deltaTime > 0) {
            this.score += Math.floor(deltaTime / 100); // 1 point per 100ms
        }
        
        // Update UI
        this.updateUI();
    }
    
    spawnEnemy() {
        const x = Math.random() * (this.canvas.width - 50);
        const speed = 1 + Math.random() * 2;
        
        this.enemies.push({
            x: x,
            y: -50,
            width: 50,
            height: 50,
            speed: speed
        });
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    gameOver() {
        this.gameState = 'GAME_OVER';
        this.elements.startBtn.textContent = '🚀 PLAY AGAIN';
        
        // Send game over to chain
        if (this.fogoSession) {
            this.sendGameOverToChain();
        }
        
        this.log(`🎮 Game Over! Final Score: ${this.score}`);
    }
    
    async sendGameOverToChain() {
        const gameOverData = {
            action: 'game_over',
            score: this.score,
            playerName: this.playerName,
            gameTime: this.gameTime,
            timestamp: Date.now()
        };
        
        try {
            await this.sendTransaction(gameOverData, 'game_over');
            this.log(`🏆 Score ${this.score} saved to chain!`);
        } catch (error) {
            this.log(`❌ Failed to save score: ${error.message}`);
        }
    }
    
    // ==================== DRAWING ====================
    drawBackground() {
        // Draw gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#02111a');
        gradient.addColorStop(1, '#0a1a2a');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.05)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawGame() {
        // Draw player
        if (this.player) {
            this.ctx.drawImage(this.playerImage, this.player.x, this.player.y, 
                             this.player.width, this.player.height);
        }
        
        // Draw bullets
        this.ctx.fillStyle = '#ffde59';
        this.bullets.forEach(bullet => {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });
        
        // Draw enemies
        this.enemies.forEach(enemy => {
            this.ctx.drawImage(this.enemyImage, enemy.x, enemy.y, enemy.width, enemy.height);
        });
    }
    
    drawMenu() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        if (this.gameState === 'MENU') {
            this.ctx.fillText('FURBO GAME', this.canvas.width / 2, this.canvas.height / 2 - 50);
            this.ctx.font = '24px Arial';
            this.ctx.fillText('Connect Fogo Session to Start', this.canvas.width / 2, this.canvas.height / 2 + 20);
        } else if (this.gameState === 'GAME_OVER') {
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 50);
            this.ctx.font = '36px Arial';
            this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        }
    }
    
    drawUI() {
        // Draw score and time in top-left
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`SCORE: ${this.score}`, 20, 30);
        this.ctx.fillText(`TIME: ${Math.floor(this.gameTime / 1000)}s`, 20, 60);
    }
    
    createParticles(x, y, count, color) {
        if (!window.FURBO_GAME_CONFIG.FEATURES.PARTICLES_EFFECTS) return;
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                radius: Math.random() * 4 + 2,
                color: color,
                life: 1.0,
                decay: 0.95
            });
        }
    }
    
    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            p.radius *= p.decay;
            
            if (p.life <= 0 || p.radius < 0.1) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;
    }
    
    // ==================== UI UPDATES ====================
    updateUI() {
        this.elements.score.textContent = this.score;
        this.elements.time.textContent = Math.floor(this.gameTime / 1000);
    }
    
    updateDashboard() {
        this.elements.movesSent.textContent = this.performanceStats.movesSent;
        this.elements.shotsSent.textContent = this.performanceStats.shotsSent;
        this.elements.avgConfirm.textContent = `${Math.floor(this.performanceStats.avgConfirmation)}ms`;
        this.elements.successRate.textContent = `${(this.performanceStats.successRate * 100).toFixed(1)}%`;
        this.elements.pendingTx.textContent = this.performanceStats.pendingTransactions;
        this.elements.speedBar.style.width = `${this.performanceStats.chainSpeed}%`;
    }
    
    updatePerformanceDashboard() {
        // Update dashboard elements
        this.elements.movesSent.textContent = this.performanceStats.movesSent;
        this.elements.shotsSent.textContent = this.performanceStats.shotsSent;
        this.elements.avgConfirm.textContent = `${Math.floor(this.performanceStats.avgConfirmation)}ms`;
        
        // Calculate success rate
        const totalTransactions = this.performanceStats.movesSent + this.performanceStats.shotsSent;
        const failedTransactions = Math.max(0, totalTransactions - this.performanceStats.confirmationTimes.length);
        this.performanceStats.successRate = totalTransactions > 0 ? 
            (totalTransactions - failedTransactions) / totalTransactions : 1.0;
        
        this.elements.successRate.textContent = `${(this.performanceStats.successRate * 100).toFixed(1)}%`;
        this.elements.pendingTx.textContent = this.performanceStats.pendingTransactions;
        
        // Update speed bar
        const recentMoves = this.performanceStats.movesSent % 100; // Last 100 moves
        this.performanceStats.chainSpeed = Math.min(recentMoves, 100);
        this.elements.speedBar.style.width = `${this.performanceStats.chainSpeed}%`;
    }
    
    // ==================== PLAYER REGISTRATION ====================
    async registerPlayer() {
        const name = this.elements.playerName.value.trim();
        if (name.length < 3) {
            this.log('⚠️ Name must be at least 3 characters');
            return;
        }
        
        if (!this.fogoSession) {
            this.log('⚠️ Connect Fogo Session first');
            return;
        }
        
        this.playerName = name;
        
        const registerData = {
            action: 'register',
            playerName: name,
            timestamp: Date.now()
        };
        
        try {
            await this.sendTransaction(registerData, 'register');
            this.isRegistered = true;
            this.elements.registerBtn.disabled = true;
            this.elements.playerName.disabled = true;
            this.log(`✅ Registered as ${name}`);
        } catch (error) {
            this.log(`❌ Registration failed: ${error.message}`);
        }
    }
    
    // ==================== LOGGING ====================
    log(message) {
        console.log(message);
        
        if (!window.FURBO_GAME_CONFIG.FEATURES.TRANSACTION_LOGGING) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        this.elements.logBox.prepend(logEntry);
        
        // Keep only last 20 entries
        while (this.elements.logBox.children.length > 20) {
            this.elements.logBox.removeChild(this.elements.logBox.lastChild);
        }
    }
    
    // ==================== BENCHMARK ====================
    async runBenchmark() {
        if (!this.fogoSession) {
            this.log('⚠️ Connect Fogo Session first');
            return;
        }
        
        this.log('⚡ Starting chain benchmark...');
        
        const testIntervals = [100, 50, 33, 16]; // ms
        const results = [];
        
        for (const interval of testIntervals) {
            const result = await this.runBenchmarkTest(interval);
            results.push(result);
        }
        
        // Display results
        this.log('='.repeat(50));
        this.log('🎯 BENCHMARK RESULTS:');
        results.forEach(r => {
            this.log(`${r.name}: ${r.tps.toFixed(1)} TPS, ${r.avgConfirm.toFixed(0)}ms avg, ${(r.successRate * 100).toFixed(1)}% success`);
        });
        this.log('='.repeat(50));
    }
    
    async runBenchmarkTest(interval) {
        const duration = 5000; // 5 seconds
        const startTime = Date.now();
        let movesSent = 0;
        let movesConfirmed = 0;
        const confirmTimes = [];
        
        return new Promise((resolve) => {
            const testInterval = setInterval(async () => {
                if (Date.now() - startTime > duration) {
                    clearInterval(testInterval);
                    
                    const result = {
                        name: `${interval}ms`,
                        interval: interval,
                        movesSent: movesSent,
                        movesConfirmed: movesConfirmed,
                        duration: duration,
                        successRate: movesConfirmed / movesSent,
                        avgConfirm: confirmTimes.length > 0 ? 
                            confirmTimes.reduce((a, b) => a + b) / confirmTimes.length : 0,
                        tps: (movesConfirmed / (duration / 1000))
                    };
                    
                    resolve(result);
                    return;
                }
                
                movesSent++;
                const testStart = performance.now();
                
                try {
                    const testData = {
                        action: 'benchmark',
                        test: `interval_${interval}`,
                        move_number: movesSent,
                        timestamp: Date.now()
                    };
                    
                    const instruction = new solanaWeb3.TransactionInstruction({
                        keys: [
                            { pubkey: this.playerPubkey, isSigner: true, isWritable: true }
                        ],
                        programId: this.programId,
                        data: Buffer.from(JSON.stringify(testData))
                    });
                    
                    await this.fogoSession.sendTransaction([instruction]);
                    movesConfirmed++;
                    confirmTimes.push(performance.now() - testStart);
                    
                } catch (error) {
                    console.warn('Benchmark move failed:', error);
                }
                
            }, interval);
        });
    }
}

// ==================== INITIALIZE GAME ====================
// Wait for page to load
window.addEventListener('load', () => {
    // Check for required dependencies
    if (typeof solanaWeb3 === 'undefined') {
        alert('Error: Solana Web3.js not loaded. Please check your internet connection.');
        return;
    }
    
    if (typeof FogoSessions === 'undefined') {
        alert('Error: Fogo Sessions SDK not loaded. Please check your internet connection.');
        return;
    }
    
    // Initialize game
    window.furboGame = new FurboGame();
    
    // Add some sample leaderboard data
    setTimeout(() => {
        const sampleData = [
            { name: 'FogoMaster', score: 12500 },
            { name: 'ChainWarrior', score: 9800 },
            { name: 'BlockHero', score: 7600 },
            { name: 'CryptoNinja', score: 5400 },
            { name: 'You', score: 0 }
        ];
        
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = '';
        
        sampleData.forEach(player => {
            const row = document.createElement('div');
            row.className = 'player-row';
            row.innerHTML = `
                <span>${player.name}</span>
                <span>${player.score}</span>
            `;
            leaderboardList.appendChild(row);
        });
    }, 1000);
});
