const START_YEAR = 2024;
const START_MONTH = 6; // June
const TOTAL_MONTHS = 72; // 6 Years

const colorMap = { "UNC": "#7BAFD4", "Duke": "#003087", "NCSU": "#CC0000", "NCPR": "#555555" };
let staffData = [];

async function loadInitialData() {
    try {
        const response = await fetch('default_dat.json');
        if (response.ok) staffData = await response.json();
    } catch (e) { console.error("No default file found."); }
    renderGantt();
    setTimeout(snapToPresent, 500);
}

function getMonthIndex(dateStr) {
    if (!dateStr) return null;
    let parts = dateStr.split('-');
    let y = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let index = ((y - START_YEAR) * 12) + (m - START_MONTH);
    return index;
}

function renderBlock(start, end, customStyle, label, title, rowNum, id) {
    if (start >= TOTAL_MONTHS || end <= 0 || start >= end) return '';
    let s = Math.max(0, start);
    let e = Math.min(TOTAL_MONTHS, end);
    let width = e - s;
    
    // We wrap the label in the seg-label span which is now sticky in CSS
    return `
        <div class="bar-segment" 
             style="grid-column: ${s + 2} / span ${width}; grid-row: ${rowNum}; ${customStyle}" 
             title="${title}" 
             onclick="editStaff('${id}')">
            <span class="seg-label">${label}</span>
        </div>`;
}

function renderMarker(index, color, label, rowNum, topOffset) {
    if (index < 0 || index >= TOTAL_MONTHS) return '';
    return `<div class="milestone-marker" style="grid-column: ${index + 2}; grid-row: ${rowNum}; border-left-color: ${color};">
                <span class="milestone-label" style="color: ${color}; top: ${topOffset}px;">${label}</span>
            </div>`;
}

function renderGantt() {
    const container = document.getElementById('ganttGridTarget');
    if (!container) return;

    let billets = {};
    staffData.forEach(s => {
        let key = `${s.unit} - ${s.billet}`;
        if (!billets[key]) billets[key] = [];
        billets[key].push(s);
    });

    let totalOfficerRows = 0;
    for (let key in billets) totalOfficerRows += billets[key].length;

    let html = `<div class="gantt-grid">`;
    
    // Academic Year Headers
    html += `<div class="row-label" style="grid-column: 1; grid-row: 1; z-index: 50; background:#ddd;">Academic Year</div>`;
    for(let y=0; y < (TOTAL_MONTHS/12); y++) {
        html += `<div class="gantt-header-years" style="grid-column: ${2 + (y*12)} / span 12; grid-row: 1;">AY ${START_YEAR+y}-${START_YEAR+y+1}</div>`;
    }

    // Month Headers
    html += `<div class="row-label" style="grid-column: 1; grid-row: 2; z-index: 50; background:#eee;">Month</div>`;
    const now = new Date();
    const currentMonthIdx = ((now.getFullYear() - START_YEAR) * 12) + (now.getMonth() - (START_MONTH - 1));

    for (let i = 0; i < TOTAL_MONTHS; i++) {
        let date = new Date(START_YEAR, START_MONTH - 1 + i);
        let m = date.getMonth() + 1;
        let semClass = (m == 6 || m == 7) ? 'summer' : (m >= 8 && m <= 12) ? 'fall' : 'spring';
        let isToday = (i === currentMonthIdx) ? 'today-col' : '';
        
        html += `<div class="gantt-header-months ${semClass} ${isToday}" style="grid-column: ${i+2}; grid-row: 2;">${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear().toString().slice(-2)}</div>`;
        html += `<div class="bg-col ${semClass} ${isToday}" style="grid-column: ${i+2}; grid-row: 3 / span ${Math.max(1, totalOfficerRows + 10)};"></div>`;
    }

    let currentRowNum = 3;
    for (let key in billets) {
        let staffList = billets[key].sort((a, b) => getMonthIndex(a.report) - getMonthIndex(b.report));
        let unit = staffList[0].unit;
        let rowSpan = staffList.length; 
        
        // Pre-calculate presence windows for everyone in the billet to make overlap math easy
        let presenceData = staffList.map(s => {
            let rIdx = getMonthIndex(s.report);
            let tIdx = s.tihe ? getMonthIndex(s.tihe) : rIdx;
            let pIdx = getMonthIndex(s.prd);
            let sbIdx = s.sb ? getMonthIndex(s.sb) : null;
            let termIdx = s.terminal ? getMonthIndex(s.terminal) : null;
            
            let start = Math.max(rIdx, tIdx); // Active at unit after report/TiHE
            let end = sbIdx ?? termIdx ?? pIdx; // Leaves unit for SB/Terminal/PRD
            return { rIdx, tIdx, pIdx, sbIdx, termIdx, start, end };
        });

        html += `<div style="display: contents;">`;
        html += `<div class="row-label" style="grid-column: 1; grid-row: ${currentRowNum} / span ${rowSpan}; border-bottom: 2px solid #ccc;">
                    <span class="unit-badge unit-${unit}">${unit}</span>
                    ${staffList[0].billet}
                 </div>`;
        
        staffList.forEach((s, idx) => {
            let officerRow = currentRowNum + idx;
            let pd = presenceData[idx];

            let inbTurnoverStart = pd.start;
            let inbTurnoverEnd = pd.start;
            let gapStart = null;
            let gapEnd = null;

            // Inbound overlap logic against previous officer
            if (idx > 0) {
                let prev = presenceData[idx - 1];
                if (prev.end > pd.start) {
                    inbTurnoverStart = pd.start;
                    inbTurnoverEnd = Math.min(prev.end, pd.end);
                } else if (prev.end < pd.start) {
                    gapStart = prev.end;
                    gapEnd = pd.start;
                }
            }

            let outTurnoverStart = pd.end;
            let outTurnoverEnd = pd.end;

            // Outbound overlap logic against next officer
            if (idx < staffList.length - 1) {
                let next = presenceData[idx + 1];
                if (pd.end > next.start) {
                    outTurnoverStart = Math.max(pd.start, next.start);
                    outTurnoverEnd = pd.end;
                }
            }

            let soloStart = inbTurnoverEnd;
            let soloEnd = outTurnoverStart;

            // Failsafe for triple-turnover extreme edge cases
            if (soloEnd < soloStart) { soloEnd = soloStart; outTurnoverStart = soloStart; }

            // Styling
            let uColor = colorMap[s.unit] || "#333";
            let opacity = s.name.toLowerCase() === "unknown" ? "opacity: 0.6; border: 2px dashed white;" : "";
            
            let inbStyle = `background: repeating-linear-gradient(45deg, rgba(255,255,255,0.4), rgba(255,255,255,0.4) 4px, ${uColor} 4px, ${uColor} 8px); ${opacity}`;
            let soloStyle = `background: ${uColor}; ${opacity}`;
            let outStyle = `background: repeating-linear-gradient(-45deg, rgba(0,0,0,0.3), rgba(0,0,0,0.3) 4px, ${uColor} 4px, ${uColor} 8px); ${opacity}`;
            let sbStyle = `background: #ffcc00;`;
            let termStyle = `background: #ff9999;`;

            // Draw Gap if it exists
            if (gapStart !== null) html += renderBlock(gapStart, gapEnd, 'background: rgba(255,0,0,0.2); border: 2px dashed red; color: red;', 'GAP', 'Staffing Gap', officerRow, null);

            html += renderBlock(inbTurnoverStart, inbTurnoverEnd, inbStyle, 'Inbound T/O', 'Inbound Turnover Window', officerRow, s.id);
            html += renderBlock(soloStart, soloEnd, soloStyle, s.name, 'Active Billet', officerRow, s.id);
            html += renderBlock(outTurnoverStart, outTurnoverEnd, outStyle, 'Outbound T/O', 'Outbound Turnover Window', officerRow, s.id);
            if (pd.sbIdx !== null) html += renderBlock(pd.sbIdx, pd.termIdx ?? pd.pIdx, sbStyle, 'Skillbridge', 'Skillbridge Window', officerRow, s.id);
            if (pd.termIdx !== null) html += renderBlock(pd.termIdx, pd.pIdx, termStyle, 'Terminal', 'Terminal Leave', officerRow, s.id);
            
            html += renderMarker(pd.rIdx, 'blue', 'Report', officerRow, 2);
            if (s.tihe && pd.tIdx !== pd.rIdx) html += renderMarker(pd.tIdx, 'purple', 'TiHE', officerRow, 14);
            else if (s.tihe) html += renderMarker(pd.tIdx, 'purple', 'TiHE/Rep', officerRow, 14);
            html += renderMarker(pd.pIdx, 'red', 'PRD', officerRow, 26);

            if (idx < rowSpan - 1) {
                html += `<div style="grid-column: 2 / -1; grid-row: ${officerRow}; border-bottom: 1px dashed #ddd; pointer-events: none; z-index: 2;"></div>`;
            }
        });
        currentRowNum += rowSpan;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function snapToPresent() {
    const container = document.getElementById('ganttContainer');
    const now = new Date();
    const currentMonthIndex = ((now.getFullYear() - START_YEAR) * 12) + (now.getMonth() - (START_MONTH - 1));
    const colWidth = container.querySelector('.gantt-header-months').offsetWidth;
    container.scrollTo({ left: (currentMonthIndex * colWidth) - 200, behavior: 'smooth' });
}

function handleScroll() {
    const container = document.getElementById('ganttContainer');
    const btn = document.getElementById('snapBtn');
    btn.style.display = container.scrollLeft > 300 ? 'block' : 'none';
}

// ... Keep your Modal and Export/Import functions from the original code ...
function openAddModal() {
    document.getElementById('staffForm').reset();
    document.getElementById('staffId').value = '';
    document.getElementById('modalTitle').innerText = 'Add Staff Member';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('staffModal').style.display = 'flex';
}

function editStaff(id) {
    if(!id) return;
    let s = staffData.find(x => x.id === id);
    document.getElementById('staffId').value = s.id;
    document.getElementById('staffName').value = s.name;
    document.getElementById('staffUnit').value = s.unit;
    document.getElementById('staffBillet').value = s.billet;
    document.getElementById('staffReport').value = s.report || '';
    document.getElementById('staffTihe').value = s.tihe || '';
    document.getElementById('staffPrd').value = s.prd || '';
    document.getElementById('staffTerminal').value = s.terminal || '';
    document.getElementById('staffSkillbridge').value = s.sb || '';
    document.getElementById('modalTitle').innerText = 'Edit Staff Member';
    document.getElementById('deleteBtn').style.display = 'inline-block';
    document.getElementById('staffModal').style.display = 'flex';
}

function closeModal() { document.getElementById('staffModal').style.display = 'none'; }

document.getElementById('staffForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let id = document.getElementById('staffId').value || Date.now().toString();
    let newData = {
        id: id,
        name: document.getElementById('staffName').value,
        unit: document.getElementById('staffUnit').value,
        billet: document.getElementById('staffBillet').value,
        report: document.getElementById('staffReport').value,
        tihe: document.getElementById('staffTihe').value,
        prd: document.getElementById('staffPrd').value,
        terminal: document.getElementById('staffTerminal').value,
        sb: document.getElementById('staffSkillbridge').value
    };
    let index = staffData.findIndex(x => x.id === id);
    if (index >= 0) staffData[index] = newData;
    else staffData.push(newData);
    closeModal();
    renderGantt();
});

function deleteStaff() {
    let id = document.getElementById('staffId').value;
    staffData = staffData.filter(x => x.id !== id);
    closeModal();
    renderGantt();
}

function exportJSON() {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(staffData));
    let node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", "ncpr_rotation_plan.json");
    document.body.appendChild(node);
    node.click();
    node.remove();
}

function importJSON(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        staffData = JSON.parse(e.target.result);
        renderGantt();
    };
    reader.readAsText(file);
}

window.onload = loadInitialData;
