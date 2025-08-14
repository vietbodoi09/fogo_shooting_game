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
    let ship, bullets, enemies, enemyBullets, particles;
    let score, timeLeft, gameOver, keysPressed = {}, enemySpawnTimer, difficulty;

    const connection = new solanaWeb3.Connection("https://testnet.fogo.io", "confirmed");
    const assets = { shipImg: new Image(), enemyImgs: [] };

    // Load assets
    function loadAssets() {
        return new Promise(resolve => {
            let loadedCount = 0;
            const totalAssets = 1 + 5;
            const onAssetLoad = () => { loadedCount++; if (loadedCount === totalAssets) resolve(); };
            assets.shipImg.onload = onAssetLoad; assets.shipImg.src = 'ship.png';
            ['enemy1.png','enemy2.png','enemy3.png','enemy4.png','enemy5.png'].forEach(src => {
                const img = new Image(); img.onload=onAssetLoad; img.src=src; assets.enemyImgs.push(img);
            });
        });
    }

    function addLog(msg){
        const div=document.createElement('div'); div.className='logEntry'; div.textContent=msg;
        logBox.prepend(div); if(logBox.childElementCount>15) logBox.removeChild(logBox.lastChild);
    }

    function isColliding(a,b){
        return a.x<a.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
    }

    function resetGame(){
        ship={x:canvas.width/2-25, y:canvas.height-110, width:70, height:80, speed:4};
        bullets=[]; enemies=[]; enemyBullets=[]; particles=[];
        score=0; timeLeft=60000; gameOver=false;
        enemySpawnTimer=0; difficulty=1; keysPressed={};
        gameOverOverlay.classList.remove('visible'); window.lastTs=undefined;
        addLog('Game reset.');
    }

    function spawnEnemy(){
        const size=40, x=Math.random()*(canvas.width-size), speed=1+Math.random()*difficulty;
        const img=assets.enemyImgs[Math.floor(Math.random()*assets.enemyImgs.length)];
        enemies.push({ x, y:-size, width:size, height:size, speed, shootTimer:0, shootInterval:1500+Math.random()*1000/difficulty, direction:Math.random()<0.5?1:-1, img });
    }

    function spawnParticles(x,y,color){
        const count=10+Math.floor(Math.random()*5);
        for(let i=0;i<count;i++) particles.push({ x,y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, radius:2+Math.random()*2, color, life:20+Math.random()*10 });
    }

    function draw(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#02111a'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(assets.shipImg, ship.x, ship.y, ship.width, ship.height);
        ctx.fillStyle='#ffde59'; bullets.forEach(b=>ctx.fillRect(b.x,b.y,b.width,b.height));
        enemies.forEach(e=>ctx.drawImage(e.img,e.x,e.y,e.width,e.height));
        ctx.fillStyle='#ff6e6e'; enemyBullets.forEach(b=>ctx.fillRect(b.x,b.y,b.width,b.height));
        particles.forEach(p=>{ ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill(); });
    }

    function update(delta){
        if(!gameOver){
            timeLeft-=delta;
            if(timeLeft<=0){ gameOver=true; gameOverOverlay.classList.add('visible'); sendTx('score',score); }
            scoreTimerEl.textContent=`Score: ${score} | Time: ${Math.ceil(timeLeft/1000)}`;
            difficulty=1+(60000-timeLeft)/60000;

            enemySpawnTimer+=delta;
            if(enemySpawnTimer>1200/difficulty){ spawnEnemy(); enemySpawnTimer=0; }

            if(keysPressed.ArrowLeft){ ship.x-=ship.speed; if(ship.x<0) ship.x=0; }
            if(keysPressed.ArrowRight){ ship.x+=ship.speed; if(ship.x+ship.width>canvas.width) ship.x=canvas.width-ship.width; }

            // bullets
            for(let i=bullets.length-1;i>=0;i--){
                const b=bullets[i]; b.y-=8; if(b.y<-b.height){ bullets.splice(i,1); continue; }
                for(let j=enemies.length-1;j>=0;j--){
                    if(isColliding(b,enemies[j])){
                        spawnParticles(enemies[j].x+enemies[j].width/2,enemies[j].y+enemies[j].height/2,'yellow');
                        enemyBullets=enemyBullets.filter(eb=>!(eb.x>enemies[j].x && eb.x<enemies[j].x+enemies[j].width && eb.y>enemies[j].y && eb.y<enemies[j].y+enemies[j].height));
                        enemies.splice(j,1); bullets.splice(i,1); score++; break;
                    }
                }
            }

            // enemy bullets
            for(let i=enemyBullets.length-1;i>=0;i--){
                const b=enemyBullets[i]; b.y+=b.speed; if(b.y>canvas.height+b.height){ enemyBullets.splice(i,1); continue; }
                if(isColliding(b,ship)){ gameOver=true; gameOverOverlay.classList.add('visible'); sendTx('score',score); }
            }

            // enemies
            for(let i=enemies.length-1;i>=0;i--){
                const e=enemies[i]; e.y+=e.speed; e.x+=e.direction*1.5;
                if(e.x<0||e.x+e.width>canvas.width) e.direction*=-1;
                if(e.y>canvas.height){ enemies.splice(i,1); continue; }
                e.shootTimer+=delta;
                if(e.shootTimer>e.shootInterval){ e.shootTimer=0; enemyBullets.push({x:e.x+e.width/2-3,y:e.y+e.height,width:6,height:12,speed:2+Math.random()*2}); }
                if(isColliding(ship,e)){ gameOver=true; gameOverOverlay.classList.add('visible'); sendTx('score',score); }
            }

            for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life--; if(p.life<=0) particles.splice(i,1); }
        }
    }

    function gameLoop(ts){ const delta=ts-(window.lastTs||ts); window.lastTs=ts; update(delta); draw(); requestAnimationFrame(gameLoop); }

    window.addEventListener('keydown', e=>{ keysPressed[e.code]=true; });
    window.addEventListener('keyup', e=>{ keysPressed[e.code]=false; });

    // Space bắn → gọi Paymaster, push bullet sau khi tx trả về
    window.addEventListener('keydown', async e=>{
        if(e.code!=='Space'||!playerPubkey||gameOver) return;
        const body={action:'shoot', player:playerPubkey.toBase58(), timestamp:Date.now(), shipX:ship.x};
        try{
            const resp=await fetch(PAYMASTER_URL,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
            if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
            const data=await resp.json();
            if(data.txSignature){
                addLog(`Tx: ${data.txSignature}`);
                bullets.push({ x: ship.x+ship.width/2-2.5, y: ship.y-10, width:5, height:10 });
            }
        } catch(err){ addLog('Shoot error: '+(err.message||err)); }
    });

    async function sendTx(action,value=null){
        if(!playerPubkey){ addLog('Register first'); return; }
        try{
            const body={ action, player:playerPubkey.toBase58() };
            if(action==='register' && xHandle) body.xHandle=xHandle;
            if(action==='score') body.score=value;
            const resp=await fetch(PAYMASTER_URL,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
            if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
            const data=await resp.json();
            if(data.txSignature) addLog(`Tx: ${data.txSignature}`);
        } catch(e){ addLog('Tx error: '+(e.message||e)); }
    }

    async function fetchLeaderboard(){
        try{
            const resp = await fetch(PAYMASTER_URL+'/leaderboard');
            if(!resp.ok){ addLog('Leaderboard fetch error'); return; }
            const data=await resp.json(); leaderboardList.innerHTML='';
            data.forEach(p=>{ const li=document.createElement('li'); li.innerHTML=`<span>${p.xHandle||p.player.slice(0,4)+'...'}</span><span>${p.score}</span>`; leaderboardList.appendChild(li); });
        } catch(e){ addLog('Leaderboard error: '+(e.message||e)); }
    }

    registerBtn.addEventListener('click', async ()=>{
        const walletAddr=walletInput.value.trim(), xHandleVal=xInput.value.trim();
        if(!walletAddr||!xHandleVal){ addLog('Enter X handle & wallet'); return; }
        let pubkey; try{ pubkey=new solanaWeb3.PublicKey(walletAddr); } catch(e){ addLog('Invalid wallet'); return; }
        playerPubkey=pubkey; xHandle=xHandleVal;
        try{
            const body={ action:'register', player:playerPubkey.toBase58(), xHandle };
            const resp=await fetch(PAYMASTER_URL,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
            if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
            const data=await resp.json();
            if(data.txSignature){
                addLog(`Registered ${xHandle} | Tx: ${data.txSignature}`);
                registerBtn.disabled=true; walletInput.disabled=true; xInput.disabled=true;
                resetGame();
            } else addLog('No tx returned');
        } catch(err){ addLog('Registration error: '+(err.message||err)); }
    });

    resetBtn.addEventListener('click', ()=>{ resetGame(); });
    addLog('Loading game assets...'); await loadAssets();
    addLog('Ready. Enter X handle & wallet, press Register. Use ← → to move, Space to shoot.');
    fetchLeaderboard(); setInterval(fetchLeaderboard,5000);
    requestAnimationFrame(gameLoop);
})();
