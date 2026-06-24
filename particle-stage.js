/* ============================================================
   ParticleStage — quiet Canvas particle field
   Particle design株式会社 / Phase 2
   - fixed background, pointer-events:none, behind content
   - light gray / blue-gray / faint cyan dots + thin links
   - slow drift, reduced count on mobile, reduced-motion aware
   - each section's data-scene gives the field a TARGET FORMATION;
     particles migrate toward it slowly so the meaning is legible
     but never loud.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("particle-stage") || document.getElementById("particle-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: true });

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The field stays a LIVE motion at all times. Under reduced-motion we keep it
  // markedly calmer & slower (rather than frozen) so the page never reads as a
  // static image, while still respecting the user's preference for less motion.
  var MOTION = REDUCE ? 0.5 : 1.0;

  // ---- palette (rgb): grays dominate, navy + cyan are rare accents ----
  var PALETTE = [
    { c: [171, 181, 196], w: 0.40 }, // blue-gray
    { c: [205, 211, 220], w: 0.34 }, // light gray
    { c: [138, 158, 180], w: 0.14 }, // muted steel
    { c: [58, 90, 130],   w: 0.07 }, // accent navy (rare)
    { c: [127, 178, 191], w: 0.05 }  // subtle cyan (rare)
  ];

  /* ---- scene config ----------------------------------------------------
     layout   : which formation the particles target
     structure: 0 = free floating, 1 = locked to formation (controls how
                tightly they snap + how small their wander is)
     dot/link : opacity multipliers   dist: link reach (× minDim)
     speed    : migration pace         opacity: global fade (founder/company)
     cut      : suppress links across groups (problem's "断絶")
  ----------------------------------------------------------------------- */
  var SCENES = {
    hero:          { layout: "cloud",    groups: 1, structure: 0.16, dot: 0.85, link: 0.30, dist: 0.115, speed: 1.00, opacity: 1.00 },
    intro:         { layout: "groups",   groups: 3, structure: 0.58, dot: 0.85, link: 0.34, dist: 0.100, speed: 1.00, opacity: 1.00 },
    problem:       { layout: "split",    groups: 2, structure: 0.52, dot: 0.82, link: 0.30, dist: 0.105, speed: 1.00, opacity: 1.00, cut: true },
    "what-we-do":  { layout: "grid",     groups: 1, structure: 0.74, dot: 0.90, link: 0.52, dist: 0.140, speed: 0.85, opacity: 1.00 },
    service:       { layout: "rings2d",  groups: 5, structure: 0.99, dot: 0.95, link: 0.0, dist: 0.052, speed: 0.55, opacity: 1.00, spin2d: true, spinSpd: 0.0042, holdForm: true, ringR: 0.088 },
    approach:      { layout: "process",  groups: 4, structure: 0.82, dot: 0.88, link: 0.44, dist: 0.165, speed: 0.80, opacity: 1.00 },
    "track-record":{ layout: "timeline", groups: 5, structure: 0.82, dot: 0.85, link: 0.40, dist: 0.150, speed: 0.80, opacity: 1.00 },
    proof:         { layout: "nodes3d", arrange: "cards",  groups: 5, structure: 0.94, dot: 0.97, link: 0.0, dist: 0.064, speed: 1.00, opacity: 1.00, shapeScale: 0.070, rotSpd: 0.0072 },
    "future-eggs": { layout: "eggs",     groups: 3, structure: 0.80, dot: 0.88, link: 0.40, dist: 0.085, speed: 0.85, opacity: 1.00 },
    founder:       { layout: "cloud",    groups: 1, structure: 0.12, dot: 0.42, link: 0.14, dist: 0.090, speed: 0.60, opacity: 0.55 },
    news:          { layout: "groups",   groups: 3, structure: 0.50, dot: 0.70, link: 0.28, dist: 0.100, speed: 0.80, opacity: 0.80 },
    company:       { layout: "cloud",    groups: 1, structure: 0.12, dot: 0.42, link: 0.14, dist: 0.090, speed: 0.60, opacity: 0.55 },
    contact:       { layout: "converge", groups: 1, structure: 0.66, dot: 0.82, link: 0.42, dist: 0.140, speed: 0.80, opacity: 1.00 }
  };

  var sceneName = "hero";
  var cfg = SCENES.hero;
  var formCur = 0;          // scroll-driven formation progress (0=floating, 1=formed)
  var spinAng = 0;          // shared rotation angle for spinning disc scenes (service)
  var activeEl = null;      // section currently nearest viewport center
  // eased global scalars
  var st = { structure: cfg.structure, dot: cfg.dot, link: cfg.link, dist: cfg.dist, opacity: cfg.opacity };

  var W = 0, H = 0, DPR = 1, COUNT = 0, particles = [], minDim = 0, gridCols = 1;
  // node-shape (3D) scene state
  var gCenters = [], gScale = [], gRotAng = [], gRotSpd = [], gTilt = [], groupCount = [];
  var groupShape = [], vertParticle = [], proofCards = [];

  function pickColor() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < PALETTE.length; i++) { acc += PALETTE[i].w; if (r <= acc) return PALETTE[i].c; }
    return PALETTE[0].c;
  }

  // even point distribution on a unit sphere (golden-angle / fibonacci)
  function fibSphere(k, n) {
    var off = 2 / n;
    var y = k * off - 1 + off * 0.5;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var phi = k * 2.399963229728653;
    return [Math.cos(phi) * r, y, Math.sin(phi) * r];
  }

  function makeParticles() {
    particles = [];
    for (var i = 0; i < COUNT; i++) {
      var col = pickColor();
      var isAccent = (col[0] === 58 || col[0] === 127);
      var fx = Math.random() * W, fy = Math.random() * H;
      particles.push({
        x: fx, y: fy,
        fx: fx, fy: fy,            // free-floating home (always drifting)
        fvx: (Math.random() - 0.5) * 0.55,
        fvy: (Math.random() - 0.5) * 0.55,
        tx: fx, ty: fy,           // formation target (per scene)
        // stable per-particle randoms (gaussian-ish, -1..1) for spread
        rx: ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1,
        ry: ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1,
        group: 0,
        lx: 0, ly: 0, lz: 0, depth: 0,   // 3D local coords for node-shape scenes
        r: (isAccent ? 1.5 : 1.0) + Math.random() * 1.7,
        col: col,
        base: isAccent ? 0.9 : 0.6 + Math.random() * 0.3,
        ph: Math.random() * Math.PI * 2,
        sp: 0.005 + Math.random() * 0.008
      });
    }
    computeTargets();
  }

  // ---- 3D wireframe solids: vertices + edges, normalized to ~unit radius ----
  function normShape(s) {
    var m = 0, i, p, d;
    for (i = 0; i < s.v.length; i++) { p = s.v[i]; d = Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]); if (d > m) m = d; }
    if (m > 0) for (i = 0; i < s.v.length; i++) { s.v[i][0]/=m; s.v[i][1]/=m; s.v[i][2]/=m; }
    return s;
  }
  function pentaPrism() {                    // 立体的な五角形 (pentagonal prism)
    var v = [], e = [], k, a;
    for (k = 0; k < 5; k++) { a = k * 2*Math.PI/5; v.push([Math.cos(a), 0.95, Math.sin(a)]); }
    for (k = 0; k < 5; k++) { a = k * 2*Math.PI/5; v.push([Math.cos(a), -0.95, Math.sin(a)]); }
    for (k = 0; k < 5; k++) { e.push([k, (k+1)%5]); e.push([5+k, 5+(k+1)%5]); e.push([k, 5+k]); }
    return normShape({ v: v, e: e });
  }
  function pentaBipyramid() {                // pentagonal bipyramid
    var v = [], e = [], k, a;
    for (k = 0; k < 5; k++) { a = k * 2*Math.PI/5; v.push([Math.cos(a), 0, Math.sin(a)]); }
    v.push([0, 1.35, 0]); v.push([0, -1.35, 0]);
    for (k = 0; k < 5; k++) { e.push([k, (k+1)%5]); e.push([5, k]); e.push([6, k]); }
    return normShape({ v: v, e: e });
  }
  function tetra() {
    return normShape({ v: [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]],
      e: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]] });
  }
  function cube() {
    return normShape({ v: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
      e: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]] });
  }
  function octa() {
    return normShape({ v: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
      e: [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[2,5],[3,4],[3,5]] });
  }
  // service → five identical pentagonal prisms ; proof → five distinct solids
  function shapesForScene() {
    if (cfg.arrange === "circle") return [pentaPrism(), pentaPrism(), pentaPrism(), pentaPrism(), pentaPrism()];
    return [tetra(), cube(), octa(), pentaPrism(), pentaBipyramid()];
  }

  // ---- node-shape (3D) formation: particles → vertices + edge points ----
  function computeNodes3d() {
    var gp = cfg.groups || 5, i, g, k;
    groupShape = shapesForScene();
    gCenters = []; gScale = []; gRotAng = []; gRotSpd = []; gTilt = []; groupCount = []; vertParticle = [];

    for (g = 0; g < gp; g++) {
      groupCount[g] = Math.floor(COUNT / gp) + (g < (COUNT % gp) ? 1 : 0);
      gScale[g]  = minDim * (cfg.shapeScale || 0.06);
      gRotAng[g] = Math.random() * Math.PI * 2;
      gRotSpd[g] = (cfg.rotSpd || 0.006) * (0.7 + Math.random() * 0.6) * (g % 2 ? 1 : -1);
      gTilt[g]   = 0.34 + Math.random() * 0.5;
      gCenters[g] = [W * 0.5, H * 0.5];
      vertParticle[g] = [];
    }

    var gi = []; for (g = 0; g < gp; g++) gi[g] = 0;
    for (i = 0; i < COUNT; i++) {
      var p = particles[i];
      g = i % gp; p.group = g;
      var sh = groupShape[g], V = sh.v.length, E = sh.e.length;
      k = gi[g]++;
      var lp;
      if (k < V) {                                  // corner / vertex particle
        lp = sh.v[k];
        p.isVertex = true;
        vertParticle[g][k] = i;
      } else {                                      // particle spread along an edge
        var r = k - V;
        var edge = sh.e[r % E];
        var layers = Math.floor((groupCount[g] - V - 1) / E) + 2;
        var frac = (Math.floor(r / E) + 1) / layers;
        var va = sh.v[edge[0]], vb = sh.v[edge[1]];
        lp = [va[0]+(vb[0]-va[0])*frac, va[1]+(vb[1]-va[1])*frac, va[2]+(vb[2]-va[2])*frac];
        p.isVertex = false;
      }
      p.lx = lp[0]; p.ly = lp[1]; p.lz = lp[2];
      p.tx = gCenters[g][0] + lp[0] * gScale[g];
      p.ty = gCenters[g][1] + lp[1] * gScale[g];
    }
  }

  // ---- per-scene formation: assign each particle a target (tx,ty) ----
  function computeTargets() {
    if (cfg.layout === "nodes3d") { computeNodes3d(); return; }
    var layout = cfg.layout;
    var cx, cy, i, p, g, gp = cfg.groups || 1;

    // group sizes for rank-within-group layouts
    var per = Math.ceil(COUNT / gp);

    for (i = 0; i < COUNT; i++) {
      p = particles[i];
      var tx, ty;

      switch (layout) {
        case "rings2d": {                      // service — 5 circles of particles that slowly rotate
          var RR = minDim * 0.27;             // big ring the 5 circles sit on
          var cR = minDim * (cfg.ringR || 0.088);
          g = i % 5; p.group = g;
          var a0 = -Math.PI / 2 + g * (2 * Math.PI / 5);
          p.ringCx = W * 0.5 + Math.cos(a0) * RR;
          p.ringCy = H * 0.5 + Math.sin(a0) * RR;
          var rank = Math.floor(i / 5);
          p.ringAng = (rank / per) * Math.PI * 2;          // base angle on its small circle
          p.ringRad = cR * (0.82 + (rank % 3) * 0.09);      // 2–3 concentric bands → reads as a disc
          p.ringDir = (g % 2 ? 1 : -1);                     // alternate spin direction per circle
          tx = p.ringCx + Math.cos(p.ringAng) * p.ringRad;
          ty = p.ringCy + Math.sin(p.ringAng) * p.ringRad;
          break;
        }
        case "cloud":
          p.group = 0;
          tx = W * 0.52 + p.rx * W * 0.34;
          ty = H * 0.50 + p.ry * H * 0.36;
          break;

        case "groups": {                       // intro — 3 concept clusters
          var GC = [[0.30, 0.40], [0.54, 0.61], [0.74, 0.40]];
          g = i % 3; p.group = g;
          tx = W * GC[g][0] + p.rx * minDim * 0.085;
          ty = H * GC[g][1] + p.ry * minDim * 0.095;
          break;
        }

        case "split": {                        // problem — two severed sides
          var SC = [[0.33, 0.50], [0.69, 0.50]];
          g = i % 2; p.group = g;
          tx = W * SC[g][0] + p.rx * minDim * 0.095;
          ty = H * SC[g][1] + p.ry * minDim * 0.135;
          break;
        }

        case "grid": {                         // what-we-do — orderly lattice
          p.group = 0;
          var cols = gridCols, rows = Math.max(1, Math.ceil(COUNT / cols));
          var col = i % cols, row = Math.floor(i / cols);
          tx = W * (0.18 + (cols > 1 ? col / (cols - 1) : 0.5) * 0.66) + p.rx * minDim * 0.012;
          ty = H * (0.22 + (rows > 1 ? row / (rows - 1) : 0.5) * 0.56) + p.ry * minDim * 0.012;
          break;
        }

        case "branches": {                     // service — 5 radiating branches
          var ANG = [-80, -40, 0, 40, 80];
          g = i % 5; p.group = g;
          var brank = Math.floor(i / 5), bt = per > 1 ? brank / (per - 1) : 0.5;
          var a = ANG[g] * Math.PI / 180;
          var rad = minDim * (0.07 + bt * 0.40);
          cx = W * 0.40; cy = H * 0.50;
          tx = cx + Math.cos(a) * rad + p.rx * minDim * 0.018;
          ty = cy + Math.sin(a) * rad + p.ry * minDim * 0.018;
          break;
        }

        case "process": {                      // approach — horizontal line, 4 nodes
          var PX = [0.20, 0.40, 0.60, 0.80];
          g = i % 4; p.group = g;
          tx = W * PX[g] + p.rx * minDim * 0.05;
          ty = H * 0.52 + p.ry * minDim * 0.05;
          break;
        }

        case "timeline": {                     // track-record — descending node line
          g = i % 5; p.group = g;
          var ty0 = 0.22 + (g / 4) * 0.58;
          var tx0 = 0.40 + (g / 4) * 0.20;
          tx = W * tx0 + p.rx * minDim * 0.05;
          ty = H * ty0 + p.ry * minDim * 0.05;
          break;
        }

        case "rings": {                        // proof — stable concentric structure
          p.group = 0;
          var ring = i % 2;
          var inRing = Math.floor(i / 2);
          var perRing = Math.ceil(COUNT / 2);
          var ar = (inRing / perRing) * Math.PI * 2 + ring * 0.4;
          var rr = minDim * (ring === 0 ? 0.15 : 0.27);
          cx = W * 0.52; cy = H * 0.50;
          tx = cx + Math.cos(ar) * rr + p.rx * minDim * 0.012;
          ty = cy + Math.sin(ar) * rr + p.ry * minDim * 0.012;
          break;
        }

        case "eggs": {                         // future-eggs — small dense cores
          var EC = [[0.36, 0.44], [0.62, 0.36], [0.50, 0.66]];
          g = i % 3; p.group = g;
          tx = W * EC[g][0] + p.rx * minDim * 0.048;
          ty = H * EC[g][1] + p.ry * minDim * 0.072; // taller = egg-like
          break;
        }

        case "converge": {                     // contact — gather to CTA center
          p.group = 0;
          tx = W * 0.50 + p.rx * minDim * 0.125;
          ty = H * 0.46 + p.ry * minDim * 0.125;
          break;
        }

        default:
          p.group = 0; tx = p.x; ty = p.y;
      }

      p.tx = tx; p.ty = ty;
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    minDim = Math.min(W, H);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    var area = W * H;
    var dense = W < 760 ? 6400 : 8800;          // a touch denser so 3D solids read well
    COUNT = Math.max(W < 760 ? 60 : 80, Math.min(W < 760 ? 90 : 180, Math.round(area / dense)));
    gridCols = Math.max(2, Math.round(Math.sqrt(COUNT * (W / H))));
    proofCards = document.querySelectorAll("#proof .proof-card");
    makeParticles();
  }

  function setScene(name) {
    if (!SCENES[name] || name === sceneName) return;
    sceneName = name;
    cfg = SCENES[name];
    canvas.setAttribute("data-scene", name);
    computeTargets();                          // new formation; particles ease in
  }
  window.ParticleStage = {
    setScene: setScene,
    get scene() { return sceneName; },
    get form() { return formCur; }
  };

  function lerp(a, b, t) { return a + (b - a) * t; }

  function snapToTargets() {
    for (var i = 0; i < COUNT; i++) { particles[i].x = particles[i].tx; particles[i].y = particles[i].ty; }
  }

  function drawLinks() {
    // links grow IN as the section forms (つながっていく) — small floor so
    // a faint web is always alive while particles float.
    var linkMul = 0.10 + 0.90 * formCur;
    var linkStrength = st.link * linkMul;
    if (linkStrength <= 0.02) return;
    var maxDist = st.dist * minDim, maxDist2 = maxDist * maxDist;
    ctx.lineWidth = 0.7;
    for (var i = 0; i < COUNT; i++) {
      var p = particles[i];
      for (var j = i + 1; j < COUNT; j++) {
        var q = particles[j];
        if (cfg.cut && p.group !== q.group && formCur > 0.45) continue;   // problem: severed once formed
        if (cfg.groupLinksOnly && p.group !== q.group) continue;           // 3D shapes: keep each node separate
        var dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
        if (d2 < maxDist2) {
          var d = Math.sqrt(d2);
          var a = (1 - d / maxDist) * linkStrength * st.opacity * 0.5;
          if (a < 0.012) continue;
          ctx.strokeStyle = "rgba(150,162,180," + a.toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
  }

  // ---- draw the wireframe edges of each rotating 3D solid ----
  function drawShapeEdges() {
    if (formCur < 0.04 || !groupShape.length) return;
    ctx.lineWidth = 0.7;
    for (var g = 0; g < gCenters.length; g++) {
      var sh = groupShape[g], vp = vertParticle[g];
      if (!sh || !vp) continue;
      for (var e = 0; e < sh.e.length; e++) {
        var ia = vp[sh.e[e][0]], ib = vp[sh.e[e][1]];
        if (ia == null || ib == null) continue;
        var pa = particles[ia], pb = particles[ib];
        var d01 = ((pa.depth + pb.depth) * 0.5 + 1) * 0.5;   // 0 back .. 1 front
        var a = (0.07 + 0.20 * d01) * formCur * st.opacity;
        if (a < 0.012) continue;
        ctx.strokeStyle = "rgba(150,162,180," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }
    }
  }

  function drawDots() {
    var useDepth = cfg.layout === "nodes3d";
    for (var i = 0; i < COUNT; i++) {
      var p = particles[i];
      var rs = 1, df = 1;
      if (useDepth) {
        var d01 = (p.depth + 1) * 0.5;        // 0 = back, 1 = front
        df = 0.40 + 0.60 * d01;
        rs = 0.65 + 0.70 * d01;
        df = 1 - formCur * (1 - df);          // depth shading fades in with the shape
        rs = 1 + formCur * (rs - 1);
        if (p.isVertex) { rs *= 1 + 0.5 * formCur; df = Math.min(1, df * 1.12); }  // corners read stronger
      }
      var alpha = p.base * st.dot * st.opacity * df;
      if (useDepth) alpha = Math.min(1, alpha * 1.35);   // 3D nodes read a little stronger
      ctx.fillStyle = "rgba(" + p.col[0] + "," + p.col[1] + "," + p.col[2] + "," + alpha.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * rs, 0, Math.PI * 2); ctx.fill();
    }
  }

  function step() {
    // ease global scalars toward the active scene (slow, calm)
    var e = 0.025;
    st.structure = lerp(st.structure, cfg.structure, e);
    st.dot       = lerp(st.dot,       cfg.dot,       e);
    st.link      = lerp(st.link,      cfg.link,      e);
    st.dist      = lerp(st.dist,      cfg.dist,      e);
    st.opacity   = lerp(st.opacity,   cfg.opacity,   e);

    // ---- scroll-coupled formation -------------------------------------
    // formProgress = how centered the active section is in the viewport.
    // 0 → particles float freely (ふわふわ) ; 1 → the scene's shape is built.
    var targetForm = 1;
    if (activeEl) {
      var r = activeEl.getBoundingClientRect();
      if (cfg.holdForm) {
        // service — plateau: form as soon as the section's top enters (01 appears)
        // and HOLD the circle shape until the section's bottom nears the top (05 leaves).
        var formIn  = Math.min(1, Math.max(0, (H * 0.92 - r.top)    / (H * 0.42)));
        var formOut = Math.min(1, Math.max(0, (r.bottom - H * 0.10) / (H * 0.42)));
        targetForm = Math.min(formIn, formOut);
      } else {
        var secMid = r.top + r.height * 0.5;
        var dist = Math.abs(secMid - H * 0.5) / (H * 0.62);
        var f = 1 - Math.min(1, dist);
        targetForm = f * f * (3 - 2 * f);            // smoothstep
      }
    }
    // structure ceiling per scene: scenes meant to stay loose form less
    formCur = lerp(formCur, targetForm * (0.35 + 0.65 * cfg.structure), 0.028);

    var nodes3d = cfg.layout === "nodes3d";

    // ---- spin the 3D node-shapes: place + re-project local coords each frame ----
    if (nodes3d && gCenters.length) {
      if (cfg.arrange === "cards") {                  // proof — anchor to live card centers
        for (var gc = 0; gc < gCenters.length; gc++) {
          var el = proofCards[gc];
          if (el) {
            var rc = el.getBoundingClientRect();
            gCenters[gc] = [rc.left + rc.width * 0.5, rc.top + rc.height * 0.5];
            gScale[gc] = Math.min(rc.width, rc.height) * 0.42;
          }
        }
      } else {                                        // service — 5 spots on a ring (no connecting lines)
        var R = minDim * 0.27, ccx = W * 0.5, ccy = H * 0.5, nn = gCenters.length;
        for (var gs = 0; gs < nn; gs++) {
          var aa = -Math.PI / 2 + gs * (2 * Math.PI / nn);
          gCenters[gs] = [ccx + Math.cos(aa) * R, ccy + Math.sin(aa) * R];
        }
      }
      for (var gg = 0; gg < gCenters.length; gg++) gRotAng[gg] += gRotSpd[gg] * MOTION;
      for (var ii = 0; ii < COUNT; ii++) {
        var pr = particles[ii], g2 = pr.group;
        if (g2 >= gCenters.length) continue;
        var ang = gRotAng[g2], tl = gTilt[g2], sc = gScale[g2];
        var cY = Math.cos(ang), sY = Math.sin(ang);
        var x1 =  pr.lx * cY + pr.lz * sY;
        var z1 = -pr.lx * sY + pr.lz * cY;
        var y1 =  pr.ly;
        var cX = Math.cos(tl), sX = Math.sin(tl);
        var y2 = y1 * cX - z1 * sX;
        var z2 = y1 * sX + z1 * cX;
        pr.tx = gCenters[g2][0] + x1 * sc;
        pr.ty = gCenters[g2][1] + y2 * sc;
        pr.depth = z2;
      }
    }

    var ease = (nodes3d ? 0.17 : 0.06) * cfg.speed;   // shapes track the spin closely
    var still = cfg.still;
    var spin2d = cfg.spin2d;
    var crisp = nodes3d ? (1 - 0.82 * formCur) : ((still || spin2d) ? Math.max(0, 1 - 1.6 * formCur) : 1);
    var floatAmt = minDim * 0.022 * crisp;            // → small for formed disc scenes (orbit handles motion)

    // service — advance a shared spin angle; each circle re-targets its orbiting points
    if (spin2d) {
      spinAng += (cfg.spinSpd || 0.004) * MOTION;
      for (var si = 0; si < COUNT; si++) {
        var sp = particles[si];
        if (sp.ringRad == null) continue;
        var ang = sp.ringAng + spinAng * sp.ringDir;
        sp.tx = sp.ringCx + Math.cos(ang) * sp.ringRad;
        sp.ty = sp.ringCy + Math.sin(ang) * sp.ringRad;
      }
    }

    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < COUNT; i++) {
      var p = particles[i];

      // 1) free home keeps drifting — the field is never static
      //    (frozen for "still" scenes once formed, so points lock in place)
      if (!(still && formCur > 0.6)) {
        p.fx += p.fvx * cfg.speed * MOTION;
        p.fy += p.fvy * cfg.speed * MOTION;
        var m = 50;
        if (p.fx < -m) p.fx = W + m; else if (p.fx > W + m) p.fx = -m;
        if (p.fy < -m) p.fy = H + m; else if (p.fy > H + m) p.fy = -m;
      }

      // 2) blend free → formation target by scroll-driven formCur
      var bx = p.fx + (p.tx - p.fx) * formCur;
      var by = p.fy + (p.ty - p.fy) * formCur;

      // 3) continuous orbital drift — keeps even "formed" nodes visibly moving
      //    (two layered frequencies = organic, never mechanical)
      p.ph += p.sp * cfg.speed * MOTION;
      var gx = bx + Math.cos(p.ph) * floatAmt + Math.sin(p.ph * 0.41 + p.rx) * floatAmt * 0.55;
      var gy = by + Math.sin(p.ph * 0.93) * floatAmt + Math.cos(p.ph * 0.37 + p.ry) * floatAmt * 0.55;

      p.x += (gx - p.x) * ease;
      p.y += (gy - p.y) * ease;
    }

    if (nodes3d) drawShapeEdges(); else drawLinks();
    drawDots();

    raf = requestAnimationFrame(step);
  }

  function renderStatic() {
    st.dot = cfg.dot; st.link = cfg.link; st.dist = cfg.dist; st.opacity = cfg.opacity;
    formCur = 0.35 + 0.65 * cfg.structure;
    for (var i = 0; i < COUNT; i++) {
      var p = particles[i];
      p.x = p.fx + (p.tx - p.fx) * formCur;
      p.y = p.fy + (p.ty - p.fy) * formCur;
    }
    ctx.clearRect(0, 0, W, H);
    drawLinks();
    drawDots();
  }

  // ---- scene detection: the section straddling the viewport center wins ----
  var sceneSections = [];
  function pickScene() {
    var mid = window.innerHeight * 0.5, chosen = null;
    for (var i = 0; i < sceneSections.length; i++) {
      var r = sceneSections[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { chosen = sceneSections[i]; break; }
      if (r.top <= mid) chosen = sceneSections[i];
    }
    if (chosen) {
      activeEl = chosen;
      if (chosen.dataset.scene) setScene(chosen.dataset.scene);
    }
  }
  function observeScenes() {
    sceneSections = Array.prototype.slice.call(document.querySelectorAll("section[data-scene]"));
    proofCards = document.querySelectorAll("#proof .proof-card");
    if (!sceneSections.length) return;
    var last = 0;
    function onScroll() {
      var now = Date.now();
      if (now - last < 90) return;
      last = now;
      pickScene();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    pickScene();
  }

  // ---- lifecycle ----
  var raf = null, running = false;
  function start() { if (running) return; running = true; raf = requestAnimationFrame(step); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  var rtid = null;
  window.addEventListener("resize", function () {
    clearTimeout(rtid);
    rtid = setTimeout(resize, 180);
  }, { passive: true });

  // init
  resize();
  observeScenes();
  start();
})();
