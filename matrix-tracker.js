const canvas = document.getElementById('flagCanvas');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');

let starBackgroundColors = Array.from({length: 50}, () => "#1a2c42");
let rawWebcamImage = null;
let activeVideoId = "oDCAAfOSqvA"; 

let currentMode = "proxy-latest";
let zoomMode = false;

let config = { 
    x: 0.505,       // 50.5%
    y: 0.609,       // 60.9%
    w: 0.018,       // 1.8%
    h: 0.155,       // 15.5%
    p: 2.25,        // 2.25x
    cloud: 1.0, 
    algae: 1.0,
    debug: false 
};

// Set default fallback date in picker to today
const todayObj = new Date();
document.getElementById('archiveDateInput').value = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

function syncSlidersToConfig() {
    document.getElementById('boxX').value = config.x * 100;
    document.getElementById('valX').textContent = (config.x * 100).toFixed(1) + '%';
    
    document.getElementById('boxY').value = config.y * 100;
    document.getElementById('valY').textContent = (config.y * 100).toFixed(1) + '%';
    
    document.getElementById('boxW').value = config.w * 100;
    document.getElementById('valW').textContent = (config.w * 100).toFixed(1) + '%';
    
    document.getElementById('boxH').value = config.h * 100;
    document.getElementById('valH').textContent = (config.h * 100).toFixed(1) + '%';
    
    document.getElementById('boxP').value = config.p;
    document.getElementById('valP').textContent = config.p.toFixed(2) + 'x';

    document.getElementById('boxCloud').value = config.cloud;
    document.getElementById('boxAlgae').value = config.algae;
    
    document.getElementById('toggleDebug').checked = config.debug;
}

document.getElementById('toggleCalibrateBtn').addEventListener('click', (e) => {
    const panel = document.getElementById('calibrationPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        config.debug = true;
        document.getElementById('toggleDebug').checked = true;
        e.target.textContent = "❌ Close Calibration Panel";
        e.target.classList.add('btn-secondary');
    } else {
        panel.style.display = 'none';
        config.debug = false;
        document.getElementById('toggleDebug').checked = false;
        e.target.textContent = "🛠️ Open Calibration Panel";
        e.target.classList.remove('btn-secondary');
    }
    drawFlag();
});

// Watch Zoom Mode Switcher
document.getElementById('toggleZoomMode').addEventListener('change', (e) => {
    zoomMode = e.target.checked;
    drawFlag();
});

const inputs = [
    { id: 'boxX', key: 'x', div: 'valX', mult: 0.01, unit: '%' },
    { id: 'boxY', key: 'y', div: 'valY', mult: 0.01, unit: '%' },
    { id: 'boxW', key: 'w', div: 'valW', mult: 0.01, unit: '%' },
    { id: 'boxH', key: 'h', div: 'valH', mult: 0.01, unit: '%' },
    { id: 'boxP', key: 'p', div: 'valP', mult: 1, unit: 'x' },
    { id: 'boxCloud', key: 'cloud', div: 'valCloud', mult: 1, unit: 'x' },
    { id: 'boxAlgae', key: 'algae', div: 'valAlgae', mult: 1, unit: 'x' }
];

inputs.forEach(input => {
    document.getElementById(input.id).addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        config[input.key] = val * input.mult;

        if(input.key === 'cloud') {
            document.getElementById(input.div).textContent = val === 1.0 ? "1.0x (Baseline)" : val.toFixed(2) + "x Gain";
        } else if (input.key === 'algae') {
            document.getElementById(input.div).textContent = val === 1.0 ? "1.0x (Raw Chroma)" : val.toFixed(1) + "x Iso Booster";
        } else {
            document.getElementById(input.div).textContent = val.toFixed(input.id === 'boxP' ? 2 : 1) + input.unit;
        }
        drawFlag();
    });
});

document.getElementById('sourceSelector').addEventListener('change', (e) => {
    const val = e.target.value;
    currentMode = val;
    
    // Toggle historical browser field visibility
    const archivePicker = document.getElementById('archivePickerContainer');
    if (val === 'archive-browse') {
        archivePicker.style.display = 'block';
        document.getElementById('valSource').textContent = "📅 Historical Archive Mode";
        document.getElementById('valSource').className = "badge bg-info text-dark";
        loadCustomArchiveTarget();
    } else {
        archivePicker.style.display = 'none';
        if (val === 'live') {
            document.getElementById('valSource').textContent = "🔴 YT Preview Thumbnail";
            document.getElementById('valSource').className = "badge bg-danger";
            statusDiv.innerHTML = `<strong style="color: #ffcc00;">⚠️ RUNTIME NOTICE:</strong> This static video placeholder layout differs from our cropped repository snapshots.`;
            updateWebcamData();
        } else if (val === 'proxy-latest') {
            document.getElementById('valSource').textContent = "🟢 Custom Proxy (Latest)";
            document.getElementById('valSource').className = "badge bg-success";
            loadLatestProxyImage();
        }
    }
});

// Trigger manually loading selected archive asset
document.getElementById('loadArchiveBtn').addEventListener('click', loadCustomArchiveTarget);

function loadCustomArchiveTarget() {
    const chosenDate = document.getElementById('archiveDateInput').value;
    const chosenIndex = document.getElementById('archiveIndexInput').value;
    if (!chosenDate) return;

    const targetedFile = `archive-${chosenDate}_${chosenIndex}.jpg`;
    statusDiv.textContent = `Probing repo path for requested asset: ${targetedFile}...`;

    const img = new Image();
    img.src = `./semiLivePics/${targetedFile}`;
    img.onload = function() {
        rawWebcamImage = img;
        statusDiv.textContent = `Loaded historical snapshot file successfully: semiLivePics/${targetedFile}`;
        drawFlag();
    };
    img.onerror = function() {
        statusDiv.innerHTML = `<span style="color: #f85149;">❌ Error: Asset './semiLivePics/${targetedFile}' not found.</span> Try a different index number or historical capture date.`;
    };
}

document.getElementById('toggleDebug').addEventListener('change', (e) => { config.debug = e.target.checked; drawFlag(); });

document.getElementById('streamUrlInput').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    let detectedId = val;
    if (val.includes('youtube.com') || val.includes('youtu.be')) {
        try {
            const urlObj = new URL(val);
            detectedId = urlObj.searchParams.has('v') ? urlObj.searchParams.get('v') : urlObj.pathname.split('/').pop();
        } catch(err) {}
    }
    activeVideoId = detectedId;
    document.getElementById('currentSource').textContent = "Target: " + detectedId;
    if(currentMode === "live") updateWebcamData();
});

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function applyAtmosphericFilters(r, g, b) {
    if (config.cloud !== 1.0) {
        r = Math.min(255, Math.max(0, ((r - 128) * config.cloud) + 128));
        g = Math.min(255, Math.max(0, ((g - 128) * config.cloud) + 128));
        b = Math.min(255, Math.max(0, ((b - 128) * config.cloud) + 128));
    }
    if (config.algae > 1.0) {
        let [h, s, l] = rgbToHsl(r, g, b);
        const hueDegree = h * 360;
        if (hueDegree >= 65 && hueDegree <= 175) {
            s = Math.min(1.0, s * config.algae);
        }
        [r, g, b] = hslToRgb(h, s, l);
    }
    return [r, g, b];
}

function updateWebcamData() {
    if (currentMode !== "live") return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timestamp = Date.now();
    img.src = `/api/live-frame?vid=${encodeURIComponent(activeVideoId)}&nocache=true&time=${timestamp}`; 

    img.onload = function() {
        if (currentMode !== "live") return;
        rawWebcamImage = img;
        drawFlag();
    };
    img.onerror = function() {
        if (currentMode !== "live") return;
        statusDiv.textContent = "Pipeline streaming network latency. Retrying proxy fallback loops...";
        setTimeout(updateWebcamData, 6000);
    };
}

function loadLatestProxyImage() {
    if (currentMode !== "proxy-latest") return;
    statusDiv.textContent = "Scanning for the latest daytime proxy frame layer...";
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    let highestFoundImg = null;
    let currentCheckIndex = 1;

    function probeNextIndex() {
        if (currentMode !== "proxy-latest") return;

        const testImg = new Image();
        testImg.src = `./semiLivePics/archive-${todayStr}_${currentCheckIndex}.jpg?t=${Date.now()}`;

        testImg.onload = function() {
            highestFoundImg = testImg;
            currentCheckIndex++;
            probeNextIndex();
        };

        testImg.onerror = function() {
            if (highestFoundImg) {
                rawWebcamImage = highestFoundImg;
                statusDiv.textContent = `Displaying custom daytime proxy snapshot metrics: archive-${todayStr}_${currentCheckIndex - 1}.jpg (Captured Today: ${todayStr}).`;
                drawFlag();
            } else {
                loadYesterdayFallback();
            }
        };
    }

    function loadYesterdayFallback() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

        statusDiv.textContent = `Today's image pending sunrise runtime. Loading historical baseline array: archive-${yesterdayStr}_1.jpg (Captured: ${yesterdayStr}).`;
        
        const fallbackImg = new Image();
        fallbackImg.src = `./semiLivePics/archive-${yesterdayStr}_1.jpg`;
        fallbackImg.onload = function() {
            if (currentMode !== "proxy-latest") return;
            rawWebcamImage = fallbackImg;
            drawFlag();
        };
        fallbackImg.onerror = function() {
            statusDiv.textContent = "System alert: No local daytime proxy files identified inside repo directory path.";
        };
    }

    probeNextIndex();
}

function get50StarColorsFromTrapezoid(sCtx, imgW, imgH) {
    const colors = [];
    const baseStartX = imgW * config.x;
    const baseStartY = imgH * config.y;
    const targetW = imgW * config.w;
    const targetH = imgH * config.h;

    for (let row = 1; row <= 9; row++) {
        const progress = (row - 1) / 8; 
        const currentRowWidth = targetW * (1 + progress * (config.p - 1));
        const widthDifference = currentRowWidth - targetW;
        const rowStartX = baseStartX - (widthDifference / 2);

        const xSpacing = currentRowWidth / 12;
        const ySpacing = targetH / 10;

        const isEvenRow = (row % 2 === 0);
        const starsInRow = isEvenRow ? 5 : 6;
        const starRowLeftEdge = rowStartX + (isEvenRow ? xSpacing * 2 : xSpacing);
        const pixelY = Math.floor(baseStartY + (row * ySpacing));

        for (let col = 0; col < starsInRow; col++) {
            const pixelX = Math.floor(starRowLeftEdge + (col * xSpacing * 2));
            const safeX = Math.max(0, Math.min(imgW - 1, pixelX));
            const safeY = Math.max(0, Math.min(imgH - 1, pixelY));

            try {
                const pixel = sCtx.getImageData(safeX, safeY, 1, 1).data;
                const [r, g, b] = applyAtmosphericFilters(pixel[0], pixel[1], pixel[2]);
                colors.push(`rgb(${r}, ${g}, ${b})`);
            } catch(e) {
                colors.push("#1a2c42");
            }
        }
    }
    return colors;
}

function drawActualStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3, x = cx, y = cy, step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step;
        x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); ctx.fill();
}

function drawFlag() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (rawWebcamImage) {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = rawWebcamImage.width;
        sampleCanvas.height = rawWebcamImage.height;
        const sCtx = sampleCanvas.getContext('2d');
        sCtx.drawImage(rawWebcamImage, 0, 0);
        starBackgroundColors = get50StarColorsFromTrapezoid(sCtx, rawWebcamImage.width, rawWebcamImage.height);
    }

    // IF ZOOM MODE IS TURNED ON: Render ONLY the isolated pool area onto the entire canvas!
    if (zoomMode && rawWebcamImage) {
        const sourceX = rawWebcamImage.width * (config.x - config.w * config.p);
        const sourceY = rawWebcamImage.height * config.y;
        const sourceWidth = rawWebcamImage.width * (config.w * config.p * 2);
        const sourceHeight = rawWebcamImage.height * config.h;

        ctx.drawImage(
            rawWebcamImage, 
            Math.max(0, sourceX), Math.max(0, sourceY), 
            Math.min(rawWebcamImage.width, sourceWidth), Math.min(rawWebcamImage.height, sourceHeight),
            0, 0, canvas.width, canvas.height
        );
        return; // Skip normal flag layout calculations when zoom mode is taking over the screen
    }

    // NORMAL FLAG MODE LAYOUT RENDERING
    const stripeHeight = canvas.height / 13;
    for (let i = 0; i < 13; i++) {
        ctx.fillStyle = (i % 2 === 0) ? "#b22234" : "#ffffff";
        ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
    }

    const cantonWidth = canvas.width * 0.4;
    const cantonHeight = stripeHeight * 7;
    ctx.fillStyle = "#1a2c42";
    ctx.fillRect(0, 0, cantonWidth, cantonHeight);

    if (config.debug && rawWebcamImage) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        if (config.cloud !== 1.0 || config.algae > 1.0) {
            const filterCanvas = document.createElement('canvas');
            filterCanvas.width = rawWebcamImage.width;
            filterCanvas.height = rawWebcamImage.height;
            const fCtx = filterCanvas.getContext('2d');
            fCtx.drawImage(rawWebcamImage, 0, 0);

            const imgData = fCtx.getImageData(0, 0, filterCanvas.width, filterCanvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const [r, g, b] = applyAtmosphericFilters(data[i], data[i+1], data[i+2]);
                data[i] = r; data[i+1] = data[i+2] = b;
            }
            fCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(filterCanvas, 0, 0, cantonWidth, cantonHeight);
        } else {
            ctx.drawImage(rawWebcamImage, 0, 0, cantonWidth, cantonHeight);
        }
        ctx.restore();
    }

    const xSpacing = cantonWidth / 12;
    const ySpacing = cantonHeight / 10;

    const starCoordinates = [];
    let starIndex = 0;

    for (let row = 1; row <= 9; row++) {
        const isEvenRow = (row % 2 === 0);
        const starsInRow = isEvenRow ? 5 : 6;
        const starXStart = isEvenRow ? xSpacing * 2 : xSpacing;

        for (let col = 0; col < starsInRow; col++) {
            const starX = starXStart + (col * xSpacing * 2);
            const starY = row * ySpacing;
            const algeaColor = starBackgroundColors[starIndex] || "#1a2c42";
            starIndex++;

            starCoordinates.push({ x: starX, y: starY, row: row, col: col, isEvenRow: isEvenRow, starsInRow: starsInRow, color: algeaColor });
        }
    }

    if (!config.debug) {
        starCoordinates.forEach((star) => {
            ctx.fillStyle = star.color;
            let tileLeft, tileRight;
            if (!star.isEvenRow) {
                tileLeft = star.col * (xSpacing * 2);
                tileRight = tileLeft + (xSpacing * 2);
            } else {
                tileLeft = (star.col === 0) ? 0 : (star.x - xSpacing);
                tileRight = (star.col === star.starsInRow - 1) ? cantonWidth : (star.x + xSpacing);
            }
            let tileTop = (star.row === 1) ? 0 : (star.y - (ySpacing / 2));
            let tileBottom = (star.row === 9) ? cantonHeight : (star.y + (ySpacing / 2));
            ctx.fillRect(tileLeft, tileTop, (tileRight - tileLeft) + 0.5, (tileBottom - tileTop) + 0.5);
        });
    }

    starCoordinates.forEach((star) => {
        if (!config.debug) {
            ctx.fillStyle = "#ffffff";
            drawActualStar(star.x, star.y, 5, 7.5, 3.2);
        } else {
            ctx.fillStyle = star.color;
            ctx.fillRect(star.x - 9, star.y - 9, 18, 18);
            ctx.save(); ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(star.x - 5, star.y); ctx.lineTo(star.x + 5, star.y); ctx.moveTo(star.x, star.y - 5); ctx.lineTo(star.x, star.y + 5); ctx.stroke();
            ctx.restore();
        }
    });

    if (config.debug) {
        ctx.save(); ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 2;
        const tlX = cantonWidth * config.x, trX = tlX + (cantonWidth * config.w), topY = cantonHeight * config.y;
        const bottomW = (cantonWidth * config.w) * config.p, wDiff = bottomW - (cantonWidth * config.w);
        const blX = tlX - (wDiff / 2), brX = blX + bottomW, bottomY = topY + (cantonHeight * config.h);
        ctx.beginPath(); ctx.moveTo(tlX, topY); ctx.lineTo(trX, topY); ctx.lineTo(brX, bottomY); ctx.lineTo(blX, bottomY);
        ctx.closePath(); ctx.stroke(); ctx.restore();
    }
}

// Kickstart logic pipelines
syncSlidersToConfig();
loadLatestProxyImage();

setInterval(() => {
    if (currentMode === "live") updateWebcamData();
    if (currentMode === "proxy-latest") loadLatestProxyImage();
}, 60000);