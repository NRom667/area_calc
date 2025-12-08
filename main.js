const fileInput = document.getElementById('fileInput');
const loadImageBtn = document.getElementById('loadImageBtn');
const startRegionBtn = document.getElementById('startRegionBtn');
const confirmBtn = document.getElementById('confirmBtn');
const saveSvgBtn = document.getElementById('saveSvgBtn');
const calcAreaBtn = document.getElementById('calcAreaBtn');
const scaleBtn = document.getElementById('scaleBtn');
const loadSvgBtn = document.getElementById('loadSvgBtn');
const deleteRegionBtn = document.getElementById('deleteRegionBtn');
const undoPointBtn = document.getElementById('undoPointBtn');
const svgInput = document.getElementById('svgInput');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const stage = document.getElementById('stage');
const placeholder = document.getElementById('placeholder');
const hint = document.getElementById('hint');
const areaResult = document.getElementById('areaResult');
const colorSwatch = document.getElementById('colorSwatch');
const colorSelect = document.getElementById('colorSelect');
const colorModeBtn = document.getElementById('colorModeBtn');
const renameColorBtn = document.getElementById('renameColorBtn');
const usageBtn = document.getElementById('usageBtn');
const usageModal = document.getElementById('usageModal');
const closeUsageBtn = document.getElementById('closeUsageBtn');

const state = {
  imageDataUrl: null,
  polygons: [],
  currentPoints: [],
  drawing: false,
  colorMode: false,
  scaleMode: false,
  deleteMode: false,
  scalePoints: [],
  metersPerPixel: null,
  loadingSvg: false,
  size: { width: 0, height: 0 },
  selectedColor: colorSelect.value,
  selectedColorName: colorSelect.selectedOptions[0]?.textContent.trim() || '',
};
const draftElements = [];

const svgNS = 'http://www.w3.org/2000/svg';

function setHint(text) {
  hint.textContent = text;
}

function updateUndoUi() {
  if (!undoPointBtn) return;
  undoPointBtn.style.display = state.drawing ? 'inline-block' : 'none';
  undoPointBtn.disabled = !state.drawing || state.currentPoints.length === 0;
}

function openUsageModal() {
  if (!usageModal) return;
  usageModal.classList.add('is-open');
  usageModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  closeUsageBtn?.focus();
}

function closeUsageModal() {
  if (!usageModal) return;
  usageModal.classList.remove('is-open');
  usageModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  usageBtn?.focus();
}

function handleUsageBackdropClick(event) {
  if (event.target === usageModal) {
    closeUsageModal();
  }
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
  state.deleteMode = false;
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
  updateUndoUi();
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
  exitDeleteMode();
  exitColorMode();
  resetDraft();
  state.drawing = true;
  confirmBtn.disabled = true;
  updateUndoUi();
  setHint('頂点をクリックで追加。3点以上で確定できます');
}

function renameSelectedColor() {
  if (!colorSelect) return;
  const option = colorSelect.selectedOptions[0];
  if (!option) return;
  const currentName = option.textContent.trim();
  const input = window.prompt('付けたい色の名前を入力してください', currentName);
  if (input === null) {
    setHint('色名称の変更をキャンセルしました');
    return;
  }
  const name = input.trim();
  if (!name) {
    setHint('名称を入力してください');
    return;
  }
  option.textContent = name;
  state.selectedColorName = name;
  updateColorSwatch();
  // 既存の同色ポリゴンの名称を最新にそろえる
  updatePolygonNamesForColor(state.selectedColor, name);
  calculateAreas();
  setHint(`色名を「${name}」に変更しました`);
}

function addPoint(x, y) {
  if (state.scaleMode) return;
  state.currentPoints.push({ x, y });
  redrawDraft();
  confirmBtn.disabled = state.currentPoints.length < 3;
  updateUndoUi();
}

function redrawDraft() {
  // Remove existing draft visuals
  draftElements.splice(0).forEach((el) => el.remove());
  // Recreate draft from currentPoints
  state.currentPoints.forEach((pt, idx) => {
    drawPoint(pt.x, pt.y);
    if (idx > 0) {
      drawLine(state.currentPoints[idx - 1], pt);
    }
  });
}

function drawPoint(x, y, isDraft = true) {
  const c = document.createElementNS(svgNS, 'circle');
  c.setAttribute('class', 'point');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', 5);
  overlay.appendChild(c);
  if (isDraft) draftElements.push(c);
}

function drawLine(a, b, isDraft = true) {
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('class', 'edge');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  overlay.appendChild(line);
  if (isDraft) draftElements.push(line);
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
    name: state.selectedColorName || state.selectedColor,
    element: polygon,
  };
  setPolygonColor(polygonEntry, polygonEntry.color);
  polygon.setAttribute('data-name', polygonEntry.name);
  polygon.setAttribute('data-color', polygonEntry.color);
  overlay.appendChild(polygon);

  draftElements.splice(0);
  state.polygons.push(polygonEntry);
  state.currentPoints = [];
  state.drawing = false;
  confirmBtn.disabled = true;
  updateUndoUi();
  saveSvgBtn.disabled = state.polygons.length === 0;
  setHint('完成！「領域作成」で次の領域を描くか、「svg保存」でまとめて保存できます');
}

function saveAsSvg() {
  if (state.polygons.length === 0) return;
  const { width, height } = state.size;
  const metersPerPixelAttr = state.metersPerPixel ? ` data-meters-per-pixel="${state.metersPerPixel}"` : '';
  const imageTag = state.imageDataUrl
    ? `<image href="${state.imageDataUrl}" width="${width}" height="${height}" />`
    : '';
  const polygonsMarkup = state.polygons
    .map((poly) => {
      const pts = poly.points.map((p) => `${p.x},${p.y}`).join(' ');
      const nameAttr = poly.name ? ` data-name="${escapeHtml(poly.name)}"` : '';
      return `<polygon points="${pts}" fill="${poly.color}" fill-opacity="0.32" stroke="${poly.color}" stroke-width="2"${nameAttr} data-color="${poly.color}" />`;
    })
    .join('');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${metersPerPixelAttr}>` +
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
  if (state.deleteMode) {
    deletePolygonAt(x, y);
    return;
  }
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
  if (state.loadingSvg) {
    state.loadingSvg = false;
    setHint('SVGを読み込みました。続きから編集できます');
  } else {
    exitColorMode();
    exitScaleMode();
    clearOverlay();
    setHint('領域作成を押して多角形を描き始めてください');
  }
}

function snapToFirstPolygon(x, y) {
  if (state.polygons.length === 0) return { x, y };
  const threshold = 20; // px
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
  target.name = state.selectedColorName || state.selectedColor;
  target.element.setAttribute('data-name', target.name);
  target.element.setAttribute('data-color', target.color);
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

function handleSvgSelection(file) {
  const reader = new FileReader();
  reader.onload = () => {
    parseAndLoadSvg(reader.result);
  };
  reader.readAsText(file, 'utf-8');
}

loadImageBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});
loadSvgBtn.addEventListener('click', () => {
  svgInput.value = '';
  svgInput.click();
});
usageBtn?.addEventListener('click', openUsageModal);
closeUsageBtn?.addEventListener('click', closeUsageModal);
usageModal?.addEventListener('click', handleUsageBackdropClick);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && usageModal?.classList.contains('is-open')) {
    closeUsageModal();
  }
});

undoPointBtn?.addEventListener('click', undoLastPoint);
fileInput.addEventListener('change', (e) => {
  const [file] = e.target.files;
  if (!file) return;
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
    setHint('png または jpg の画像を選択してください');
    return;
  }
  handleFileSelection(file);
});
svgInput.addEventListener('change', (e) => {
  const [file] = e.target.files;
  if (!file) return;
  if (file.type && !/^image\/svg\+xml$/i.test(file.type) && !file.name.toLowerCase().endsWith('.svg')) {
    setHint('svgファイルを選択してください');
    return;
  }
  handleSvgSelection(file);
});

startRegionBtn.addEventListener('click', startDrawing);
overlay.addEventListener('click', handleOverlayClick);
confirmBtn.addEventListener('click', closePolygon);
saveSvgBtn.addEventListener('click', saveAsSvg);
photo.addEventListener('load', handleImageLoad);
colorSelect.addEventListener('change', (e) => {
  state.selectedColor = e.target.value;
  state.selectedColorName = e.target.selectedOptions[0]?.textContent.trim() || '';
  updateColorSwatch();
});
colorModeBtn.addEventListener('click', toggleColorMode);
calcAreaBtn.addEventListener('click', calculateAreas);
scaleBtn.addEventListener('click', startScaleMode);
renameColorBtn.addEventListener('click', renameSelectedColor);
deleteRegionBtn.addEventListener('click', startDeleteMode);

updateColorModeUi();
setHint('1. 画像読込 → 2. 領域作成 → クリックで頂点追加 → 確定 → 必要なら再度領域作成 → SVG保存 / 縮尺設定で m² 表示');
renderAreaSummary(new Map());
updateColorSwatch();
updateUndoUi();

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
    const current = totals.get(poly.color) || { area: 0, count: 0, name: poly.name || poly.color };
    current.area += area;
    current.count += 1;
    if (!current.name) current.name = poly.name || poly.color;
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
      ? `${areaValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} m2`
      : `${Math.round(areaValue).toLocaleString()} px2`;
    rows.push(
      `<div class="row">` +
      `<span class="swatch" style="background:${color}"></span>` +
      `<span>${info.name || color}</span>` +
      `<strong>${display}</strong>` +
      `<span>(${info.count}領域)</span>` +
      `</div>`,
    );
  });
  areaResult.innerHTML = rows.join('');
}

function updateColorSwatch() {
  if (!colorSwatch) return;
  colorSwatch.style.background = state.selectedColor;
}

function undoLastPoint() {
  if (!state.drawing || state.currentPoints.length === 0) {
    setHint('戻せる頂点がありません');
    return;
  }
  state.currentPoints.pop();
  redrawDraft();
  confirmBtn.disabled = state.currentPoints.length < 3;
  updateUndoUi();
  setHint(state.currentPoints.length === 0 ? '頂点をクリックして追加してください' : '1つ前の頂点に戻しました');
}

function parseAndLoadSvg(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    setHint('SVGを解析できませんでした');
    return;
  }

  let width = Number(svgEl.getAttribute('width')) || Number(svgEl.viewBox?.baseVal?.width) || 0;
  let height = Number(svgEl.getAttribute('height')) || Number(svgEl.viewBox?.baseVal?.height) || 0;
  if (width === 0 || height === 0) {
    width = state.size.width || 800;
    height = state.size.height || 600;
  }
  const mppAttr = parseFloat(svgEl.getAttribute('data-meters-per-pixel'));
  const imgEl = svgEl.querySelector('image');
  const imgHref = imgEl?.getAttribute('href') || imgEl?.getAttribute('xlink:href') || null;

  // 初期化
  clearOverlay();
  exitColorMode();
  exitScaleMode();

  if (Number.isFinite(mppAttr) && mppAttr > 0) {
    state.metersPerPixel = mppAttr;
  }

  if (width > 0 && height > 0) {
    syncStageSize(width, height);
  }
  if (imgHref) {
    state.loadingSvg = true;
    state.imageDataUrl = imgHref;
    photo.src = imgHref;
    photo.style.display = 'block';
    overlay.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    state.imageDataUrl = null;
    photo.style.display = 'none';
    overlay.style.display = 'block';
    placeholder.style.display = 'none';
  }

  const polygons = Array.from(svgEl.querySelectorAll('polygon'));
  const colorNameMap = new Map();
  polygons.forEach((node) => {
    const pointsAttr = node.getAttribute('points') || '';
    const points = parsePoints(pointsAttr);
    if (points.length < 3) return;
    const color = node.getAttribute('data-color') || node.getAttribute('fill') || '#ff7043';
    const name = node.getAttribute('data-name') || color;
    const polygon = document.createElementNS(svgNS, 'polygon');
    polygon.setAttribute('class', 'polygon');
    polygon.setAttribute('points', pointsAttr.trim());
    polygon.setAttribute('data-name', name);
    polygon.setAttribute('data-color', color);
    const entry = { points, color, name, element: polygon };
    setPolygonColor(entry, color);
    overlay.appendChild(polygon);
    entry.points.forEach((pt) => drawPoint(pt.x, pt.y, false));
    state.polygons.push(entry);
    const key = normalizeColor(color);
    if (key && !colorNameMap.has(key)) {
      colorNameMap.set(key, name);
    }
  });

  saveSvgBtn.disabled = state.polygons.length === 0;
  applyLoadedColorNames(colorNameMap);
  renderAreaSummary(new Map()); // compute with calculateAreas to include units
  calculateAreas();
  setHint('SVGを読み込みました。領域を編集できます');
}

function parsePoints(pointsStr) {
  return pointsStr
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter((arr) => arr.length === 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1]))
    .map(([x, y]) => ({ x, y }));
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeColor(color) {
  return (color || '').trim().toLowerCase();
}

function applyLoadedColorNames(colorNameMap) {
  if (!colorSelect || !colorNameMap || colorNameMap.size === 0) return;
  const seen = new Set();
  Array.from(colorSelect.options).forEach((opt) => {
    const key = normalizeColor(opt.value);
    if (colorNameMap.has(key)) {
      opt.textContent = colorNameMap.get(key);
      seen.add(key);
    }
  });
  // もしSVGに存在する色がセレクトに無い場合、追記する
  colorNameMap.forEach((name, key) => {
    if (seen.has(key)) return;
    const option = document.createElement('option');
    option.value = key;
    option.textContent = name;
    colorSelect.appendChild(option);
  });
  state.selectedColor = colorSelect.value;
  state.selectedColorName = colorSelect.selectedOptions[0]?.textContent.trim() || state.selectedColor;
  updateColorSwatch();
}

function updatePolygonNamesForColor(color, name) {
  const key = normalizeColor(color);
  state.polygons.forEach((poly) => {
    if (normalizeColor(poly.color) === key) {
      poly.name = name;
      poly.element.setAttribute('data-name', name);
    }
  });
}

function startScaleMode() {
  if (!state.imageDataUrl) {
    setHint('先に画像を読み込んでください');
    return;
  }
  exitColorMode();
  exitDeleteMode();
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

function startDeleteMode() {
  if (state.polygons.length === 0) {
    setHint('削除できる領域がありません');
    return;
  }
  exitColorMode();
  exitScaleMode();
  resetDraft();
  state.deleteMode = true;
  setHint('削除したい領域をクリックしてください');
}

function exitDeleteMode() {
  if (!state.deleteMode) return;
  state.deleteMode = false;
}

function deletePolygonAt(x, y) {
  const target = findPolygonAt(x, y);
  if (!target) {
    setHint('領域をクリックしてください');
    return;
  }
  const idx = state.polygons.indexOf(target);
  if (idx !== -1) {
    state.polygons.splice(idx, 1);
    renderPolygons();
    saveSvgBtn.disabled = state.polygons.length === 0;
    calculateAreas();
    setHint('領域を削除しました');
  }
  exitDeleteMode();
}

function renderPolygons() {
  overlay.innerHTML = '';
  state.polygons.forEach((entry) => {
    const polygon = document.createElementNS(svgNS, 'polygon');
    polygon.setAttribute('class', 'polygon');
    const pointString = entry.points.map((p) => `${p.x},${p.y}`).join(' ');
    polygon.setAttribute('points', pointString);
    polygon.setAttribute('data-name', entry.name);
    polygon.setAttribute('data-color', entry.color);
    entry.element = polygon;
    setPolygonColor(entry, entry.color);
    overlay.appendChild(polygon);
    entry.points.forEach((pt) => drawPoint(pt.x, pt.y, false));
  });
}


