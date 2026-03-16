// Supabase config
const SUPABASE_URL = 'https://liyuifrrlnslbthbvutg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DMXbM1vUQNJy8YKAKsMmiQ_ZSAzGdA-';

const PAGE_SIZE = 30;
const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_NAMES_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// State
let tournaments = [];
let clubs = {};
let displayCount = PAGE_SIZE;
let currentView = 'calendar';
let currentWeekStart = getMonday(new Date());
let activeFilters = {
    region: '',
    format: '',
    fee: 'all',
    slots: 'all',
};
let sortBy = 'date_asc';

// ─── Supabase REST ──────────────────────────────
async function supabaseQuery(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const resp = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
    });
    if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
    return resp.json();
}

// ─── Data loading ───────────────────────────────
async function loadData() {
    document.getElementById('tournamentList').innerHTML =
        '<div class="loading">Turniere werden geladen...</div>';

    try {
        const [tournamentData, clubData] = await Promise.all([
            supabaseQuery('tournaments', 'select=*&order=date_start.asc&limit=5000'),
            supabaseQuery('golf_clubs', 'select=id,name,city,region,latitude,longitude'),
        ]);

        clubData.forEach(c => { clubs[c.id] = c; });
        tournaments = tournamentData;
        render();
    } catch (err) {
        console.error(err);
        document.getElementById('tournamentList').innerHTML =
            '<div class="empty-state"><h3>Fehler beim Laden</h3><p>' + err.message + '</p></div>';
    }
}

// ─── Filtering (shared by both views) ───────────
function filterTournaments(dateFrom, dateTo) {
    const today = new Date().toISOString().split('T')[0];

    return tournaments.filter(t => {
        // Only upcoming
        if (t.date_start < today) return false;

        // Date range
        if (dateFrom && t.date_start < dateFrom) return false;
        if (dateTo && t.date_start > dateTo) return false;

        // Region
        if (activeFilters.region) {
            const club = clubs[t.club_id];
            if (!club || club.region !== activeFilters.region) return false;
        }

        // Format
        if (activeFilters.format && t.format !== activeFilters.format) return false;

        // Fee
        if (activeFilters.fee !== 'all') {
            const maxFee = parseInt(activeFilters.fee);
            if (maxFee === 0 && t.entry_fee && t.entry_fee > 0) return false;
            if (maxFee > 0 && t.entry_fee && t.entry_fee > maxFee) return false;
        }

        // Slots
        if (activeFilters.slots === 'yes') {
            const raw = t.raw_data || {};
            if (raw.free_slots !== null && raw.free_slots !== undefined && raw.free_slots <= 0) return false;
        }

        return true;
    });
}

// ─── Render dispatcher ──────────────────────────
function render() {
    if (currentView === 'calendar') {
        renderCalendar();
    } else {
        renderList();
    }
    updateFilterBadge();
}

// ─── Calendar View ──────────────────────────────
function renderCalendar() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const fromStr = toISO(currentWeekStart);
    const toStr = toISO(weekEnd);

    // Update week label
    const weekNum = getWeekNumber(currentWeekStart);
    document.getElementById('weekLabel').textContent =
        `${formatDateShort(currentWeekStart)} – ${formatDateShort(weekEnd)}`;

    // Filter tournaments for this week
    const filtered = filterTournaments(fromStr, toStr);

    // Group by date
    const byDate = {};
    filtered.forEach(t => {
        if (!byDate[t.date_start]) byDate[t.date_start] = [];
        byDate[t.date_start].push(t);
    });

    // Build 7 day columns
    const board = document.getElementById('weekBoard');
    let html = '';

    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const dateStr = toISO(date);
        const isToday = dateStr === toISO(new Date());
        const isWeekend = i >= 5;
        const dayTournaments = byDate[dateStr] || [];

        html += `
            <div class="day-column">
                <div class="day-header ${isToday ? 'today' : ''} ${isWeekend && !isToday ? 'weekend' : ''}">
                    <div class="day-name">${DAY_NAMES[i]}</div>
                    <div class="day-date">${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.</div>
                </div>
                <div class="day-body ${isWeekend ? 'weekend' : ''}">
                    ${dayTournaments.length === 0
                        ? '<div class="day-empty">—</div>'
                        : dayTournaments.map(renderCalCard).join('')
                    }
                </div>
            </div>`;
    }

    board.innerHTML = html;

    // On mobile, scroll to today or first day with tournaments
    if (window.innerWidth < 768) {
        const todayStr = toISO(new Date());
        let scrollToIdx = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            if (toISO(date) === todayStr) { scrollToIdx = i; break; }
            if (byDate[toISO(date)] && scrollToIdx === 0) scrollToIdx = i;
        }
        const cols = board.querySelectorAll('.day-column');
        if (cols[scrollToIdx]) {
            cols[scrollToIdx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        }
    }
}

function renderCalCard(t) {
    const club = clubs[t.club_id];
    const clubName = club ? club.name : '';
    const raw = t.raw_data || {};
    const formatLabel = formatToLabel(t.format);

    let tags = '';
    if (formatLabel) tags += `<span class="cal-tag">${formatLabel}</span>`;
    if (t.entry_fee) tags += `<span class="cal-tag fee">${t.entry_fee} €</span>`;
    if (raw.prizes && raw.prizes.length > 0) {
        tags += `<span class="cal-tag prize">🏆 Preise</span>`;
    }
    if (raw.free_slots !== null && raw.free_slots !== undefined && raw.max_participants) {
        tags += `<span class="cal-tag slots">${raw.free_slots}/${raw.max_participants}</span>`;
    }

    const onclick = t.source_url ? `onclick="window.open('${t.source_url}', '_blank')"` : '';

    return `
        <div class="cal-card" ${onclick}>
            <div class="cal-card-name">${escapeHtml(t.name)}</div>
            <div class="cal-card-club">${escapeHtml(clubName)}</div>
            <div class="cal-card-meta">${tags}</div>
        </div>`;
}

// ─── List View ──────────────────────────────────
function renderList() {
    const filtered = sortTournaments(filterTournaments(null, null));
    const visible = filtered.slice(0, displayCount);

    document.getElementById('resultCount').textContent =
        `${filtered.length} Turnier${filtered.length !== 1 ? 'e' : ''}`;

    const list = document.getElementById('tournamentList');
    if (visible.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <h3>Keine Turniere gefunden</h3>
                <p>Versuche andere Filter oder einen anderen Zeitraum.</p>
            </div>`;
    } else {
        list.innerHTML = visible.map(renderListCard).join('');
    }

    const loadMoreEl = document.getElementById('loadMore');
    if (filtered.length > displayCount) {
        loadMoreEl.classList.remove('hidden');
        document.getElementById('loadMoreBtn').textContent =
            `Mehr laden (${filtered.length - displayCount} weitere)`;
    } else {
        loadMoreEl.classList.add('hidden');
    }
}

function renderListCard(t) {
    const club = clubs[t.club_id];
    const clubName = club ? club.name : '';
    const clubCity = club ? club.city : '';
    const raw = t.raw_data || {};

    const dateStr = formatDateFull(t.date_start);
    const endStr = t.date_end && t.date_end !== t.date_start ? ` – ${formatDateFull(t.date_end)}` : '';
    const formatLabel = formatToLabel(t.format);

    let details = '';
    if (t.entry_fee) {
        details += `<div class="card-detail"><span class="label">Nenngeld</span> <span class="value">${t.entry_fee} €</span></div>`;
    }
    if (raw.max_participants) {
        const slotsText = raw.free_slots !== null && raw.free_slots !== undefined
            ? `${raw.free_slots}/${raw.max_participants} frei`
            : `${raw.max_participants} Plätze`;
        details += `<div class="card-detail"><span class="label">Plätze</span> <span class="value">${slotsText}</span></div>`;
    }
    if (raw.hcp_relevant) {
        details += `<div class="card-detail"><span class="value">HCP-relevant</span></div>`;
    }
    if (raw.spielform) {
        details += `<div class="card-detail"><span class="label">Spielform</span> <span class="value">${raw.spielform}</span></div>`;
    }

    let prizesHtml = '';
    if (raw.prizes && raw.prizes.length > 0) {
        const prizeText = raw.prizes.map(p => {
            if (p.count > 1) return `${p.count}x ${p.category}`;
            return p.category;
        }).join(', ');
        prizesHtml = `<div class="card-prizes"><span class="prize-icon">🏆</span><span class="prize-label">Preise:</span> ${prizeText}</div>`;
    }

    const onclick = t.source_url ? `onclick="window.open('${t.source_url}', '_blank')"` : '';

    return `
        <div class="tournament-card" ${onclick}>
            <div class="card-top">
                <span class="card-date">${dateStr}${endStr}</span>
                ${formatLabel ? `<span class="card-format">${formatLabel}</span>` : ''}
            </div>
            <div class="card-name">${escapeHtml(t.name)}</div>
            <div class="card-club">${escapeHtml(clubName)}${clubCity ? ` · ${escapeHtml(clubCity)}` : ''}</div>
            ${details ? `<div class="card-details">${details}</div>` : ''}
            ${prizesHtml}
        </div>`;
}

function sortTournaments(list) {
    return [...list].sort((a, b) => {
        if (sortBy === 'date_asc') return a.date_start.localeCompare(b.date_start);
        if (sortBy === 'date_desc') return b.date_start.localeCompare(a.date_start);
        if (sortBy === 'fee_asc') return (a.entry_fee || 0) - (b.entry_fee || 0);
        return 0;
    });
}

// ─── Helpers ────────────────────────────────────
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function toISO(d) {
    return d.toISOString().split('T')[0];
}

function getWeekNumber(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function formatDateShort(d) {
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

function formatDateFull(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return `${days[d.getDay()]}, ${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

function formatToLabel(format) {
    const labels = {
        stableford: 'Stableford',
        strokeplay: 'Zählspiel',
        matchplay: 'Lochspiel',
        scramble: 'Scramble',
        texas_scramble: 'Texas Scramble',
        best_ball: 'Best Ball',
        chapman: 'Chapman',
        vierer: 'Vierer',
        other: 'Sonstige',
    };
    return labels[format] || '';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function countActiveFilters() {
    let count = 0;
    if (activeFilters.region) count++;
    if (activeFilters.format) count++;
    if (activeFilters.fee !== 'all') count++;
    if (activeFilters.slots !== 'all') count++;
    return count;
}

function updateFilterBadge() {
    const activeCount = countActiveFilters();
    const countEl = document.getElementById('filterCount');
    countEl.textContent = activeCount;
    countEl.classList.toggle('visible', activeCount > 0);
}

// ─── Event listeners ────────────────────────────
function initEvents() {
    // View toggle
    document.getElementById('viewCalendar').addEventListener('click', () => {
        currentView = 'calendar';
        document.getElementById('viewCalendar').classList.add('active');
        document.getElementById('viewList').classList.remove('active');
        document.getElementById('calendarView').classList.remove('hidden');
        document.getElementById('listView').classList.add('hidden');
        render();
    });

    document.getElementById('viewList').addEventListener('click', () => {
        currentView = 'list';
        document.getElementById('viewList').classList.add('active');
        document.getElementById('viewCalendar').classList.remove('active');
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('calendarView').classList.add('hidden');
        render();
    });

    // Week navigation
    document.getElementById('prevWeek').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        render();
    });

    document.getElementById('nextWeek').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        render();
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
        currentWeekStart = getMonday(new Date());
        render();
    });

    // Filter toggle (mobile)
    document.getElementById('filterToggle').addEventListener('click', () => {
        document.getElementById('filterPanel').classList.toggle('open');
    });

    // Chip filters
    document.querySelectorAll('.filter-chips').forEach(group => {
        group.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const filterId = group.id;
                const value = chip.dataset.value;

                if (filterId === 'feeFilter') activeFilters.fee = value;
                else if (filterId === 'slotsFilter') activeFilters.slots = value;

                displayCount = PAGE_SIZE;
                render();
            });
        });
    });

    // Select filters
    document.getElementById('regionFilter').addEventListener('change', e => {
        activeFilters.region = e.target.value;
        displayCount = PAGE_SIZE;
        render();
    });

    document.getElementById('formatFilter').addEventListener('change', e => {
        activeFilters.format = e.target.value;
        displayCount = PAGE_SIZE;
        render();
    });

    // Sort
    document.getElementById('sortBy').addEventListener('change', e => {
        sortBy = e.target.value;
        render();
    });

    // Load more
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        displayCount += PAGE_SIZE;
        render();
    });

    // Reset
    document.getElementById('resetFilters').addEventListener('click', () => {
        activeFilters = { region: '', format: '', fee: 'all', slots: 'all' };
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.chip[data-value="all"]').forEach(c => c.classList.add('active'));
        document.getElementById('regionFilter').value = '';
        document.getElementById('formatFilter').value = '';
        displayCount = PAGE_SIZE;
        render();
    });

    // Keyboard shortcuts for week nav
    document.addEventListener('keydown', e => {
        if (currentView !== 'calendar') return;
        if (e.key === 'ArrowLeft') { currentWeekStart.setDate(currentWeekStart.getDate() - 7); render(); }
        if (e.key === 'ArrowRight') { currentWeekStart.setDate(currentWeekStart.getDate() + 7); render(); }
    });

    // Swipe on mobile for week nav
    let touchStartX = 0;
    const board = document.getElementById('weekBoard');
    board.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    board.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) > 100) {
            if (diff > 0) { currentWeekStart.setDate(currentWeekStart.getDate() - 7); }
            else { currentWeekStart.setDate(currentWeekStart.getDate() + 7); }
            render();
        }
    }, { passive: true });
}

// ─── Init ───────────────────────────────────────
initEvents();
loadData();
