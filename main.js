const fileInput = document.getElementById('fileInput');
const loadImageBtn = document.getElementById('loadImageBtn');
const startRegionBtn = document.getElementById('startRegionBtn');
const confirmBtn = document.getElementById('confirmBtn');
const saveSvgBtn = document.getElementById('saveSvgBtn');
const calcAreaBtn = document.getElementById('calcAreaBtn');
const scaleBtn = document.getElementById('scaleBtn');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const stage = document.getElementById('stage');
const placeholder = document.getElementById('placeholder');
const hint = document.getElementById('hint');
const areaResult = document.getElementById('areaResult');
const colorSelect = document.getElementById('colorSelect');
const colorModeBtn = document.getElementById('colorModeBtn');

const state = {
  imageDataUrl: null,
  polygons: [],
  currentPoints: [],
  drawing: false,
  colorMode: false,
  scaleMode: false,
  scalePoints: [],
  metersPerPixel: null,
  size: { width: 0, height: 0 },
  selectedColor: colorSelect.value,
};
const draftElements = [];

const svgNS = 'http://www.w3.org/2000/svg';

function setHint(text) {
  hint.textContent = text;
}

function syncStageSize(width, height) {
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  overlay.setAttribute('width', width);
  overlay.setAttribute('height', height);
  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;
  photo.style.width = `${width}px`;
  photo.style.height = `${height}px`;
  state.size = { width, height };
}

function clearOverlay() {
  overlay.innerHTML = '';
  state.polygons = [];
  resetDraft();
  saveSvgBtn.disabled = true;
  renderAreaSummary(new Map());
  state.metersPerPixel = null;
  state.scalePoints = [];
  scaleBtn.textContent = '縮尺設定';
}

function resetDraft() {
  draftElements.splice(0).forEach((el) => el.remove());
  state.currentPoints = [];
  state.drawing = false;
  confirmBtn.disabled = true;
}

function setPolygonColor(polygonEntry, color) {
  polygonEntry.color = color;
  polygonEntry.element.setAttribute('fill', color);
  polygonEntry.element.setAttribute('stroke', color);
  polygonEntry.element.setAttribute('fill-opacity', '0.32');
  polygonEntry.element.setAttribute('stroke-width', '2');
}

function updateColorModeUi() {
  colorModeBtn.classList.toggle('is-active', state.colorMode);
  colorModeBtn.textContent = state.colorMode ? '色変更中' : '色変更';
  colorModeBtn.setAttribute('aria-pressed', state.colorMode ? 'true' : 'false');
}

function exitColorMode() {
  if (!state.colorMode) return;
  state.colorMode = false;
  updateColorModeUi();
}

function startDrawing() {
  if (!state.imageDataUrl) {
    setHint('先に画像を読み込んでください');
    return;
  }
  if (state.scaleMode) {
    setHint('まず縮尺設定を完了してください（2点クリック後に数値入力）');
    return;
  }
  // すでに確定した領域は残し、編集中のドラフトだけ捨てる
  exitColorMode();
  resetDraft();
  state.drawing = true;
  confirmBtn.disabled = true;
  setHint('頂点をクリックで追加。3点以上で確定できます');
}

function addPoint(x, y) {
  if (state.scaleMode) return;
  state.currentPoints.push({ x, y });
  drawPoint(x, y);
  const len = state.currentPoints.length;
  if (len > 1) {
    drawLine(state.currentPoints[len - 2], state.currentPoints[len - 1]);
  }
  confirmBtn.disabled = state.currentPoints.length < 3;
}

function drawPoint(x, y) {
  const c = document.createElementNS(svgNS, 'circle');
  c.setAttribute('class', 'point');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', 5);
  overlay.appendChild(c);
  draftElements.push(c);
}

function drawLine(a, b) {
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('class', 'edge');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  overlay.appendChild(line);
  draftElements.push(line);
}

function closePolygon() {
  if (!state.drawing || state.currentPoints.length < 3) return;
  const first = state.currentPoints[0];
  const last = state.currentPoints[state.currentPoints.length - 1];
  drawLine(last, first);

  const polygon = document.createElementNS(svgNS, 'polygon');
  polygon.setAttribute('class', 'polygon');
  const pointString = state.currentPoints.map((p) => `${p.x},${p.y}`).join(' ');
  polygon.setAttribute('points', pointString);
  const polygonEntry = {
    points: [...state.currentPoints],
    color: state.selectedColor,
    element: polygon,
  };
  setPolygonColor(polygonEntry, polygonEntry.color);
  overlay.appendChild(polygon);

  draftElements.splice(0);
  state.polygons.push(polygonEntry);
  state.currentPoints = [];
  state.drawing = false;
  confirmBtn.disabled = true;
  saveSvgBtn.disabled = state.polygons.length === 0;
  setHint('完成！「領域作成」で次の領域を描くか、「svg保存」でまとめて保存できます');
}

function saveAsSvg() {
  if (state.polygons.length === 0) return;
  const { width, height } = state.size;
  const imageTag = state.imageDataUrl
    ? `<image href="${state.imageDataUrl}" width="${width}" height="${height}" />`
    : '';
  const polygonsMarkup = state.polygons
    .map((poly) => {
      const pts = poly.points.map((p) => `${p.x},${p.y}`).join(' ');
      return `<polygon points="${pts}" fill="${poly.color}" fill-opacity="0.32" stroke="${poly.color}" stroke-width="2" />`;
    })
    .join('');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `${imageTag}` +
    `${polygonsMarkup}` +
    `</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'polygon.svg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleOverlayClick(event) {
  const rect = overlay.getBoundingClientRect();
  const x = Number((event.clientX - rect.left).toFixed(1));
  const y = Number((event.clientY - rect.top).toFixed(1));
  if (state.scaleMode) {
    handleScaleClick(x, y);
    return;
  }
  if (state.colorMode) {
    applyColorToPolygon(x, y);
    return;
  }
  if (!state.drawing) return;
  const snapped = snapToFirstPolygon(x, y);
  addPoint(snapped.x, snapped.y);
}

function handleImageLoad() {
  const maxWidth = Math.min(window.innerWidth - 40, 1000);
  const displayWidth = Math.min(photo.naturalWidth, maxWidth);
  const scale = displayWidth / photo.naturalWidth;
  const displayHeight = Math.round(photo.naturalHeight * scale);

  syncStageSize(displayWidth, displayHeight);
  photo.style.display = 'block';
  overlay.style.display = 'block';
  placeholder.style.display = 'none';
  exitColorMode();
  exitScaleMode();
  clearOverlay();
  setHint('領域作成を押して多角形を描き始めてください');
}

function snapToFirstPolygon(x, y) {
  if (state.polygons.length === 0) return { x, y };
  const threshold = 8; // px
  const firstPoly = state.polygons[0].points;
  let snapped = { x, y };
  let bestDist = threshold;
  firstPoly.forEach((p) => {
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist <= bestDist) {
      bestDist = dist;
      snapped = { x: p.x, y: p.y };
    }
  });
  return snapped;
}

function isPointInPolygon(point, polygonPoints) {
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].x;
    const yi = polygonPoints[i].y;
    const xj = polygonPoints[j].x;
    const yj = polygonPoints[j].y;

    const intersect = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findPolygonAt(x, y) {
  for (let i = state.polygons.length - 1; i >= 0; i -= 1) {
    if (isPointInPolygon({ x, y }, state.polygons[i].points)) {
      return state.polygons[i];
    }
  }
  return null;
}

function applyColorToPolygon(x, y) {
  if (state.polygons.length === 0) {
    setHint('先に領域を作成してください');
    return;
  }
  const target = findPolygonAt(x, y);
  if (!target) {
    setHint('領域をクリックして色を変更してください');
    return;
  }
  setPolygonColor(target, state.selectedColor);
  setHint('色を変更しました');
}

function toggleColorMode() {
  if (!state.imageDataUrl) {
    setHint('先に画像を読み込んでください');
    return;
  }
  if (state.scaleMode) exitScaleMode();
  state.colorMode = !state.colorMode;
  if (state.colorMode) {
    resetDraft();
    setHint('色を変更したい領域をクリックしてください');
  } else {
    setHint('領域作成で新しい多角形を描けます');
  }
  updateColorModeUi();
}

function handleFileSelection(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.imageDataUrl = reader.result;
    photo.src = reader.result;
  };
  reader.readAsDataURL(file);
}

loadImageBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const [file] = e.target.files;
  if (!file) return;
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
    setHint('png または jpg の画像を選択してください');
    return;
  }
  handleFileSelection(file);
});

startRegionBtn.addEventListener('click', startDrawing);
overlay.addEventListener('click', handleOverlayClick);
confirmBtn.addEventListener('click', closePolygon);
saveSvgBtn.addEventListener('click', saveAsSvg);
photo.addEventListener('load', handleImageLoad);
colorSelect.addEventListener('change', (e) => {
  state.selectedColor = e.target.value;
});
colorModeBtn.addEventListener('click', toggleColorMode);
calcAreaBtn.addEventListener('click', calculateAreas);
scaleBtn.addEventListener('click', startScaleMode);

updateColorModeUi();
setHint('1. 画像読込 → 2. 領域作成 → クリックで頂点追加 → 確定 → 必要なら再度領域作成 → SVG保存 / 縮尺設定で m² 表示');
renderAreaSummary(new Map());

function polygonArea(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

function calculateAreas() {
  if (state.polygons.length === 0) {
    setHint('領域がありません。先に領域を作成してください');
    renderAreaSummary(new Map());
    return;
  }
  const totals = new Map();
  state.polygons.forEach((poly) => {
    const area = polygonArea(poly.points);
    const current = totals.get(poly.color) || { area: 0, count: 0 };
    current.area += area;
    current.count += 1;
    totals.set(poly.color, current);
  });
  renderAreaSummary(totals);
  setHint('色ごとの面積を計算しました');
}

function renderAreaSummary(totals) {
  if (!areaResult) return;
  if (!totals || totals.size === 0) {
    areaResult.textContent = '面積を表示する領域がありません';
    return;
  }
  const rows = [];
  totals.forEach((info, color) => {
    const areaValue = state.metersPerPixel
      ? (info.area * state.metersPerPixel * state.metersPerPixel)
      : info.area;
    const display = state.metersPerPixel
      ? `${areaValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`
      : `${Math.round(areaValue).toLocaleString()} px²`;
    rows.push(
      `<div class="row">` +
      `<span class="swatch" style="background:${color}"></span>` +
      `<span>${color}</span>` +
      `<strong>${display}</strong>` +
      `<span>(${info.count}領域)</span>` +
      `</div>`,
    );
  });
  areaResult.innerHTML = rows.join('');
}

function startScaleMode() {
  if (!state.imageDataUrl) {
    setHint('先に画像を読み込んでください');
    return;
  }
  exitColorMode();
  resetDraft();
  state.scaleMode = true;
  state.scalePoints = [];
  scaleBtn.textContent = '縮尺設定中…';
  setHint('縮尺設定: 任意の2点をクリックしてください');
}

function exitScaleMode() {
  if (!state.scaleMode) return;
  state.scaleMode = false;
  state.scalePoints = [];
  scaleBtn.textContent = '縮尺設定';
}

function handleScaleClick(x, y) {
  state.scalePoints.push({ x, y });
  drawPoint(x, y);
  if (state.scalePoints.length === 1) {
    setHint('もう1点クリックしてください');
    return;
  }
  const [a, b] = state.scalePoints;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distPx = Math.hypot(dx, dy);
  if (distPx === 0) {
    setHint('距離が 0px です。別の2点を選んでください');
    state.scalePoints = [];
    draftElements.pop()?.remove();
    draftElements.pop()?.remove();
    return;
  }
  const input = window.prompt('縮尺を入力してください（単位：m）', '');
  if (!input) {
    setHint('縮尺設定をキャンセルしました');
    exitScaleMode();
    resetDraft();
    return;
  }
  const meters = Number(input);
  if (Number.isNaN(meters) || meters <= 0) {
    setHint('数値を正しく入力してください（例: 12.5）');
    state.scalePoints = [];
    resetDraft();
    exitScaleMode();
    return;
  }
  state.metersPerPixel = meters / distPx;
  exitScaleMode();
  resetDraft();
  setHint(`縮尺を設定しました: 1px = ${(state.metersPerPixel).toFixed(4)} m`);
  calculateAreas();
}
