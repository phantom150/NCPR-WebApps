let orgData = [];
let network = null; // Holds the Vis-network instance

document.addEventListener("DOMContentLoaded", () => {
    // Attach listeners to toggles
    document.querySelectorAll('#sidebar input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', render);
    });

    // Fetch the default JSON file on load
    fetch('default_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Could not load default_data.json. Are you running this on a web server?');
            }
            return response.json();
        })
        .then(data => {
            // Ensure legacy data converts parentId to parentIds array just in case
            data.forEach(d => {
                if (d.parentId !== undefined) {
                    d.parentIds = d.parentId ? [d.parentId] : [];
                    delete d.parentId;
                }
            });
            orgData = data;
            render();
        })
        .catch(error => {
            console.warn(error);
            // Fallback to a single node if the JSON fails to load
            orgData = [
                { id: "1", parentIds: [], name: "Error/Missing Data", title: "Default Data Failed to Load", unit: "NCPR", role: "Military" }
            ];
            render();
        });
});

// ... Keep everything from function render() onwards exactly the same ...

function render() {
    updateParentDropdown();
    renderStaffList();
    renderChart();
}

// ... Keep saveStaff, editStaff, deleteStaff, resetForm, updateParentDropdown, renderStaffList EXACTLY as they were in the previous DAG version ...

function saveStaff(e) {
    e.preventDefault();
    const id = document.getElementById('staffId').value || Date.now().toString();
    const parentSelect = document.getElementById('staffParent');
    const selectedParents = Array.from(parentSelect.selectedOptions).map(opt => opt.value).filter(val => val !== "");
    
    if (selectedParents.includes(id)) {
        alert("A staff member cannot report to themselves.");
        return;
    }

    const newNode = {
        id: id,
        parentIds: selectedParents,
        name: document.getElementById('staffName').value,
        title: document.getElementById('staffTitle').value,
        unit: document.getElementById('staffUnit').value,
        role: document.getElementById('staffRole').value
    };

    const existingIndex = orgData.findIndex(d => d.id === id);
    if (existingIndex >= 0) {
        orgData[existingIndex] = newNode;
    } else {
        orgData.push(newNode);
    }
    resetForm();
    render();
}

function editStaff(id) {
    const staff = orgData.find(d => d.id === id);
    if (!staff) return;
    document.getElementById('staffId').value = staff.id;
    document.getElementById('staffName').value = staff.name;
    document.getElementById('staffTitle').value = staff.title;
    document.getElementById('staffUnit').value = staff.unit;
    document.getElementById('staffRole').value = staff.role;
    updateParentDropdown(staff.id);
    const parentSelect = document.getElementById('staffParent');
    Array.from(parentSelect.options).forEach(opt => {
        opt.selected = staff.parentIds.includes(opt.value);
    });
    document.getElementById('formTitle').innerText = "Edit Staff";
    document.getElementById('saveBtn').innerText = "Update Staff";
}

function deleteStaff(id) {
    if (confirm("Are you sure? Any sub-staff reporting solely to this person will be moved to the root level.")) {
        orgData.forEach(d => { d.parentIds = d.parentIds.filter(pid => pid !== id); });
        orgData = orgData.filter(d => d.id !== id);
        render();
    }
}

function resetForm() {
    document.getElementById('staffForm').reset();
    document.getElementById('staffId').value = "";
    document.getElementById('formTitle').innerText = "Add New Staff";
    document.getElementById('saveBtn').innerText = "Add Staff";
    const parentSelect = document.getElementById('staffParent');
    Array.from(parentSelect.options).forEach(opt => opt.selected = false);
    updateParentDropdown();
}

function updateParentDropdown(excludeId = null) {
    const select = document.getElementById('staffParent');
    const selectedValues = Array.from(select.selectedOptions).map(opt => opt.value);
    select.innerHTML = '<option value="">-- No Parent (Root) --</option>';
    orgData.forEach(d => {
        if (d.id !== excludeId) {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.title} (${d.name})`;
            select.appendChild(opt);
        }
    });
    Array.from(select.options).forEach(opt => {
        if (selectedValues.includes(opt.value)) { opt.selected = true; }
    });
}

function renderStaffList() {
    const list = document.getElementById('staffList');
    list.innerHTML = "";
    orgData.forEach(d => {
        const div = document.createElement('div');
        div.className = 'staff-item';
        div.innerHTML = `
            <span><strong>${d.title}</strong><br><small>${d.name}</small></span>
            <div>
                <button class="btn-edit" onclick="editStaff('${d.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteStaff('${d.id}')">Del</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// NEW: Vis-network Chart Renderer
function renderChart() {
    const container = document.getElementById('mynetwork');
    
    const showDuke = document.getElementById('toggleDuke').checked;
    const showUNC = document.getElementById('toggleUNC').checked;
    const showNCSU = document.getElementById('toggleNCSU').checked;
    const showAdmin = document.getElementById('toggleAdmin').checked;

    const filteredData = orgData.filter(d => {
        if (!showDuke && d.unit === 'Duke') return false;
        if (!showUNC && d.unit === 'UNC') return false;
        if (!showNCSU && d.unit === 'NCSU') return false;
        if (!showAdmin && d.role === 'Admin') return false;
        return true;
    });

    const nodesArray = [];
    const edgesArray = [];

    // Define Unit Colors
    const unitColors = {
        'NCPR': { border: '#34495e', background: '#ecf0f1' },
        'Duke': { border: '#00539B', background: '#e0f0ff' },
        'UNC':  { border: '#4B9CD3', background: '#e6f7ff' },
        'NCSU': { border: '#CC0000', background: '#ffe6e6' }
    };

    filteredData.forEach(d => {
        // Node Styling based on Role and Unit
        let colorConfig = unitColors[d.unit] || { border: '#2c3e50', background: '#ffffff' };
        let shapeConfig = 'box';
        let dashes = false;

        if (d.role === 'Admin') {
            dashes = true; // Make admin borders dashed
            colorConfig.background = '#fffdf5'; // slight yellow tint for admins
        }

        nodesArray.push({
            id: d.id,
            label: `*${d.title}*\n${d.name}\n[${d.unit}]`,
            shape: shapeConfig,
            color: colorConfig,
            borderWidth: 2,
            shapeProperties: { borderDashes: dashes },
            font: { multi: 'md', align: 'center', face: 'Segoe UI' } // enables markdown *bold*
        });

        // Add edges (connecting lines)
        d.parentIds.forEach(pid => {
            // Only draw the line if the parent is ALSO currently visible
            if (filteredData.some(fd => fd.id === pid)) {
                edgesArray.push({
                    from: pid,
                    to: d.id,
                    arrows: 'to',
                    color: { color: '#888888' },
                    smooth: { type: 'cubicBezier', forceDirection: 'vertical' }
                });
            }
        });
    });

    const data = {
        nodes: new vis.DataSet(nodesArray),
        edges: new vis.DataSet(edgesArray)
    };

    const options = {
        layout: {
            hierarchical: {
                direction: 'UD', // Up-Down hierarchy
                sortMethod: 'directed',
                levelSeparation: 120,
                nodeSpacing: 200
            }
        },
        physics: false, // Turn off bouncy physics
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true
        }
    };

    // Destroy existing network to prevent memory leaks and reset layout
    if (network !== null) {
        network.destroy();
    }
    
    network = new vis.Network(container, data, options);
}

function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orgData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "ncpr_org_chart.json");
    dlAnchorElem.click();
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                // Ensure legacy data converts parentId to parentIds array
                importedData.forEach(d => {
                    if (d.parentId !== undefined) {
                        d.parentIds = d.parentId ? [d.parentId] : [];
                        delete d.parentId;
                    }
                });
                orgData = importedData;
                render();
                alert("Data loaded successfully!");
            } else {
                alert("Invalid JSON format.");
            }
        } catch (err) {
            alert("Error parsing JSON file.");
        }
    };
    reader.readAsText(file);
}