

document.addEventListener('DOMContentLoaded', () => {
  
  let model = null;
  let maxPredictions = 0;
  let currentPredictions = [];
  let isWebcamRunning = false;
  let webcamStream = null;
  let animFrameId = null;
  let lastPredictionTime = 0;
  const PREDICTION_INTERVAL_MS = 100; 

  let confidenceThreshold = 70; 
  let activeTab = 'webcam'; 

  const modelStatusEl = document.getElementById('model-status');
  const statusDot = modelStatusEl.querySelector('.status-dot');
  const statusText = modelStatusEl.querySelector('.status-text');

  const tabWebcamBtn = document.getElementById('tab-webcam-btn');
  const tabUploadBtn = document.getElementById('tab-upload-btn');
  const webcamTab = document.getElementById('webcam-tab');
  const uploadTab = document.getElementById('upload-tab');

  const webcamVideo = document.getElementById('webcam');
  const webcamPlaceholder = document.getElementById('webcam-placeholder');
  const liveBadge = document.getElementById('live-badge');
  const startWebcamBtn = document.getElementById('start-webcam-btn');
  const stopWebcamBtn = document.getElementById('stop-webcam-btn');
  const saveWebcamBtn = document.getElementById('save-webcam-btn');

  const dropzone = document.getElementById('dropzone');
  const imageInput = document.getElementById('image-input');
  const dropzonePrompt = document.getElementById('dropzone-prompt');
  const uploadPreviewWrapper = document.getElementById('upload-preview-wrapper');
  const imagePreview = document.getElementById('image-preview');
  const saveUploadBtn = document.getElementById('save-upload-btn');

  const confidenceSlider = document.getElementById('confidence-slider');
  const confidenceDisplay = document.getElementById('confidence-display');

  const topMatchCard = document.getElementById('top-match-card');
  const matchBadge = document.getElementById('match-badge');
  const topClassName = document.getElementById('top-class-name');
  const topClassScore = document.getElementById('top-class-score');
  const classBarsContainer = document.getElementById('class-bars');

  const historyCountBadge = document.getElementById('history-count');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyGrid = document.getElementById('history-grid');
  const emptyHistoryEl = document.getElementById('empty-history');

  const HISTORY_STORAGE_KEY = 'ia_vision_model_history_v1';

  async function initApp() {
    setupEventListeners();
    loadHistory();
    await loadModel();
  }

  async function loadModel() {
    updateStatus('loading', 'Cargando modelo...');

    const modelURL = './modelo/model.json';
    const metadataURL = './modelo/metadata.json';

    try {
      if (typeof tmImage === 'undefined') {
        throw new Error('La librería Teachable Machine no se cargó correctamente.');
      }

      model = await tmImage.load(modelURL, metadataURL);
      maxPredictions = model.getTotalClasses();

      updateStatus('ready', 'Modelo listo');
      setupClassBars();
    } catch (error) {
      console.error('Error al cargar el modelo:', error);
      let msg = 'Error al cargar modelo';
      if (window.location.protocol === 'file:') {
        msg = 'Servidor local requerido (HTTP/HTTPS)';
      }
      updateStatus('error', msg);
      topClassName.textContent = 'Error al cargar';
      topClassScore.textContent = '--';
      matchBadge.textContent = 'Sin modelo';
      matchBadge.className = 'match-badge badge-invalid';
    }
  }

  function updateStatus(state, text) {
    statusDot.className = `status-dot ${state}`;
    statusText.textContent = text;
  }

  function setupClassBars() {
    classBarsContainer.innerHTML = '';

    for (let i = 0; i < maxPredictions; i++) {
      const barItem = document.createElement('div');
      barItem.className = 'class-bar-item';
      barItem.dataset.index = i;

      barItem.innerHTML = `
        <div class="class-bar-header">
          <span class="class-label" id="class-label-${i}">--</span>
          <span class="class-percent" id="class-percent-${i}">0.0%</span>
        </div>
        <div class="class-bar-track">
          <div class="class-bar-fill" id="class-fill-${i}"></div>
        </div>
      `;
      classBarsContainer.appendChild(barItem);
    }
  }

  function setupEventListeners() {
    
    tabWebcamBtn.addEventListener('click', () => switchTab('webcam'));
    tabUploadBtn.addEventListener('click', () => switchTab('upload'));

    startWebcamBtn.addEventListener('click', startWebcam);
    stopWebcamBtn.addEventListener('click', stopWebcam);
    saveWebcamBtn.addEventListener('click', () => saveCurrentResult('Webcam'));

    imageInput.addEventListener('change', handleFileSelect);
    saveUploadBtn.addEventListener('click', () => saveCurrentResult('Imagen'));

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        processImageFile(files[0]);
      }
    });

    confidenceSlider.addEventListener('input', (e) => {
      confidenceThreshold = parseInt(e.target.value, 10);
      confidenceDisplay.textContent = `${confidenceThreshold}%`;
      if (currentPredictions.length > 0) {
        updateUIWithPredictions(currentPredictions);
      }
    });

    clearHistoryBtn.addEventListener('click', clearHistory);
  }

  function switchTab(tabName) {
    activeTab = tabName;

    if (tabName === 'webcam') {
      tabWebcamBtn.classList.add('active');
      tabUploadBtn.classList.remove('active');
      webcamTab.classList.add('active');
      uploadTab.classList.remove('active');
    } else {
      tabUploadBtn.classList.add('active');
      tabWebcamBtn.classList.remove('active');
      uploadTab.classList.add('active');
      webcamTab.classList.remove('active');

      if (isWebcamRunning) {
        stopWebcam();
      }
    }
  }

  async function startWebcam() {
    if (!model) {
      alert('Espera a que el modelo se cargue por completo.');
      return;
    }

    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      webcamVideo.srcObject = webcamStream;
      await webcamVideo.play();

      isWebcamRunning = true;
      webcamPlaceholder.classList.add('hidden');
      liveBadge.classList.remove('hidden');

      startWebcamBtn.disabled = true;
      stopWebcamBtn.disabled = false;
      saveWebcamBtn.disabled = false;

      predictWebcamLoop();
    } catch (err) {
      console.error('Acceso a webcam denegado o no disponible:', err);
      alert('No se pudo acceder a la webcam. Comprueba los permisos de tu navegador.');
    }
  }

  function stopWebcam() {
    isWebcamRunning = false;

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }

    webcamVideo.srcObject = null;
    webcamPlaceholder.classList.remove('hidden');
    liveBadge.classList.add('hidden');

    startWebcamBtn.disabled = false;
    stopWebcamBtn.disabled = true;
    saveWebcamBtn.disabled = true;
  }

  async function predictWebcamLoop(timestamp) {
    if (!isWebcamRunning) return;

    if (timestamp - lastPredictionTime >= PREDICTION_INTERVAL_MS) {
      lastPredictionTime = timestamp;
      if (webcamVideo.readyState === 4 && model) {
        try {
          const predictions = await model.predict(webcamVideo);
          currentPredictions = predictions;
          updateUIWithPredictions(predictions);
        } catch (e) {
          console.error('Error en prediccion webcam:', e);
        }
      }
    }

    animFrameId = requestAnimationFrame(predictWebcamLoop);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      processImageFile(file);
    }
  }

  function processImageFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      dropzonePrompt.classList.add('hidden');
      uploadPreviewWrapper.classList.remove('hidden');
      saveUploadBtn.disabled = false;

      imagePreview.onload = async () => {
        if (!model) {
          alert('Espera a que el modelo se cargue por completo.');
          return;
        }

        try {
          const predictions = await model.predict(imagePreview);
          currentPredictions = predictions;
          updateUIWithPredictions(predictions);
        } catch (err) {
          console.error('Error al predecir imagen:', err);
        }
      };
    };
    reader.readAsDataURL(file);
  }

  function updateUIWithPredictions(predictions) {
    if (!predictions || predictions.length === 0) return;

    let topPred = predictions[0];
    for (let i = 1; i < predictions.length; i++) {
      if (predictions[i].probability > topPred.probability) {
        topPred = predictions[i];
      }
    }

    const topPercentage = (topPred.probability * 100);
    const meetsThreshold = topPercentage >= confidenceThreshold;

    const effectiveClassName = meetsThreshold ? topPred.className : 'Nada';

    topClassName.textContent = effectiveClassName;
    topClassScore.textContent = `${topPercentage.toFixed(1)}%`;

    if (meetsThreshold) {
      matchBadge.textContent = `VÁLIDO (≥ ${confidenceThreshold}%)`;
      matchBadge.className = 'match-badge badge-valid';
    } else {
      matchBadge.textContent = `BAJO UMBRAL (< ${confidenceThreshold}%) → Nada`;
      matchBadge.className = 'match-badge badge-invalid';
    }

    predictions.forEach((pred, idx) => {
      const labelEl = document.getElementById(`class-label-${idx}`);
      const percentEl = document.getElementById(`class-percent-${idx}`);
      const fillEl = document.getElementById(`class-fill-${idx}`);

      if (labelEl && percentEl && fillEl) {
        const pct = (pred.probability * 100);
        labelEl.textContent = pred.className;
        percentEl.textContent = `${pct.toFixed(1)}%`;
        fillEl.style.width = `${pct}%`;

        if (pct >= confidenceThreshold) {
          fillEl.classList.add('above-threshold');
        } else {
          fillEl.classList.remove('above-threshold');
        }
      }
    });
  }

  function getHistory() {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error al leer localStorage:', e);
      return [];
    }
  }

  function saveHistory(historyList) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyList));
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }
  }

  function saveCurrentResult(sourceName) {
    if (currentPredictions.length === 0) {
      alert('No hay ninguna predicción disponible para guardar.');
      return;
    }

    let topPred = currentPredictions[0];
    for (let i = 1; i < currentPredictions.length; i++) {
      if (currentPredictions[i].probability > topPred.probability) {
        topPred = currentPredictions[i];
      }
    }

    const topPercentage = (topPred.probability * 100);
    const meetsThreshold = topPercentage >= confidenceThreshold;
    const effectiveClassName = meetsThreshold ? topPred.className : 'Nada';

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + new Date().toLocaleDateString(),
      source: sourceName,
      className: effectiveClassName,
      rawClassName: topPred.className,
      probability: topPercentage.toFixed(1),
      threshold: confidenceThreshold,
      meetsThreshold: meetsThreshold
    };

    const history = getHistory();
    history.unshift(entry); 
    saveHistory(history);
    renderHistory();

    const targetBtn = sourceName === 'Webcam' ? saveWebcamBtn : saveUploadBtn;
    const origText = targetBtn.innerHTML;
    targetBtn.innerHTML = `¡Guardado!`;
    setTimeout(() => {
      targetBtn.innerHTML = origText;
    }, 1200);
  }

  function deleteHistoryItem(id) {
    let history = getHistory();
    history = history.filter(item => item.id !== id);
    saveHistory(history);
    renderHistory();
  }

  function clearHistory() {
    if (confirm('¿Seguro que deseas eliminar todo el historial de resultados?')) {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      renderHistory();
    }
  }

  function loadHistory() {
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    historyCountBadge.textContent = history.length;

    if (history.length === 0) {
      historyGrid.innerHTML = '';
      emptyHistoryEl.classList.remove('hidden');
      clearHistoryBtn.disabled = true;
      return;
    }

    emptyHistoryEl.classList.add('hidden');
    clearHistoryBtn.disabled = false;
    historyGrid.innerHTML = '';

    history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-item-card';

      const meetsClass = item.meetsThreshold ? 'meets' : 'fails';
      const meetsText = item.meetsThreshold ? 'Cumple' : 'No cumple';
      const sourceIcon = item.source === 'Webcam' 
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>` 
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

      card.innerHTML = `
        <div class="history-item-top">
          <span class="history-source-badge">${sourceIcon} ${item.source}</span>
          <button class="history-delete-btn" data-id="${item.id}" title="Eliminar entrada">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="history-main-result">
          <span class="history-class">${item.className}</span>
          <span class="history-score ${meetsClass}">${item.probability}%</span>
        </div>
        <div class="history-item-footer">
          <span>${item.timestamp}</span>
          <span>Umbral: ${item.threshold}% (${meetsText})</span>
        </div>
      `;

      card.querySelector('.history-delete-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        deleteHistoryItem(id);
      });

      historyGrid.appendChild(card);
    });
  }

  initApp();
});