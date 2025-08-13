(async () => {
    const PAYMASTER_URL = "https://fogoshooting.shop:3000/sponsor"; 
    const canvas = document.getElementById('game'); 
    const ctx = canvas.getContext('2d');
    const scoreTimerEl = document.getElementById('scoreTimer');
    const logBox = document.getElementById('logBox');
    const xInput = document.getElementById('xInput');
    const walletInput = document.getElementById('walletInput');
    const registerBtn = document.getElementById('registerBtn');
    const resetBtn = document.getElementById('resetBtn');
    const leaderboardList = document.getElementById('leaderboardList');
    const gameOverOverlay = document.getElementById('gameOverOverlay');

    let playerPubkey = null, xHandle = null;
    let ship = { x: canvas.width/2-25, y: canvas.height-60, width: 50, height: 20, speed: 4 };
    let bullets = [], enemies = [], enemyBullets = [], particles = [];
    let score = 0, timeLeft = 60000, gameOver = true, keysPressed = {}, lastShotTime = 0;
    let enemySpawnTimer = 0, difficulty = 1;

    const connection = new solanaWeb3.Connection("https://testnet.fogo.io", "confirmed");

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
            x, y: -size, width: size, height: size, speed, 
            shootTimer: 0, 
            shootInterval: 1500 + Math.random()*1000/difficulty, 
            direction: Math.random()<0.5?1:-1
        });
    }

    function spawnParticles(x, y, color) {
        const count = 10 + Math.floor(Math.random()*5);
        for(let i=0;i<count;i++){
            particles.push({
                x, y,
                vx: (Math.random()-0.5)*4,
                vy: (Math.random()-0.5)*4,
                radius: 2 + Math.random()*2,
                color,
                life: 20 + Math.random()*10
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

        timeLeft -= delta; 
        if (timeLeft <= 0) { 
            gameOver = true; 
            gameOverOverlay.classList.add('visible');
            sendTx('score', score); 
            return; 
        } 
        scoreTimerEl.textContent = `Score: ${score} | Time: ${Math.ceil(timeLeft/1000)}`; 

        difficulty = 1 + (60000 - timeLeft)/60000; 

        enemySpawnTimer += delta;
        if (enemySpawnTimer > 1200/difficulty) { 
            spawnEnemy(); 
            enemySpawnTimer = 0; 
        }

        // Player bullets
        bullets.forEach((b,i)=>{
            b.y -= 8;
            if (b.y < -b.height) bullets.splice(i,1);
            enemies.forEach((e,j)=>{
                if(isColliding(b,e)){
                    bullets.splice(i,1); enemies.splice(j,1);
                    score++;
                    spawnParticles(e.x+e.width/2,e.y+e.height/2,'yellow');
                    // Remove enemy bullets hitting this enemy
                    enemyBullets = enemyBullets.filter(eb=>!(eb.x>e.x && eb.x<e.x+e.width && eb.y>e.y && eb.y<e.y+e.height));
                }
            });
        });

        // Enemy bullets
        enemyBullets.forEach((b,i)=>{
            b.y += b.speed;
            if(b.y>canvas.height+b.height) enemyBullets.splice(i,1);
            if(isColliding(b,ship)){
                gameOver = true;
                gameOverOverlay.classList.add('visible');
                sendTx('score', score);
            }
        });

        // Enemies
        enemies.forEach(e=>{
            e.y += e.speed;
            e.x += e.direction*1.5;
            if(e.x<0 || e.x+e.width>canvas.width) e.direction*=-1;

            e.shootTimer += delta;
            if(e.shootTimer>e.shootInterval){
                e.shootTimer=0;
                const bulletSpeed = 2 + Math.random()*2;
                enemyBullets.push({ x:e.x+e.width/2-3, y:e.y+e.height, width:6, height:12, speed:bulletSpeed });
            }

            if(isColliding(ship,e)){
                gameOver = true;
                gameOverOverlay.classList.add('visible');
                sendTx('score', score);
            }
        });

        // Particles
        particles.forEach((p,i)=>{
            p.x += p.vx; p.y += p.vy; p.life--;
            if(p.life<=0) particles.splice(i,1);
        });

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

    window.addEventListener('keydown', e=>{
        keysPressed[e.code]=true;
        if(e.code==='Space'){
            if(Date.now()-lastShotTime>0.1){
                lastShotTime = Date.now();
                if(!playerPubkey){ addLog('Register first'); return; }
                bullets.push({ x:ship.x+ship.width/2-2.5, y:ship.y-10, width:5, height:10 });
                const body = { action:'shoot', player:playerPubkey.toBase58(), timestamp:Date.now(), shipX:ship.x };
                fetch(PAYMASTER_URL,{
                    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
                }).then(async resp=>{
                    if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
                    const data = await resp.json();
                    if(data.txSignature) addLog(`Tx: ${data.txSignature}`);
                }).catch(e=>addLog('Tx error: '+(e.message||e)));
            }
        }
    });
    window.addEventListener('keyup', e=>{ keysPressed[e.code]=false; });

    async function sendTx(action,value=null){
        if(!playerPubkey){ addLog('Register first'); return; }
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

    registerBtn.addEventListener('click', async ()=>{
        const walletAddr = walletInput.value.trim();
        const xHandleVal = xInput.value.trim();
        if(!walletAddr || !xHandleVal){ addLog('Enter X handle and wallet'); return; }

        let pubkey;
        try{ pubkey = new solanaWeb3.PublicKey(walletAddr); } 
        catch(e){ addLog('Invalid wallet address'); return; }

        const balance = await connection.getBalance(pubkey);
        if(balance/1e9 < 0.1){ addLog('Wallet must have ≥0.1 FOGO'); return; }

        playerPubkey = pubkey; xHandle = xHandleVal;

        await sendTx('register');
        addLog(`Registered ${xHandle} (${playerPubkey.toBase58()})`);
        registerBtn.disabled=true; walletInput.disabled=true; xInput.disabled=true;

        resetGame();
        requestAnimationFrame(gameLoop);
    });

    resetBtn.addEventListener('click',()=>{ resetGame(); requestAnimationFrame(gameLoop); });

    addLog('Ready. Enter X handle & wallet, then press Register. Use ← → to move, Space to shoot.');
    fetchLeaderboard();
    setInterval(fetchLeaderboard,5000);
})();
