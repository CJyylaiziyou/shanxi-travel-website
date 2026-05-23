
const SCENES = ['s0','s1','s1b','s2','s3a','s3b','s3c','s3d','s4a','s4b','s4c','s4d','s4e','s5','s6'];
const GROUPS = [
  { label:'棣栭〉', scene:'s0', match:['s0'] },
  { label:'鎬讳綋鎬濊矾', scene:'s1', match:['s1','s1b','s2'] },
  { label:'鍔挎湳閬?, scene:'s3a', match:['s3a','s3b','s3c','s3d'] },
  { label:'鎬濈淮鐪嬭', scene:'s4a', match:['s4a','s4b','s4c','s4d','s4e'] },
  { label:'鍏ぇ涓婚', scene:'s5', match:['s5'] },
  { label:'鍏充簬鎴戜滑', scene:'s6', match:['s6'] }
];
const STRATEGY_SCENES = new Set(['s3a','s3c','s3d','s6']);

let ci = 0;
let busy = false;
let scrollLock = false;
let vidDone = false;
let scrollPos = 0;
let dissolving = false;
let dProg = 0;
let dReady = false;
let dParts = [];
let inHub = false;

const scenes = SCENES.map(id => document.getElementById(id));
const eyeVid = document.getElementById('eyeVid');
const calWrap = document.getElementById('calWrap');
const calPng = document.getElementById('calPng');
const s0prog = document.getElementById('s0prog');
const dissolveC = document.getElementById('dissolveC');
const dissolveX = dissolveC.getContext('2d');
const strategyLoop = document.getElementById('strategyLoop');
const sideRail = document.getElementById('sideRail');
const globalHome = document.getElementById('globalHome');
const hubReturn = document.getElementById('hubReturn');

let videoDuration = 8;
eyeVid.addEventListener('loadedmetadata', () => {
  videoDuration = eyeVid.duration || 8;
  eyeVid.currentTime = 0;
});

function resizeDissolveCanvas() {
  dissolveC.width = innerWidth;
  dissolveC.height = innerHeight;
}
resizeDissolveCanvas();
addEventListener('resize', resizeDissolveCanvas);

function makeParts(img, cvs) {
  cvs.width = innerWidth;
  cvs.height = innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return [];
  const scale = Math.min(cvs.width / iw, cvs.height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const ox = (cvs.width - dw) / 2;
  const oy = (cvs.height - dh) / 2;
  const tmp = document.createElement('canvas');
  tmp.width = cvs.width;
  tmp.height = cvs.height;
  const ctx = tmp.getContext('2d');
  ctx.drawImage(img, ox, oy, dw, dh);
  const data = ctx.getImageData(0, 0, tmp.width, tmp.height).data;
  const parts = [];
  const step = 3;
  for (let y = 0; y < tmp.height; y += step) {
    for (let x = 0; x < tmp.width; x += step) {
      const i = (y * tmp.width + x) * 4;
      if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) {
        const scatter = Math.random() < 0.3;
        parts.push({
          ox:x,
          oy:y,
          r:data[i],
          g:data[i+1],
          b:data[i+2],
          vx:scatter ? (Math.random() - 0.3) * 3 : Math.random() * 2.5 + 1,
          vy:scatter ? (Math.random() - 0.5) * 2.4 : (Math.random() - 0.5) * 1.1,
          sz:step * 0.55
        });
      }
    }
  }
  return parts;
}

function drawParts(parts, ctx, cvs, prog) {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  if (!parts.length || prog <= 0) return;
  const spread = prog * 1.5;
  for (const p of parts) {
    const life = Math.max(0, 1 - prog * 1.08);
    if (life <= 0) continue;
    ctx.globalAlpha = life * life;
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    const s = p.sz * (0.45 + life * 0.55);
    ctx.fillRect(p.ox + p.vx * spread * 40, p.oy + p.vy * spread * 40, s, s);
  }
  ctx.globalAlpha = 1;
}

calPng.addEventListener('load', () => {
  dParts = makeParts(calPng, dissolveC);
  dReady = true;
});

function resetOpening() {
  scrollPos = 0;
  vidDone = false;
  dissolving = false;
  dProg = 0;
  calWrap.classList.remove('show');
  calWrap.style.opacity = '';
  s0prog.style.width = '0%';
  dissolveX.clearRect(0, 0, dissolveC.width, dissolveC.height);
  try {
    eyeVid.currentTime = 0;
  } catch (_) {}
}

function updateStrategyLoop(sceneId) {
  strategyLoop.classList.toggle('show', STRATEGY_SCENES.has(sceneId));
  strategyLoop.play().catch(() => {});
}

function buildSideRail() {
  GROUPS.forEach(group => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'side-rail-btn';
    btn.textContent = group.label;
    btn.dataset.scene = group.scene;
    btn.addEventListener('click', () => jumpToScene(group.scene));
    sideRail.appendChild(btn);
  });
}

function updateSideRail(sceneId) {
  const active = GROUPS.find(group => group.match.includes(sceneId));
  document.querySelectorAll('.side-rail-btn').forEach(btn => {
    btn.classList.toggle('active', active && btn.dataset.scene === active.scene);
  });
}

function lockScroll() {
  scrollLock = true;
  setTimeout(() => { scrollLock = false; }, 720);
}

function leaveHubForSceneChange() {
  if (!inHub) return;
  hubHideIntro();
  resetHubSelection(true);
  inHub = false;
}

function setScene(id, options = {}) {
  if ((busy && !options.force) || scrollLock) return;
  busy = true;
  lockScroll();
  leaveHubForSceneChange();

  scenes.forEach(scene => scene.classList.remove('on'));
  const target = document.getElementById(id);
  target.classList.add('on');
  ci = SCENES.indexOf(id);

  updateStrategyLoop(id);
  updateSideRail(id);

  if (id === 's5') {
    initHub();
  }

  setTimeout(() => { busy = false; }, 680);
}

function jumpToScene(id) {
  if (id === 's0') {
    resetOpening();
  }
  setScene(id, { force:true });
}

globalHome.addEventListener('click', () => {
  resetOpening();
  setScene('s0', { force:true });
});

buildSideRail();
updateSideRail('s0');
updateStrategyLoop('s0');

function handleOpeningWheel(delta) {
  scrollPos = Math.max(0, Math.min(3000, scrollPos + delta));
  const progress = scrollPos / 3000;
  try {
    eyeVid.currentTime = Math.min(progress * videoDuration, Math.max(videoDuration - 0.01, 0));
  } catch (_) {}
  s0prog.style.width = `${progress * 100}%`;

  if (progress < 0.125) {
    calWrap.classList.remove('show');
    calWrap.style.opacity = '';
    dissolving = false;
    dProg = 0;
    dissolveX.clearRect(0, 0, dissolveC.width, dissolveC.height);
  } else if (progress < 0.25) {
    calWrap.classList.add('show');
    calWrap.style.opacity = '';
    dissolving = false;
    dProg = 0;
    dissolveX.clearRect(0, 0, dissolveC.width, dissolveC.height);
  } else {
    if (!dissolving) {
      dissolving = true;
      calWrap.style.opacity = '0';
      if (!dReady) {
        dParts = makeParts(calPng, dissolveC);
        dReady = true;
      }
    }
    dProg = Math.min(1, (progress - 0.25) / 0.4);
  }

  if (progress >= 0.98 && !vidDone) {
    vidDone = true;
    setScene('s1');
  }
}

function sceneScroll(delta) {
  if (busy || scrollLock) return;
  if (!vidDone && ci === 0) {
    handleOpeningWheel(delta);
    return;
  }
  if (ci === 13 && inHub) {
    hubWheel(delta);
    return;
  }
  if (delta > 0 && ci < SCENES.length - 1) {
    setScene(SCENES[ci + 1]);
    return;
  }
  if (delta < 0 && ci > 0) {
    if (ci === 1) {
      resetOpening();
      setScene('s0');
      return;
    }
    setScene(SCENES[ci - 1]);
  }
}

addEventListener('wheel', e => {
  if (!vidDone && ci === 0) {
    e.preventDefault();
    handleOpeningWheel(e.deltaY);
    return;
  }
  if (ci === 13 && inHub) {
    e.preventDefault();
    hubWheel(e.deltaY);
    return;
  }
  e.preventDefault();
  sceneScroll(e.deltaY);
}, { passive:false });

let touchY = 0;
addEventListener('touchstart', e => {
  touchY = e.touches[0].clientY;
}, { passive:true });

addEventListener('touchend', e => {
  const delta = touchY - e.changedTouches[0].clientY;
  if (Math.abs(delta) < 40) return;
  sceneScroll(delta * 1.8);
}, { passive:true });

document.addEventListener('keydown', e => {
  if (e.key === 'Home') {
    resetOpening();
    setScene('s0', { force:true });
    return;
  }
  if (e.key === 'Escape' && inHub) {
    hubBackStep();
    return;
  }
  if (!vidDone && ci === 0) return;
  if (e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    sceneScroll(160);
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    sceneScroll(-160);
  }
});

/* particles */
const burstC = document.getElementById('burst');
const burstX = burstC.getContext('2d');
let burstW = 0;
let burstH = 0;
let bursts = [];
function resizeBurst() {
  burstW = burstC.width = innerWidth;
  burstH = burstC.height = innerHeight;
}
resizeBurst();
addEventListener('resize', resizeBurst);

function burstLoop() {
  burstX.clearRect(0, 0, burstW, burstH);
  for (let i = bursts.length - 1; i >= 0; i--) {
    const p = bursts[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06;
    p.life -= 0.016;
    if (p.life <= 0) {
      bursts.splice(i, 1);
      continue;
    }
    burstX.beginPath();
    burstX.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    burstX.fillStyle = `rgba(212,175,55,${p.life})`;
    burstX.fill();
  }
  if (dissolving && dReady) drawParts(dParts, dissolveX, dissolveC, dProg);
  requestAnimationFrame(burstLoop);
}
burstLoop();

const ptc = document.getElementById('ptc');
const ptcX = ptc.getContext('2d');
let ptcW = 0;
let ptcH = 0;
const ambient = [];
function resizePtc() {
  ptcW = ptc.width = innerWidth;
  ptcH = ptc.height = innerHeight;
}
resizePtc();
addEventListener('resize', resizePtc);
for (let i = 0; i < 35; i++) {
  ambient.push({
    x:Math.random() * innerWidth,
    y:Math.random() * innerHeight,
    r:Math.random() * 1.2 + 0.3,
    s:Math.random() * 0.15 + 0.04,
    o:Math.random() * 0.18 + 0.02,
    d:Math.random() * Math.PI * 2
  });
}
function ptcLoop() {
  ptcX.clearRect(0, 0, ptcW, ptcH);
  ambient.forEach(p => {
    p.y -= p.s;
    p.x += Math.sin(p.d) * 0.1;
    p.d += 0.002;
    if (p.y < -10) {
      p.y = ptcH + 10;
      p.x = Math.random() * ptcW;
    }
    ptcX.beginPath();
    ptcX.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ptcX.fillStyle = `rgba(212,175,55,${p.o})`;
    ptcX.fill();
  });
  requestAnimationFrame(ptcLoop);
}
ptcLoop();

/* S2 */
const painData = [
  {
    head:'鐮村湀闅?,
    title:'鏍囩鍥哄寲',
    sub:'鐓ゃ€侀唻銆侀潰銆俍 涓栦唬鏃犳劅銆?,
    desc:'Z 涓栦唬瀵瑰北瑗跨殑璁ょ煡鍋滅暀鍦ㄢ€滅叅鑰佹澘鈥濆拰鈥滆€侀檲閱嬧€濄€備簲鍗冨勾鏂囨槑鐨勫帤閲嶈祫婧愮己涓€涓潰鍚戝勾杞讳汉鐨勫紩鐖嗙偣銆傘€婇粦绁炶瘽锛氭偀绌恒€嬭瘉鏄庝簡璺緞鏈夋晥锛屼絾杩樼己灏戣嚜宸卞師鐢熺殑鐮村湀鐭╅樀銆?
  },
  {
    head:'浣撻獙寮?,
    title:'鐐规暎绾挎柇',
    sub:'鐧藉ぉ鐪嬪簷锛屾櫄涓婄潯瑙夈€?,
    desc:'鏅偣瀛ょ珛銆佷綋楠屽崟涓€銆佸仠鐣欐椂闂寸煭銆?8% 鐨勬父瀹㈠皢鈥滄矇娴稿紡浣撻獙鈥濆垪涓洪€夋嫨鏅尯棣栬鏍囧噯锛屼絾灞辫タ鍙ゅ缓鏅尯鐨勪簰鍔ㄦ€у嚑涔庝负闆躲€?
  },
  {
    head:'鐪嬩笉鎳?,
    title:'鐪奸噷杩疯尗',
    sub:'璧伴┈瑙傝姳锛屾棤鏁板瓧鍖栬В璇汇€?,
    desc:'姘镐箰瀹鐢汇€佷經鍏夊鏂楁嫳銆佹偓绌哄缁撴瀯绛変笘鐣岀骇鏂囧寲閬椾骇锛屼粛缂哄皯楂樺畬鎴愬害鏁板瓧鍖栬В璇诲伐鍏枫€傛父瀹㈢珯鍦ㄥ浗瀹濋潰鍓嶏紝鐪嬪埌鐨勫父甯稿彧鏄€滄棫澧欏鈥濆拰鈥滄棫鏈ㄥご鈥濄€?
  },
  {
    head:'甯︿笉璧?,
    title:'鏂囧垱鍚岃川',
    sub:'璁板繂鐐逛负闆躲€備簩娑堜箯鍔涖€?,
    desc:'鍏ㄥ浗鏅尯鏂囧垱涓ラ噸鍚岃川鍖栵紝灞辫タ缂轰箯楂樿鲸璇嗗害鐨勬暟瀛楁枃鍒涗骇鍝併€傛父瀹㈢寮€鍚庢病鏈夊彲鎸佺画浼犳挱鐨勨€滆蹇嗛敋鐐光€濄€?
  }
];

function buildS2() {
  const wrap = document.getElementById('s2Grid');
  wrap.innerHTML = '';
  painData.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 's2-item';
    card.innerHTML = `
      <div class="s2-item-head" data-float style="--delay:${0.1 + index * 0.12}s">
        <img src="assets/s2_title_ui.png" alt="">
        <span>${item.head}</span>
      </div>
      <div class="s2-card" data-float style="--delay:${0.2 + index * 0.12}s">
        <img class="s2-card-bg" src="assets/s2_card_bg.png" alt="">
        <div class="s2-card-content">
          <div class="s2-card-title">${item.title}</div>
          <div class="s2-card-sub">${item.sub}</div>
          <div class="s2-card-desc">${item.desc}</div>
        </div>
      </div>
    `;
    wrap.appendChild(card);
  });
}
buildS2();

/* S3b */
const ssdData = [
  {
    cal:'s3_shi.png',
    role:'涓绘垬鍦?路 鑸亾',
    q:'鎴戜滑鍦ㄥ摢閲屾垬鏂楋紵',
    desc:'鐭棰戜互 10.74 浜跨敤鎴枫€乗n鏃ュ潎 90+ 鍒嗛挓銆乗n95.4% 娓楅€忕巼鎴愪负缁濆涓绘垬鍦?,
    num:'10.74 浜?,
    label:'鐭棰戠敤鎴疯妯?
  },
  {
    cal:'s3_shu.png',
    role:'鏂板紩鎿?路 姝﹀櫒',
    q:'鎴戜滑鐢ㄤ粈涔堟垬鏂楋紵',
    desc:'AI 璁╁唴瀹圭敓浜т粠鎶€鑳藉瘑闆嗗瀷\n鍙樹负鍒涙剰瀵嗛泦鍨嬶紝鏁堢巼鎻愬崌 72 鍊?,
    num:'72脳',
    label:'AI 鐢熶骇鏁堢巼鎻愬崌'
  },
  {
    cal:'s3_dao.png',
    role:'鐩殑鍦?路 鐏甸瓊',
    q:'鎴戜滑涓轰綍鑰屾垬锛?,
    desc:'鏈€缁堟姷杈剧敤鎴峰唴蹇冪殑\n鏄嫭鐗圭殑鎬濇兂鍜岀湡璇?,
    num:'58%',
    label:'鍥犲唴瀹归潪璁″垝璐拱'
  }
];

function buildS3b() {
  const wrap = document.getElementById('s3bCards');
  wrap.innerHTML = '';
  ssdData.forEach((item, index) => {
    const slot = document.createElement('div');
    slot.className = 's3b-slot';
    slot.setAttribute('data-float', '');
    slot.style.setProperty('--delay', `${0.12 + index * 0.16}s`);
    slot.innerHTML = `
      <div class="s3b-top">
        <img class="s3b-circle" src="assets/s3_circle.png" alt="">
        <img class="s3b-cal" src="assets/${item.cal}" alt="">
      </div>
      <div class="s3b-panel">
        <img class="s3b-textbg" src="assets/s3_text_bg.png" alt="">
        <div class="s3b-body">
          <div class="s3b-role">${item.role}</div>
          <div class="s3b-q">${item.q}</div>
          <div class="s3b-desc">${item.desc.replace(/\n/g, '<br>')}</div>
          <div class="s3b-num">${item.num}</div>
          <div class="s3b-label">${item.label}</div>
        </div>
      </div>
    `;
    wrap.appendChild(slot);
  });
}
buildS3b();

/* S5 */
const hubVid = document.getElementById('hubVid');
const hubOverlay = document.getElementById('hubOverlay');
const hubCards = document.getElementById('hubCards');
const hubIntro = document.getElementById('hubIntro');
const hubIntroCard = document.getElementById('hubIntroCard');
const hubIntroText = document.getElementById('hubIntroText');
const hubVideos = [
  'assets/hub_001.mp4',
  'assets/hub_002.mp4',
  'assets/hub_003.mp4',
  'assets/hub_004.mp4',
  'assets/hub_005.mp4',
  'assets/hub_006.mp4',
  'assets/hub_007.mp4',
  'assets/hub_008.mp4'
];
const themeNames = ['灞辫タ浼氳璇?,'鎮熺┖寮曡矾','灞辨渤鍏ュ','鏅嬪懗姹熸箹','鎵嬩笂灞辫タ','鑺傛皵灞辫タ'];
const themeIntros = [
  `鍏崇窘鐨勫繝涔夈€佺媱浠佹澃鐨勫叕姝ｃ€佺帇涔嬫叮鐨勮瘲鎰忋€佹鎬濇垚鐨勫畧鎶も€斺€斿北瑗跨殑鍘嗗彶鍚嶄汉浠庝笉缂烘晠浜嬶紝缂虹殑鏄鏁呬簨閲嶆柊琚惉瑙佺殑鏂瑰紡銆傗€滃北瑗夸細璇磋瘽鈥濈敤 AI 璁╁巻鍙插悕浜哄娲诲彂澹帮細娓稿鍦ㄦ櫙鍖虹敤鎵嬫満鎵弿鍚嶄汉濉戝儚鎴栫敾鍍忥紝AI 鑷姩璇嗗埆浜虹墿韬唤锛屾墜鏈哄睆骞曚笂鍑虹幇鍥介鐢婚鐨勫悕浜哄姩鎬佸舰璞★紝浠栧紑鍙ｈ鍑哄叧閿悕瑷€锛岀劧鍚庣瓑浣犳彁闂€備綘闂叧缇戒粈涔堟槸涔夛紝浠栫敤鑷繁鐨勫彛鍚诲洖绛斾綘锛涗綘闂鎬濇垚涓轰粈涔堜竴杈堝瓙瀹堢潃鏃ф埧瀛愶紝浠栧憡璇変綘浣涘厜瀵洪偅涓粍鏄忕殑鏁呬簨銆傛暣娈靛璇濊嚜鍔ㄥ悎鎴愪竴鏉＄煭瑙嗛锛屼竴閿垎浜埌鏈嬪弸鍦堛€傝繖涓嶆槸鍐峰啺鍐扮殑璇煶瀵艰鍣紝鏄竴娆¤法瓒婂崈骞寸殑闈㈠闈氦璋堛€傜敤鎴峰甫璧扮殑涓嶆槸涓€寮犻棬绁ㄥ瓨鏍癸紝鑰屾槸涓€娈碘€滄垜鍦ㄥ北瑗垮拰鍏崇窘鑱婁簡涓€娆♀€濈殑绀句氦璧勪骇銆俙,
  `2024 骞达紝銆婇粦绁炶瘽锛氭偀绌恒€嬪叏鐞冮攢閲忕獊鐮翠袱鍗冧竾锛?6 涓彇鏅湴涓?27 涓潵鑷北瑗裤€傝繖鏄北瑗垮彜寤虹瓚涓€鐧惧勾鏉ユ渶澶х殑涓€娆＄牬鍦堟満浼氥€傗€滄偀绌哄紩璺€濇妸杩欎釜鏈轰細鎺ヤ綇锛氭父瀹㈢敤鎵嬫満鎷嶇収鎴栨壂鎻忓北瑗垮彜寤虹瓚锛孉I 鑷姩璇嗗埆寤虹瓚鍚嶇О鍜屾湞浠ｏ紝鐢婚潰鍙充笅瑙掑嚭鐜版偀绌鸿鑹叉媴浠诲娓搞€備粬鐢ㄦ父鎴忓寲鐨勮瑷€璁蹭經鍏夊涓轰粈涔堝惫绔嬩簡涓€鍗冧竴鐧惧叚鍗佷節骞达紝璁插簲鍘挎湪濉斿叚鍗佷竷绫抽珮鐨勭函鏈ㄧ粨鏋勫浣曞鎶楀湴闇囷紝璁茶В杩囩▼涓┛鎻掍袱娈?AI 鍔ㄧ敾鈥斺€斾竴娈垫槸鍙ゅ缓浠庢畫鎹熺幇鐘跺洖婧埌寤烘垚鍒濇湡鐨勬椂闂村鍘熷姩鐢伙紝涓€娈垫槸鏂楁嫳钘讳簳鐨勭垎鐐告媶瑙ｅ姩鐢伙紝姣忎釜鏋勪欢鍚嶅瓧閮芥爣娉ㄦ竻妤氥€傛父瀹笉鍐嶆槸鈥滅湅浜嗕竴搴ф棫搴欎笉鐭ラ亾濂藉湪鍝€濓紝鑰屾槸浜茬溂鐪嬭鏃堕棿鍊掓祦銆佷翰鎵嬫媶寮€涓€搴у攼浠ｅ缓绛戠殑楠ㄩ銆傝瑙ｈ棰戝彲浠ヤ笅杞斤紝27 澶勫彇鏅湴闆嗛綈鍙幏寰楁暟瀛楅€氬叧鏂囩墥銆俙,
  `骞抽仴鍙ゅ煄鏄笘鐣屾枃鍖栭仐浜э紝鏄庢竻琛楁浘缁忔槸涓浗鐨勫崕灏旇锛屾棩鍗囨槍绁ㄥ彿鍦ㄨ繖閲屽彂鏄庝簡涓浗鏈€鏃╃殑姹囩エ銆備絾浠婂ぉ鐨勬父瀹㈣蛋鍦ㄨ繖鏉¤涓婏紝鐪嬪埌鐨勬槸瀹夐潤鐨勭煶鏉胯矾鍜屽叧闂ㄧ殑鑰侀摵闈€傗€滃北娌冲叆澶溾€濈敤 AI 璁╄繖鏉¤鍥炲埌涓夌櫨骞村墠锛氭父瀹㈠湪骞抽仴鍙ゅ煄寮€鍚墜鏈?AR 妯″紡锛岀敾闈笂瀹炴椂鍙犲姞鍙や唬绻佽崳鏅薄鈥斺€旀棩鍗囨槍绁ㄥ彿鏌滃彴鍓嶆帉鏌滈獙绁ㄣ€佺桓缂庡簞闂ㄥ彛椹奸槦鍒氬埌銆佽尪閾轰紮璁″悊鍠濋洦鍓嶉緳浜曘€傚悓鏃惰€虫満閲屽搷璧?AI 鐢熸垚鐨勪笓灞炲０鏅細椋庣┛杩囩獎宸风殑鍛煎暩銆佺煶鏉胯矾涓婄殑鑴氭澹般€佽繙澶勭殑閿ｉ紦鍜屾柟瑷€鍙崠銆傝瑙夌┛瓒婂姞鍚娌夋蹈锛屼簲鎰熷悓鏃惰婵€娲汇€傚綍鍒剁粨鏉熷悗鑷姩鐢熸垚涓€娈甸煶瑙嗛鍗＄墖鍜屼竴寮犳矇娴稿紡澹佺焊锛屸€滄垜鍦ㄥ钩閬ワ紝鐪嬭浜嗕笁鐧惧勾鍓嶇殑杩欐潯琛椻€濃€斺€旇繖鍙ヨ瘽鏈韩灏辨槸浼犳挱銆俙,
  `灞辫タ鏄腑鍥介潰椋熺殑鏁呬埂锛?80 浣欑闈㈤鏄换浣曠渷浠介兘鏃犳硶澶嶅埗鐨勬枃鍖栧鍨掋€備絾缁濆ぇ澶氭暟娓稿鍚冨畬涓€纰楀垁鍓婇潰锛屽彧璁颁綇浜嗏€滃ソ鍚冣€濅袱涓瓧锛屼笉鐭ラ亾杩欑闈㈣癁鐢熶簬鍏冧唬绂侀搧浠わ紝涓嶇煡閬撻偅涓€鍒€鍓婂嚭鐨勫姬绾胯儗鍚庢湁涓冪櫨骞寸殑鎵嬭壓浼犳壙銆傗€滄檵鍛虫睙婀栤€濈敤 AI 璁╂瘡涓€纰楅潰璁插嚭鑷繁鐨勮韩涓栵細鐢ㄦ埛鎵弿鎴栨媿鐓ч潰鍓嶇殑灞辫タ闈㈤锛孉I 鑷姩璇嗗埆鍝佺被锛屾帹閫佷竴娈?AI 澧炲己鐨勫埗浣滆繃绋嬭棰戔€斺€旈潰鍥㈤鍑虹殑寮х嚎鐢ㄦ參鍔ㄤ綔鎹曟崏锛屽叆閿呮簠璧风殑姘磋姳鐢ㄥ井璺濇斁澶э紝钂告苯鍗囪吘鐢ㄥ厜鏁堟覆鏌撱€傝棰戜箣鍚庯紝涓€寮?AI 椋熻氨鏁呬簨鍗℃粦鍑猴細杩欑闈粠鍝釜鏈濅唬鏉ワ紝鍥犱綍鑰岀敓锛岃皝鍦ㄥ悆锛屾€庝箞鍋氥€備笉鏄共宸村反鐨勭櫨绉戣瘝鏉★紝鑰屾槸涓€娈垫湁鐢婚潰鎰熺殑鍙欎簨銆傛晠浜嬪崱鍜岃棰戜竴閿垎浜垨涓嬭浇銆俙,
  `姘镐箰瀹笁娓呮鐨勩€婃湞鍏冨浘銆嬶紝403 骞虫柟绫炽€?86 浣嶉亾鏁欑浠欍€侀珮 4.26 绫炽€侀暱 94.68 绫筹紝鏄腑鍥界幇瀛樿妯℃渶澶с€佷繚瀛樻渶瀹屾暣鐨勫厓浠ｅ鐢汇€傚畠鐨勮壓鏈环鍊艰冻浠ユ瘮鑲╂暒鐓岋紝浣嗙粷澶у鏁版父瀹㈢珯鍦ㄥ鐢诲墠锛屽彧瑙夊緱鈥滃ソ澶уソ澶氫汉鈥濓紝鍒嗕笉娓呯帀鐨囧ぇ甯濆拰绱井澶у笣锛屾洿涓嶇煡閬撹钀介噷閭ｄ綅鎵嬫崸鐏佃姖鐨勭帀濂冲凡缁忓湪鍗楀ぉ闂ㄥ€煎畧浜嗕竷鐧惧勾銆傗€滄墜涓婂北瑗库€濆仛涓や欢浜嬶細绗竴锛岃浣犺蛋杩涘鐢汇€傛父瀹㈠湪澹佺敾鍓嶈嚜鎷嶏紝AI 鍚屾椂璇嗗埆浣犵殑闈㈤儴鍜岃儗鏅鐢伙紝鑷姩灏嗕綘鐨勫舰璞¤浆鍖栦负澹佺敾鍘熺敾鐨勫伐绗旈噸褰╅鏍硷紝鐢熸垚涓€寮犫€滀綘涓庣浠欏苟鑲┾€濈殑鍚堝奖銆傜浜岋紝璁╃浠欏紑鍙ｈ璇濄€傚悎褰变腑鐨勫鐢昏鑹茶 AI 婵€娲伙紝寰井杞ご鐪嬪悜浣狅紝鐢ㄥ彜鍏歌姘旇杩拌嚜宸辩殑鍊肩彮鏃ュ父銆傞潤鎬佸悎褰?+ 鍔ㄦ€佸彛鎾煭瑙嗛鍙岃緭鍑猴紝鈥滀竷鐧惧勾鍓嶇殑绁炰粰锛屼粖澶╁拰鎴戝悎浜嗗紶褰扁€濃€斺€旇繖鍙ヨ瘽鑷甫浼犳挱鍔涖€俙,
  `浜屽崄鍥涜妭姘旀槸涓浗浜哄埢鍦ㄩ瀛愰噷鐨勬椂闂磋銆傛瘡涓€涓妭姘旇儗鍚庨兘鏈夊北瑗跨嫭鐗圭殑鍥炲簲锛氳胺闆ㄦ椂鑺傚钩閬ュ彜鍩庣殑闈掔煶鏉挎硾鐫€姘村厜锛屽ぇ闆箣鏃ヤ簲鍙板北閾惰绱犺９锛岀珛鍐殑闆侀棬鍏抽涓嬬涓€鍦洪洩銆傗€滆妭姘斿北瑗库€濇妸杩欏眰鍏崇郴鍙樻垚姣忎釜浜虹殑涓撳睘鍚嶇墖锛氱敤鎴疯緭鍏ョ敓鏃ワ紝AI 鍖归厤瀵瑰簲鑺傛皵锛岀敓鎴愪竴寮犱釜鎬у寲鐨勨€滆妭姘旇韩浠借瘉鈥濃€斺€斾綘鐨勮妭姘旀槸浠€涔堛€佸搴斿摢搴у北瑗垮彜寤烘垨鍝」闈為仐銆丄I 涓轰綘鐢讳簡涓€骞呬笓灞炵殑鑺傛皵 脳 灞辫タ铻嶅悎鍦烘櫙鍥俱€丩LM 涓轰綘鍐欎簡涓€娈电嫭涓€鏃犱簩鐨勫彜椋庣璇€傚悓鏃剁敓鎴?15 绉掑姩鎬佺増瑙嗛锛氱敾闈㈤噷椋樼潃瀵瑰簲瀛ｈ妭鐨勯洩鑺辨垨钀藉彾锛屾枃瀛楅€愯娴幇锛岄厤鍙ら闊充箰銆傞潤鎬佸崱鐗?+ 鍔ㄦ€佽棰戝弻鐗堟湰锛岄檮瑁傚彉鎸夐挳鈥滈個璇峰ソ鍙嬫煡鐪?TA 鐨勮妭姘斿懡鏍尖€濄€傝繖鏄ぉ鐒堕€傚悎瑁傚彉鐨勭ぞ浜ゅ瀷鍐呭浜у搧銆俙
];

let hubState = 'cards';
let hubSelected = -1;
let hubVideoIndex = -1;

function buildHubCards() {
  hubCards.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const card = document.createElement('div');
    card.className = 'hc';
    card.style.transitionDelay = `${0.08 + i * 0.08}s`;
    card.innerHTML = `
      <div class="hc-inner">
        <img class="hc-front" src="assets/hub_card0${i + 1}_off.png" alt="">
        <img class="hc-back" src="assets/hub_card0${i + 1}_on.png" alt="">
      </div>
    `;
    card.addEventListener('click', () => hubCardClick(i));
    hubCards.appendChild(card);
  }
}

function playHubSegment(index) {
  if (hubVideoIndex === index) {
    hubVid.play().catch(() => {});
    return;
  }
  hubVideoIndex = index;
  hubVid.style.opacity = '0';
  hubVid.src = hubVideos[index];
  hubVid.load();
  hubVid.oncanplay = () => {
    hubVid.playbackRate = 1;
    hubVid.play().catch(() => {});
    hubVid.style.opacity = '1';
  };
}

function resetHubSelection(quiet = false) {
  hubSelected = -1;
  hubState = 'cards';
  [...hubCards.children].forEach(card => {
    card.classList.remove('selected','flipped','dimmed');
    card.style.opacity = '1';
  });
  hubCards.style.opacity = '1';
  hubCards.style.pointerEvents = 'auto';
  if (!quiet) {
    playHubSegment(0);
  }
}

function hubHideIntro() {
  hubIntro.classList.remove('show');
  hubOverlay.classList.remove('dark');
  hubReturn.classList.remove('show');
}

function hubCardClick(index) {
  if (hubState === 'intro' && hubSelected === index) return;

  if (hubSelected === index && hubState === 'selected') {
    showHubIntro(index);
    return;
  }

  hubSelected = index;
  hubState = 'selected';

  [...hubCards.children].forEach((card, i) => {
    const dist = Math.abs(i - index);
    if (i === index) {
      card.classList.add('selected','flipped');
      card.classList.remove('dimmed');
      card.style.opacity = '1';
    } else {
      card.classList.remove('selected','flipped');
      card.classList.add('dimmed');
      card.style.opacity = `${Math.max(0.4, 0.78 - dist * 0.12)}`;
    }
  });

  hubHideIntro();
  playHubSegment(index + 1);
}

function showHubIntro(index) {
  hubState = 'intro';
  hubOverlay.classList.add('dark');
  hubIntroCard.src = `assets/hub_card0${index + 1}_on.png`;
  hubIntroText.innerHTML = themeIntros[index];
  hubIntro.classList.add('show');
  hubReturn.classList.add('show');
  hubCards.style.opacity = '.22';
  hubCards.style.pointerEvents = 'none';
}

function hubBackStep() {
  if (hubState === 'intro') {
    hubHideIntro();
    resetHubSelection(true);
    return;
  }
  if (hubState === 'selected') {
    resetHubSelection();
    return;
  }
  inHub = false;
  setScene('s4e', { force:true });
}

function hubWheel(delta) {
  if (hubState === 'intro') {
    if (delta < 0) hubBackStep();
    return;
  }
  if (hubState === 'selected') {
    if (delta > 0) showHubIntro(hubSelected);
    if (delta < 0) hubBackStep();
    return;
  }
  if (hubState === 'cards' && delta < 0) {
    inHub = false;
    setScene('s4e', { force:true });
  }
}

function initHub() {
  inHub = true;
  hubHideIntro();
  resetHubSelection(true);
  playHubSegment(0);
  requestAnimationFrame(() => {
    [...hubCards.children].forEach(card => {
      card.style.opacity = '1';
      card.style.transform = '';
    });
  });
}

hubReturn.addEventListener('click', hubBackStep);
buildHubCards();

if (strategyLoop.readyState < 2) {
  strategyLoop.addEventListener('canplay', () => strategyLoop.play().catch(() => {}), { once:true });
} else {
  strategyLoop.play().catch(() => {});
}

