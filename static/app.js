const fileInput = document.getElementById("image-upload");
const dropzone = document.getElementById("dropzone");
const resetButton = document.getElementById("reset-button");
const canvasStage = document.getElementById("canvas-stage");
const canvasEmpty = document.getElementById("canvas-empty");
const canvasScroll = document.getElementById("canvas-scroll");
const fileMeta = document.getElementById("file-meta");
const helperCopy = document.getElementById("helper-copy");
const zoomRange = document.getElementById("zoom-range");
const zoomValue = document.getElementById("zoom-value");
const imageCanvas = document.getElementById("image-canvas");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const trainingShareValue = document.getElementById("training-share-value");
const testingShareValue = document.getElementById("testing-share-value");
const trainingShareBar = document.getElementById("training-share-bar");
const testingShareBar = document.getElementById("testing-share-bar");
const settingsModelList = document.getElementById("settings-model-list");
const colorName = document.getElementById("color-name");
const sampleStatus = document.getElementById("sample-status");
const primarySwatch = document.getElementById("primary-swatch");
const datasetRowValue = document.getElementById("dataset-row-value");
const sampleHexValue = document.getElementById("sample-hex-value");
const datasetRedValue = document.getElementById("dataset-red-value");
const datasetGreenValue = document.getElementById("dataset-green-value");
const datasetBlueValue = document.getElementById("dataset-blue-value");
const datasetTotalValue = document.getElementById("dataset-total-value");

const displayContext = imageCanvas.getContext("2d");
const sampleCanvas = document.createElement("canvas");
const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
const defaultHelperCopy = "Upload an image to begin. After that, click on the image preview to sample a color.";
const NOTEBOOK_REFRESH_INTERVAL_MS = 3000;

const state = {
    activeUrl: null,
    image: null,
    naturalWidth: 0,
    naturalHeight: 0,
    baseWidth: 0,
    baseHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    renderScale: 1,
    renderOffsetX: 0,
    renderOffsetY: 0,
    selection: null,
    zoom: 1,
    requestToken: 0,
};

function rgbToHex(r, g, b) {
    return `#${[r, g, b]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
}

function formatBytes(bytes) {
    if (!bytes) {
        return "0 Bytes";
    }

    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatZoomLabel(value) {
    return Number.isInteger(value) ? `${value}x` : `${value.toFixed(2).replace(/0$/, "")}x`;
}

function formatPercent(value) {
    return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

function updatePrecisionLabels() {
    zoomValue.textContent = formatZoomLabel(state.zoom);
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}

function getPixelRatio() {
    return Math.max(window.devicePixelRatio || 1, 1);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getCanvasViewport() {
    const compactLayout = window.matchMedia("(max-width: 720px)").matches;
    const horizontalPadding = compactLayout ? 24 : 36;
    const verticalPadding = compactLayout ? 24 : 36;
    const maxHeight = compactLayout
        ? Math.min(window.innerHeight * 0.6, 520)
        : Math.min(window.innerHeight * 0.72, 620);

    return {
        width: Math.max(canvasStage.clientWidth - horizontalPadding, 1),
        height: Math.max(maxHeight - verticalPadding, 1),
    };
}

function resetInspector() {
    colorName.textContent = "Awaiting Selection";
    colorName.classList.add("is-placeholder");
    sampleStatus.textContent = "Click the image to view dataset details.";
    primarySwatch.style.background = "linear-gradient(135deg, rgba(124, 229, 197, 0.2), rgba(255, 188, 117, 0.16))";
    datasetRowValue.textContent = "--";
    sampleHexValue.textContent = "--";
    datasetRedValue.textContent = "--";
    datasetGreenValue.textContent = "--";
    datasetBlueValue.textContent = "--";
}

function updateDatasetRowCount(rowCount) {
    if (!Number.isFinite(rowCount)) {
        datasetTotalValue.textContent = "--";
        return;
    }

    datasetTotalValue.textContent = formatNumber(rowCount);
}

function resetNotebookSummary() {
    if (trainingShareValue) {
        trainingShareValue.textContent = "--";
    }
    if (testingShareValue) {
        testingShareValue.textContent = "--";
    }
    if (trainingShareBar) {
        trainingShareBar.style.width = "0%";
    }
    if (testingShareBar) {
        testingShareBar.style.width = "0%";
    }
    if (settingsModelList) {
        settingsModelList.innerHTML = '<p class="settings-panel-empty">Model accuracy details will appear here.</p>';
    }
}

function renderNotebookModels(models) {
    if (!settingsModelList) {
        return;
    }

    if (!Array.isArray(models) || models.length === 0) {
        settingsModelList.innerHTML = '<p class="settings-panel-empty">Model accuracy details are not available in the notebook yet.</p>';
        return;
    }

    settingsModelList.innerHTML = models
        .map(
            (model) => `
                <div class="settings-model-item">
                    <div class="settings-model-meta">
                        <span>${model.name}</span>
                        <strong>${model.accuracy_label}</strong>
                    </div>
                    <div class="settings-model-bar">
                        <span class="settings-model-fill" style="width: ${Math.max(0, Math.min(model.accuracy, 100))}%;"></span>
                    </div>
                </div>
            `
        )
        .join("");
}

function updateNotebookSummary(summary) {
    const split = summary?.split;

    if (split && Number.isFinite(split.training) && Number.isFinite(split.testing)) {
        if (trainingShareValue) {
            trainingShareValue.textContent = split.training_label ?? formatPercent(split.training);
        }
        if (testingShareValue) {
            testingShareValue.textContent = split.testing_label ?? formatPercent(split.testing);
        }
        if (trainingShareBar) {
            trainingShareBar.style.width = `${Math.max(0, Math.min(split.training, 100))}%`;
        }
        if (testingShareBar) {
            testingShareBar.style.width = `${Math.max(0, Math.min(split.testing, 100))}%`;
        }
    } else {
        resetNotebookSummary();
        return;
    }

    renderNotebookModels(summary?.models);
}

function closeSettingsPanel() {
    if (!settingsToggle || !settingsPanel) {
        return;
    }

    settingsPanel.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
}

function toggleSettingsPanel() {
    if (!settingsToggle || !settingsPanel) {
        return;
    }

    const isHidden = settingsPanel.hidden;
    settingsPanel.hidden = !isHidden;
    settingsToggle.setAttribute("aria-expanded", String(isHidden));
}

function resetWorkspace() {
    state.image = null;
    state.selection = null;
    state.naturalWidth = 0;
    state.naturalHeight = 0;
    state.baseWidth = 0;
    state.baseHeight = 0;
    state.displayWidth = 0;
    state.displayHeight = 0;
    state.renderScale = 1;
    state.renderOffsetX = 0;
    state.renderOffsetY = 0;
    state.zoom = 1;
    state.requestToken += 1;

    if (state.activeUrl) {
        URL.revokeObjectURL(state.activeUrl);
        state.activeUrl = null;
    }

    fileInput.value = "";
    fileMeta.textContent = "No image selected yet.";
    helperCopy.textContent = defaultHelperCopy;
    zoomRange.value = "1";
    canvasScroll.scrollTop = 0;
    canvasScroll.scrollLeft = 0;
    canvasScroll.classList.remove("is-zoomed");
    updatePrecisionLabels();

    imageCanvas.width = 0;
    imageCanvas.height = 0;
    imageCanvas.style.width = "0px";
    imageCanvas.style.height = "0px";
    displayContext.clearRect(0, 0, 0, 0);
    canvasStage.classList.remove("has-image");
    canvasStage.classList.add("is-empty");
    canvasEmpty.hidden = false;
    resetInspector();
}

function drawCanvas() {
    if (!state.image) {
        return;
    }

    displayContext.clearRect(0, 0, state.displayWidth, state.displayHeight);
    displayContext.drawImage(
        state.image,
        state.renderOffsetX,
        state.renderOffsetY,
        state.naturalWidth * state.renderScale,
        state.naturalHeight * state.renderScale
    );

    if (!state.selection) {
        return;
    }

    const markerX = state.renderOffsetX + state.selection.x * state.renderScale;
    const markerY = state.renderOffsetY + state.selection.y * state.renderScale;
    const markerWidth = 3;
    const markerHeight = 3;
    const markerLeft = markerX - markerWidth / 2;
    const markerTop = markerY - markerHeight / 2;
    const guideGapX = markerWidth / 2 + 4;
    const guideGapY = markerHeight / 2 + 4;
    const guideLength = 10;

    displayContext.save();
    displayContext.lineWidth = 1.2;
    displayContext.strokeStyle = "rgba(255, 255, 255, 0.95)";
    displayContext.fillStyle = "rgba(124, 229, 197, 0.08)";
    displayContext.fillRect(markerLeft, markerTop, markerWidth, markerHeight);
    displayContext.strokeRect(markerLeft, markerTop, markerWidth, markerHeight);
    displayContext.strokeStyle = "rgba(124, 229, 197, 0.95)";
    displayContext.beginPath();
    displayContext.moveTo(markerX - guideGapX - guideLength, markerY);
    displayContext.lineTo(markerX - guideGapX, markerY);
    displayContext.moveTo(markerX + guideGapX, markerY);
    displayContext.lineTo(markerX + guideGapX + guideLength, markerY);
    displayContext.moveTo(markerX, markerY - guideGapY - guideLength);
    displayContext.lineTo(markerX, markerY - guideGapY);
    displayContext.moveTo(markerX, markerY + guideGapY);
    displayContext.lineTo(markerX, markerY + guideGapY + guideLength);
    displayContext.stroke();
    displayContext.restore();
}

function setImageLayout(image) {
    const viewport = getCanvasViewport();

    state.naturalWidth = image.naturalWidth;
    state.naturalHeight = image.naturalHeight;
    state.baseWidth = Math.max(1, Math.round(viewport.width));
    state.baseHeight = Math.max(1, Math.round(viewport.height));
    updateCanvasScale();

    sampleCanvas.width = state.naturalWidth;
    sampleCanvas.height = state.naturalHeight;
    sampleContext.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sampleContext.drawImage(image, 0, 0, state.naturalWidth, state.naturalHeight);

}

function updateCanvasScale() {
    state.displayWidth = Math.max(1, Math.round(state.baseWidth * state.zoom));
    state.displayHeight = Math.max(1, Math.round(state.baseHeight * state.zoom));
    state.renderScale = Math.min(
        state.displayWidth / state.naturalWidth,
        state.displayHeight / state.naturalHeight
    );
    state.renderOffsetX = (state.displayWidth - state.naturalWidth * state.renderScale) / 2;
    state.renderOffsetY = (state.displayHeight - state.naturalHeight * state.renderScale) / 2;
    const pixelRatio = getPixelRatio();
    imageCanvas.width = Math.max(1, Math.round(state.displayWidth * pixelRatio));
    imageCanvas.height = Math.max(1, Math.round(state.displayHeight * pixelRatio));
    imageCanvas.style.width = `${state.displayWidth}px`;
    imageCanvas.style.height = `${state.displayHeight}px`;
    displayContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    displayContext.imageSmoothingEnabled = true;
    displayContext.imageSmoothingQuality = "high";
    canvasScroll.classList.toggle("is-zoomed", state.zoom > 1);

    if (state.zoom <= 1) {
        canvasScroll.scrollTop = 0;
        canvasScroll.scrollLeft = 0;
    }

    if (state.image) {
        drawCanvas();
    }
}

function updateFileMeta(file) {
    fileMeta.textContent = `${file.name} | ${formatBytes(file.size)} | ${file.type || "Image file"}`;
}

function updateInspector(sample, match) {
    primarySwatch.style.background = sample.hex;
    colorName.textContent = match.name;
    colorName.classList.remove("is-placeholder");
    datasetRowValue.textContent = match.csv_row ?? "--";
    sampleHexValue.textContent = sample.hex;
    sampleStatus.textContent = match.exact_match
        ? `Exact match: row ${match.csv_row}.`
        : `Nearest match: row ${match.csv_row}.`;
    datasetRedValue.textContent = `${match.r}`;
    datasetGreenValue.textContent = `${match.g}`;
    datasetBlueValue.textContent = `${match.b}`;
}

function showLookupUnavailable(sample) {
    primarySwatch.style.background = sample.hex;
    colorName.textContent = "Lookup unavailable";
    colorName.classList.add("is-placeholder");
    datasetRowValue.textContent = "--";
    sampleHexValue.textContent = sample.hex;
    sampleStatus.textContent = "Dataset details are unavailable right now.";
    datasetRedValue.textContent = "--";
    datasetGreenValue.textContent = "--";
    datasetBlueValue.textContent = "--";
}

async function fetchClosestColor(r, g, b) {
    const response = await fetch("/api/colors/match", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ r, g, b }),
    });

    if (!response.ok) {
        throw new Error("Unable to match the selected color.");
    }

    return response.json();
}

async function fetchDatasetSummary() {
    const response = await fetch("/api/dataset/summary", {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error("Unable to load dataset summary.");
    }

    return response.json();
}

async function fetchNotebookSummary() {
    const response = await fetch("/api/notebook/summary", {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error("Unable to load notebook summary.");
    }

    return response.json();
}

function refreshNotebookSummary() {
    return fetchNotebookSummary()
        .then((payload) => {
            updateNotebookSummary(payload);
        })
        .catch(() => {
            // Keep the last successful notebook values if a refresh fails.
        });
}

async function sampleColor(naturalX, naturalY) {
    if (!state.image) {
        return;
    }

    const imageData = sampleContext.getImageData(naturalX, naturalY, 1, 1).data;
    const [averageRed, averageGreen, averageBlue] = imageData;
    const sample = {
        x: naturalX,
        y: naturalY,
        r: averageRed,
        g: averageGreen,
        b: averageBlue,
        hex: rgbToHex(averageRed, averageGreen, averageBlue),
    };

    state.selection = {
        x: naturalX,
        y: naturalY,
    };
    drawCanvas();

    const token = ++state.requestToken;

    try {
        const payload = await fetchClosestColor(sample.r, sample.g, sample.b);
        if (token !== state.requestToken) {
            return;
        }

        updateDatasetRowCount(payload.dataset?.row_count);
        updateInspector(sample, payload.match);
    } catch (error) {
        if (token !== state.requestToken) {
            return;
        }

        showLookupUnavailable(sample);
    }
}

function getCanvasCoordinates(event) {
    const rect = imageCanvas.getBoundingClientRect();
    const displayX = clamp(event.clientX - rect.left, 0, state.displayWidth - 1);
    const displayY = clamp(event.clientY - rect.top, 0, state.displayHeight - 1);

    return {
        x: clamp(Math.round((displayX - state.renderOffsetX) / state.renderScale), 0, state.naturalWidth - 1),
        y: clamp(Math.round((displayY - state.renderOffsetY) / state.renderScale), 0, state.naturalHeight - 1),
    };
}

function nudgeSelection(deltaX, deltaY) {
    if (!state.selection) {
        return;
    }

    const nextX = clamp(state.selection.x + deltaX, 0, state.naturalWidth - 1);
    const nextY = clamp(state.selection.y + deltaY, 0, state.naturalHeight - 1);
    sampleColor(nextX, nextY);
}

function loadImage(file) {
    if (!file || !file.type.startsWith("image/")) {
        fileMeta.textContent = "Please choose a valid image file.";
        return;
    }

    if (state.activeUrl) {
        URL.revokeObjectURL(state.activeUrl);
    }

    const image = new Image();
    state.activeUrl = URL.createObjectURL(file);

    image.onload = () => {
        state.image = image;
        state.selection = null;
        setImageLayout(image);
        drawCanvas();
        updateFileMeta(file);
        canvasStage.classList.add("has-image");
        canvasStage.classList.remove("is-empty");
        canvasEmpty.hidden = true;
        helperCopy.textContent = defaultHelperCopy;
        resetInspector();
    };

    image.onerror = () => {
        fileMeta.textContent = "This image could not be loaded. Please try another file.";
        resetInspector();
    };

    image.src = state.activeUrl;
}

fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    loadImage(file);
});

dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
});

dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragging");
});

dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");

    const [file] = event.dataTransfer.files;
    loadImage(file);
});

imageCanvas.addEventListener("pointerdown", (event) => {
    if (!state.image) {
        return;
    }

    imageCanvas.focus();
    const { x, y } = getCanvasCoordinates(event);
    sampleColor(x, y);
});

imageCanvas.addEventListener("keydown", (event) => {
    if (!state.image || !state.selection) {
        return;
    }

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelection(-1, 0);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelection(1, 0);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeSelection(0, -1);
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeSelection(0, 1);
    }
});

zoomRange.addEventListener("input", (event) => {
    state.zoom = Number(event.target.value);
    updatePrecisionLabels();
    updateCanvasScale();
});

resetButton.addEventListener("click", () => {
    resetWorkspace();
});

window.addEventListener("resize", () => {
    if (!state.image) {
        return;
    }

    setImageLayout(state.image);
});

updateDatasetRowCount(Number.NaN);
resetNotebookSummary();
fetchDatasetSummary()
    .then((payload) => {
        updateDatasetRowCount(payload.row_count);
    })
    .catch(() => {
        updateDatasetRowCount(Number.NaN);
    });

fetchNotebookSummary()
    .then((payload) => {
        updateNotebookSummary(payload);
    })
    .catch(() => {
        resetNotebookSummary();
    });

window.setInterval(() => {
    fetchDatasetSummary()
        .then((payload) => {
            updateDatasetRowCount(payload.row_count);
        })
        .catch(() => {
            // Keep the last successful value if a refresh fails.
        });
}, 5000);

window.setInterval(() => {
    refreshNotebookSummary();
}, NOTEBOOK_REFRESH_INTERVAL_MS);

if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSettingsPanel();

        if (!settingsPanel.hidden) {
            refreshNotebookSummary();
        }
    });

    settingsPanel.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    document.addEventListener("click", () => {
        closeSettingsPanel();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSettingsPanel();
        }
    });
}

resetWorkspace();
