(async () => {
    const PAYMASTER_URL = "https://fogoshooting.shop:3000/sponsor";

    // --- Canvas & UI ---
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

    // --- Images ---
    const shipImg = new Image(); shipImg.src = 'ship.png';
    const enemyImg = new Image(); enemyImg.src = 'enemy1.png';

    // --- Game state ---
    let playerPubkey = null, xHandle = null;
    let ship, bullets=[], enemies=[], enemyBullets=[], particles=[];
    let score=0, timeLeft=60000, gameOver=true, keysPressed={};
    let enemySpawnTimer=0, difficulty=1;

    // --- Transaction pending counter ---
    let pendingTxCount = 0;
    const MAX_PENDING_TX = 5;

    function addLog(msg){
        const div = document.createElement('div');
        div.className='logEntry';
        div.textContent=msg;
        logBox.prepend(div);
        if(logBox.childElementCount>15) logBox.removeChild(logBox.lastChild);
    }

    function isColliding(a,b){
        return a.x<a.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
    }

    function resetGame(){
        ship={x:canvas.width/2-25,y:canvas.height-110,width:70,height:80,speed:4};
        bullets=[]; enemies=[]; enemyBullets=[]; particles=[];
        score=0; timeLeft=60000; gameOver=false;
        enemySpawnTimer=0; difficulty=1;
        gameOverOverlay.classList.remove('visible');
        addLog('Game reset.');
    }

    function spawnEnemy(){
        const size=50;
        const x=Math.random()*(canvas.width-size);
        const speed=1+Math.random()*difficulty;
        enemies.push({x,y:-size,width:size,height:size,speed,shootTimer:0,shootInterval:1500+Math.random()*1000/difficulty,direction:Math.random()<0.5?1:-1,img:enemyImg});
    }

    function draw(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#02111a';
        ctx.fillRect(0,0,canvas.width,canvas.height);

        if(shipImg.complete) ctx.drawImage(shipImg,ship.x,ship.y,ship.width,ship.height);

        ctx.fillStyle='#ffde59';
        bullets.forEach(b=>ctx.fillRect(b.x,b.y,b.width,b.height));

        enemies.forEach(e=>{
            if(e.img && e.img.complete) ctx.drawImage(e.img,e.x,e.y,e.width,e.height);
            else {ctx.fillStyle='red';ctx.fillRect(e.x,e.y,e.width,e.height);}
        });

        ctx.fillStyle='#ff6e6e';
        enemyBullets.forEach(b=>ctx.fillRect(b.x,b.y,b.width,b.height));

        particles.forEach(p=>{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();});
    }

    function update(delta){
        if(gameOver) return;
        timeLeft-=delta;
        enemySpawnTimer+=delta;

        if(enemySpawnTimer>1200/difficulty){ spawnEnemy(); enemySpawnTimer=0; }

        if(keysPressed.ArrowLeft){ ship.x-=ship.speed; if(ship.x<0) ship.x=0; }
        if(keysPressed.ArrowRight){ ship.x+=ship.speed; if(ship.x+ship.width>canvas.width) ship.x=canvas.width-ship.width; }

        // Player bullets
        for(let i=bullets.length-1;i>=0;i--){
            const b=bullets[i]; b.y-=8;
            if(b.y<-b.height){ bullets.splice(i,1); continue; }
            for(let j=enemies.length-1;j>=0;j--){
                const e=enemies[j];
                if(isColliding(b,e)){ bullets.splice(i,1); enemies.splice(j,1); score++; break; }
            }
        }

        // Enemy bullets
        for(let i=enemyBullets.length-1;i>=0;i--){
            const b=enemyBullets[i]; b.y+=b.speed;
            if(b.y>canvas.height+b.height){ enemyBullets.splice(i,1); continue; }
            if(isColliding(b,ship)){ gameOver=true; gameOverOverlay.classList.add('visible'); sendTx('score',score); break; }
        }

        // Enemies
        for(let i=enemies.length-1;i>=0;i--){
            const e=enemies[i]; e.y+=e.speed; e.x+=e.direction*1.5;
            if(e.x<0||e.x+e.width>canvas.width) e.direction*=-1;
            if(e.y>canvas.height){ enemies.splice(i,1); continue; }
            e.shootTimer+=delta;
            if(e.shootTimer>e.shootInterval){
                e.shootTimer=0;
                enemyBullets.push({x:e.x+e.width/2-4,y:e.y+e.height,width:8,height:14,speed:2+Math.random()*2});
            }
            if(isColliding(ship,e)){ gameOver=true; gameOverOverlay.classList.add('visible'); sendTx('score',score); break; }
        }

        scoreTimerEl.textContent=`Score: ${score} | Time: ${Math.ceil(Math.max(timeLeft,0)/1000)}`;
        difficulty=1+(60000-timeLeft)/60000;
        if(timeLeft<=0){ gameOver=true; gameOverOverlay.classList.add('visible'); sendTx('score',score); }
    }

    function gameLoop(ts){ const delta=ts-(window.lastTs||ts); window.lastTs=ts; update(delta); draw(); requestAnimationFrame(gameLoop); }

    window.addEventListener('keydown', e=>{ keysPressed[e.code]=true; });
    window.addEventListener('keyup', e=>{ keysPressed[e.code]=false; });

    // --- Shoot with pending tx logic ---
    window.addEventListener('keydown', async e=>{
        if(e.code!=='Space'||gameOver) return;
        if(!playerPubkey){ addLog('Register first'); return; }
        if(pendingTxCount>=MAX_PENDING_TX){ addLog('Wait for previous transactions to confirm'); return; }

        // bắn ngay
        bullets.push({x:ship.x+ship.width/2-5,y:ship.y-12,width:10,height:18});

        // gửi transaction
        pendingTxCount++;
        const body={action:'shoot',player:playerPubkey.toBase58(),timestamp:Date.now(),shipX:ship.x};
        try{
            const resp=await fetch(PAYMASTER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
            if(!resp.ok){ addLog('Paymaster error '+resp.status); }
            else{
                const data=await resp.json();
                if(data.txSignature) addLog(`Tx: ${data.txSignature}`);
            }
        }catch(err){ addLog('Tx error: '+(err.message||err)); }
        finally{ pendingTxCount--; }
    });

    async function sendTx(action,value=null){
        if(!playerPubkey){ addLog('Register first'); return; }
        try{
            const body={action,player:playerPubkey.toBase58()};
            if(action==='register'&&xHandle) body.xHandle=xHandle;
            if(action==='score') body.score=value;
            const resp=await fetch(PAYMASTER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
            if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
            const data=await resp.json();
            if(data.txSignature) addLog(`Tx: ${data.txSignature}`);
        }catch(e){ addLog('Tx error: '+(e.message||e)); }
    }

    async function fetchLeaderboard(){
        try{
            const resp=await fetch(PAYMASTER_URL+'/leaderboard');
            if(!resp.ok){ addLog('Leaderboard fetch error'); return; }
            const data=await resp.json();
            leaderboardList.innerHTML='';
            data.forEach(p=>{
                const li=document.createElement('li');
                li.innerHTML=`<span>${p.xHandle||p.player.slice(0,4)+'...'}</span><span>${p.score}</span>`;
                leaderboardList.appendChild(li);
            });
        }catch(e){ addLog('Leaderboard error: '+(e.message||e));}
    }

    registerBtn.addEventListener('click', async ()=>{
        const walletAddr=walletInput.value.trim(), xHandleVal=xInput.value.trim();
        if(!walletAddr||!xHandleVal){ addLog('Enter X handle & wallet'); return; }
        let pubkey;
        try{ pubkey=new solanaWeb3.PublicKey(walletAddr); }
        catch(e){ addLog('Invalid wallet'); return; }
        playerPubkey=pubkey; xHandle=xHandleVal;
        try{
            const body={action:'register',player:playerPubkey.toBase58(),xHandle};
            const resp=await fetch(PAYMASTER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
            if(!resp.ok){ addLog('Paymaster error '+resp.status); return; }
            const data=await resp.json();
            if(data.txSignature){ addLog(`Registered ${xHandle} | Tx: ${data.txSignature}`);
                registerBtn.disabled=true; walletInput.disabled=true; xInput.disabled=true;
                resetGame(); requestAnimationFrame(gameLoop);
            }else addLog('No tx returned from paymaster');
        }catch(err){ addLog('Register error: '+(err.message||err)); }
    });

    resetBtn.addEventListener('click',()=>{ resetGame(); });

    addLog('Ready. Enter X handle & wallet, then press Register. Use ← → to move, Space to shoot.');
    fetchLeaderboard(); setInterval(fetchLeaderboard,5000);

})();
