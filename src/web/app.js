const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${window.location.host}/ws`;
const MAX_LOG_ROWS = 400;
const PAD = 20;
const GLOBAL_WIDTH = 436 + PAD * 2;
const GLOBAL_HEIGHT = 444 + PAD * 2;
const THEME_STORAGE_KEY = "poke-dashboard-theme";

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
const activeInputsEl = document.getElementById("active-inputs");
const pokedexProgressEl = document.getElementById("pokedex-progress");
const partySummaryEl = document.getElementById("party-summary");
const partyGridEl = document.getElementById("party-grid");
const pokedexSummaryEl = document.getElementById("pokedex-summary");
const pokedexGridEl = document.getElementById("pokedex-grid");
const pokedexSearchEl = document.getElementById("pokedex-search");
const pokedexTypeFilterEl = document.getElementById("pokedex-type-filter");
const pokedexStatusFilterEl = document.getElementById("pokedex-status-filter");
const pokedexTotalEl = document.getElementById("pokedex-total");
const pokedexSeenCountEl = document.getElementById("pokedex-seen-count");
const pokedexOwnedCountEl = document.getElementById("pokedex-owned-count");
const pokedexFilteredCountEl = document.getElementById("pokedex-filtered-count");
const themeToggleEl = document.getElementById("theme-toggle");

const appState = {
    socket: null,
    reconnectTimer: null,
    mapData: {},
    pokemonCatalog: [],
    catalogByDex: new Map(),
    catalogByInternalId: new Map(),
    latestState: null,
    remoteActiveInputs: [],
};

class InputController {
    constructor(sendFn, onChange) {
        this.sendFn = sendFn;
        this.onChange = onChange;
        this.sequence = 0;
        this.activeButtons = new Set();
    }

    press(button) {
        if (this.activeButtons.has(button)) {
            return;
        }
        this.activeButtons.add(button);
        this.sequence += 1;
        this.sendFn({ type: "input_event", button, pressed: true, sequence: this.sequence });
        this.onChange(this.snapshot());
    }

    release(button) {
        if (!this.activeButtons.has(button)) {
            return;
        }
        this.activeButtons.delete(button);
        this.sequence += 1;
        this.sendFn({ type: "input_event", button, pressed: false, sequence: this.sequence });
        this.onChange(this.snapshot());
    }

    clear() {
        if (this.activeButtons.size === 0) {
            return;
        }
        this.activeButtons.clear();
        this.sequence += 1;
        this.sendFn({ type: "input_snapshot", buttons: [], sequence: this.sequence });
        this.onChange(this.snapshot());
    }

    sync() {
        this.sequence += 1;
        this.sendFn({ type: "input_snapshot", buttons: this.snapshot(), sequence: this.sequence });
    }

    snapshot() {
        return Array.from(this.activeButtons).sort();
    }
}

function sendJson(payload) {
    if (appState.socket && appState.socket.readyState === WebSocket.OPEN) {
        appState.socket.send(JSON.stringify(payload));
    }
}

const inputController = new InputController(sendJson, renderInputHighlights);

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

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatPercent(part, total) {
    if (!total) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
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

    Object.entries(appState.mapData).forEach(([id, region]) => {
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

    const region = appState.mapData[activeMapId];
    if (!region) {
        return;
    }

    const [offsetX, offsetY] = region.coordinates;
    const globalX = (offsetX + Number(playerX || 0) + PAD) * scaleX;
    const globalY = (offsetY + Number(playerY || 0) + PAD) * scaleY;
    mapContext.fillStyle = "#ff5f5f";
    mapContext.beginPath();
    mapContext.arc(globalX, globalY, 5, 0, Math.PI * 2);
    mapContext.fill();
    mapContext.strokeStyle = "#ffffff";
    mapContext.lineWidth = 1;
    mapContext.stroke();
}

function getCatalogEntryBySpeciesId(speciesId) {
    return appState.catalogByInternalId.get(Number(speciesId)) || null;
}

function createEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
}

function createTypeRow(types) {
    const row = document.createElement("div");
    row.className = "type-row";
    types.forEach((typeName) => {
        const chip = document.createElement("span");
        chip.className = "type-chip";
        chip.textContent = typeName;
        row.appendChild(chip);
    });
    return row;
}

function createStatRow(label, value) {
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `<span>${label}</span><span>${value}</span>`;
    return row;
}

function renderParty(party) {
    partyGridEl.replaceChildren();
    partySummaryEl.textContent = `${party.length} active slot${party.length === 1 ? "" : "s"}`;

    if (!party.length) {
        partyGridEl.appendChild(createEmptyState("No party data is available yet."));
        return;
    }

    party.forEach((member) => {
        const catalogEntry = getCatalogEntryBySpeciesId(member.species_id);
        const card = document.createElement("article");
        card.className = "party-card";
        const hpPercent = formatPercent(member.hp, member.max_hp || member.hp || 1);
        const statusClass = member.status === "Healthy" ? "healthy" : "warning";
        const title = catalogEntry ? catalogEntry.name : `Species ${member.species_id}`;
        const dexLabel = catalogEntry ? `Dex ${String(catalogEntry.dex_no).padStart(3, "0")}` : `Species ${member.species_id}`;

        const header = document.createElement("div");
        header.className = "card-header";
        header.innerHTML = `
            <div>
                <div class="badge-row">
                    <span class="slot-chip mono">Slot ${member.slot}</span>
                    <span class="status-chip ${statusClass}">${member.status}</span>
                </div>
                <h3>${title}</h3>
                <p class="panel-subtitle mono">${dexLabel} · Lv ${member.level}</p>
            </div>
            <span class="mono">${formatNumber(member.experience)} XP</span>
        `;

        const hpBar = document.createElement("div");
        hpBar.className = "hp-bar";
        hpBar.innerHTML = `<div class="hp-fill" style="width:${hpPercent}%"></div>`;

        const stats = document.createElement("div");
        stats.className = "party-stats";
        stats.append(
            createStatRow("HP", `${member.hp} / ${member.max_hp}`),
            createStatRow("Attack", member.attack),
            createStatRow("Defense", member.defense),
            createStatRow("Speed", member.speed),
            createStatRow("Special", member.special),
            createStatRow("Status", member.status)
        );

        card.append(header);
        if (catalogEntry) {
            card.append(createTypeRow(catalogEntry.types));
        }
        card.append(hpBar, stats);

        partyGridEl.appendChild(card);
    });
}

function renderPokedex(pokedex) {
    const seen = new Set((pokedex && pokedex.seen) || []);
    const owned = new Set((pokedex && pokedex.owned) || []);
    const searchText = pokedexSearchEl.value.trim().toLowerCase();
    const selectedType = pokedexTypeFilterEl.value;
    const selectedStatus = pokedexStatusFilterEl.value;
    const entries = [...appState.pokemonCatalog].sort((left, right) => left.dex_no - right.dex_no);

    const filtered = entries.filter((entry) => {
        const matchesSearch = !searchText
            || entry.name.toLowerCase().includes(searchText)
            || String(entry.dex_no).padStart(3, "0").includes(searchText)
            || entry.types.some((typeName) => typeName.toLowerCase().includes(searchText));
        const matchesType = selectedType === "all" || entry.types.includes(selectedType);
        const isSeen = seen.has(entry.dex_no);
        const isOwned = owned.has(entry.dex_no);
        const matchesStatus = selectedStatus === "all"
            || (selectedStatus === "owned" && isOwned)
            || (selectedStatus === "seen" && isSeen)
            || (selectedStatus === "unseen" && !isSeen)
            || (selectedStatus === "unowned" && !isOwned);
        return matchesSearch && matchesType && matchesStatus;
    });

    pokedexSummaryEl.textContent = `${filtered.length} / ${entries.length} entries visible`;
    pokedexTotalEl.textContent = `${entries.length}`;
    pokedexSeenCountEl.textContent = `${seen.size}`;
    pokedexOwnedCountEl.textContent = `${owned.size}`;
    pokedexFilteredCountEl.textContent = `${filtered.length}`;

    pokedexGridEl.replaceChildren();
    if (!filtered.length) {
        pokedexGridEl.appendChild(createEmptyState("No Pokemon match the current filters."));
        return;
    }

    filtered.forEach((entry) => {
        const card = document.createElement("article");
        card.className = "dex-card";

        const header = document.createElement("div");
        header.className = "dex-header";
        header.innerHTML = `
            <div>
                <h3>${entry.name}</h3>
                <p class="panel-subtitle mono">Internal ${entry.internal_id} · ${entry.growth_rate}</p>
            </div>
            <span class="dex-number mono">#${String(entry.dex_no).padStart(3, "0")}</span>
        `;

        const badgeRow = document.createElement("div");
        badgeRow.className = "badge-row";
        badgeRow.append(createTypeRow(entry.types));
        const seenChip = document.createElement("span");
        seenChip.className = `ownership-chip ${owned.has(entry.dex_no) ? "owned" : seen.has(entry.dex_no) ? "seen" : ""}`;
        seenChip.textContent = owned.has(entry.dex_no) ? "Owned" : seen.has(entry.dex_no) ? "Seen" : "Unknown";
        badgeRow.append(seenChip);

        const stats = document.createElement("div");
        stats.className = "dex-stats";
        stats.append(
            createStatRow("HP", entry.base_stats.hp),
            createStatRow("Atk", entry.base_stats.attack),
            createStatRow("Def", entry.base_stats.defense),
            createStatRow("Spd", entry.base_stats.speed),
            createStatRow("Spc", entry.base_stats.special),
            createStatRow("Catch", entry.catch_rate),
            createStatRow("Base EXP", entry.base_exp),
            createStatRow("Growth", entry.growth_rate)
        );

        card.append(header, badgeRow, stats);
        pokedexGridEl.appendChild(card);
    });
}

function renderInputHighlights(localButtons) {
    const combined = new Set([...(localButtons || []), ...appState.remoteActiveInputs]);
    const buttons = document.querySelectorAll("[data-btn]");
    buttons.forEach((button) => {
        button.classList.toggle("held", combined.has(button.dataset.btn));
    });
    activeInputsEl.textContent = `Held inputs: ${combined.size ? [...combined].sort().join(", ") : "none"}`;
}

function handleState(data) {
    appState.latestState = data;
    appState.remoteActiveInputs = data.active_inputs || [];
    renderInputHighlights(inputController.snapshot());

    if (data.screen) {
        screenEl.src = data.screen;
    }
    mapNameEl.textContent = data.map_name || `Map ${data.map_id ?? "?"}`;
    coordsEl.textContent = `X:${data.x ?? 0} Y:${data.y ?? 0}`;
    partyEl.textContent = `${data.party_count ?? 0}`;
    badgesEl.textContent = `${data.badges ?? 0}`;
    moneyEl.textContent = formatNumber(data.money ?? 0);
    leadHpEl.textContent = `${data.lead_hp ?? 0} / ${data.lead_max_hp ?? 0}`;
    botStateEl.textContent = data.state || "UNKNOWN";
    frameCountEl.textContent = `Frame: ${data.frame ?? 0}`;
    setActiveSpeed(data.speed || "1x");
    drawWorldMap(data.map_id, data.x, data.y);

    const pokedex = data.pokedex || { seen: [], owned: [], seen_count: 0, owned_count: 0 };
    pokedexProgressEl.textContent = `${pokedex.seen_count ?? 0} seen / ${pokedex.owned_count ?? 0} owned`;
    renderParty(data.party || []);
    renderPokedex(pokedex);
}

function handleLog(data) {
    appendLogLine(data.timestamp, data.message);
}

function connect() {
    setConnectionStatus(false);
    appState.socket = new WebSocket(WS_URL);

    appState.socket.addEventListener("open", () => {
        setConnectionStatus(true);
        inputController.sync();
    });

    appState.socket.addEventListener("close", () => {
        setConnectionStatus(false);
        window.clearTimeout(appState.reconnectTimer);
        appState.reconnectTimer = window.setTimeout(connect, 2000);
    });

    appState.socket.addEventListener("message", (event) => {
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

function bindHoldButton(button) {
    const control = button.dataset.btn;
    const release = () => inputController.release(control);

    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        inputController.press(control);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse" && event.buttons === 0) {
            release();
        }
    });
}

function bindKeyboardControls() {
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
        inputController.press(button);
    });

    document.addEventListener("keyup", (event) => {
        const button = keyMap[event.key];
        if (!button) {
            return;
        }
        event.preventDefault();
        inputController.release(button);
    });

    window.addEventListener("blur", () => inputController.clear());
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            inputController.clear();
        }
    });
}

function bindTabs() {
    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.tab;
            document.querySelectorAll("[data-tab]").forEach((tabButton) => {
                tabButton.classList.toggle("active", tabButton.dataset.tab === target);
            });
            document.querySelectorAll("[data-panel]").forEach((panel) => {
                panel.classList.toggle("active", panel.dataset.panel === target);
            });
        });
    });
}

function updateThemeButton(theme) {
    themeToggleEl.textContent = theme === "dark" ? "Switch to light" : "Switch to dark";
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeButton(theme);
}

function initializeTheme() {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
    themeToggleEl.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
    });
}

function populateTypeFilter() {
    const typeNames = new Set();
    appState.pokemonCatalog.forEach((entry) => {
        entry.types.forEach((typeName) => typeNames.add(typeName));
    });

    [...typeNames].sort().forEach((typeName) => {
        const option = document.createElement("option");
        option.value = typeName;
        option.textContent = typeName;
        pokedexTypeFilterEl.appendChild(option);
    });
}

function bindPokedexFilters() {
    [pokedexSearchEl, pokedexTypeFilterEl, pokedexStatusFilterEl].forEach((element) => {
        element.addEventListener("input", () => renderPokedex(appState.latestState && appState.latestState.pokedex));
        element.addEventListener("change", () => renderPokedex(appState.latestState && appState.latestState.pokedex));
    });
}

async function loadMapData() {
    const response = await fetch("/map_data.json");
    const payload = await response.json();
    appState.mapData = Object.fromEntries(payload.regions.map((region) => [Number(region.id), region]));
    drawWorldMap();
}

async function loadPokemonCatalog() {
    const response = await fetch("/pokemon_catalog.json");
    const payload = await response.json();
    appState.pokemonCatalog = payload.pokemon || [];
    appState.catalogByDex = new Map(appState.pokemonCatalog.map((entry) => [Number(entry.dex_no), entry]));
    appState.catalogByInternalId = new Map(appState.pokemonCatalog.map((entry) => [Number(entry.internal_id), entry]));
    populateTypeFilter();
    pokedexTotalEl.textContent = `${payload.meta ? payload.meta.total_pokemon : appState.pokemonCatalog.length}`;
    renderPokedex(appState.latestState && appState.latestState.pokedex);
}

document.querySelectorAll("[data-btn]").forEach(bindHoldButton);
document.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
        const speed = button.dataset.speed;
        setActiveSpeed(speed);
        sendJson({ type: "set_speed", speed });
    });
});

setActiveSpeed("1x");
bindTabs();
bindKeyboardControls();
bindPokedexFilters();
initializeTheme();
renderInputHighlights([]);
renderParty([]);
renderPokedex(null);

Promise.all([loadMapData(), loadPokemonCatalog()]).catch((error) => {
    appendLogLine("client", `Failed to load dashboard data: ${error.message}`);
});

connect();