const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${window.location.host}/ws`;
const MAX_LOG_ROWS = 400;
const PAD = 20;
const GLOBAL_WIDTH = 436 + PAD * 2;
const GLOBAL_HEIGHT = 444 + PAD * 2;

const screenEl = document.getElementById("screen");
const mapNameEl = document.getElementById("map-name");
const coordsEl = document.getElementById("coords");
const partyEl = document.getElementById("party");
const badgesEl = document.getElementById("badges");
const moneyEl = document.getElementById("money");
const leadHpEl = document.getElementById("lead-hp");
const botStateEl = document.getElementById("bot-state");
const frameCountEl = document.getElementById("frame-count");
const indicatorEl = document.getElementById("connection-indicator");
const logContainer = document.getElementById("log-output");
const mapCanvas = document.getElementById("world-map");
const mapContext = mapCanvas.getContext("2d");

let socket;
let reconnectTimer;
let mapData = {};

function setConnectionStatus(connected) {
    indicatorEl.textContent = connected ? "Connected" : "Disconnected";
    indicatorEl.classList.toggle("online", connected);
    indicatorEl.classList.toggle("offline", !connected);
}

function setActiveSpeed(speed) {
    document.querySelectorAll("[data-speed]").forEach((button) => {
        button.classList.toggle("active", button.dataset.speed === speed);
    });
}

function appendLogLine(timestamp, message) {
    const line = document.createElement("div");
    line.className = "log-line";
    line.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(line);

    while (logContainer.children.length > MAX_LOG_ROWS) {
        logContainer.removeChild(logContainer.firstChild);
    }

    logContainer.scrollTop = logContainer.scrollHeight;
}

function colorForRegion(regionName, regionId) {
    const palette = ["#244c73", "#2c6e49", "#735d2f", "#704264", "#4a5f7a", "#5d7343"];
    const index = Math.abs(Number(regionId)) % palette.length;
    if (/city/i.test(regionName)) {
        return "#507ad9";
    }
    if (/town/i.test(regionName)) {
        return "#5aaf67";
    }
    if (/route/i.test(regionName)) {
        return "#9c8b52";
    }
    return palette[index];
}

function drawWorldMap(activeMapId, playerX, playerY) {
    mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    mapContext.fillStyle = "#09101b";
    mapContext.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    const scaleX = mapCanvas.width / GLOBAL_WIDTH;
    const scaleY = mapCanvas.height / GLOBAL_HEIGHT;

    Object.entries(mapData).forEach(([id, region]) => {
        const regionId = Number(id);
        if (regionId < 0 || regionId > 36) {
            return;
        }

        const [regionX, regionY] = region.coordinates;
        const [width, height] = region.tileSize;

        const x = (regionX + PAD) * scaleX;
        const y = (regionY + PAD) * scaleY;
        const w = width * scaleX;
        const h = height * scaleY;

        mapContext.fillStyle = colorForRegion(region.name, regionId);
        mapContext.fillRect(x, y, w, h);
        mapContext.strokeStyle = regionId === Number(activeMapId) ? "#f7ecaf" : "rgba(255, 255, 255, 0.18)";
        mapContext.lineWidth = regionId === Number(activeMapId) ? 2 : 1;
        mapContext.strokeRect(x, y, w, h);
    });

    const region = mapData[activeMapId];
    if (!region) {
        return;
    }

    const [offsetX, offsetY] = region.coordinates;
    const globalX = (offsetX + Number(playerX) + PAD) * scaleX;
    const globalY = (offsetY + Number(playerY) + PAD) * scaleY;
    mapContext.fillStyle = "#ff5f5f";
    mapContext.beginPath();
    mapContext.arc(globalX, globalY, 5, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.strokeStyle = "#ffffff";
    mapContext.lineWidth = 1;
    mapContext.stroke();
}

function handleState(data) {
    if (data.screen) {
        screenEl.src = data.screen;
    }
    mapNameEl.textContent = data.map_name || `Map ${data.map_id ?? "?"}`;
    coordsEl.textContent = `X:${data.x ?? 0} Y:${data.y ?? 0}`;
    partyEl.textContent = `${data.party_count ?? 0}`;
    badgesEl.textContent = `${data.badges ?? 0}`;
    moneyEl.textContent = `${data.money ?? 0}`;
    leadHpEl.textContent = `${data.lead_hp ?? 0} / ${data.lead_max_hp ?? 0}`;
    botStateEl.textContent = data.state || "UNKNOWN";
    frameCountEl.textContent = `Frame: ${data.frame ?? 0}`;
    setActiveSpeed(data.speed || "1x");
    drawWorldMap(data.map_id, data.x, data.y);
}

function handleLog(data) {
    appendLogLine(data.timestamp, data.message);
}

function sendJson(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
}

function connect() {
    setConnectionStatus(false);
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        setConnectionStatus(true);
    });

    socket.addEventListener("close", () => {
        setConnectionStatus(false);
        window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, 2000);
    });

    socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "state") {
            handleState(data);
        } else if (data.type === "log") {
            handleLog(data);
        } else if (data.type === "error") {
            appendLogLine("client", data.message);
        }
    });
}

const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    z: "a",
    Z: "a",
    x: "b",
    X: "b",
    Enter: "start",
    Shift: "select",
};

document.addEventListener("keydown", (event) => {
    const button = keyMap[event.key];
    if (!button || event.repeat) {
        return;
    }
    event.preventDefault();
    sendJson({ type: "input", button });
});

document.querySelectorAll("[data-btn]").forEach((button) => {
    const dispatch = () => sendJson({ type: "input", button: button.dataset.btn });
    button.addEventListener("click", dispatch);
    button.addEventListener("touchstart", (event) => {
        event.preventDefault();
        dispatch();
    }, { passive: false });
});

document.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
        const speed = button.dataset.speed;
        setActiveSpeed(speed);
        sendJson({ type: "set_speed", speed });
    });
});

async function loadMapData() {
    const response = await fetch("/map_data.json");
    const payload = await response.json();
    mapData = Object.fromEntries(payload.regions.map((region) => [Number(region.id), region]));
    drawWorldMap();
}

setActiveSpeed("1x");
loadMapData().catch((error) => {
    appendLogLine("client", `Failed to load map data: ${error.message}`);
});
connect();