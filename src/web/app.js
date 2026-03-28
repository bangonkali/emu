const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${window.location.host}/ws`;
const MAX_LOG_ROWS = 400;
const PAD = 20;
const GLOBAL_WIDTH = 436 + PAD * 2;
const GLOBAL_HEIGHT = 444 + PAD * 2;
const THEME_STORAGE_KEY = "poke-dashboard-theme";
const LAYOUT_MODE_STORAGE_KEY = "poke-dashboard-layout-mode";
const MOBILE_LAYOUT_BREAKPOINT = 900;
const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const mobileWidthQuery = window.matchMedia(`(max-width: ${MOBILE_LAYOUT_BREAKPOINT}px)`);
const portraitQuery = window.matchMedia("(orientation: portrait)");

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
const itemsSummaryEl = document.getElementById("items-summary");
const itemsUsedSlotsEl = document.getElementById("items-used-slots");
const itemsFreeSlotsEl = document.getElementById("items-free-slots");
const itemsTotalQuantityEl = document.getElementById("items-total-quantity");
const itemsGridEl = document.getElementById("items-grid");
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
const layoutIndicatorEl = document.getElementById("layout-indicator");
const layoutButtons = [...document.querySelectorAll("[data-layout-mode]")];
const orientationWarningEl = document.getElementById("mobile-orientation-warning");
const desktopCombatSummaryEl = document.getElementById("desktop-combat-summary");
const desktopCombatContentEl = document.getElementById("desktop-combat-content");
const mobileCombatSummaryEl = document.getElementById("mobile-combat-summary");
const mobileCombatContentEl = document.getElementById("mobile-combat-content");

const appState = {
    socket: null,
    reconnectTimer: null,
    mapData: {},
    pokemonCatalog: [],
    catalogByDex: new Map(),
    catalogByInternalId: new Map(),
    latestState: null,
    remoteActiveInputs: [],
    layoutPreference: "auto",
    resolvedLayout: "desktop",
};

const ITEM_NAME_LOOKUP = {
    0x01: "Master Ball",
    0x02: "Ultra Ball",
    0x03: "Great Ball",
    0x04: "Poke Ball",
    0x05: "Town Map",
    0x06: "Bicycle",
    0x07: "Surfboard",
    0x08: "Safari Ball",
    0x09: "Pokedex",
    0x0A: "Moon Stone",
    0x0B: "Antidote",
    0x0C: "Burn Heal",
    0x0D: "Ice Heal",
    0x0E: "Awakening",
    0x0F: "Parlyz Heal",
    0x10: "Full Restore",
    0x11: "Max Potion",
    0x12: "Hyper Potion",
    0x13: "Super Potion",
    0x14: "Potion",
    0x15: "BoulderBadge",
    0x16: "CascadeBadge",
    0x17: "ThunderBadge",
    0x18: "RainbowBadge",
    0x19: "SoulBadge",
    0x1A: "MarshBadge",
    0x1B: "VolcanoBadge",
    0x1C: "EarthBadge",
    0x1D: "Escape Rope",
    0x1E: "Repel",
    0x1F: "Old Amber",
    0x20: "Fire Stone",
    0x21: "Thunderstone",
    0x22: "Water Stone",
    0x23: "HP Up",
    0x24: "Protein",
    0x25: "Iron",
    0x26: "Carbos",
    0x27: "Calcium",
    0x28: "Rare Candy",
    0x29: "Dome Fossil",
    0x2A: "Helix Fossil",
    0x2B: "Secret Key",
    0x2C: "Unused Item 2C",
    0x2D: "Bike Voucher",
    0x2E: "X Accuracy",
    0x2F: "Leaf Stone",
    0x30: "Card Key",
    0x31: "Nugget",
    0x32: "Unused Item 32",
    0x33: "Poke Doll",
    0x34: "Full Heal",
    0x35: "Revive",
    0x36: "Max Revive",
    0x37: "Guard Spec.",
    0x38: "Super Repel",
    0x39: "Max Repel",
    0x3A: "Dire Hit",
    0x3B: "Coin",
    0x3C: "Fresh Water",
    0x3D: "Soda Pop",
    0x3E: "Lemonade",
    0x3F: "S.S.Ticket",
    0x40: "Gold Teeth",
    0x41: "X Attack",
    0x42: "X Defend",
    0x43: "X Speed",
    0x44: "X Special",
    0x45: "Coin Case",
    0x46: "Oak's Parcel",
    0x47: "Itemfinder",
    0x48: "Silph Scope",
    0x49: "Poke Flute",
    0x4A: "Lift Key",
    0x4B: "Exp.All",
    0x4C: "Old Rod",
    0x4D: "Good Rod",
    0x4E: "Super Rod",
    0x4F: "PP Up",
    0x50: "Ether",
    0x51: "Max Ether",
    0x52: "Elixer",
    0x53: "Max Elixer",
    0x54: "B2F",
    0x55: "B1F",
    0x56: "1F",
    0x57: "2F",
    0x58: "3F",
    0x59: "4F",
    0x5A: "5F",
    0x5B: "6F",
    0x5C: "7F",
    0x5D: "8F",
    0x5E: "9F",
    0x5F: "10F",
    0x60: "11F",
    0x61: "B4F",
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

function getItemName(itemId) {
    const normalizedId = Number(itemId);
    if (normalizedId >= 0xC4 && normalizedId <= 0xC8) {
        return `HM${String(normalizedId - 0xC3).padStart(2, "0")}`;
    }
    if (normalizedId >= 0xC9 && normalizedId <= 0xFA) {
        return `TM${String(normalizedId - 0xC8).padStart(2, "0")}`;
    }
    return ITEM_NAME_LOOKUP[normalizedId] || `Item ${normalizedId}`;
}

function getItemCategory(itemId) {
    const normalizedId = Number(itemId);
    if (normalizedId >= 0xC4 && normalizedId <= 0xC8) {
        return "Hidden Machine";
    }
    if (normalizedId >= 0xC9 && normalizedId <= 0xFA) {
        return "Technical Machine";
    }
    if (normalizedId <= 0x08) {
        return "Ball / Tool";
    }
    if (normalizedId >= 0x0A && normalizedId <= 0x14) {
        return "Medicine";
    }
    if (normalizedId >= 0x1F && normalizedId <= 0x2F) {
        return "Evolution / Rare Item";
    }
    if (normalizedId >= 0x3C && normalizedId <= 0x3E) {
        return "Drink";
    }
    if (normalizedId >= 0x45 && normalizedId <= 0x4E) {
        return "Key Item";
    }
    return "Inventory Item";
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

function renderInventory(inventory) {
    const payload = inventory || { count: 0, capacity: 20, total_quantity: 0, items: [] };
    const items = payload.items || [];
    const usedSlots = payload.count ?? items.length;
    const capacity = payload.capacity ?? 20;
    const freeSlots = Math.max(capacity - usedSlots, 0);

    itemsSummaryEl.textContent = `${usedSlots} / ${capacity} slots`;
    itemsUsedSlotsEl.textContent = `${usedSlots}`;
    itemsFreeSlotsEl.textContent = `${freeSlots}`;
    itemsTotalQuantityEl.textContent = `${payload.total_quantity ?? 0}`;
    itemsGridEl.replaceChildren();

    if (!items.length) {
        itemsGridEl.appendChild(createEmptyState("No bag items are available yet."));
        return;
    }

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "inventory-card";

        const header = document.createElement("div");
        header.className = "card-header";
        header.innerHTML = `
            <div>
                <div class="badge-row">
                    <span class="slot-chip mono">Bag ${item.slot}</span>
                    <span class="status-chip healthy">x${item.quantity}</span>
                </div>
                <h3>${getItemName(item.item_id)}</h3>
                <p class="panel-subtitle mono">${getItemCategory(item.item_id)}</p>
            </div>
            <span class="mono">0x${Number(item.item_id).toString(16).toUpperCase().padStart(2, "0")}</span>
        `;

        const stats = document.createElement("div");
        stats.className = "inventory-stats";
        stats.append(
            createStatRow("Quantity", item.quantity),
            createStatRow("Slot", item.slot),
            createStatRow("Item ID", `0x${Number(item.item_id).toString(16).toUpperCase().padStart(2, "0")}`)
        );

        card.append(header, stats);
        itemsGridEl.appendChild(card);
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

function buildCombatMonCard(member, options = {}) {
    if (!member) {
        return createEmptyState("No live combat data is available for this slot.");
    }

    const { label = "", active = false, currentEnemy = false } = options;
    const catalogEntry = getCatalogEntryBySpeciesId(member.species_id);
    const title = catalogEntry ? catalogEntry.name : `Species ${member.species_id}`;
    const dexLabel = catalogEntry ? `Dex ${String(catalogEntry.dex_no).padStart(3, "0")}` : `Species ${member.species_id}`;
    const hpPercent = formatPercent(member.hp, member.max_hp || member.hp || 1);
    const card = document.createElement("article");
    card.className = "combat-card";
    if (active) {
        card.classList.add("active");
    }
    if (currentEnemy) {
        card.classList.add("enemy-focus");
    }

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `
        <div>
            <div class="badge-row">
                ${label ? `<span class="slot-chip mono">${label}</span>` : ""}
                ${active ? `<span class="status-chip healthy">Active</span>` : ""}
                ${currentEnemy ? `<span class="status-chip warning">Current Enemy</span>` : `<span class="status-chip ${member.status === "Healthy" ? "healthy" : "warning"}">${member.status}</span>`}
            </div>
            <h3>${title}</h3>
            <p class="panel-subtitle mono">${dexLabel} · Lv ${member.level}</p>
        </div>
        <span class="mono">${member.hp} / ${member.max_hp}</span>
    `;

    const hpBar = document.createElement("div");
    hpBar.className = "hp-bar";
    hpBar.innerHTML = `<div class="hp-fill" style="width:${hpPercent}%"></div>`;

    const stats = document.createElement("div");
    stats.className = "combat-stats";
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
    return card;
}

function buildCombatSection(title, subtitle, gridClassName, members, options = {}) {
    const section = document.createElement("section");
    section.className = "combat-section";

    const heading = document.createElement("div");
    heading.className = "combat-section-heading";
    heading.innerHTML = `<h3>${title}</h3><p class="panel-subtitle">${subtitle}</p>`;

    const grid = document.createElement("div");
    grid.className = gridClassName;

    if (!members.length) {
        grid.appendChild(createEmptyState("No live combat data is available."));
    } else {
        members.forEach((member) => {
            grid.appendChild(buildCombatMonCard(member, options(member)));
        });
    }

    section.append(heading, grid);
    return section;
}

function buildCombatContent(combat) {
    if (!combat || !combat.active) {
        return createEmptyState("No active battle. Combat telemetry appears automatically during wild, trainer, and safari encounters.");
    }

    const wrapper = document.createElement("div");
    wrapper.className = "combat-stack";

    const focusGrid = document.createElement("div");
    focusGrid.className = "combat-focus-grid";
    focusGrid.append(
        buildCombatMonCard(combat.player_active, {
            label: combat.player_active_slot ? `Party ${combat.player_active_slot}` : "Active",
            active: true,
        }),
        buildCombatMonCard(combat.enemy_active, {
            label: combat.kind === "trainer" ? "Enemy" : "Wild",
            active: true,
            currentEnemy: true,
        })
    );

    wrapper.append(focusGrid);
    wrapper.append(
        buildCombatSection(
            "Your Party",
            "Entire team with the current battler highlighted.",
            "combat-grid party-combat-grid",
            combat.player_party || [],
            (member) => ({
                label: `Party ${member.slot}`,
                active: member.slot === combat.player_active_slot,
            })
        )
    );
    wrapper.append(
        buildCombatSection(
            combat.kind === "trainer" ? "Enemy Party" : "Opponent",
            combat.kind === "trainer"
                ? "Opposing trainer roster with the current battler highlighted."
                : "Wild encounter details for the current opponent.",
            "combat-grid enemy-combat-grid",
            combat.enemy_party || [],
            (member) => ({
                label: member.slot ? `Enemy ${member.slot}` : "Enemy",
                active: member.slot === combat.enemy_active_slot,
                currentEnemy: member.slot === combat.enemy_active_slot,
            })
        )
    );

    return wrapper;
}

function renderCombat(combat) {
    const summary = combat && combat.active
        ? `${capitalize(combat.kind)} battle · ${combat.enemy_party_count || (combat.enemy_party || []).length} foe${(combat.enemy_party_count || (combat.enemy_party || []).length) === 1 ? "" : "s"}`
        : "No battle";

    [desktopCombatSummaryEl, mobileCombatSummaryEl].forEach((element) => {
        if (element) {
            element.textContent = summary;
        }
    });

    const contentElements = [desktopCombatContentEl, mobileCombatContentEl];
    contentElements.forEach((element) => {
        if (!element) {
            return;
        }
        element.replaceChildren(buildCombatContent(combat));
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
    renderCombat(data.combat || null);
    renderParty(data.party || []);
    renderInventory(data.inventory || null);
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
            setActiveTab(button.dataset.tab);
        });
    });
}

function setActiveTab(target) {
    document.querySelectorAll("[data-tab]").forEach((tabButton) => {
        tabButton.classList.toggle("active", tabButton.dataset.tab === target);
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === target);
    });
}

function capitalize(value) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";
}

function isLikelyMobileDevice() {
    const userAgent = navigator.userAgent || "";
    const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const narrowViewport = mobileWidthQuery.matches || window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
    return MOBILE_USER_AGENT_PATTERN.test(userAgent) || (hasTouch && coarsePointerQuery.matches && narrowViewport);
}

function isPortraitOrientation() {
    return portraitQuery.matches || window.innerHeight >= window.innerWidth;
}

function resolveLayout(preference) {
    if (preference === "desktop" || preference === "mobile") {
        if (preference === "mobile" && !isPortraitOrientation()) {
            return "desktop";
        }
        return preference;
    }
    return isLikelyMobileDevice() && isPortraitOrientation() ? "mobile" : "desktop";
}

function updateLayoutControls(preference, resolved) {
    layoutButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.layoutMode === preference);
    });
    layoutIndicatorEl.textContent = preference === "auto"
        ? `Layout: Auto (${capitalize(resolved)})`
        : `Layout: ${capitalize(resolved)}`;
}

function updateOrientationWarning(preference, resolved) {
    const shouldShow = (preference === "mobile" || (preference === "auto" && isLikelyMobileDevice()))
        && !isPortraitOrientation()
        && resolved !== "mobile";
    orientationWarningEl.hidden = !shouldShow;
}

function applyLayoutPreference(preference) {
    const resolved = resolveLayout(preference);
    appState.layoutPreference = preference;
    appState.resolvedLayout = resolved;
    document.documentElement.dataset.layout = resolved;
    window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, preference);
    updateLayoutControls(preference, resolved);
    updateOrientationWarning(preference, resolved);

    if (resolved === "mobile") {
        setActiveTab("play");
    } else {
        const activeMobilePanel = document.querySelector(".tab-panel.active.mobile-only");
        if (activeMobilePanel) {
            setActiveTab("play");
        }
    }
}

function initializeLayoutMode() {
    const savedPreference = window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
    const initialPreference = ["auto", "desktop", "mobile"].includes(savedPreference) ? savedPreference : "auto";

    layoutButtons.forEach((button) => {
        button.addEventListener("click", () => applyLayoutPreference(button.dataset.layoutMode));
    });

    const refreshAutoLayout = () => {
        if (appState.layoutPreference === "auto") {
            applyLayoutPreference("auto");
        }
    };

    if (typeof coarsePointerQuery.addEventListener === "function") {
        coarsePointerQuery.addEventListener("change", refreshAutoLayout);
        mobileWidthQuery.addEventListener("change", refreshAutoLayout);
        portraitQuery.addEventListener("change", refreshAutoLayout);
    } else {
        coarsePointerQuery.addListener(refreshAutoLayout);
        mobileWidthQuery.addListener(refreshAutoLayout);
        portraitQuery.addListener(refreshAutoLayout);
    }

    window.addEventListener("resize", refreshAutoLayout);
    applyLayoutPreference(initialPreference);
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
initializeLayoutMode();
renderInputHighlights([]);
renderCombat(null);
renderParty([]);
renderInventory(null);
renderPokedex(null);

Promise.all([loadMapData(), loadPokemonCatalog()]).catch((error) => {
    appendLogLine("client", `Failed to load dashboard data: ${error.message}`);
});

connect();