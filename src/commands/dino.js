'use strict';

const { sendRichHtml } = require('./richhtml');

function buildDinoHtml() {
    return `<body style="margin:0;background:#10131c;font-family:Arial,sans-serif;color:#fff;touch-action:manipulation;">
<div style="max-width:560px;margin:auto;padding:14px;box-sizing:border-box;">
  <div style="background:#1a2030;border:1px solid #3a4660;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px #0008;">
    <div style="padding:15px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #3a4660;">
      <div><div style="font-size:11px;letter-spacing:1.5px;color:#aab4ca;">INNERBOT MINI GAME</div><b style="font-size:21px;">Dino Runner</b></div>
      <div style="text-align:right;"><b id="dino-score" style="font-size:19px;">00000</b><div id="dino-best" style="font-size:10px;color:#aab4ca;">BEST 00000</div></div>
    </div>
    <div style="padding:14px;"><canvas id="dino-canvas" width="520" height="180" style="width:100%;height:auto;display:block;background:#111722;border:1px solid #3a4660;border-radius:10px;"></canvas>
      <div id="dino-status" style="text-align:center;color:#aab4ca;font-size:12px;margin-top:9px;">Tap layar untuk lompat</div>
    </div>
  </div>
</div>
<script>
(function(){
  var canvas=document.getElementById('dino-canvas'),ctx=canvas.getContext('2d'),scoreEl=document.getElementById('dino-score'),bestEl=document.getElementById('dino-best'),statusEl=document.getElementById('dino-status');
  var dino,obstacles,score,best=0,speed,gameOver,last,spawn;
  try{best=Number(localStorage.getItem('innerbot_dino_best'))||0}catch(e){}
  function reset(){dino={x:48,y:126,w:25,h:30,vy:0,onGround:true};obstacles=[];score=0;speed=5;gameOver=false;spawn=80;last=0;statusEl.textContent='Tap layar untuk lompat';}
  function jump(){if(gameOver){reset();return;}if(dino.onGround){dino.vy=-12;dino.onGround=false;}}
  function hit(a,b){return a.x+3<b.x+b.w&&a.x+a.w-3>b.x&&a.y+3<b.y+b.h&&a.y+a.h>b.y;}
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111722';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#5a6988';ctx.setLineDash([10,8]);ctx.lineDashOffset=-score;ctx.beginPath();ctx.moveTo(0,157);ctx.lineTo(canvas.width,157);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f3f4f6';ctx.fillRect(dino.x,dino.y,dino.w,dino.h);ctx.fillRect(dino.x+20,dino.y+4,12,17);ctx.fillStyle='#8b7bff';ctx.fillRect(dino.x+27,dino.y+8,3,3);
    obstacles.forEach(function(o){ctx.fillStyle='#ef8181';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillRect(o.x-6,o.y+9,6,5);ctx.fillRect(o.x+o.w,o.y+15,6,5);});
    if(gameOver){ctx.fillStyle='#000a';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 24px Arial';ctx.fillText('GAME OVER',canvas.width/2,76);ctx.font='14px Arial';ctx.fillText('Tap untuk main lagi',canvas.width/2,106);ctx.textAlign='left';}}
  function loop(t){if(!last)last=t;var dt=Math.min((t-last)/16.67,2);last=t;if(!gameOver){dino.y+=dino.vy*dt;dino.vy+=.72*dt;if(dino.y>=126){dino.y=126;dino.vy=0;dino.onGround=true;}spawn-=dt;if(spawn<=0){var h=25+Math.random()*25;obstacles.push({x:canvas.width+15,y:157-h,w:17,h:h});spawn=Math.max(42,82-speed*3)+Math.random()*35;}obstacles.forEach(function(o){o.x-=speed*dt;});obstacles=obstacles.filter(function(o){return o.x>-35;});speed=Math.min(11,speed+.0016*dt);score+=dt*.62;for(var i=0;i<obstacles.length;i++)if(hit(dino,obstacles[i])){gameOver=true;if(score>best){best=Math.floor(score);try{localStorage.setItem('innerbot_dino_best',best)}catch(e){}}statusEl.textContent='Skor akhir: '+Math.floor(score);}}
    scoreEl.textContent=String(Math.floor(score)).padStart(5,'0');bestEl.textContent='BEST '+String(Math.floor(best)).padStart(5,'0');draw();requestAnimationFrame(loop);}
  document.addEventListener('pointerdown',function(e){e.preventDefault();jump();},{passive:false});reset();requestAnimationFrame(loop);
}());
</script></body>`;
}

module.exports = {
    name: 'msg',
    aliases: ['dino', 'game'],
    description: 'Mengirim kartu game Dino Runner interaktif.',
    adminOnly: true,

    async execute({ sock, remoteJid, reply }) {
        try {
            await sendRichHtml(sock, remoteJid, {
                id: 'innerbot-dino',
                title: 'Dino Runner',
                html: buildDinoHtml(),
                source: 'innerbot-shop',
            });
        } catch (error) {
            console.error('[DINO]', error?.message || error);
            await reply({ text: '❌ Gagal mengirim game HTML.' });
        }
        return true;
    },
};

module.exports._test = { buildDinoHtml };
