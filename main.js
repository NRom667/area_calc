const fileInput = document.getElementById('fileInput');
const loadImageBtn = document.getElementById('loadImageBtn');
const startRegionBtn = document.getElementById('startRegionBtn');
const confirmBtn = document.getElementById('confirmBtn');
const saveSvgBtn = document.getElementById('saveSvgBtn');
const photo = document.getElementById('photo');
const overlay = document.getElementById('overlay');
const stage = document.getElementById('stage');
const placeholder = document.getElementById('placeholder');
const hint = document.getElementById('hint');

const state = {
  imageDataUrl: null,
  points: [],
  drawing: false,
  closed: false,
  size: { width: 0, height: 0 },
};

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
  state.points = [];
  state.closed = false;
  state.drawing = false;
  confirmBtn.disabled = true;
  saveSvgBtn.disabled = true;
}

function startDrawing() {
  if (!state.imageDataUrl) {
    setHint('先に画像を読み込んでください');
    return;
  }
  clearOverlay();
  state.drawing = true;
  setHint('頂点をクリックで追加。3点以上で確定できます');
}

function addPoint(x, y) {
  state.points.push({ x, y });
  drawPoint(x, y);
  const len = state.points.length;
  if (len > 1) {
    drawLine(state.points[len - 2], state.points[len - 1]);
  }
  confirmBtn.disabled = state.points.length < 3;
}

function drawPoint(x, y) {
  const c = document.createElementNS(svgNS, 'circle');
  c.setAttribute('class', 'point');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', 5);
  overlay.appendChild(c);
}

function drawLine(a, b) {
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('class', 'edge');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  overlay.appendChild(line);
}

function closePolygon() {
  if (!state.drawing || state.points.length < 3) return;
  const first = state.points[0];
  const last = state.points[state.points.length - 1];
  drawLine(last, first);

  const polygon = document.createElementNS(svgNS, 'polygon');
  polygon.setAttribute('class', 'polygon');
  const pointString = state.points.map((p) => `${p.x},${p.y}`).join(' ');
  polygon.setAttribute('points', pointString);
  overlay.insertBefore(polygon, overlay.firstChild);

  state.drawing = false;
  state.closed = true;
  confirmBtn.disabled = true;
  saveSvgBtn.disabled = false;
  setHint('完成！「svg保存」でダウンロードできます');
}

function saveAsSvg() {
  if (!state.closed || state.points.length < 3) return;
  const { width, height } = state.size;
  const points = state.points.map((p) => `${p.x},${p.y}`).join(' ');
  const imageTag = state.imageDataUrl
    ? `<image href="${state.imageDataUrl}" width="${width}" height="${height}" />`
    : '';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `${imageTag}` +
    `<polygon points="${points}" fill="#ffb74d" fill-opacity="0.28" stroke="#e65100" stroke-width="2" />` +
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
  if (!state.drawing) return;
  const rect = overlay.getBoundingClientRect();
  const x = Number((event.clientX - rect.left).toFixed(1));
  const y = Number((event.clientY - rect.top).toFixed(1));
  addPoint(x, y);
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
  clearOverlay();
  setHint('領域作成を押して多角形を描き始めてください');
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

setHint('1. 画像を読み込む → 2. 領域作成 → クリックで頂点追加 → 確定 → SVG保存');
