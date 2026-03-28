// --- API Layer ---
const API_URL = (typeof ENV !== 'undefined' && ENV.API_URL) || 'http://localhost:7071';
let currentTrackerId = localStorage.getItem('alergenics_tracker_id') || null;

let apiCallCount = 0;
function apiStart() {
    apiCallCount++;
    document.getElementById('api-indicator')?.classList.add('active');
}
function apiEnd() {
    apiCallCount = Math.max(0, apiCallCount - 1);
    if (apiCallCount === 0) document.getElementById('api-indicator')?.classList.remove('active');
}

async function apiCreateTracker() {
    apiStart();
    try {
        const res = await fetch(`${API_URL}/api/trackers`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to create tracker');
        return (await res.json()).trackerId;
    } finally { apiEnd(); }
}

async function apiLoadTracker(trackerId) {
    apiStart();
    try {
        const res = await fetch(`${API_URL}/api/trackers/${trackerId}`);
        if (!res.ok) throw new Error(res.status === 404 ? 'מעקב לא נמצא' : 'שגיאה בטעינת המעקב');
        return await res.json();
    } finally { apiEnd(); }
}

async function apiSaveTracker(trackerId, allergens) {
    apiStart();
    try {
        const res = await fetch(`${API_URL}/api/trackers/${trackerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allergens }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to save tracker');
    } finally { apiEnd(); }
}

// --- State Management ---
let tasks = [];
let sessionHistory = new Map();
let debugDateOffset = parseInt(localStorage.getItem('alergenics_debug_offset') || '0');

function getNow() {
    const d = new Date();
    d.setDate(d.getDate() + debugDateOffset);
    return d;
}

// Master Allergen List (Hebrew - MoH Israel)
const mohAllergens = [
    'חלב', 'ביצים', 'בוטנים', 'סויה', 'חיטה',
    'אגוזי לוז', 'אגוזי מלך', 'אגוזי קשיו', 'אגוזי פקאן', 'פיסטוק',
    'שקדים', 'צנוברים', 'שומשום', 'דגים',
    'סרטנים', 'רכיכות', 'סלרי', 'חרדל', 'תורמוס', 'גופרית'
];

// Emoji Mapping
const allergenMap = {
    'בוטנים': '🥜', 'חלב': '🥛', 'ביצים': '🥚', 'ביצה': '🥚', 'חיטה': '🌾',
    'גלוטן': '🌾', 'דגים': '🐟', 'דג': '🐟', 'סויה': '🫘', 'אגוזי לוז': '🌰',
    'אגוזי מלך': '🌰', 'אגוזי קשיו': '🌰', 'אגוזי פקאן': '🌰', 'פיסטוק': '🌰',
    'שקדים': '🌰', 'צנוברים': '🌲', 'שומשום': '🥯', 'טחינה': '🥯',
    'סרטנים': '🦐', 'רכיכות': '🐚', 'סלרי': '🌿', 'חרדל': '🌭',
    'תורמוס': '🌸', 'גופרית': '🍷', 'אבק': '🧹', 'חתול': '🐈',
    'כלב': '🐕', 'תות': '🍓', 'תפוח': '🍎', 'דבש': '🍯'
};

let itemCadences = {};
let allergenLayoutMode = 'rows'; // 'grid' | 'rows'

// DOM Elements
const pendingList = document.getElementById('pending-list');
const viewAgenda = document.getElementById('view-agenda');
const viewTrack = document.getElementById('view-track');
const viewTrackerLanding = document.getElementById('view-tracker-landing');
const masterListContainer = document.getElementById('master-list-container');
const btnFinishManage = document.getElementById('btn-finish-manage');
const btnOpenSettings = document.getElementById('btn-open-settings');
const bottomNav = document.getElementById('bottom-nav');
const trackedCountDisplay = document.getElementById('tracked-count');

// --- Tracker Management ---
function showTrackerError(msg) {
    const el = document.getElementById('tracker-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function setLandingBusy(busy) {
    const spinner = document.getElementById('landing-spinner');
    const actions = document.getElementById('landing-actions');
    spinner.classList.toggle('hidden', !busy);
    actions.querySelectorAll('button, input').forEach(el => { el.disabled = busy; });
}

async function createTracker() {
    setLandingBusy(true);
    try {
        const trackerId = await apiCreateTracker();
        currentTrackerId = trackerId;
        localStorage.setItem('alergenics_tracker_id', trackerId);
        tasks = [];
        itemCadences = {};
        enterTracker();
    } catch (e) {
        showTrackerError(e.message);
        setLandingBusy(false);
    }
}

async function joinTracker() {
    const input = document.getElementById('input-tracker-id');
    const trackerId = input.value.trim();
    if (!trackerId || trackerId.length !== 6 || !/^[A-Za-z0-9_-]{6}$/.test(trackerId)) {
        showTrackerError('קוד מעקב חייב להכיל בדיוק 6 תווים');
        return;
    }
    setLandingBusy(true);
    try {
        const data = await apiLoadTracker(trackerId);
        currentTrackerId = trackerId;
        localStorage.setItem('alergenics_tracker_id', trackerId);
        tasks = data.allergens || [];
        tasks.forEach(t => { if (t.name) itemCadences[t.name] = t.freqValue || 3; });
        enterTracker();
    } catch (e) {
        showTrackerError(e.message);
        setLandingBusy(false);
    }
}

function leaveTracker() {
    stopPolling();
    currentTrackerId = null;
    localStorage.removeItem('alergenics_tracker_id');
    tasks = [];
    itemCadences = {};
    showLanding();
}

function showLanding() {
    viewTrackerLanding.classList.remove('hidden');
    viewAgenda.classList.add('hidden');
    viewTrack.classList.add('hidden');
    bottomNav.classList.add('hidden');
}

async function enterTracker() {
    viewTrackerLanding.classList.add('hidden');
    document.getElementById('tracker-id-display').textContent = currentTrackerId;

    // Load fresh data from server
    try {
        const data = await apiLoadTracker(currentTrackerId);
        tasks = data.allergens || [];
        tasks.forEach(t => { if (t.name) itemCadences[t.name] = t.freqValue || 3; });
    } catch (e) {
        console.error('Failed to load tracker:', e);
    }

    switchView('agenda', false);
    window.history.replaceState({ view: 'agenda' }, '');
    startPolling();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Show debug controls if ?dev is in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dev')) {
        const debugControls = document.getElementById('debug-controls');
        if (debugControls) debugControls.classList.remove('hidden');
    }

    updateDebugUI();

    // Auto-join from invite link (?join=TRACKERID)
    const joinParam = new URLSearchParams(window.location.search).get('join');
    if (joinParam) {
        // Clear the param from URL without reload
        history.replaceState({}, '', location.pathname);
        currentTrackerId = null;
        localStorage.removeItem('alergenics_tracker_id');
        showLanding();
        // Pre-fill the input and show the join form
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('input-tracker-id').value = joinParam;
        joinTracker();
    } else if (currentTrackerId) {
        enterTracker();
    } else {
        showLanding();
    }
});

function setupEventListeners() {
    document.getElementById('btn-create-tracker').addEventListener('click', createTracker);

    // "הצטרף למעקב קיים" reveals the input form
    document.getElementById('btn-show-join').addEventListener('click', () => {
        const form = document.getElementById('join-form');
        const opening = form.classList.contains('hidden');
        form.classList.toggle('hidden', !opening);
        if (opening) document.getElementById('input-tracker-id').focus();
    });

    document.getElementById('btn-join-tracker').addEventListener('click', joinTracker);
    let leaveConfirmPending = false;
    document.getElementById('btn-leave-tracker').addEventListener('click', () => {
        const btn = document.getElementById('btn-leave-tracker');
        const warning = document.getElementById('leave-warning');
        if (!leaveConfirmPending) {
            // First click — arm: show warning, turn red, shake, disable for 1s
            leaveConfirmPending = true;
            warning.classList.remove('hidden');
            btn.classList.remove('armed'); // reset to re-trigger animation
            void btn.offsetWidth;
            btn.classList.add('armed');
            btn.disabled = true;
            setTimeout(() => { btn.disabled = false; }, 1000);
        } else {
            // Second click — disconnect
            leaveConfirmPending = false;
            warning.classList.add('hidden');
            btn.classList.remove('armed');
            leaveTracker();
        }
    });

    document.getElementById('btn-invite').addEventListener('click', () => {
        const url = `${location.origin}${location.pathname}?join=${currentTrackerId}`;
        navigator.clipboard.writeText(url).then(() => {
            const confirm = document.getElementById('invite-confirm');
            confirm.classList.remove('hidden');
            setTimeout(() => confirm.classList.add('hidden'), 2500);
        });
    });

    document.getElementById('input-tracker-id').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') joinTracker();
    });

    btnOpenSettings.addEventListener('click', () => switchView('track', true));
    btnFinishManage.addEventListener('click', () => switchView('agenda', true));

    document.getElementById('btn-toggle-layout').addEventListener('click', () => {
        allergenLayoutMode = allergenLayoutMode === 'grid' ? 'rows' : 'grid';
        document.getElementById('btn-toggle-layout').textContent = allergenLayoutMode === 'grid' ? '☰' : '⊞';
        renderMasterList();
    });

    const btnDebugMinus = document.getElementById('debug-day-minus');
    const btnDebugPlus = document.getElementById('debug-day-plus');

    if (btnDebugMinus) {
        btnDebugMinus.addEventListener('click', () => {
            debugDateOffset--;
            localStorage.setItem('alergenics_debug_offset', debugDateOffset);
            updateDebugUI();
            render();
        });
    }

    if (btnDebugPlus) {
        btnDebugPlus.addEventListener('click', () => {
            debugDateOffset++;
            localStorage.setItem('alergenics_debug_offset', debugDateOffset);
            updateDebugUI();
            render();
        });
    }

    const btnDebugReset = document.getElementById('debug-reset');
    if (btnDebugReset) {
        btnDebugReset.addEventListener('click', () => {
            if (confirm('האם אתה בטוח שברצונך לאפס את כל הנתונים?')) {
                localStorage.clear();
                location.reload();
            }
        });
    }

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.view) {
            switchView(event.state.view, false);
        } else {
            switchView('agenda', false);
        }
    });

    // Sync: poll every 30s, pause when page hidden, immediate fetch on visibility restore
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            syncFromServer();
            startPolling();
        } else {
            stopPolling();
        }
    });
}

let pollTimer = null;

function startPolling() {
    stopPolling();
    if (!currentTrackerId) return;
    pollTimer = setInterval(syncFromServer, 30000);
}

function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function syncFromServer() {
    if (!currentTrackerId || document.visibilityState !== 'visible') return;
    try {
        const data = await apiLoadTracker(currentTrackerId);
        tasks = data.allergens || [];
        tasks.forEach(t => { if (t.name) itemCadences[t.name] = t.freqValue || 3; });
        render();
    } catch (e) {
        // silent — don't disrupt the user if sync fails
    }
}

function updateDebugUI() {
    const debugDisplay = document.getElementById('debug-offset-display');
    if (!debugDisplay) return;

    if (debugDateOffset === 0) {
        debugDisplay.innerText = 'מצב רגיל';
    } else {
        const sign = debugDateOffset > 0 ? '+' : '';
        debugDisplay.innerText = `יום: ${sign}${debugDateOffset}`;
    }
}

function switchView(target, pushToHistory) {
    if (pushToHistory) window.history.pushState({ view: target }, '');
    // Reset disconnect confirmation if navigating away from settings
    if (target !== 'track') {
        document.getElementById('leave-warning')?.classList.add('hidden');
        const btn = document.getElementById('btn-leave-tracker');
        if (btn) { btn.disabled = false; btn.classList.remove('armed'); }
    }
    const credit = document.getElementById('app-credit');
    if (target === 'track') {
        viewAgenda.classList.add('hidden');
        viewTrack.classList.remove('hidden');
        bottomNav.classList.add('hidden');
        credit?.classList.remove('hidden');
        renderMasterList();
    } else {
        viewTrack.classList.add('hidden');
        viewAgenda.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        credit?.classList.add('hidden');
        render();
    }
}

// --- Persistence: always save to API ---
async function saveTasks() {
    if (!currentTrackerId) return;
    try {
        await apiSaveTracker(currentTrackerId, tasks);
    } catch (e) {
        console.error('Failed to save to server:', e);
    }
}

function calculateNextDue(lastDoneStr, freqValue) {
    const lastDone = new Date(lastDoneStr);
    const nextDue = new Date(lastDone);
    nextDue.setDate(lastDone.getDate() + parseInt(freqValue));
    nextDue.setHours(0, 0, 0, 0);
    return nextDue.toISOString();
}

function getDaysDifference(isoStr) {
    const today = getNow();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(isoStr);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function isSameDay(isoStr1, isoStr2) {
    if (!isoStr1 || !isoStr2) return false;
    const d1 = new Date(isoStr1);
    const d2 = new Date(isoStr2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function getEmoji(name) {
    return allergenMap[name.trim()] || '🍴';
}

function renderMasterList() {
    masterListContainer.innerHTML = '';
    masterListContainer.className = allergenLayoutMode === 'grid' ? 'allergen-grid' : 'allergen-rows';
    if (trackedCountDisplay) trackedCountDisplay.innerText = `אלרגנים במעקב: ${tasks.length}`;

    mohAllergens.forEach(name => {
        const isTracked = tasks.some(t => t.name === name);
        if (!itemCadences[name]) itemCadences[name] = 3;

        const btnContainer = document.createElement('div');
        btnContainer.className = `btn-allergen-toggle ${isTracked ? 'tracked' : ''}`;

        btnContainer.innerHTML = `
            <div class="allergen-main-info" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <span class="emoji" style="font-size: 1.5rem;">${getEmoji(name)}</span>
                <span class="name" style="font-size: 0.9rem; font-weight: 600;">${name}</span>
            </div>
            <div class="cadence-ctrl">
                <button class="btn-qty minus">-</button>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span class="cadence-val">${itemCadences[name]}</span>
                    <span style="font-size: 0.6rem; opacity: 0.8; font-weight: bold; line-height: 1;">ימים</span>
                </div>
                <button class="btn-qty plus">+</button>
            </div>
        `;

        btnContainer.querySelector('.allergen-main-info').onclick = () => {
            isTracked ? untrackAllergen(name) : trackAllergen(name);
        };

        btnContainer.querySelector('.minus').onclick = (e) => {
            e.stopPropagation();
            updateCadence(name, -1);
        };
        btnContainer.querySelector('.plus').onclick = (e) => {
            e.stopPropagation();
            updateCadence(name, 1);
        };

        masterListContainer.appendChild(btnContainer);
    });
}

function updateCadence(name, delta) {
    const newVal = Math.max(1, (itemCadences[name] || 3) + delta);
    itemCadences[name] = newVal;
    const task = tasks.find(t => t.name === name);
    if (task) {
        task.freqValue = newVal;
        saveTasks();
    } else {
        trackAllergen(name);
    }
    renderMasterList();
}

function trackAllergen(name) {
    const today = getNow();
    today.setHours(0, 0, 0, 0);
    const newTask = {
        id: Date.now(),
        name: name,
        freqValue: itemCadences[name] || 3,
        freqUnit: 'days',
        lastDone: null,
        nextDue: today.toISOString()
    };
    tasks.push(newTask);
    saveTasks();
    renderMasterList();
}

function untrackAllergen(name) {
    const index = tasks.findIndex(t => t.name === name);
    if (index !== -1) {
        tasks.splice(index, 1);
        saveTasks();
        renderMasterList();
    }
}

let draggedId = null;

function render() {
    if (!pendingList) return;
    pendingList.innerHTML = '';

    if (tasks.length === 0) {
        pendingList.innerHTML = '<p class="empty-msg">אין אלרגנים במעקב. עברו להגדרות כדי להתחיל</p>';
        return;
    }

    const now = getNow();
    const todayISO = now.toISOString();
    const stableTasks = [...tasks].sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const todayDate = new Date(now);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(todayDate.getDate() + 1);
    const fmt = (d) => `${d.getDate()}.${d.getMonth() + 1}`;

    const groups = [
        { id: 'today', title: `היום (${fmt(todayDate)})`, items: [] },
        { id: 'tomorrow', title: `מחר (${fmt(tomorrowDate)})`, items: [] },
        { id: 'future', title: 'בהמשך', items: [] }
    ];

    stableTasks.forEach(task => {
        const diff = getDaysDifference(task.nextDue);
        const isDoneToday = isSameDay(task.lastDone, todayISO);

        if (diff <= 0 || isDoneToday) {
            groups[0].items.push({ task, isPreview: false });
        }

        let nextOccurrenceDiff = diff;
        if (diff <= 0 && !isDoneToday) {
            nextOccurrenceDiff = parseInt(task.freqValue);
        }

        if (diff === 1 || (diff <= 0 && !isDoneToday && parseInt(task.freqValue) === 1)) {
            groups[1].items.push({ task, isPreview: (diff !== 1) });
        }

        let laterProjectedDiff = diff;
        if (diff <= 0 && !isDoneToday) {
            laterProjectedDiff = parseInt(task.freqValue);
        } else if (diff === 1) {
            laterProjectedDiff = 1 + parseInt(task.freqValue);
        }
        groups[2].items.push({ task, isPreview: true, customDiff: laterProjectedDiff });
    });

    groups.forEach(group => {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'agenda-section';

        let isTodayDone = false;
        if (group.id === 'today') {
            isTodayDone = groups[0].items.length > 0 && groups[0].items.every(item => isSameDay(item.task.lastDone, todayISO));
        }

        const headerPrefix = group.id === 'today' ? `<span class="header-checkmark ${isTodayDone ? 'visible' : ''}">✅</span>` : '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'agenda-section-title';
        titleDiv.innerHTML = `${headerPrefix}${group.title}`;
        sectionContainer.appendChild(titleDiv);

        if (group.id !== 'future') {
            sectionContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                sectionContainer.classList.add('drag-over');
            });
            sectionContainer.addEventListener('dragleave', () => sectionContainer.classList.remove('drag-over'));
            sectionContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                sectionContainer.classList.remove('drag-over');
                handleDrop(draggedId, group.id);
            });
        }

        const itemsList = document.createElement('div');
        itemsList.className = 'section-items';

        if (group.items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-msg';
            empty.style.padding = '0.5rem 0';
            empty.innerText = 'אין פריטים';
            itemsList.appendChild(empty);
        } else {
            if (group.id === 'future') {
                group.items.sort((a, b) => a.customDiff - b.customDiff);
            }

            group.items.forEach(({ task, isPreview, customDiff }) => {
                const card = document.createElement('div');
                const diff = isPreview ? (customDiff || getDaysDifference(task.nextDue)) : getDaysDifference(task.nextDue);
                const isDoneToday = isSameDay(task.lastDone, todayISO);

                card.className = 'action-card';
                if (diff < 0 && !isDoneToday) card.classList.add('overdue');
                card.draggable = true;
                card.addEventListener('dragstart', () => {
                    draggedId = task.id;
                    card.classList.add('dragging');
                });
                card.addEventListener('dragend', () => card.classList.remove('dragging'));

                if (group.id === 'today' && !isPreview && !isDoneToday) {
                    card.classList.add('clickable');
                    card.onclick = () => markAsDone(task.id);
                } else {
                    card.classList.add('non-interactive');
                    card.onclick = null;
                }

                let statusText = '';
                let statusClass = '';
                if (isDoneToday && !isPreview) {
                    statusText = '';
                    statusClass = 'status-ok';
                } else if (diff < 0) {
                    statusText = `באיחור של ${Math.abs(diff)} ימים`;
                    statusClass = 'status-overdue';
                } else if (diff === 0) {
                    statusText = '';
                    statusClass = 'status-due';
                } else if (group.id === 'tomorrow') {
                    statusText = '';
                    statusClass = 'status-ok';
                } else {
                    statusText = `בעוד ${diff} ימים`;
                    statusClass = 'status-ok';
                }

                let checkboxHtml = '';
                if (group.id === 'today') {
                    const isChecked = isDoneToday;
                    checkboxHtml = `
                        <div class="checkbox-container ${isChecked ? 'checked' : ''}"
                             onclick="event.stopPropagation(); ${isChecked ? `undoItem(${task.id})` : `markAsDone(${task.id})`}">
                        </div>`;
                }

                card.innerHTML = `
                    <div class="action-info" style="width: 100%;">
                        <h3 style="display:flex; align-items:center; margin:0;">
                            ${checkboxHtml}
                            <span style="margin-right: ${group.id === 'today' ? '12px' : '0'}">${task.name} ${getEmoji(task.name)}</span>
                        </h3>
                        ${statusText ? `<p class="${statusClass}" style="margin:0; font-size: 0.9rem; margin-right: ${group.id === 'today' ? '3.2rem' : '0'}">${statusText}</p>` : ''}
                    </div>
                `;
                itemsList.appendChild(card);
            });
        }

        sectionContainer.appendChild(itemsList);
        pendingList.appendChild(sectionContainer);
    });
}

function handleDrop(id, targetGroupId) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    sessionHistory.set(id, { ...tasks[index] });

    const newDate = getNow();
    if (targetGroupId === 'tomorrow') {
        newDate.setDate(newDate.getDate() + 1);
    }
    newDate.setHours(0, 0, 0, 0);

    tasks[index].nextDue = newDate.toISOString();
    tasks[index].lastDone = null;

    saveTasks();
    render();
}

window.markAsDone = function(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        sessionHistory.set(id, { ...tasks[index] });
        const today = getNow();
        tasks[index].lastDone = today.toISOString();
        tasks[index].nextDue = calculateNextDue(today.toISOString(), tasks[index].freqValue);
        saveTasks();
        render();
    }
};

window.undoItem = function(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;
    if (sessionHistory.has(id)) {
        tasks[index] = sessionHistory.get(id);
        sessionHistory.delete(id);
    } else {
        const today = getNow();
        today.setHours(0, 0, 0, 0);
        tasks[index].nextDue = today.toISOString();
        tasks[index].lastDone = null;
    }
    saveTasks();
    render();
};
