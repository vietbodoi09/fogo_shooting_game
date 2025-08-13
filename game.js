(async () => {
    const PAYMASTER_URL = "https://fogoshooting.shop:3000/sponsor"; 
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
    let ship = { x: canvas.width/2-25, y: canvas.height-60, width: 50, height: 20, speed: 4 };
    let bullets = [], enemies = [], enemyBullets = [], particles = [];
    let score = 0, timeLeft = 60000, gameOver = true, keysPressed = {}, lastShotTime = 0;
    let enemySpawnTimer = 0, difficulty = 1;
    let enemyIdCounter = 0;

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
        ship = { x: canvas.width/2-25, y: canvas.height-60, width: 50, height: 20, speed: 4 };
        bullets = []; enemies = []; enemyBullets = []; particles = [];
        score = 0; timeLeft = 60000; gameOver = false;
        enemySpawnTimer = 0; difficulty = 1;
        gameOverOverlay.classList.remove('visible');
        addLog('Game reset');
    }

    function spawnEnemy() {
        const size = 40; 
        const x = Math.random() * (canvas.width - size); 
        const speed = 1 + Math.random() * difficulty;
        enemies.push({ 
            id: enemyIdCounter++,
            x, y: -size, width: size, height: size, speed, 
            shootTimer: 0, 
            shootInterval: 1500/Math.sqrt(difficulty) + Math.random()*500, 
            direction: Math.random()<0.5?1:-1
        });
    }

    function spawnParticles(x, y, color) {
        const count = 10 + Math.floor(Math.random()*5*difficulty);
        for(let i=0;i<count;i++){
            particles.push({
                x, y,
                vx: (Math.random()-0.5)*6,
                vy: (Math.random()-0.5)*6,
                radius: 2 + Math.random()*3,
                color,
                life: 20 + Math.random()*20
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#02111a'; 
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // Ship
        ctx.fillStyle = '#4caf50'; 
        ctx.fillRect(ship.x, ship.y, ship.width, ship.height); 

        // Player bullets
        ctx.fillStyle = '#ffde59'; 
        bullets.forEach(b => ctx.fillRect(b.x,b.y,b.width,b.height)); 

        // Enemies
        ctx.fillStyle = '#d32f2f'; 
        enemies.forEach(e => ctx.fillRect(e.x,e.y,e.width,e.height)); 

        // Enemy bullets
        ctx.fillStyle = '#ff6e6e'; 
        enemyBullets.forEach(b => ctx.fillRect(b.x,b.y,b.width,b.height)); 

        // Particles
        particles.forEach(p=>{
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
            ctx.fill();
        });
    }

    function update(delta) {
        if (gameOver) return;

        // Update time
        timeLeft -= delta; 
        if (timeLeft <= 0) { 
            timeLeft = 0;
            gameOver = true; 
            gameOverOverlay.classList.add('visible'); 
            sendTx('score', score); 
            return;
        }

        scoreTimerEl.textContent = `Score: ${score} | Time: ${Math.ceil(timeLeft/1000)}`; 

        // Difficulty
        difficulty = 1 + (60000 - timeLeft)/60000 * 3;

        // Spawn multiple enemies per frame based on difficulty
        enemySpawnTimer += delta;
        if (enemySpawnTimer > 1000/Math.min(difficulty,5)) { 
            for(let i=0;i<Math.ceil(difficulty);i++) spawnEnemy();
            enemySpawnTimer = 0; 
        }

        // Player bullets
        for(let i=bullets.length-1;i>=0;i--){
            const b = bullets[i];
            b.y -= 8;
            if(b.y < -b.height) bullets.splice(i,1);
            else {
                for(let j=enemies.length-1;j>=0;j--){
                    const e = enemies[j];
                    if(isColliding(b,e)){
                        bullets.splice(i,1); 
                        enemies.splice(j,1);
                        score++;
                        spawnParticles(e.x+e.width/2,e.y+e.height/2,'yellow');

                        // Xóa tất cả đạn của enemy này
                        enemyBullets = enemyBullets.filter(eb => eb.ownerId !== e.id);

                        break;
                    }
                }
            }
        }

        // Enemy bullets
        for(let i=enemyBullets.length-1;i>=0;i--){
            const b = enemyBullets[i];
            b.y += 2 + difficulty; // đạn mạnh hơn theo difficulty
            if(b.y>canvas.height+b.height) enemyBullets.splice(i,1);
            else if(isColliding(b,ship)){
                enemyBullets.splice(i,1);
                gameOver = true;
                gameOverOverlay.classList.add('visible');
                sendTx('score', score);
                return; // dừng update ngay
            }
        }

        // Enemies
        enemies.forEach(e=>{
            e.y += e.speed;
            e.x += e.direction*1.5;
            if(e.x<0 || e.x+e.width>canvas.width) e.direction*=-1;

            e.shootTimer += delta;
            if(e.shootTimer>e.shootInterval){
                e.shootTimer=0;
                const bulletCount = Math.min(3, Math.floor(difficulty));
                for(let i=0;i<bulletCount;i++){
                    const offset = (i - Math.floor(bulletCount/2))*8;
                    enemyBullets.push({ x:e.x+e.width/2-3+offset, y:e.y+e.height, width:6, height:12, speed:2 + Math.random()*difficulty, ownerId:e.id });
                }
            }
        });

        // Particles
        for(let i=particles.length-1;i>=0;i--){
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.life--;
            if(p.life<=0) particles.splice(i,1);
        }

        // Player movement
        if(keysPressed.ArrowLeft){ ship.x -= ship.speed; if(ship.x<0) ship.x=0; }
        if(keysPressed.ArrowRight){ ship.x += ship.speed; if(ship.x+ship.width>canvas.width) ship.x=canvas.width-ship.width; }
    }

    function gameLoop(ts) {
        const delta = ts - (window.lastTs||ts);
        window.lastTs = ts;
        update(delta);
        draw();
        if(!gameOver) requestAnimationFrame(gameLoop);
    }

    // Player shoot
    window.addEventListener('keydown', e=>{
        keysPressed[e.code]=true;
        if(e.code==='Space'){
            if(Date.now()-lastShotTime>200){
                lastShotTime = Date.now();
                if(!playerPubkey){ addLog('Connect wallet first'); return; }
                const body = { action:'shoot', player:playerPubkey.toBase58(), timestamp:Date.now(), shipX:ship.x };
                fetch(PAYMASTER_URL,{
                    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
                })
                .then(async resp=>{
                    if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
                    const data = await resp.json();
                    if(data.txSignature) addLog(`Tx: ${data.txSignature}`);
                    bullets.push({ x:ship.x+ship.width/2-2.5, y:ship.y-10, width:5, height:10 });
                })
                .catch(e=>addLog('Tx error: '+(e.message||e)));
            }
        }
    });
    window.addEventListener('keyup', e=>{ keysPressed[e.code]=false; });

    async function sendTx(action,value=null){
        if(!playerPubkey){ addLog('Connect wallet first'); return; }
        try{
            const body={ action, player:playerPubkey.toBase58() };
            if(action==='register' && xHandle) body.xHandle=xHandle;
            if(action==='score') body.score=value;
            const resp=await fetch(PAYMASTER_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
            if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
            const data=await resp.json();
            if(data.txSignature) addLog(`Tx: ${data.txSignature}`);
        }catch(e){ addLog('Tx error: '+(e.message||e)); }
    }

    async function fetchLeaderboard(){ 
        try{ 
            const resp = await fetch(PAYMASTER_URL+'/leaderboard'); 
            if(!resp.ok){ addLog('Leaderboard fetch error'); return; } 
            const data = await resp.json(); 
            leaderboardList.innerHTML=''; 
            data.forEach(p=>{
                const li=document.createElement('li');
                li.innerHTML=`<span>${p.xHandle||p.player.slice(0,4)+'...'}</span><span>${p.score}</span>`;
                leaderboardList.appendChild(li);
            });
        }catch(e){ addLog('Leaderboard error: '+(e.message||e)); }
    }

    connectBtn.addEventListener('click',async ()=>{
        xHandle = xInput.value.trim();
        const provider = window.solana || (window.nightly && window.nightly.solana);
        if(!provider||!provider.connect){ addLog('Wallet not found'); return; }
        const resp = await provider.connect();
        playerPubkey = resp.publicKey || provider.publicKey;
        addLog('Connected: '+playerPubkey.toBase58());
        connectBtn.disabled=true; xInput.disabled=true;
        await sendTx('register');
        fetchLeaderboard(); resetGame(); requestAnimationFrame(gameLoop);
    });

    resetBtn.addEventListener('click',()=>{ resetGame(); requestAnimationFrame(gameLoop); });

    addLog('Ready. Connect wallet, use ← → to move, Space to shoot.');
    fetchLeaderboard();
})();
