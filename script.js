// State Management
let tasks = [];
let sessionHistory = new Map();

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

// Helper for click animation and cooldown
function triggerClickEffect(element) {
    if (!element) return;
    document.body.classList.add('cooldown');
    setTimeout(() => {
        document.body.classList.remove('cooldown');
    }, 300);
    element.classList.remove('clicked-effect');
    void element.offsetWidth; // Force reflow
    element.classList.add('clicked-effect');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
    render();
    window.history.replaceState({ view: 'agenda' }, '');
});

function setupEventListeners() {
    btnOpenSettings.addEventListener('click', (e) => {
        triggerClickEffect(e.currentTarget);
        setTimeout(() => switchView('track', true), 150);
    });
    
    btnFinishManage.addEventListener('click', (e) => {
        triggerClickEffect(e.currentTarget);
        setTimeout(() => switchView('agenda', true), 150);
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
    if (pushToHistory) window.history.pushState({ view: target }, '');
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
    nextDue.setDate(lastDone.getDate() + parseInt(freqValue));
    nextDue.setHours(0, 0, 0, 0);
    return nextDue.toISOString();
}

function getDaysDifference(isoStr) {
    const today = new Date();
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
            triggerClickEffect(btnContainer);
            setTimeout(() => isTracked ? untrackAllergen(name) : trackAllergen(name), 150);
        };

        btnContainer.querySelector('.minus').onclick = (e) => {
            e.stopPropagation();
            triggerClickEffect(e.currentTarget);
            setTimeout(() => updateCadence(name, -1), 150);
        };
        btnContainer.querySelector('.plus').onclick = (e) => {
            e.stopPropagation();
            triggerClickEffect(e.currentTarget);
            setTimeout(() => updateCadence(name, 1), 150);
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
    const today = new Date();
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

        // 1. TODAY section
        if (diff <= 0 || isDoneToday) {
            groups[0].items.push({ task, isPreview: false });
        }

        // Project the NEXT occurrence
        let nextOccurrenceDiff = diff;
        if (diff <= 0 && !isDoneToday) {
            nextOccurrenceDiff = parseInt(task.freqValue);
        } else if (diff === 1) {
            // Even if due tomorrow, we want to see it in Tomorrow section AND proyected in Later
            // but user said "added 1 day cadence... not showing in tomorrow"
            // If cadence is 1 and it's due today, next occurrence is Tomorrow.
        }

        // 2. TOMORROW section
        // Should show if diff is 1 OR if next projection is 1
        if (diff === 1 || (diff <= 0 && !isDoneToday && parseInt(task.freqValue) === 1)) {
            // Only add if not already added as a non-preview (prevents duplicate if diff is 1)
            groups[1].items.push({ task, isPreview: (diff !== 1) });
        }

        // 3. LATER section
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
        
        // Header
        let headerPrefix = '';
        if (group.id === 'today' && groups[0].items.length > 0) {
            const allDone = groups[0].items.every(item => isSameDay(item.task.lastDone, todayISO));
            if (allDone) headerPrefix = '<span class="header-checkmark">✅</span>';
        }

        const titleDiv = document.createElement('div');
        titleDiv.className = 'agenda-section-title';
        titleDiv.innerHTML = `${headerPrefix}${group.title}`;
        sectionContainer.appendChild(titleDiv);

        // Drop Target Logic for the entire section
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
                card.draggable = true;
                card.addEventListener('dragstart', () => {
                    draggedId = task.id;
                    card.classList.add('dragging');
                });
                card.addEventListener('dragend', () => card.classList.remove('dragging'));

                if (group.id === 'today' && !isPreview && !isDoneToday) {
                    card.classList.add('clickable');
                    card.onclick = () => {
                        triggerClickEffect(card);
                        setTimeout(() => markAsDone(task.id), 150);
                    };
                } else {
                    card.classList.add('non-interactive');
                    card.onclick = null; // Explicitly no click
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
                    statusText = ''; // Removed "Tomorrow" text as requested
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
                             onclick="event.stopPropagation(); triggerClickEffect(this); setTimeout(() => ${isChecked ? `undoItem(${task.id})` : `markAsDone(${task.id})`}, 150)">
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

    // Save state for undo
    sessionHistory.set(id, { ...tasks[index] });

    const newDate = new Date();
    if (targetGroupId === 'tomorrow') {
        newDate.setDate(newDate.getDate() + 1);
    }
    newDate.setHours(0, 0, 0, 0);

    tasks[index].nextDue = newDate.toISOString();

    // Crucial: Reset done state when moving to a different day
    // This allows re-marking it as done on the new day.
    tasks[index].lastDone = null; 

    saveTasks();
    render();
}

window.markAsDone = function(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        sessionHistory.set(id, { ...tasks[index] });
        const today = new Date();
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        tasks[index].nextDue = today.toISOString();
        tasks[index].lastDone = null; 
    }
    saveTasks();
    render();
};
