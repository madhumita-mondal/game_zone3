const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timerText = document.getElementById("timerText");
const timerBar = document.getElementById("timerBar");

const modeSelect = document.getElementById("modeSelect");
const currentNodeEl = document.getElementById("currentNode");
const nextTargetEl = document.getElementById("nextTarget");
const moveCountEl = document.getElementById("moveCount");
const messageBox = document.getElementById("messageBox");

const restartBtn = document.getElementById("restartBtn");
const undoBtn = document.getElementById("undoBtn");
const hintBtn = document.getElementById("hintBtn");
const newBoardBtn = document.getElementById("newBoardBtn");

const MODE_CONFIG = {
  easy: { rows: 3, cols: 3, count: 7 },
  medium: { rows: 3, cols: 4, count: 10 },
  hard: { rows: 4, cols: 4, count: 14 },
  expert: { rows: 4, cols: 5, count: 18 }
};

const MODE_TIMES = {
  easy: 60,
  medium: 90,
  hard: 120,
  expert: 180
};

const NODE_RADIUS = 22;
const NODE_BOX_HALF = 22;
const BOX_SAFE_PADDING = 12;
const START_RADIUS = 32;
const TARGET_SNAP_RADIUS = 34;
const MIN_POINT_DISTANCE = 1.5;
const MAX_SEQUENCE_ATTEMPTS = 400;
const MAX_BOARD_ATTEMPTS = 40;
const PATH_TOUCH_THRESHOLD = 7;

const PATH_COLORS = [
  "#ff5a5f",
  "#ffd43b",
  "#6ea8ff",
  "#d36cff",
  "#ff73c6",
  "#45d483",
  "#ff9f43",
  "#7ae7ff"
];

let nodes = [];
let finishedPaths = [];
let currentNode = null;
let nextTarget = null;
let moveCount = 0;
let mode = "easy";
let solutionOrder = [];
let colorIndex = 0;

let isDrawing = false;
let activeStroke = [];
let activeColor = "";

let partialConnection = null;
let history = [];
let gameOver = false;

let losingPathPreview = null;
let losingPathColor = "";

let timerInterval = null;
let totalTime = 120;
let timeLeft = 120;

function setMessage(text) {
  messageBox.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffled(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointEquals(a, b, eps = 0.001) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

function removeNearDuplicatePoints(points) {
  if (!points.length) return [];
  const result = [points[0]];

  for (let i = 1; i < points.length; i++) {
    if (distance(result[result.length - 1], points[i]) >= 1.2) {
      result.push(points[i]);
    }
  }
  return result;
}

function pathToSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({ a: points[i], b: points[i + 1] });
  }
  return segments;
}

function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p, q, r) {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-9 &&
    q.x + 1e-9 >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) + 1e-9 &&
    q.y + 1e-9 >= Math.min(p.y, r.y)
  );
}

function lineSegmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;

  return false;
}

function closestPointOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) return { x: a.x, y: a.y };

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));

  return {
    x: a.x + clampedT * dx,
    y: a.y + clampedT * dy
  };
}

function segmentSegmentMinDistance(segA, segB) {
  if (lineSegmentsIntersect(segA.a, segA.b, segB.a, segB.b)) {
    return {
      distance: 0,
      pointA: segA.a,
      pointB: segA.a
    };
  }

  const c1 = closestPointOnSegment(segA.a, segB.a, segB.b);
  const d1 = distance(segA.a, c1);

  const c2 = closestPointOnSegment(segA.b, segB.a, segB.b);
  const d2 = distance(segA.b, c2);

  const c3 = closestPointOnSegment(segB.a, segA.a, segA.b);
  const d3 = distance(segB.a, c3);

  const c4 = closestPointOnSegment(segB.b, segA.a, segA.b);
  const d4 = distance(segB.b, c4);

  const candidates = [
    { distance: d1, pointA: segA.a, pointB: c1 },
    { distance: d2, pointA: segA.b, pointB: c2 },
    { distance: d3, pointA: c3, pointB: segB.a },
    { distance: d4, pointA: c4, pointB: segB.b }
  ];

  candidates.sort((x, y) => x.distance - y.distance);
  return candidates[0];
}

function shareAllowedEndpoint(segA, segB, allowedPoints = []) {
  const segAPoints = [segA.a, segA.b];
  const segBPoints = [segB.a, segB.b];

  for (const p1 of segAPoints) {
    for (const p2 of segBPoints) {
      if (pointEquals(p1, p2)) {
        for (const allowed of allowedPoints) {
          if (distance(p1, allowed) < 0.5) return true;
        }
      }
    }
  }
  return false;
}

function getCommittedSegments() {
  const all = [];
  for (const p of finishedPaths) {
    all.push(...pathToSegments(p.points));
  }
  return all;
}

function getNodeSafeRect(node) {
  const half = NODE_BOX_HALF + BOX_SAFE_PADDING;
  return {
    left: node.x - half,
    right: node.x + half,
    top: node.y - half,
    bottom: node.y + half
  };
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function pointInsideAnyNodeBox(point) {
  for (const node of nodes) {
    if (pointInRect(point, getNodeSafeRect(node))) {
      return true;
    }
  }
  return false;
}

function isForbiddenOldPathContact(segA, segB, allowedEndpoints = []) {
  if (shareAllowedEndpoint(segA, segB, allowedEndpoints)) {
    return false;
  }

  const exactIntersection = lineSegmentsIntersect(segA.a, segA.b, segB.a, segB.b);
  const nearest = segmentSegmentMinDistance(segA, segB);

  if (!exactIntersection && nearest.distance > PATH_TOUCH_THRESHOLD) {
    return false;
  }

  const contactPoint = {
    x: (nearest.pointA.x + nearest.pointB.x) / 2,
    y: (nearest.pointA.y + nearest.pointB.y) / 2
  };

  if (pointInsideAnyNodeBox(contactPoint)) {
    return false;
  }

  return true;
}

function polylineTouchesCommittedOutsideBoxes(points, allowedEndpoints = []) {
  const candidateSegs = pathToSegments(points);
  const committedSegs = getCommittedSegments();

  for (const seg of candidateSegs) {
    for (const other of committedSegs) {
      if (isForbiddenOldPathContact(seg, other, allowedEndpoints)) {
        return true;
      }
    }
  }
  return false;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimerUI() {
  if (!timerText || !timerBar) return;

  timerText.textContent = formatTime(timeLeft);

  const percent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  timerBar.style.width = `${Math.max(0, percent)}%`;

  if (percent > 50) {
    timerBar.style.background = "linear-gradient(90deg, #5dffb2 0%, #ffe45c 70%, #ff7a7a 100%)";
  } else if (percent > 20) {
    timerBar.style.background = "linear-gradient(90deg, #ffe45c 0%, #ffb347 65%, #ff7a7a 100%)";
  } else {
    timerBar.style.background = "linear-gradient(90deg, #ff8a8a 0%, #ff5c5c 100%)";
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  totalTime = MODE_TIMES[mode] || 120;
  timeLeft = totalTime;
  updateTimerUI();

  timerInterval = setInterval(() => {
    if (gameOver || !nextTarget) {
      stopTimer();
      return;
    }

    timeLeft--;
    updateTimerUI();

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateTimerUI();
      stopTimer();
      loseGame("Time is up");
    }
  }, 1000);
}

function loseGame(reason = "You lost the game", candidatePoints = null, color = "") {
  stopTimer();
  gameOver = true;
  isDrawing = false;

  if (candidatePoints && candidatePoints.length > 1) {
    losingPathPreview = candidatePoints.map(p => ({ x: p.x, y: p.y }));
    losingPathColor = color || activeColor || PATH_COLORS[colorIndex % PATH_COLORS.length];
  } else if (activeStroke.length > 1) {
    losingPathPreview = activeStroke.map(p => ({ x: p.x, y: p.y }));
    losingPathColor = activeColor || PATH_COLORS[colorIndex % PATH_COLORS.length];
  } else {
    losingPathPreview = null;
    losingPathColor = "";
  }

  setMessage(reason);
  draw();
}

function buildValidSequence(nodeList) {
  if (nodeList.length < 2) return null;

  for (let attempt = 0; attempt < MAX_SEQUENCE_ATTEMPTS; attempt++) {
    const start = nodeList[Math.floor(Math.random() * nodeList.length)];
    const remaining = nodeList.filter(n => n.id !== start.id);
    const order = [start];
    const tempSegments = [];
    let current = start;
    let success = true;

    while (remaining.length > 0) {
      const candidates = remaining.filter(candidate => {
        const seg = { a: current, b: candidate };
        let blocked = false;

        for (const other of tempSegments) {
          const allowed = [current, candidate];
          if (shareAllowedEndpoint(seg, other, allowed)) continue;
          if (lineSegmentsIntersect(seg.a, seg.b, other.a, other.b)) {
            blocked = true;
            break;
          }
        }
        return !blocked;
      });

      if (!candidates.length) {
        success = false;
        break;
      }

      candidates.sort((a, b) => distance(current, a) - distance(current, b));
      const shortlist = candidates.slice(0, Math.min(4, candidates.length));
      const next = shortlist[Math.floor(Math.random() * shortlist.length)];

      tempSegments.push({ a: current, b: next });
      order.push(next);
      remaining.splice(remaining.findIndex(n => n.id === next.id), 1);
      current = next;
    }

    if (success) return order;
  }

  return null;
}

function createNeatGridPositions(rows, cols, count) {
  const positions = [];
  const paddingX = 52;
  const paddingY = 60;
  const usableWidth = canvas.width - paddingX * 2;
  const usableHeight = canvas.height - paddingY * 2;

  const stepX = cols > 1 ? usableWidth / (cols - 1) : 0;
  const stepY = rows > 1 ? usableHeight / (rows - 1) : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: paddingX + c * stepX,
        y: paddingY + r * stepY
      });
    }
  }

  const selected = shuffled(positions).slice(0, count);

  return selected.map((pos, index) => ({
    id: index + 1,
    x: clamp(pos.x + (Math.random() - 0.5) * 20, 36, canvas.width - 36),
    y: clamp(pos.y + (Math.random() - 0.5) * 20, 36, canvas.height - 36)
  }));
}

function resetState() {
  nodes = [];
  finishedPaths = [];
  currentNode = null;
  nextTarget = null;
  moveCount = 0;
  solutionOrder = [];
  colorIndex = 0;
  isDrawing = false;
  activeStroke = [];
  activeColor = "";
  partialConnection = null;
  history = [];
  gameOver = false;
  losingPathPreview = null;
  losingPathColor = "";
  stopTimer();
  totalTime = 120;
  timeLeft = 120;
  updateTimerUI();
}

function updateInfo() {
  currentNodeEl.textContent = currentNode ? currentNode.id : "-";
  nextTargetEl.textContent = nextTarget ? nextTarget.id : "Done";
  moveCountEl.textContent = moveCount;
}

function generateBoard() {
  mode = modeSelect.value;
  const { rows, cols, count } = MODE_CONFIG[mode];
  resetState();

  let built = false;

  for (let i = 0; i < MAX_BOARD_ATTEMPTS; i++) {
    const generatedNodes = createNeatGridPositions(rows, cols, count);
    const generatedSequence = buildValidSequence(generatedNodes);

    if (generatedSequence) {
      nodes = generatedNodes;
      solutionOrder = generatedSequence;
      currentNode = solutionOrder[0];
      nextTarget = solutionOrder[1] || null;
      built = true;
      break;
    }
  }

  if (!built) {
    setMessage("Could not generate board. Try New Board.");
    updateInfo();
    draw();
    return;
  }

  updateInfo();
  setMessage(`Start from ${currentNode.id} and draw toward ${nextTarget.id}.`);
  startTimer();
  draw();
}

function restartSameBoard() {
  if (!solutionOrder.length) {
    generateBoard();
    return;
  }

  finishedPaths = [];
  moveCount = 0;
  colorIndex = 0;
  currentNode = solutionOrder[0];
  nextTarget = solutionOrder[1] || null;
  isDrawing = false;
  activeStroke = [];
  activeColor = "";
  partialConnection = null;
  history = [];
  gameOver = false;
  losingPathPreview = null;
  losingPathColor = "";
  stopTimer();
  totalTime = MODE_TIMES[mode] || 120;
  timeLeft = totalTime;
  updateTimerUI();

  updateInfo();
  setMessage(`Board restarted. Start from ${currentNode.id} and go to ${nextTarget.id}.`);
  startTimer();
  draw();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  const clientX = touch ? touch.clientX : event.clientX;
  const clientY = touch ? touch.clientY : event.clientY;

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

function getCurrentAnchorPoint() {
  if (partialConnection && partialConnection.points.length) {
    return partialConnection.points[partialConnection.points.length - 1];
  }
  if (currentNode) {
    return { x: currentNode.x, y: currentNode.y };
  }
  return null;
}

function getCurrentConnectionColor() {
  if (partialConnection) return partialConnection.color;
  return PATH_COLORS[colorIndex % PATH_COLORS.length];
}

function addPointToStroke(point) {
  if (!activeStroke.length) {
    activeStroke.push({ x: point.x, y: point.y });
    return;
  }

  const last = activeStroke[activeStroke.length - 1];
  if (distance(last, point) >= MIN_POINT_DISTANCE) {
    activeStroke.push({ x: point.x, y: point.y });
  }
}

function beginStroke(point) {
  if (!currentNode || !nextTarget || gameOver) return;

  const anchor = getCurrentAnchorPoint();
  if (!anchor) return;

  if (distance(point, anchor) > START_RADIUS) {
    if (partialConnection) {
      setMessage("Start from the end of your saved partial line.");
    } else {
      setMessage(`Start from ${currentNode.id}.`);
    }
    return;
  }

  isDrawing = true;
  activeColor = getCurrentConnectionColor();
  activeStroke = [{ x: anchor.x, y: anchor.y }];
  addPointToStroke(point);
  draw();
}

function buildLiveCandidate() {
  const basePoints = partialConnection
    ? [...partialConnection.points]
    : [{ x: currentNode.x, y: currentNode.y }];

  let strokePoints = removeNearDuplicatePoints(activeStroke);

  if (strokePoints.length < 1) {
    strokePoints = [{ ...basePoints[basePoints.length - 1] }];
  }

  if (!pointEquals(basePoints[basePoints.length - 1], strokePoints[0])) {
    strokePoints.unshift({ ...basePoints[basePoints.length - 1] });
  }

  const combined = [...basePoints, ...strokePoints.slice(1)];
  return removeNearDuplicatePoints(combined);
}

function validateLivePath(candidatePoints) {
  const allowedEndpoints = [];
  if (currentNode) allowedEndpoints.push(currentNode);
  if (nextTarget) allowedEndpoints.push(nextTarget);

  const joinPoint = partialConnection
    ? partialConnection.points[partialConnection.points.length - 1]
    : { x: currentNode.x, y: currentNode.y };

  if (joinPoint) allowedEndpoints.push(joinPoint);

  if (polylineTouchesCommittedOutsideBoxes(candidatePoints, allowedEndpoints)) {
    return { ok: false, reason: "You lost the game" };
  }

  return { ok: true };
}

function updateStroke(point) {
  if (!isDrawing || gameOver) return;

  addPointToStroke(point);

  const candidatePoints = buildLiveCandidate();
  const liveCheck = validateLivePath(candidatePoints);

  if (!liveCheck.ok) {
    loseGame(liveCheck.reason, candidatePoints, activeColor);
    return;
  }

  draw();
}

function buildCandidatePoints(strokeEndPoint, snapToTarget) {
  const basePoints = partialConnection
    ? [...partialConnection.points]
    : [{ x: currentNode.x, y: currentNode.y }];

  let strokePoints = removeNearDuplicatePoints(activeStroke);

  if (strokePoints.length < 1) {
    strokePoints = [{ ...basePoints[basePoints.length - 1] }];
  }

  if (!pointEquals(basePoints[basePoints.length - 1], strokePoints[0])) {
    strokePoints.unshift({ ...basePoints[basePoints.length - 1] });
  }

  let combined = [...basePoints, ...strokePoints.slice(1)];

  if (snapToTarget) {
    if (!pointEquals(combined[combined.length - 1], nextTarget)) {
      combined.push({ x: nextTarget.x, y: nextTarget.y });
    }
  } else {
    const endPoint = { x: strokeEndPoint.x, y: strokeEndPoint.y };
    if (!pointEquals(combined[combined.length - 1], endPoint)) {
      combined.push(endPoint);
    }
  }

  return removeNearDuplicatePoints(combined);
}

function isCandidateValid(candidatePoints, finalizing) {
  const allowedEndpoints = [];

  if (currentNode) allowedEndpoints.push(currentNode);
  if (nextTarget) allowedEndpoints.push(nextTarget);

  const joinPoint = partialConnection
    ? partialConnection.points[partialConnection.points.length - 1]
    : { x: currentNode.x, y: currentNode.y };

  if (joinPoint) allowedEndpoints.push(joinPoint);

  if (polylineTouchesCommittedOutsideBoxes(candidatePoints, allowedEndpoints)) {
    return { ok: false, reason: "You lost the game" };
  }

  if (finalizing) {
    const last = candidatePoints[candidatePoints.length - 1];
    if (distance(last, nextTarget) > 0.5) {
      return { ok: false, reason: "Final line must end on the target." };
    }
  }

  return { ok: true };
}

function savePartial(candidatePoints) {
  if (!partialConnection) {
    partialConnection = {
      fromId: currentNode.id,
      toId: nextTarget.id,
      color: activeColor,
      points: candidatePoints
    };
  } else {
    partialConnection.points = candidatePoints;
  }

  history.push({
    type: "partial-save",
    points: candidatePoints.map(p => ({ x: p.x, y: p.y })),
    fromId: currentNode.id,
    toId: nextTarget.id,
    color: partialConnection.color
  });

  isDrawing = false;
  activeStroke = [];
  activeColor = "";
  draw();
  setMessage(`Partial path saved. Continue to ${nextTarget.id}.`);
}

function finalizeConnection(candidatePoints) {
  const color = partialConnection ? partialConnection.color : activeColor;

  finishedPaths.push({
    fromId: currentNode.id,
    toId: nextTarget.id,
    color,
    points: candidatePoints
  });

  history.push({
    type: "full-commit"
  });

  moveCount++;
  colorIndex++;

  const nextIndex = solutionOrder.findIndex(node => node.id === nextTarget.id) + 1;
  currentNode = nextTarget;
  nextTarget = solutionOrder[nextIndex] || null;

  partialConnection = null;
  isDrawing = false;
  activeStroke = [];
  activeColor = "";
  losingPathPreview = null;
  losingPathColor = "";

  updateInfo();
  draw();

  if (!nextTarget) {
    stopTimer();
    setMessage("Outstanding! You completed the puzzle.");
  } else {
    setMessage(`Great! Now go to ${nextTarget.id}.`);
  }
}

function endStroke(point) {
  if (!isDrawing || gameOver) return;

  addPointToStroke(point);

  const reachedTarget = distance(point, nextTarget) <= TARGET_SNAP_RADIUS;
  const candidatePoints = buildCandidatePoints(point, reachedTarget);
  const validation = isCandidateValid(candidatePoints, reachedTarget);

  if (!validation.ok) {
    loseGame(validation.reason, candidatePoints, activeColor);
    return;
  }

  if (reachedTarget) {
    finalizeConnection(candidatePoints);
  } else {
    savePartial(candidatePoints);
  }
}

function undoMove() {
  if (gameOver) {
    setMessage("Restart or make a new board.");
    return;
  }

  if (isDrawing) {
    isDrawing = false;
    activeStroke = [];
    activeColor = "";
    draw();
    setMessage("Current stroke cancelled.");
    return;
  }

  if (!history.length) {
    setMessage("Nothing to undo.");
    return;
  }

  const last = history.pop();

  if (last.type === "partial-save") {
    let previousPartial = null;

    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.type === "partial-save" && h.fromId === last.fromId && h.toId === last.toId) {
        previousPartial = h;
        break;
      }
      if (h.type === "full-commit") break;
    }

    if (previousPartial) {
      partialConnection = {
        fromId: previousPartial.fromId,
        toId: previousPartial.toId,
        color: previousPartial.color,
        points: previousPartial.points.map(p => ({ x: p.x, y: p.y }))
      };
      setMessage("Went back one partial step.");
    } else {
      partialConnection = null;
      setMessage("Removed saved partial line.");
    }

    draw();
    return;
  }

  if (last.type === "full-commit") {
    const removedPath = finishedPaths.pop();
    if (!removedPath) return;

    moveCount = Math.max(0, moveCount - 1);
    colorIndex = Math.max(0, colorIndex - 1);

    const fromNode = nodes.find(n => n.id === removedPath.fromId);
    const toNode = nodes.find(n => n.id === removedPath.toId);

    currentNode = fromNode;
    nextTarget = toNode;
    partialConnection = null;
    losingPathPreview = null;
    losingPathColor = "";

    updateInfo();
    draw();
    setMessage("Last completed connection removed.");
  }
}

function showHint() {
  if (gameOver) {
    setMessage("Game over. Restart to play again.");
    return;
  }

  if (!currentNode || !nextTarget) {
    setMessage("Puzzle already finished.");
    return;
  }

  const anchor = getCurrentAnchorPoint();
  setMessage(`Hint: continue from where the line ends and reach ${nextTarget.id}.`);
  draw();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.setLineDash([10, 8]);

  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  const mx = (anchor.x + nextTarget.x) / 2;
  const my = (anchor.y + nextTarget.y) / 2 - 30;
  ctx.quadraticCurveTo(mx, my, nextTarget.x, nextTarget.y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

function drawBackgroundGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  for (let x = 30; x < canvas.width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 30; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPrettyPath(points, color, width = 7, alpha = 1) {
  if (!points || points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawNodes() {
  for (const node of nodes) {
    const isCurrent = currentNode && node.id === currentNode.id;
    const isTarget = nextTarget && node.id === nextTarget.id;
    const isUsed = finishedPaths.some(p => p.fromId === node.id || p.toId === node.id);

    ctx.save();

    let fill = "#f4f1ea";
    let stroke = "#ded6c8";
    let shadow = "rgba(0,0,0,0.2)";

    if (isTarget) {
      fill = "#ffe082";
      stroke = "#ffca28";
      shadow = "rgba(255, 213, 79, 0.55)";
    } else if (isCurrent) {
      fill = "#b3f1ff";
      stroke = "#4dd0e1";
      shadow = "rgba(77, 208, 225, 0.55)";
    } else if (isUsed) {
      fill = "#e8f5e9";
      stroke = "#a5d6a7";
    }

    ctx.shadowColor = shadow;
    ctx.shadowBlur = isCurrent || isTarget ? 18 : 8;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(node.x - 22, node.y - 22, 44, 44, 10);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#2e2e2e";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.id, node.x, node.y + 1);

    ctx.restore();
  }
}

function drawAnchorMarker() {
  const anchor = getCurrentAnchorPoint();
  if (!anchor || !nextTarget || gameOver) return;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPrompt() {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let text = "Ready";
  if (gameOver) {
    text = "You lost the game";
  } else if (currentNode && nextTarget) {
    text = partialConnection
      ? `Continue → ${nextTarget.id}`
      : `Draw ${currentNode.id} → ${nextTarget.id}`;
  } else if (currentNode && !nextTarget) {
    text = "Completed!";
  }

  ctx.fillText(text, 14, 12);
  ctx.restore();
}

function drawLoseBanner() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(40, canvas.height / 2 - 42, canvas.width - 80, 84);

  ctx.fillStyle = "#ffb3b3";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("You lost the game", canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function drawWinBanner() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(40, canvas.height / 2 - 42, canvas.width - 80, 84);

  ctx.fillStyle = "#fff59d";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Outstanding!", canvas.width / 2, canvas.height / 2 - 8);

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Arial";
  ctx.fillText("You completed the number path", canvas.width / 2, canvas.height / 2 + 22);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackgroundGrid();

  for (const path of finishedPaths) {
    drawPrettyPath(path.points, path.color, 7, 1);
  }

  if (partialConnection) {
    drawPrettyPath(partialConnection.points, partialConnection.color, 7, 1);
  }

  if (isDrawing && activeStroke.length > 1) {
    drawPrettyPath(activeStroke, activeColor, 7, 0.85);
  }

  if (gameOver && losingPathPreview && losingPathPreview.length > 1) {
    drawPrettyPath(losingPathPreview, losingPathColor || "#ff5a5f", 7, 1);
  }

  drawNodes();
  drawAnchorMarker();
  drawPrompt();

  if (gameOver) {
    drawLoseBanner();
  } else if (!nextTarget && solutionOrder.length > 0) {
    drawWinBanner();
  }
}

function pointerDownHandler(event) {
  if (event.cancelable) event.preventDefault();
  if (!currentNode || !nextTarget || gameOver) return;

  const point = getCanvasPoint(event);
  beginStroke(point);
}

function pointerMoveHandler(event) {
  if (!isDrawing || gameOver) return;
  if (event.cancelable) event.preventDefault();

  const point = getCanvasPoint(event);
  updateStroke(point);
}

function pointerUpHandler(event) {
  if (!isDrawing || gameOver) return;
  if (event.cancelable) event.preventDefault();

  const point = getCanvasPoint(event);
  endStroke(point);
}

canvas.addEventListener("mousedown", pointerDownHandler);
canvas.addEventListener("mousemove", pointerMoveHandler);
window.addEventListener("mouseup", pointerUpHandler);

canvas.addEventListener("touchstart", pointerDownHandler, { passive: false });
canvas.addEventListener("touchmove", pointerMoveHandler, { passive: false });
canvas.addEventListener("touchend", pointerUpHandler, { passive: false });

restartBtn.addEventListener("click", restartSameBoard);
undoBtn.addEventListener("click", undoMove);
hintBtn.addEventListener("click", showHint);
newBoardBtn.addEventListener("click", generateBoard);
modeSelect.addEventListener("change", generateBoard);

updateTimerUI();
generateBoard();