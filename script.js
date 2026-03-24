// State Management
let tasks = [];
let sessionHistory = new Map(); // Robust per-item undo storage

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

// DOM Elements
const pendingList = document.getElementById('pending-list');
const viewAgenda = document.getElementById('view-agenda');
const viewTrack = document.getElementById('view-track');
const masterListContainer = document.getElementById('master-list-container');
const btnFinishManage = document.getElementById('btn-finish-manage');
const btnOpenSettings = document.getElementById('btn-open-settings');
const bottomNav = document.getElementById('bottom-nav');
const trackedCountDisplay = document.getElementById('tracked-count');

// Helper for click animation
function triggerClickEffect(element) {
    if (!element) return;
    element.classList.remove('clicked-effect');
    void element.offsetWidth; // Force reflow
    element.classList.add('clicked-effect');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
    render();
    
    // Initial state for History API
    window.history.replaceState({ view: 'agenda' }, '');
});

function setupEventListeners() {
    btnOpenSettings.addEventListener('click', (e) => {
        triggerClickEffect(e.currentTarget);
        switchView('track', true);
    });
    
    btnFinishManage.addEventListener('click', (e) => {
        triggerClickEffect(e.currentTarget);
        switchView('agenda', true);
    });

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.view) {
            switchView(event.state.view, false);
        } else {
            switchView('agenda', false);
        }
    });
}

function switchView(target, pushToHistory) {
    if (pushToHistory) {
        window.history.pushState({ view: target }, '');
    }

    if (target === 'track') {
        viewAgenda.classList.add('hidden');
        viewTrack.classList.remove('hidden');
        bottomNav.classList.add('hidden');
        renderMasterList();
    } else {
        viewTrack.classList.add('hidden');
        viewAgenda.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        render();
    }
}

function loadTasks() {
    const stored = localStorage.getItem('alergenics_tasks_he');
    if (stored) {
        tasks = JSON.parse(stored);
        tasks.forEach(t => { itemCadences[t.name] = t.freqValue; });
    }
}

function saveTasks() {
    localStorage.setItem('alergenics_tasks_he', JSON.stringify(tasks));
}

function calculateNextDue(lastDoneStr, freqValue) {
    const lastDone = new Date(lastDoneStr);
    const nextDue = new Date(lastDone);
    nextDue.setUTCDate(lastDone.getUTCDate() + parseInt(freqValue));
    return nextDue.toISOString();
}

function getDaysDifference(isoStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(isoStr);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isSameDay(isoStr1, isoStr2) {
    if (!isoStr1 || !isoStr2) return false;
    const d1 = new Date(isoStr1);
    const d2 = new Date(isoStr2);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
}

function getEmoji(name) {
    return allergenMap[name.trim()] || '🍴';
}

function renderMasterList() {
    masterListContainer.innerHTML = '';
    
    if (trackedCountDisplay) {
        trackedCountDisplay.innerText = `אלרגנים במעקב: ${tasks.length}`;
    }

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
        
        btnContainer.querySelector('.allergen-main-info').onclick = (e) => {
            triggerClickEffect(btnContainer);
            isTracked ? untrackAllergen(name) : trackAllergen(name);
        };

        btnContainer.querySelector('.minus').onclick = (e) => {
            e.stopPropagation();
            triggerClickEffect(e.currentTarget);
            updateCadence(name, -1);
        };
        btnContainer.querySelector('.plus').onclick = (e) => {
            e.stopPropagation();
            triggerClickEffect(e.currentTarget);
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
    const todayISO = new Date().toISOString();
    const newTask = {
        id: Date.now(),
        name: name,
        freqValue: itemCadences[name] || 3,
        freqUnit: 'days',
        lastDone: null,
        nextDue: todayISO 
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

// Robust Long-Press Detection
let longPressTimer;
let isLongPressActive = false;

function handleInteractionStart(id) {
    isLongPressActive = false;
    longPressTimer = setTimeout(() => {
        isLongPressActive = true;
        rescheduleToTomorrow(id);
    }, 600);
}

function handleInteractionEnd() {
    clearTimeout(longPressTimer);
}

function rescheduleToTomorrow(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        if (confirm(`האם להעביר את "${tasks[index].name}" למחר?`)) {
            sessionHistory.set(id, { ...tasks[index] });
            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tasks[index].nextDue = tomorrow.toISOString();
            saveTasks();
            render();
        }
    }
}

function render() {
    if (!pendingList) return;
    pendingList.innerHTML = '';
    
    if (tasks.length === 0) {
        pendingList.innerHTML = '<p class="empty-msg">אין אלרגנים במעקב. עברו להגדרות כדי להתחיל!</p>';
        return;
    }

    const todayISO = new Date().toISOString();
    const stableTasks = [...tasks].sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const groups = [
        { id: 'today', title: 'היום', items: [] },
        { id: 'tomorrow', title: 'מחר', items: [] },
        { id: 'future', title: 'בהמשך', items: [] }
    ];

    stableTasks.forEach(task => {
        const diff = getDaysDifference(task.nextDue);
        const isDoneToday = isSameDay(task.lastDone, todayISO);

        if (diff <= 0 || isDoneToday) {
            groups[0].items.push({ task, isPreview: false });
        }

        let nextOccurrenceDiff;
        if (isDoneToday) {
            nextOccurrenceDiff = diff;
        } else {
            nextOccurrenceDiff = parseInt(task.freqValue);
        }

        if (nextOccurrenceDiff === 1) {
            groups[1].items.push({ task, isPreview: true, customDiff: 1 });
        } else if (nextOccurrenceDiff > 1) {
            groups[2].items.push({ task, isPreview: true, customDiff: nextOccurrenceDiff });
        }
    });

    groups.forEach(group => {
        let headerPrefix = '';
        if (group.id === 'today' && group.items.length > 0) {
            const allDone = group.items.every(item => isSameDay(item.task.lastDone, todayISO));
            if (allDone) headerPrefix = '<span class="header-checkmark">✅</span>';
        }

        const title = document.createElement('div');
        title.className = 'agenda-section-title';
        title.innerHTML = `${headerPrefix}${group.title}`;
        pendingList.appendChild(title);

        if (group.items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-msg';
            empty.style.padding = '0.5rem 0';
            empty.innerText = 'אין פריטים';
            pendingList.appendChild(empty);
            return;
        }

        group.items.forEach(({ task, isPreview, customDiff }) => {
            const card = document.createElement('div');
            const diff = isPreview ? customDiff : getDaysDifference(task.nextDue);
            const isDoneToday = isSameDay(task.lastDone, todayISO);

            card.className = 'action-card';
            if (isPreview) {
                card.style.opacity = '0.7';
            } else if (diff <= 0 && !isDoneToday) {
                card.classList.add('clickable');
                card.oncontextmenu = (e) => { e.preventDefault(); return false; };
                
                card.onclick = (e) => { 
                    if (!isLongPressActive) {
                        triggerClickEffect(card);
                        markAsDone(task.id); 
                    }
                };
                card.onmousedown = () => handleInteractionStart(task.id);
                card.onmouseup = handleInteractionEnd;
                card.onmouseleave = handleInteractionEnd;
                card.ontouchstart = () => handleInteractionStart(task.id);
                card.ontouchend = handleInteractionEnd;
                card.ontouchmove = handleInteractionEnd; // Cancel if scrolling
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
            } else if (diff === 1) {
                statusText = 'מחר';
                statusClass = 'status-ok';
            } else {
                statusText = `בעוד ${diff} ימים`;
                statusClass = 'status-ok';
            }

            card.innerHTML = `
                <div class="action-info" style="width: 100%;">
                    <h3 style="display:flex; align-items:center; margin:0;">
                        ${isDoneToday && !isPreview ? `<span class="checkmark" onclick="event.stopPropagation(); triggerClickEffect(this); undoItem(${task.id})">✅</span>` : ''}
                        <span style="margin-right: ${isDoneToday && !isPreview ? '8px' : '0'}">${task.name} ${getEmoji(task.name)}</span>
                    </h3>
                    ${statusText ? `<p class="${statusClass}" style="margin:0; font-size: 0.9rem;">${statusText}</p>` : ''}
                </div>
            `;
            pendingList.appendChild(card);
        });
    });
}

window.markAsDone = function(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        sessionHistory.set(id, { ...tasks[index] });
        const todayISO = new Date().toISOString();
        tasks[index].lastDone = todayISO;
        tasks[index].nextDue = calculateNextDue(todayISO, tasks[index].freqValue);
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
        tasks[index].nextDue = new Date().toISOString();
        tasks[index].lastDone = null; 
    }
    saveTasks();
    render();
};
