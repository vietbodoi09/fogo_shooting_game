(async () => {
    const PAYMASTER_URL = "https://fogoshooting.shop:3000/sponsor"; // backend phải allow CORS
    const connection = new solanaWeb3.Connection('https://api.testnet.fogo.io', 'confirmed');
    const canvas = document.getElementById('game'); 
    const ctx = canvas.getContext('2d');
    const scoreTimerEl = document.getElementById('scoreTimer');
    const logBox = document.getElementById('logBox');
    const connectBtn = document.getElementById('connectBtn');
    const resetBtn = document.getElementById('resetBtn');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const xInput = document.getElementById('xInput');
    const leaderboardList = document.getElementById('leaderboardList');

    let playerPubkey = null, xHandle = null;
    let ship = { x: canvas.width / 2 - 25, y: canvas.height - 60, width: 50, height: 20, speed: 4 };
    let bullets = [], enemies = [], enemyBullets = [];
    let score = 0, timeLeft = 60000, gameOver = true, keysPressed = {}, lastShotTime = 0;

    function addLog(msg) {
        const div = document.createElement('div'); 
        div.className = 'logEntry'; 
        div.textContent = msg; 
        logBox.prepend(div); 
        if (logBox.childElementCount > 15) logBox.removeChild(logBox.lastChild); 
    }

    function isColliding(a, b) {
        return (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);
    }

    function resetGame() {
        ship = { x: canvas.width / 2 - 25, y: canvas.height - 60, width: 50, height: 20, speed: 4 };
        bullets = []; enemies = []; enemyBullets = [];
        score = 0; timeLeft = 60000; gameOver = false;
        gameOverOverlay.classList.remove('visible');
        addLog('Game reset');
    }

    function spawnEnemy() {
        const size = 40; 
        const x = Math.random() * (canvas.width - size); 
        enemies.push({ x, y: -size, width: size, height: size, speed: 1 + Math.random(), shootTimer: 0, shootInterval: 1500 + Math.random() * 1000 });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#02111a'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height); 

        ctx.fillStyle = '#4caf50'; 
        ctx.fillRect(ship.x, ship.y, ship.width, ship.height); 

        ctx.fillStyle = '#ffde59'; 
        bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height)); 

        ctx.fillStyle = '#d32f2f'; 
        enemies.forEach(e => ctx.fillRect(e.x, e.y, e.width, e.height)); 

        ctx.fillStyle = '#ff6e6e'; 
        enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height)); 
    }

    function update(delta) {
        if (gameOver) return; 
        timeLeft -= delta; 
        if (timeLeft <= 0) { 
            gameOver = true; 
            gameOverOverlay.classList.add('visible'); 
            sendTx('score', score); 
            return; 
        } 
        scoreTimerEl.textContent = `Score: ${score} | Time: ${Math.ceil(timeLeft/1000)}`; 

        if (Math.random() < delta / 2000) spawnEnemy(); 

        bullets.forEach((b, i) => { 
            b.y -= 8; 
            if (b.y < -b.height) bullets.splice(i, 1); 
            enemies.forEach((e, j) => { 
                if (isColliding(b, e)) { 
                    bullets.splice(i, 1); 
                    enemies.splice(j, 1); 
                    score++; 
                } 
            }); 
        }); 

        enemyBullets.forEach((b, i) => { 
            b.y += 2.5; 
            if (b.y > canvas.height + b.height) enemyBullets.splice(i, 1); 
            if (isColliding(b, ship)) { 
                gameOver = true; 
                gameOverOverlay.classList.add('visible'); 
                sendTx('score', score); 
            } 
        }); 

        if (keysPressed.ArrowLeft) { 
            ship.x -= ship.speed; 
            if (ship.x < 0) ship.x = 0; 
        } 
        if (keysPressed.ArrowRight) { 
            ship.x += ship.speed; 
            if (ship.x + ship.width > canvas.width) ship.x = canvas.width - ship.width; 
        } 
    }

    function gameLoop(ts) {
        const delta = ts - (window.lastTs || ts); 
        window.lastTs = ts; 
        update(delta); 
        draw(); 
        if (!gameOver) requestAnimationFrame(gameLoop); 
    }

    // ===== Fire-and-process shoot =====
    window.addEventListener('keydown', e => {
        keysPressed[e.code] = true;

        if (e.code === 'Space') {
            if (Date.now() - lastShotTime > 200) {
                lastShotTime = Date.now();

                if (!playerPubkey) { addLog('Connect wallet first'); return; }

                const body = { action: 'shoot', player: playerPubkey.toBase58(), timestamp: Date.now(), shipX: ship.x };

                fetch(PAYMASTER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
                .then(async resp => {
                    if (!resp.ok) { addLog('Paymaster error ' + resp.status); return; }
                    const data = await resp.json();
                    if (data.txSignature) addLog(`Tx: ${data.txSignature}`);

                    // Đạn bắn ra khi transaction đã process
                    bullets.push({ x: ship.x + ship.width / 2 - 2.5, y: ship.y - 10, width: 5, height: 10 });
                })
                .catch(e => addLog('Tx error: ' + (e.message || e)));
            }
        }
    });

    window.addEventListener('keyup', e => { keysPressed[e.code] = false; });

    async function sendTx(action, value = null) {
        if (!playerPubkey) { addLog('Connect wallet first'); return; }
        try {
            const body = { action, player: playerPubkey.toBase58() };
            if (action === 'register' && xHandle) body.xHandle = xHandle;
            if (action === 'score') body.score = value;
            const resp = await fetch(PAYMASTER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!resp.ok) { addLog('Paymaster error ' + resp.status); return; }
            const data = await resp.json();
            if (data.txSignature) addLog(`Tx: ${data.txSignature}`);
        } catch (e) { addLog('Tx error: ' + (e.message || e)); }
    }

    async function fetchLeaderboard() { 
        try { 
            const resp = await fetch(PAYMASTER_URL + '/leaderboard'); 
            if (!resp.ok) { addLog('Leaderboard fetch error'); return; } 
            const data = await resp.json(); 
            leaderboardList.innerHTML = ''; 
            data.forEach(p => {
                const li = document.createElement('li'); 
                li.innerHTML = `<span>${p.xHandle || p.player.slice(0,4)+'...'}</span><span>${p.score}</span>`; 
                leaderboardList.appendChild(li); 
            }); 
        } catch(e) { addLog('Leaderboard error: '+(e.message||e)); } 
    }

    connectBtn.addEventListener('click', async () => {
        xHandle = xInput.value.trim();
        const provider = window.solana || (window.nightly && window.nightly.solana);
        if (!provider || !provider.connect) { addLog('Wallet not found'); return; }
        const resp = await provider.connect();
        playerPubkey = resp.publicKey || provider.publicKey;
        addLog('Connected: ' + playerPubkey.toBase58());
        connectBtn.disabled = true; xInput.disabled = true;
        await sendTx('register'); 
        fetchLeaderboard(); 
        resetGame(); 
        requestAnimationFrame(gameLoop);
    });

    resetBtn.addEventListener('click', () => { resetGame(); requestAnimationFrame(gameLoop); });

    addLog('Ready. Connect wallet, use ← → to move, Space to shoot.');
    fetchLeaderboard();
})();
