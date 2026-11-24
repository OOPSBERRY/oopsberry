import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, onValue, off, push, remove, onDisconnect, runTransaction } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

const firebaseConfig={apiKey:'AIzaSyCO6d8xemPjvrd4_twdiouZ4vG-AlFiexo',authDomain:'drawdrawonthewall.firebaseapp.com',databaseURL:'https://drawdrawonthewall-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'drawdrawonthewall',storageBucket:'drawdrawonthewall.firebasestorage.app',messagingSenderId:'843622460328',appId:'1:843622460328:web:64e4cb2c8760a9e00d8b9d'};
const app=initializeApp(firebaseConfig),db=getDatabase(app),auth=getAuth(app); const APP_VERSION='v8';
const BOARD_COLOR='#2f4a3a';
const COLORS=['#f0f0e0','#e63946','#ff6b35','#f4a261','#f4d35e','#2a9d8f','#457b9d','#9b5de5'],DEFAULT_WORDS=['사과','고양이','학교','축구공','비행기','나비','수박','로봇'];
const BANNED_PATTERNS=[/씨발|시발|쉬발|쉬벌|시벌|십팔|ㅅㅂ|ㅆㅂ|ㅅ\s*ㅂ/i,/병신|븅신|ㅂㅅ|ㅂ\s*ㅅ/i,/미친|ㅁㅊ|ㅁ\s*ㅊ|지랄|염병|개새|꺼져|존나|좆|좇/i,/섹스|ㅅㅅ|성기|자지|보지|야동|포르노|딸딸|음경|질|애무|가슴빨/i,/fuck|f\s*u\s*c\s*k|shit|bitch|sex|porn|dick|pussy/i,/보\s*지|자\s*지|씨\s*발|시\s*발|병\s*신/i,/[ㅂㅈ]{2,}|[ㅈㄹ]{2,}|[ㅅㅂ]{2,}/i];
let myId=localStorage.getItem('gm_uid'); if(!myId){myId='u_'+Math.random().toString(36).slice(2,11);localStorage.setItem('gm_uid',myId)}
let myName='',myRole='',roomCode='',roomRef,playersRef,gameRef,chatRef,canvasRef,settingsRef,timerInterval=null,listeners={},canvasEventsBound=false,isDrawer=false,drawing=false,erasing=false,brushSize=8,brushColor=COLORS[0],undoStack=[],nextRoundScheduled=false,lastCelebrationKey='',currentRoundSeen=0,rulesCountdownTimer=null,audioCtx=null,soundEnabled=true,rulesShownForRoom=false,lastWrongPopupKey='',lastDrawerTurnKey='';
let playersCache = {};
let gameCache = {};
const canvas=document.getElementById('drawCanvas'),ctx=canvas.getContext('2d');
window.selectRole=selectRole;window.showScreen=showScreen;window.createRoom=createRoom;window.joinRoom=joinRoom;window.startGame=startGame;window.nextRound=nextRound;window.submitAnswer=submitAnswer;window.backToLobby=backToLobby;window.clearCanvas=clearCanvas;window.toggleEraser=toggleEraser;window.undoCanvas=undoCanvas;window.toggleSound=toggleSound;window.copyRoomCode=copyRoomCode;window.copyJoinLink=copyJoinLink;window.skipRules=skipRules;window.playAgain=playAgain;

let authPromise=null;
function ensureAnonymousAuth(){
if(!authPromise){
  authPromise=signInAnonymously(auth).then(cred=>{myId=cred.user.uid;localStorage.setItem('gm_uid',myId)}).catch(e=>{authPromise=null;throw e});
}
return authPromise;
}
function withTimeout(promise,ms){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error('TIMEOUT'),{code:'TIMEOUT'})),ms))])}
function describeFirebaseError(e){
const code=String(e?.code||e?.message||'unknown');
if(/too-many-requests/i.test(code))return `같은 인터넷(IP)에서 로그인 요청이 너무 많아 일시적으로 막혔어요. 잠시 후 다시 시도하거나 휴대폰 핫스팟으로 연결해 보세요.\n\n오류 코드: ${code}`;
if(/operation-not-allowed|admin-restricted/i.test(code))return `Firebase에서 익명 로그인이 꺼져 있어요. 관리자에게 알려주세요.\n\n오류 코드: ${code}`;
if(/permission.denied/i.test(code))return `서버가 요청을 거부했어요. 페이지를 새로고침해 보고, 계속되면 이 화면을 관리자에게 보내주세요.\n\n오류 코드: ${code}`;
if(/network|offline|timeout|unavailable/i.test(code))return `서버에 연결하지 못했어요. 학교 인터넷이나 보안 프로그램이 막고 있을 수 있으니 휴대폰 핫스팟으로 연결해 보세요.\n\n오류 코드: ${code}`;
return `문제가 생겼어요. 이 화면을 관리자에게 보내주세요.\n\n오류 코드: ${code}`;
}
function showScreen(id){document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));document.getElementById(id).classList.add('active')}
let toastTimer=null;
function toast(msg,tone='error'){const el=document.getElementById('toast');el.textContent=msg;el.classList.toggle('error',tone==='error');el.classList.remove('hidden');if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),Math.max(2600,String(msg).length*70))}
document.getElementById('toast').addEventListener('click',e=>e.currentTarget.classList.add('hidden'));
function todayKey(){return new Date().toISOString().slice(0,10).replace(/-/g,'')}
function showCenterPopup(title,sub,ms=2200,tone='success'){const p=document.getElementById('centerPopup'),t=document.getElementById('centerPopupTitle'),s=document.getElementById('centerPopupSub');t.textContent=title;s.textContent=sub;p.classList.toggle('fail',tone==='fail');p.classList.remove('hidden');setTimeout(()=>p.classList.add('hidden'),ms)}
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{})}
function playTone(freq=660,duration=.12,type='sine',gainValue=.05){if(!soundEnabled)return; try{ensureAudio(); const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(); osc.type=type;osc.frequency.value=freq;gain.gain.value=gainValue;osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration)}catch(e){console.error(e)}}
function playCorrectSound(){playTone(660,.08,'triangle',.04);setTimeout(()=>playTone(880,.1,'triangle',.04),90);setTimeout(()=>playTone(1040,.12,'triangle',.04),200)}
function playFailSound(){playTone(320,.14,'sawtooth',.035);setTimeout(()=>playTone(250,.18,'sawtooth',.035),120)}
function showRulesOverlay(){const o=document.getElementById('rulesOverlay'),c=document.getElementById('rulesCountdown');let left=20;c.textContent=left;document.getElementById('skipRulesBtn').classList.toggle('hidden',myRole!=='teacher');o.classList.remove('hidden');rulesShownForRoom=true;if(rulesCountdownTimer)clearInterval(rulesCountdownTimer);rulesCountdownTimer=setInterval(()=>{left-=1;c.textContent=left;if(left<=0){clearInterval(rulesCountdownTimer);o.classList.add('hidden')}},1000)}
function hideRulesOverlay(){if(rulesCountdownTimer)clearInterval(rulesCountdownTimer);rulesCountdownTimer=null;document.getElementById('rulesOverlay').classList.add('hidden')}
async function skipRules(){hideRulesOverlay();if(myRole==='teacher'&&gameRef){try{await update(gameRef,{rulesSkipped:true})}catch(e){console.error(e)}}}
function joinLink(){return `${location.origin}${location.pathname}?code=${roomCode}`}
async function copyText(text,doneMsg){try{await navigator.clipboard.writeText(text);toast(doneMsg,'info')}catch(e){toast('복사하지 못했어요. 직접 선택해서 복사해 주세요.\n'+text)}}
function copyRoomCode(){if(roomCode)copyText(roomCode,`방 코드 ${roomCode}를 복사했어요.`)}
function copyJoinLink(){if(roomCode)copyText(joinLink(),'참여 링크를 복사했어요.')}
function renderQr(){const wrap=document.getElementById('qrWrap'),box=document.getElementById('qrBox');box.innerHTML='';if(myRole!=='teacher'||typeof window.qrcode!=='function'){wrap.classList.add('hidden');return}try{const qr=window.qrcode(0,'M');qr.addData(joinLink());qr.make();box.innerHTML=qr.createImgTag(6,0);wrap.classList.remove('hidden')}catch(e){console.error(e);wrap.classList.add('hidden')}}
function clearBoard(){ctx.fillStyle=BOARD_COLOR;ctx.fillRect(0,0,canvas.width,canvas.height)}
function normalizeForFilter(text){return String(text||'').toLowerCase().replace(/[!@#$%^&*()_+=\-{}\[\]:;"'`,.<>/?\\|~]/g,'').replace(/\s+/g,'')}
function sanitizeAnswer(text){return String(text||'').replace(/\s+/g,' ').trim()} function containsBannedWord(text){const n=normalizeForFilter(text);return BANNED_PATTERNS.some(rx=>rx.test(n))}
async function attachPresence(name){const presRef=ref(db,`presence/${myId}`); await set(presRef,{name,ts:Date.now()}); onDisconnect(presRef).remove(); const userRef=ref(db,`stats/users/${myId}`),snap=await get(userRef),user=snap.val(); if(!user?.firstSeen) await runTransaction(ref(db,'stats/counters/totalUsers'),v=>(v||0)+1); if(user?.lastDate!==todayKey()) await runTransaction(ref(db,`stats/counters/daily_${todayKey()}`),v=>(v||0)+1); await update(userRef,{firstSeen:user?.firstSeen||Date.now(),lastDate:todayKey(),name})}
async function loadStats(){try{await ensureAnonymousAuth()}catch(e){console.error(e);return}if(myRole!=='teacher'||roomCode)return;addListener('stat_presence',ref(db,'presence'),snap=>{document.getElementById('statOnline').textContent=Object.keys(snap.val()||{}).length},console.error);addListener('stat_counters',ref(db,'stats/counters'),snap=>{const v=snap.val()||{};document.getElementById('statTotal').textContent=v.totalUsers||0;document.getElementById('statToday').textContent=v[`daily_${todayKey()}`]||0},console.error)}
function selectRole(role){
myRole=role;
detachAllListeners();
localStorage.removeItem('gm_session');
roomCode='';
if(role==='teacher'){
  showScreen('screenTeacherHome');
  loadStats();
}else{
  showScreen('screenStudentHome');
  document.getElementById('studentName').value='';
  document.getElementById('roomCodeInput').value='';
}
}
function initRefs(){roomRef=ref(db,`rooms/${roomCode}`);playersRef=ref(db,`rooms/${roomCode}/players`);gameRef=ref(db,`rooms/${roomCode}/game`);chatRef=ref(db,`rooms/${roomCode}/chat`);canvasRef=ref(db,`rooms/${roomCode}/canvas`);settingsRef=ref(db,`rooms/${roomCode}/settings`)}
function addListener(key,targetRef,callback,onError){if(listeners[key])off(listeners[key].targetRef,'value',listeners[key].callback);onValue(targetRef,callback,onError);listeners[key]={targetRef,callback}}
function detachAllListeners(){Object.values(listeners).forEach(({targetRef,callback})=>off(targetRef,'value',callback));listeners={}}
async function genUniqueRoomCode(){for(let i=0;i<15;i++){const code=Math.random().toString(36).slice(2,6).toUpperCase();const snap=await get(ref(db,`rooms/${code}/code`));if(!snap.exists())return code}return Math.random().toString(36).slice(2,8).toUpperCase()}
function parseWords(raw){const pieces=raw.split(/[,\n]/).map(v=>v.trim()).filter(Boolean);return [...new Set(pieces)]}
async function resolveUniqueName(code,desiredName){const snap=await get(ref(db,`rooms/${code}/players`));const players=snap.val()||{};const mine=players[myId];if(mine)return mine.name||desiredName;const used=Object.values(players).map(p=>p.name);if(!used.includes(desiredName))return desiredName;let idx=2;while(used.includes(`${desiredName}${idx}`))idx++;return `${desiredName}${idx}`}
function getNextDrawer(players,usedDrawers){
const students=Object.entries(players).filter(([,p])=>p.role==='student').map(([uid])=>uid);
if(!students.length)return null;
const usedSet=new Set(usedDrawers||[]);
let eligible=students.filter(uid=>!usedSet.has(uid));
if(!eligible.length){ eligible=[...students]; }
return eligible.sort((a,b)=>{
const pa=(window.__playersCache?.[a]||players[a]),pb=(window.__playersCache?.[b]||players[b]);
const da=pa?.drawCount||0,db=pb?.drawCount||0;
if(da!==db)return da-db;
return (pa?.joinedAt||0)-(pb?.joinedAt||0);
})[0];
}
async function createRoom(){
const teacherName=(document.getElementById('teacherName').value||'').trim()||'선생님',
timeLimit=parseInt(document.getElementById('timeLimit').value,10),
words=parseWords(document.getElementById('wordInput').value||'');
if(!words.length){ toast('제시어를 1개 이상 입력해 주세요.'); return; }
soundEnabled=document.getElementById('soundSelect').value==='on';
const btn=document.getElementById('createBtn'),btnLabel=btn.textContent;
btn.disabled=true;btn.textContent='방 만드는 중...';
try{
  await withTimeout(ensureAnonymousAuth(),15000);
  myName=teacherName;myRole='teacher';
  roomCode=await withTimeout(genUniqueRoomCode(),15000);initRefs();
  await withTimeout((async()=>{
    await set(roomRef,{code:roomCode,host:myId,status:'waiting',createdAt:Date.now(),appVersion:APP_VERSION});
    await set(playersRef,{[myId]:{name:teacherName,role:'teacher',isManager:true,score:0,drawCount:0,correctCount:0,joinedAt:Date.now()}});
    await set(settingsRef,{roundCount:words.length,timeLimit,words,appVersion:APP_VERSION});
    await set(gameRef,{status:'waiting',round:0,totalRounds:words.length,drawerId:'',keyword:'',timeLimit,timerStart:0,answeredBy:'',usedWords:[],usedDrawers:[],roundOver:false});
    await set(canvasRef,{data:'',ts:Date.now()});
    await attachPresence(myName);
  })(),20000);
  localStorage.setItem('gm_session',JSON.stringify({code:roomCode,name:myName,role:myRole,appVersion:APP_VERSION}));
  rulesShownForRoom=false;
  enterWaiting();
}catch(e){
  console.error(e);
  roomCode='';
  localStorage.removeItem('gm_session');
  toast('방을 만들지 못했어요.\n\n'+describeFirebaseError(e));
}finally{
  btn.disabled=false;btn.textContent=btnLabel;
}
}
async function joinRoom(){const nameEl=document.getElementById('studentName'),codeEl=document.getElementById('roomCodeInput'),desiredName=(nameEl.value||'').trim(),code=(codeEl.value||'').trim().toUpperCase();if(!desiredName){nameEl.focus();return toast('이름을 입력해 주세요.')}if(!code){codeEl.focus();return toast('방 코드를 입력해 주세요.')}const btn=document.getElementById('joinBtn'),btnLabel=btn.textContent;btn.disabled=true;btn.textContent='들어가는 중…';try{await withTimeout(ensureAnonymousAuth(),15000);const roomSnap=await withTimeout(get(ref(db,`rooms/${code}`)),15000);if(!roomSnap.exists()){codeEl.focus();return toast('그 코드의 방을 찾을 수 없어요. 코드를 다시 확인해 주세요.')}if(roomSnap.val()?.status==='closed'){return toast('이미 끝난 방이에요. 선생님께 새 코드를 받아 주세요.')}await enterRoomAsStudent(code,desiredName)}catch(e){console.error(e);toast('방에 들어가지 못했어요.\n\n'+describeFirebaseError(e))}finally{btn.disabled=false;btn.textContent=btnLabel}}
async function enterRoomAsStudent(code,desiredName){roomCode=code;initRefs();myRole='student';myName=await resolveUniqueName(code,desiredName);const existingSnap=await get(ref(db,`rooms/${roomCode}/players/${myId}`));if(existingSnap.exists())await update(ref(db,`rooms/${roomCode}/players/${myId}`),{name:myName});else await set(ref(db,`rooms/${roomCode}/players/${myId}`),{name:myName,role:'student',score:0,drawCount:0,correctCount:0,joinedAt:Date.now()});localStorage.setItem('gm_session',JSON.stringify({code:roomCode,name:myName,role:myRole,appVersion:APP_VERSION}));await attachPresence(myName);rulesShownForRoom=false;enterWaiting()}
async function enterWaiting(){detachAllListeners();showScreen('screenWaiting');document.getElementById('waitingRoomCode').textContent=roomCode;document.getElementById('teacherWaitControls').classList.toggle('hidden',myRole!=='teacher');renderQr();addListener('waiting_players',playersRef,snap=>{const players=snap.val()||{};window.__playersCache=players;const list=document.getElementById('playerList');list.innerHTML='';Object.entries(players).forEach(([uid,p])=>{const chip=document.createElement('div');chip.className='chip'+(p.role==='teacher'?' teacher':'')+(uid===myId?' me':'');const r=document.createElement('span');r.className='role';r.textContent=p.role==='teacher'?'선생님':(uid===myId?'나':'학생');chip.appendChild(r);chip.appendChild(document.createTextNode(p.name||''));list.appendChild(chip)});const studentCount=Object.values(players).filter(p=>p.role==='student').length;document.getElementById('waitingStatus').textContent=`현재 학생 ${studentCount}명 접속 중`;document.getElementById('startBtn').disabled=studentCount<1});addListener('waiting_game',gameRef,snap=>{const g=snap.val();if(!g)return;if(g.status==='playing')enterGame();if(g.status==='result')showResult()})}
async function startGame(){
await update(roomRef,{status:'playing'});
const [playersSnap,settingsSnap]=await Promise.all([get(playersRef),get(settingsRef)]);
const players=playersSnap.val()||{};
window.__playersCache=players;
const settings=settingsSnap.val()||{};
const orderedWords=(settings.words&&settings.words.length)?settings.words:[];
if(!orderedWords.length){
  await update(roomRef,{status:'waiting'});
  toast('제시어가 없어서 게임을 시작할 수 없어요.');
  return;
}
const drawerId=getNextDrawer(players,[]);
const keyword=orderedWords[0];
await update(gameRef,{status:'playing',round:1,totalRounds:orderedWords.length,drawerId,keyword,timeLimit:settings.timeLimit,timerStart:Date.now(),answeredBy:'',usedWords:[keyword],usedDrawers:drawerId?[drawerId]:[],roundOver:false,rulesSkipped:false});
if(drawerId)await runTransaction(ref(db,`rooms/${roomCode}/players/${drawerId}/drawCount`),v=>(v||0)+1);
await set(canvasRef,{data:'',ts:Date.now()});
await remove(chatRef);
lastCelebrationKey='';
currentRoundSeen=0
}
function enterGame(){detachAllListeners();showScreen('screenGame');updateSoundBtn();document.getElementById('gameRoomCode').textContent=roomCode;setupCanvas();addListener('game_players',playersRef,snap=>{playersCache=snap.val()||{};window.__playersCache=playersCache;const scoreBoard=document.getElementById('scoreBoard');if(scoreBoard){scoreBoard.innerHTML='';Object.entries(playersCache).filter(([,p])=>p.role==='student').forEach(([uid,p])=>{const item=document.createElement('div');item.className='score-item';item.title=`정답 ${p.correctCount||0}회 · 출제 ${p.drawCount||0}회`;item.textContent=p.name||'';const pts=document.createElement('span');pts.className='pts';pts.textContent=`${p.score||0}점`;item.appendChild(pts);scoreBoard.appendChild(item)})}});addListener('game_state',gameRef,async snap=>{const g=snap.val();if(!g)return;gameCache=g;if(g.status==='result')return showResult();const players=playersCache||{};window.__playersCache=players;isDrawer=g.drawerId===myId;document.getElementById('curRound').textContent=g.round||0;document.getElementById('totalRound').textContent=g.totalRounds||0;document.getElementById('drawerNameDisplay').textContent=players[g.drawerId]?.name||'-';document.getElementById('drawerNameMini').textContent=players[g.drawerId]?.name||'-';document.getElementById('keywordDisplay').textContent=isDrawer?(g.keyword||''):'비밀';document.getElementById('wordBanner').classList.toggle('hidden',!isDrawer);document.getElementById('drawerNotice').classList.toggle('hidden',!isDrawer);document.getElementById('answerWrap').classList.toggle('hidden',isDrawer);document.getElementById('toolBox').classList.toggle('hidden',!isDrawer);document.getElementById('colorPalette').classList.toggle('hidden',!isDrawer);document.getElementById('watchBanner').classList.toggle('hidden',isDrawer);document.getElementById('gameBanner').classList.toggle('is-drawer',isDrawer);document.getElementById('teacherMonitor').classList.toggle('hidden',myRole!=='teacher');if(myRole==='teacher'){document.getElementById('teacherMonitorContent').textContent=`${g.round||0} / ${g.totalRounds||0} 라운드 · ${players[g.drawerId]?.name||'-'} 출제 중 · ${g.roundOver?'정답 처리 중':'진행 중'}`}if(g.round!==currentRoundSeen){currentRoundSeen=g.round||0;clearBoard();undoStack=[]}if(g.rulesSkipped)hideRulesOverlay();const drawerTurnKey=`${g.round}-${g.drawerId||''}`;if(isDrawer&&drawerTurnKey&&lastDrawerTurnKey!==drawerTurnKey){lastDrawerTurnKey=drawerTurnKey;showCenterPopup('당신이 그릴 차례입니다!!','3초 동안 준비하고 그림을 시작하세요!',3000,'success')}const celebrationKey=`${g.round}-${g.answeredBy||''}`;if(g.roundOver&&g.answeredBy&&lastCelebrationKey!==celebrationKey){lastCelebrationKey=celebrationKey;const winnerName=players[g.answeredBy]?.name||'어떤 학생';showCenterPopup('정답입니다!!',`${winnerName} +10점 획득!!`,3000,'success');playCorrectSound()}if(myRole==='teacher'&&g.roundOver&&g.answeredBy&&!nextRoundScheduled){nextRoundScheduled=true;setTimeout(async()=>{nextRoundScheduled=false;const latest=await get(gameRef),latestGame=latest.val();if(latestGame&&latestGame.roundOver&&latestGame.answeredBy)await nextRound()},5000)}if(g.round===1&&!g.roundOver&&!g.rulesSkipped&&!rulesShownForRoom)showRulesOverlay();startTimer(g.timerStart,g.timeLimit,g.roundOver)});addListener('game_chat',chatRef,async snap=>{const box=document.getElementById('chatBox');box.innerHTML='';const msgs=snap.val()||{};const msgList=Object.entries(msgs).map(([id,msg])=>({id,...msg})).sort((a,b)=>(a.ts||0)-(b.ts||0));msgList.forEach(msg=>{const div=document.createElement('div');div.className='msg'+(msg.system?' system':'')+(msg.correct?' correct':'');if(msg.system)div.textContent=msg.text;else{const n=document.createElement('span');n.className='name';n.textContent=msg.name||'';div.appendChild(n);div.appendChild(document.createTextNode(msg.text||''))}box.appendChild(div)});box.scrollTop=box.scrollHeight;if(myRole==='teacher')await processCorrectAnswerFromChat(msgList)});addListener('game_canvas',canvasRef,snap=>{if(isDrawer)return;const data=snap.val();if(!data?.data){clearBoard();return}const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,canvas.width,canvas.height)};img.src=data.data})}
async function processCorrectAnswerFromChat(msgList){
const g=gameCache||{};
if(!g||g.roundOver||!g.keyword)return;
const candidate=msgList.find(msg=>!msg.system&&(msg.round===g.round)&&(msg.isCorrectGuess===true||String(msg.text||'').toLowerCase()===String(g.keyword||'').toLowerCase()));
if(!candidate)return;
const answerRef=ref(db,`rooms/${roomCode}/game/answeredBy`);
let won=false;
await runTransaction(answerRef,current=>{if(!current){won=true;return candidate.uid||''}return current});
if(!won)return;
await Promise.all([runTransaction(ref(db,`rooms/${roomCode}/players/${candidate.uid}/score`),v=>(v||0)+10),runTransaction(ref(db,`rooms/${roomCode}/players/${candidate.uid}/correctCount`),v=>(v||0)+1),runTransaction(ref(db,`rooms/${roomCode}/players/${g.drawerId}/score`),v=>(v||0)+5),update(gameRef,{roundOver:true}),update(ref(db,`rooms/${roomCode}/chat/${candidate.id}`),{correct:true}),addSystemChat(`정답입니다! ${candidate.name} +10점 / 출제자 +5점`)] )}
function startTimer(startTs,limit,roundOver){if(timerInterval)clearInterval(timerInterval);const display=document.getElementById('timerDisplay');display.classList.remove('urgent');if(roundOver){display.textContent='정답!';return}timerInterval=setInterval(async()=>{const remain=Math.max(0,limit-Math.floor((Date.now()-startTs)/1000));const m=Math.floor(remain/60).toString().padStart(2,'0'),s=(remain%60).toString().padStart(2,'0');display.textContent=`${m}:${s}`;display.classList.toggle('urgent',remain<=30);if(remain===0){clearInterval(timerInterval);if(myRole==='teacher'){const g=gameCache||{};if(g&&!g.roundOver){showCenterPopup('아쉽게 실패!',`정답은 "${g.keyword}" · 다음 라운드로 이동`,3000,'fail');playFailSound();await addSystemChat(`⏰ 시간 종료! 정답은 "${g.keyword}"`);setTimeout(async()=>{await nextRound()},3000)}}}},500)}
async function addSystemChat(text){await push(chatRef,{system:true,text,ts:Date.now()})}
async function submitAnswer(){const input=document.getElementById('answerInput'),raw=input.value,answer=sanitizeAnswer(raw);input.value='';if(!answer||isDrawer)return;if(containsBannedWord(answer))return toast('이 표현은 입력할 수 없어요.');const gameSnap=await get(gameRef),g=gameSnap.val();if(!g||g.roundOver)return;const isCorrect=answer.toLowerCase()==String(g.keyword||'').toLowerCase();await push(chatRef,{uid:myId,name:myName,text:answer,ts:Date.now(),round:g.round,isCorrectGuess:isCorrect});if(!isCorrect){const wrongKey=`${g.round}-${myId}-${answer}`;if(lastWrongPopupKey!==wrongKey){lastWrongPopupKey=wrongKey;showCenterPopup('오답입니다!!','다시 도전하세요!!',1800,'fail');playFailSound()}}}
async function nextRound(){
const [gameSnap,settingsSnap,playersSnap]=await Promise.all([get(gameRef),get(settingsRef),get(playersRef)]);
const g=gameSnap.val(),settings=settingsSnap.val()||{},players=playersSnap.val()||{};
window.__playersCache=players;
if(!g)return;
const orderedWords=(settings.words&&settings.words.length)?settings.words:[];
if(!orderedWords.length || g.round>=orderedWords.length){
  await update(gameRef,{status:'result'});
  await update(roomRef,{status:'closed'});
  return;
}
const nextWord=orderedWords[g.round];
const usedWords=orderedWords.slice(0,g.round+1);
const students=Object.entries(players).filter(([,p])=>p.role==='student').map(([uid])=>uid);
let usedDrawers=g.usedDrawers||[];
const everyoneDone=students.length>0 && students.every(uid=>usedDrawers.includes(uid));
if(everyoneDone){ usedDrawers=[]; }
const nextDrawer=getNextDrawer(players,usedDrawers);
const nextUsedDrawers=nextDrawer?[...usedDrawers,nextDrawer]:usedDrawers;
await update(gameRef,{round:g.round+1,drawerId:nextDrawer||'',keyword:nextWord,timerStart:Date.now(),answeredBy:'',roundOver:false,usedWords:usedWords,usedDrawers:nextUsedDrawers});
if(nextDrawer)await runTransaction(ref(db,`rooms/${roomCode}/players/${nextDrawer}/drawCount`),v=>(v||0)+1);
await set(canvasRef,{data:'',ts:Date.now()});
await remove(chatRef);
lastCelebrationKey='';
}
function renderPalette(){const palette=document.getElementById('colorPalette');palette.innerHTML='';COLORS.forEach(color=>{const dot=document.createElement('div');dot.className='color-dot'+(color===brushColor?' active':'');dot.style.background=color;dot.onclick=()=>{brushColor=color;erasing=false;renderPalette()};palette.appendChild(dot)})}
function setupCanvas(){if(canvasEventsBound)return;canvasEventsBound=true;clearBoard();renderPalette();let lastX=0,lastY=0,canvasDirty=false,lastCanvasSyncAt=0;const pos=e=>{const rect=canvas.getBoundingClientRect(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height,src=e.touches?e.touches[0]:e;return{x:(src.clientX-rect.left)*scaleX,y:(src.clientY-rect.top)*scaleY}};const syncCanvas=()=>{if(!canvasRef||!canvasDirty)return;canvasDirty=false;lastCanvasSyncAt=Date.now();set(canvasRef,{data:canvas.toDataURL('image/jpeg',0.45),ts:lastCanvasSyncAt})};const start=e=>{if(!isDrawer)return;e.preventDefault();saveUndoState();drawing=true;const p=pos(e);lastX=p.x;lastY=p.y};const move=e=>{if(!drawing||!isDrawer)return;e.preventDefault();const p=pos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.strokeStyle=erasing?BOARD_COLOR:brushColor;ctx.lineWidth=erasing?brushSize*3:brushSize;ctx.lineCap='round';ctx.stroke();lastX=p.x;lastY=p.y;canvasDirty=true;if(!window.__canvasThrottle){window.__canvasThrottle=setTimeout(()=>{syncCanvas();window.__canvasThrottle=null},800)}};const end=()=>{if(drawing&&isDrawer&&canvasDirty&&(Date.now()-lastCanvasSyncAt>250))syncCanvas();drawing=false};canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);canvas.addEventListener('mouseleave',end);canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end)}
function saveUndoState(){try{undoStack.push(canvas.toDataURL());if(undoStack.length>20)undoStack.shift()}catch(e){console.error(e)}}
function undoCanvas(){if(!isDrawer||!undoStack.length)return;const prev=undoStack.pop(),img=new Image();img.onload=()=>{clearBoard();ctx.drawImage(img,0,0);if(canvasRef)set(canvasRef,{data:canvas.toDataURL('image/jpeg',0.45),ts:Date.now()})};img.src=prev}
function clearCanvas(){if(!isDrawer)return;saveUndoState();clearBoard();if(canvasRef)set(canvasRef,{data:'',ts:Date.now()})}
function toggleEraser(){erasing=!erasing;const btn=document.getElementById('eraserBtn');btn.classList.toggle('active',erasing);btn.textContent=erasing?'지우개 사용 중':'지우개'}
function updateSoundBtn(){const btn=document.getElementById('soundBtn');if(btn)btn.textContent=soundEnabled?'효과음 켜짐':'효과음 꺼짐'}
function toggleSound(){soundEnabled=!soundEnabled;updateSoundBtn()}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
async function showResult(){if(timerInterval)clearInterval(timerInterval);hideRulesOverlay();detachAllListeners();showScreen('screenResult');const isTeacher=myRole==='teacher';document.getElementById('replayBtn').classList.toggle('hidden',!isTeacher);document.getElementById('replayWaitNote').classList.toggle('hidden',isTeacher);addListener('result_game',gameRef,snap=>{const g=snap.val();if(g&&g.status==='waiting')resetLocalRoundState(),enterWaiting()});const playersSnap=await get(playersRef),players=playersSnap.val()||{},students=Object.values(players).filter(p=>p.role==='student');const list=document.getElementById('resultList');list.innerHTML='';const podium=el('div','block block-lime podium');podium.appendChild(el('p','eyebrow','개인 순위 TOP 3'));list.appendChild(podium);const ranked=[...students].sort((a,b)=>(b.score||0)-(a.score||0));ranked.slice(0,3).forEach((p,idx)=>{const row=el('div','result-item'),left=el('div');left.appendChild(el('span','rank',`${idx+1}위`));left.appendChild(document.createTextNode(p.name||''));row.appendChild(left);row.appendChild(el('div','',`${p.score||0}점`));podium.appendChild(row)});list.appendChild(el('p','eyebrow badge-eyebrow','칭찬 타이틀'));const byCorrect=[...students].sort((a,b)=>(b.correctCount||0)-(a.correctCount||0)),byDraw=[...students].sort((a,b)=>(b.drawCount||0)-(a.drawCount||0));const badgeLine=el('div','badge-line');[{tone:'pink',title:'정답왕',name:byCorrect[0]?.name||'-',value:`${byCorrect[0]?.correctCount||0}회 정답`},{tone:'lilac',title:'그림왕',name:byDraw[0]?.name||'-',value:`${byDraw[0]?.drawCount||0}회 출제`},{tone:'mint',title:'종합 1위',name:ranked[0]?.name||'-',value:`${ranked[0]?.score||0}점`}].forEach(a=>{const card=el('div','badge-card note-'+a.tone);card.appendChild(el('div','badge-title',a.title));card.appendChild(el('div','badge-name',a.name));card.appendChild(el('div','small',a.value));card.appendChild(el('div','stamp','참\n잘했어요'));badgeLine.appendChild(card)});list.appendChild(badgeLine)}
function resetLocalRoundState(){rulesShownForRoom=false;currentRoundSeen=0;lastCelebrationKey='';lastDrawerTurnKey='';lastWrongPopupKey='';nextRoundScheduled=false;undoStack=[]}
async function playAgain(){if(myRole!=='teacher'||!roomCode)return;const btn=document.getElementById('replayBtn'),label=btn.textContent;btn.disabled=true;btn.textContent='준비하는 중…';try{const [playersSnap,settingsSnap]=await Promise.all([get(playersRef),get(settingsRef)]);const players=playersSnap.val()||{},settings=settingsSnap.val()||{},words=settings.words||[];const resets={};Object.keys(players).forEach(uid=>{resets[`${uid}/score`]=0;resets[`${uid}/drawCount`]=0;resets[`${uid}/correctCount`]=0});if(Object.keys(resets).length)await update(playersRef,resets);await set(canvasRef,{data:'',ts:Date.now()});await remove(chatRef);await update(roomRef,{status:'waiting'});await set(gameRef,{status:'waiting',round:0,totalRounds:words.length,drawerId:'',keyword:'',timeLimit:settings.timeLimit||180,timerStart:0,answeredBy:'',usedWords:[],usedDrawers:[],roundOver:false,rulesSkipped:false});localStorage.setItem('gm_session',JSON.stringify({code:roomCode,name:myName,role:myRole,appVersion:APP_VERSION}))}catch(e){console.error(e);toast('한 판 더 준비하지 못했어요.\n\n'+describeFirebaseError(e))}finally{btn.disabled=false;btn.textContent=label}}
async function backToLobby(){
detachAllListeners();
if(timerInterval)clearInterval(timerInterval);
resetLocalRoundState();
hideRulesOverlay();
if(roomCode&&myRole==='teacher'){
  try{ await update(roomRef,{status:'closed'}); }catch(e){ console.error(e); }
}
localStorage.removeItem('gm_session');
showScreen('screenLobby');
}
async function restoreSession(){
const saved=JSON.parse(localStorage.getItem('gm_session')||'null');
if(!saved)return;
if(saved.appVersion && saved.appVersion!==APP_VERSION){
  localStorage.removeItem('gm_session');
  return;
}
const roomSnap=await get(ref(db,`rooms/${saved.code}`));
if(!roomSnap.exists()){ localStorage.removeItem('gm_session'); return; }
const roomMeta=roomSnap.val()||{};
if(roomMeta.appVersion!==APP_VERSION || roomMeta.status==='closed'){
  localStorage.removeItem('gm_session');
  return;
}
roomCode=saved.code;
initRefs();
const settingsSnap=await get(settingsRef);
const settings=settingsSnap.val()||{};
if(settings.appVersion && settings.appVersion!==APP_VERSION){
  localStorage.removeItem('gm_session');
  return;
}
const playerSnap=await get(ref(db,`rooms/${roomCode}/players/${myId}`));
if(!playerSnap.exists()){ localStorage.removeItem('gm_session'); return; }
myName=playerSnap.val().name;
myRole=playerSnap.val().role;
await attachPresence(myName);
const gameSnap=await get(gameRef),game=gameSnap.val();
playersCache={};
gameCache={};
if(game?.status==='playing')enterGame();
else if(game?.status==='result')showResult();
else enterWaiting();
}
(async function boot(){try{await ensureAnonymousAuth()}catch(e){console.error(e);toast('로그인에 실패했어요.\n\n'+describeFirebaseError(e));return}try{await restoreSession()}catch(e){console.error(e)}openJoinLinkIfAny()})();
(function writeBoardDate(){const d=new Date(),days=['일','월','화','수','목','금','토'];const e=document.getElementById('boardDate');if(e)e.textContent=`${d.getMonth()+1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`})();
function openJoinLinkIfAny(){const code=(new URLSearchParams(location.search).get('code')||'').trim().toUpperCase();if(!code||roomCode)return;history.replaceState(null,'',location.pathname);selectRole('student');document.getElementById('roomCodeInput').value=code;document.getElementById('studentName').focus()}
