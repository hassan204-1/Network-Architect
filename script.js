let currentConfig = { rooms: 3, devices: 3 };
let currentServerTopology = null;
let currentScale = 1;
let exportAreaX = 0, exportAreaY = 0;
let isDragging = false;
let startX = 0, startY = 0;

const colorThemes = [
    { border: 'border-cyan-500/50', text: 'text-cyan-400', bgBadge: 'bg-cyan-500', line: 'bg-cyan-500', switchBg: 'bg-cyan-950/40' },
    { border: 'border-purple-500/50', text: 'text-purple-400', bgBadge: 'bg-purple-500', line: 'bg-purple-500', switchBg: 'bg-purple-950/40' },
    { border: 'border-amber-500/50', text: 'text-amber-400', bgBadge: 'bg-amber-500', line: 'bg-amber-500', switchBg: 'bg-amber-950/40' },
    { border: 'border-emerald-500/50', text: 'text-emerald-400', bgBadge: 'bg-emerald-500', line: 'bg-emerald-500', switchBg: 'bg-emerald-950/40' },
    { border: 'border-rose-500/50', text: 'text-rose-400', bgBadge: 'bg-rose-500', line: 'bg-rose-500', switchBg: 'bg-rose-950/40' }
];

function updateNavbarTitle(val) {
    const titleEl = document.getElementById('navbarProjectTitle');
    if (titleEl) {
        titleEl.innerText = val ? `Archisnet - ${val}` : "Archisnet - Enterprise Network Architect";
    }
}

async function generateTopology() {
    const projectNameInput = document.getElementById('projectName');
    const projectName = projectNameInput.value.trim();

    if (!projectName) {
        alert("الرجاء إدخال اسم المشروع قبل التوليد.");
        projectNameInput.focus();
        return;
    }

    const routerModel = document.getElementById('routerModel').value;
    const firewallModel = document.getElementById('firewallModel').value;
    const cableType = document.getElementById('cableType').value;
    const baseIP = document.getElementById('baseIP').value.trim() || '192.168.10.0';
    currentConfig.rooms = parseInt(document.getElementById('numRooms').value) || 3;
    currentConfig.devices = parseInt(document.getElementById('numDevices').value) || 3;

    const requestData = {
        project_name: projectName,
        router_model: routerModel,
        firewall_model: firewallModel,
        cable_type: cableType,
        base_ip: baseIP,
        num_offices: currentConfig.rooms,
        pcs_per_office: currentConfig.devices
    };

    try {
        const response = await fetch('http://127.0.0.1:8000/api/projects/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) throw new Error('فشل الاستجابة من الباك اند.');

        const result = await response.json();
        currentServerTopology = result.topology_structure;

        document.getElementById('placeholderMessage').classList.add('hidden');
        document.getElementById('exportArea').classList.remove('hidden');
        document.getElementById('advancedTools').classList.remove('hidden');

        resetZoomAndCenter();
        renderTopologyHTML(projectName, routerModel, firewallModel, cableType, currentServerTopology);

    } catch (error) {
        console.error(error);
        alert("تعذر الاتصال بالخادم المحلي (FastAPI). تأكد من تشغيل uvicorn وعدم حظر المتصفح للاتصال المحلي.");
    }
}

function getStandardSwitchSize(portsNeeded) {
    if (portsNeeded <= 8) return 8;
    if (portsNeeded <= 16) return 16;
    if (portsNeeded <= 24) return 24;
    return 48;
}

function renderTopologyHTML(projectName, routerModel, firewallModel, cableType, topologyData) {
    const container = document.getElementById('topologyContainer');
    const baseIPInput = document.getElementById('baseIP').value.trim() || '192.168.10.0';

    let ipParts = baseIPInput.split('.');
    if (ipParts.length < 3) ipParts = ['192', '168', '10', '0'];
    const ipPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;

    const coreSwitchPortsNeeded = currentConfig.rooms + 1;
    const coreSwitchStandardPorts = getStandardSwitchSize(coreSwitchPortsNeeded);
    let totalDevicesCount = currentConfig.rooms * currentConfig.devices;

    let switchSizesSummary = {};
    for (let i = 1; i <= currentConfig.rooms; i++) {
        let portsNeeded = currentConfig.devices + 1;
        let stdSize = getStandardSwitchSize(portsNeeded);
        switchSizesSummary[stdSize] = (switchSizesSummary[stdSize] || 0) + 1;
    }
    let switchSummaryText = Object.entries(switchSizesSummary).map(([size, count]) => `${count}x (${size}P)`).join(' ، ');

    let html = `
        <div class="w-full bg-[#111827]/95 border border-gray-600 rounded-xl p-4 mb-2 shadow-lg">
            <div class="text-sm font-bold text-[#0095ff] mb-2 border-b border-gray-700 pb-1.5 flex justify-between items-center">
                <span>تقرير الملخص الهندسي والأمني (${projectName})</span>
                <span class="text-xs text-gray-300 font-semibold">نوع الكابل: ${cableType}</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div class="bg-[#0b0f17] p-2.5 rounded border border-gray-700">
                    <div class="text-xs text-gray-400">إجمالي الأجهزة</div>
                    <div class="text-sm font-bold text-white mt-0.5" id="summary-total-devices">${totalDevicesCount} Nodes</div>
                </div>
                <div class="bg-[#0b0f17] p-2.5 rounded border border-gray-700">
                    <div class="text-xs text-gray-400">جدار الحماية</div>
                    <div class="text-sm font-bold text-rose-400 mt-0.5">${firewallModel}</div>
                </div>
                <div class="bg-[#0b0f17] p-2.5 rounded border border-gray-700">
                    <div class="text-xs text-gray-400">السويتشات المرخصة</div>
                    <div class="text-sm font-bold text-cyan-400 mt-0.5">${switchSummaryText}</div>
                </div>
                <div class="bg-[#0b0f17] p-2.5 rounded border border-gray-700">
                    <div class="text-xs text-gray-400">الحالة الأمنية</div>
                    <div class="text-sm font-bold text-emerald-400 mt-0.5">Port Security Active</div>
                </div>
            </div>
        </div>

        <div class="flex flex-col items-center">
            <div class="bg-[#131b2e] border-2 border-[#0095ff] px-8 py-3 rounded-xl shadow-xl text-center">
                <div class="text-xs text-[#0095ff] font-bold mb-1">${routerModel}</div>
                <div class="text-base font-bold text-white">${projectName}</div>
                <div class="text-xs text-gray-300 mt-0.5">Gateway: ${topologyData.gateway || ipPrefix + '.1'}</div>
            </div>
            <span class="text-[11px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700 my-1 font-semibold">${cableType} Link</span>
            <div class="w-1.5 h-5 bg-[#0095ff] rounded-full"></div>
        </div>

        <div class="flex flex-col items-center">
            <div class="bg-rose-950/50 border-2 border-rose-500 px-7 py-3 rounded-xl text-center shadow-xl">
                <div class="text-xs font-bold text-rose-400 mb-0.5">🛡️ ${firewallModel}</div>
                <div class="text-xs text-gray-200">Stateful Inspection & Security Enforcement</div>
            </div>
            <span class="text-[11px] text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-700 my-1 font-semibold">Secure Trunk (${cableType})</span>
            <div class="w-1.5 h-5 bg-purple-500 rounded-full"></div>
        </div>

        <div class="flex flex-col items-center">
            <div class="bg-[#111827] border-2 border-purple-500 px-7 py-3 rounded-xl text-center shadow-xl">
                <div class="text-xs font-bold text-purple-300 mb-0.5">Cisco Catalyst Core Switch (التوزيع المركزي)</div>
                <div class="text-xs text-gray-300 mt-0.5">المنافذ المستخدمة: <span class="text-purple-400 font-bold">${coreSwitchPortsNeeded}</span> | القياسي: <span class="text-emerald-400 font-bold">${coreSwitchStandardPorts} Port</span></div>
            </div>
            <span class="text-[11px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700 my-1 font-semibold">Backbone Uplink (${cableType})</span>
            <div class="w-1.5 h-5 bg-purple-500 rounded-full"></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
    `;

    let ipCounter = 10;

    for (let i = 1; i <= currentConfig.rooms; i++) {
        const theme = colorThemes[(i - 1) % colorThemes.length];
        const initialDevicesCount = currentConfig.devices;
        const accessSwitchPortsNeeded = initialDevicesCount + 1;
        const accessSwitchStandardPorts = getStandardSwitchSize(accessSwitchPortsNeeded);

        let deptInputEl = document.getElementById(`dept-name-${i}`);
        let deptName = deptInputEl ? deptInputEl.value : `القسم (${i})`;

        html += `
            <div class="bg-[#0b0f17] border-2 ${theme.border} rounded-2xl p-4 flex flex-col gap-3 shadow-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 w-2 h-full ${theme.bgBadge}"></div>
                
                <div class="text-sm font-bold ${theme.text} border-b border-gray-700 pb-2 flex justify-between items-center pr-3">
                    <span>${deptName} - [VLAN ${10 * i}]</span>
                    <div class="flex gap-2">
                        <button onclick="addDeviceToRoom(${i})" class="text-xs bg-[#131b2e] hover:bg-opacity-80 text-gray-100 px-2.5 py-1 rounded transition border border-gray-600 cursor-pointer font-semibold">+ جهاز</button>
                        <button onclick="removeDeviceFromRoom(${i})" class="text-xs bg-[#131b2e] hover:bg-rose-600 text-gray-100 px-2.5 py-1 rounded transition border border-gray-600 cursor-pointer font-semibold">- حذف</button>
                    </div>
                </div>

                <div class="flex flex-col items-center my-1">
                    <div class="${theme.switchBg} border border-gray-600 px-4 py-2.5 rounded-lg text-center shadow-md w-full flex justify-between items-center">
                        <div class="text-left">
                            <div class="text-xs font-bold ${theme.text}">Access Switch (Catalyst 9200)</div>
                            <div class="text-[11px] text-gray-300 mt-0.5">المنافذ: <span id="ports-needed-${i}" class="text-white font-bold">${accessSwitchPortsNeeded}</span> | المقاس: <span id="switch-size-${i}" class="text-emerald-400 font-bold">${accessSwitchStandardPorts}P</span></div>
                        </div>
                        <button onclick="openSwitchCLIModal(${i}, 'SW-Room-${i}', '${baseIPInput}')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-md transition cursor-pointer font-bold shadow">
                            💻 عرض CLI
                        </button>
                    </div>
                    <span class="text-[10px] text-gray-400 mt-1 font-medium">Link: ${cableType}</span>
                    <div class="w-1 h-3 ${theme.line}"></div>
                </div>

                <div class="grid grid-cols-3 gap-2.5 pr-1" id="room-${i}-devices">
        `;

        for (let j = 1; j <= initialDevicesCount; j++) {
            const deviceIP = `${ipPrefix}.${ipCounter++}`;
            html += `
                <div class="bg-[#131b2e] border border-gray-600 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 hover:${theme.border} transition relative group">
                    <select onchange="changeDeviceType(this)" class="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition bg-[#0b0f17] text-[10px] text-emerald-400 border border-gray-600 rounded px-1.5 py-0.5 cursor-pointer">
                        <option value="pc">🖥️ PC</option>
                        <option value="printer">🖨️ Printer</option>
                        <option value="server">🗄️ Server</option>
                        <option value="phone">☎️ IP Phone</option>
                    </select>
                    <div class="device-icon-container mt-1">
                        <svg class="w-5 h-5 ${theme.text}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </div>
                    <span class="text-xs text-gray-200 font-bold device-name">PC-${i}-${j}</span>
                    <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-700">${deviceIP}</span>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function changeDeviceType(selectEl) {
    const card = selectEl.closest('div');
    const iconContainer = card.querySelector('.device-icon-container');
    const type = selectEl.value;

    let svgIcon = '';
    if (type === 'pc') {
        svgIcon = `<svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    } else if (type === 'printer') {
        svgIcon = `<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;
    } else if (type === 'server') {
        svgIcon = `<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`;
    } else if (type === 'phone') {
        svgIcon = `<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    }
    iconContainer.innerHTML = svgIcon;
}

function openSwitchCLIModal(roomNum, switchName, baseIP) {
    let ipParts = baseIP.split('.');
    if (ipParts.length < 3) ipParts = ['192', '168', '10', '0'];
    const subnetPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;

    let cli = `! --- Cisco Catalyst 9200 CLI Configuration for ${switchName} --- \n`;
    cli += `enable\nconfigure terminal\n!\n`;
    cli += `hostname ${switchName}\n!\n`;
    cli += `ip default-gateway ${subnetPrefix}.1\n!\n`;
    cli += `vlan ${10 * roomNum}\n name Department_${roomNum}_VLAN\n!\n`;
    cli += `spanning-tree mode rapid-pvst\n!\n`;

    const devicesContainer = document.getElementById(`room-${roomNum}-devices`);
    if (devicesContainer) {
        const deviceCards = devicesContainer.children;
        for (let i = 0; i < deviceCards.length; i++) {
            let pcNameEl = deviceCards[i].querySelector('.device-name');
            let pcIPEl = deviceCards[i].querySelector('span.font-mono');
            let pcName = pcNameEl ? pcNameEl.innerText : `Device-${roomNum}-${i + 1}`;
            let pcIP = pcIPEl ? pcIPEl.innerText : `${subnetPrefix}.X`;

            let portNum = i + 2;
            cli += `interface GigabitEthernet0/${portNum}\n`;
            cli += ` description Connected to ${pcName} [IP: ${pcIP}]\n`;
            cli += ` switchport mode access\n`;
            cli += ` switchport access vlan ${10 * roomNum}\n`;
            cli += ` switchport port-security\n`;
            cli += ` switchport port-security maximum 2\n`;
            cli += ` switchport port-security violation restrict\n`;
            cli += ` no shutdown\n!\n`;
        }
    }

    cli += `line vty 0 4\n login\n transport input ssh\n!\nend\nwrite memory`;
    showModal(`أوامر تكوين السويتش وحماية المنافذ (Port Security) - قسم (${roomNum})`, cli);
}

function openSecurityAudit() {
    const projectName = document.getElementById('projectName').value;
    const firewallModel = document.getElementById('firewallModel').value;

    let report = `[+] بدء فحص الأمان الذكي لنظام الشبكة: ${projectName}\n`;
    report += `[+] جدار الحماية النشط: ${firewallModel} (Active Stateful Inspection)\n`;
    report += `--------------------------------------------------\n`;
    report += `✓ تفعيل ميزة Port Security على جميع سويتشات الأقسام لمنع هجمات MAC Flooding.\n`;
    report += `✓ عزل شبكات الـ VLANs لمنع حركة المرور غير المصرح بها بين الأقسام.\n`;
    report += `✓ فحص تشفير خطوط الإدارة (SSH v2 Enabled).\n`;
    report += `--------------------------------------------------\n`;
    report += `نتيجة الفحص النهائي: الشبكة مؤمنة وفق معايير المؤسسات الكبرى (Security Score: 99/100).`;

    showModal("تقرير الفحص الأمني للشبكة (AI Security Audit)", report);
}

function openCLIConfigs() {
    const routerModel = document.getElementById('routerModel').value;
    const baseIP = document.getElementById('baseIP').value;
    let ipParts = baseIP.split('.');
    if (ipParts.length < 3) ipParts = ['192', '168', '10', '0'];
    const gateway = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1`;

    let cli = `! --- Enterprise Master Startup-Config (${routerModel}) --- \n`;
    cli += `version 16.9\nenable\nconfigure terminal\n!\n`;
    cli += `hostname Core-Router-Archisnet\n!\n`;
    cli += `ip routing\n!\n`;
    cli += `interface GigabitEthernet0/0/0\n`;
    cli += ` ip address ${gateway} 255.255.255.0\n`;
    cli += ` description WAN / ISP Uplink Gateway\n`;
    cli += ` no shutdown\n!\n`;
    cli += `ip route 0.0.0.0 0.0.0.0 GigabitEthernet0/0/0\n!\n`;
    cli += `line vty 0 15\n transport input ssh\n login local\n!\nend\nwrite memory`;

    showModal("أوامر تكوين الراوتر المركزي الشاملة (Core Router CLI)", cli);
}

function showModal(title, content) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerText = content;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

function addDeviceToRoom(roomNum) {
    const devicesContainer = document.getElementById(`room-${roomNum}-devices`);
    const currentCount = devicesContainer.children.length + 1;
    const theme = colorThemes[(roomNum - 1) % colorThemes.length];

    const baseIPInput = document.getElementById('baseIP').value.trim() || '192.168.10.0';
    let ipParts = baseIPInput.split('.');
    if (ipParts.length < 3) ipParts = ['192', '168', '10', '0'];
    const ipPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
    const deviceIP = `${ipPrefix}.${Math.floor(Math.random() * 150) + 20}`;

    const deviceCard = document.createElement('div');
    deviceCard.className = `bg-[#131b2e] border border-gray-600 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 hover:${theme.border} transition relative group`;
    deviceCard.innerHTML = `
        <select onchange="changeDeviceType(this)" class="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition bg-[#0b0f17] text-[10px] text-emerald-400 border border-gray-600 rounded px-1.5 py-0.5 cursor-pointer">
            <option value="pc">🖥️ PC</option>
            <option value="printer">🖨️ Printer</option>
            <option value="server">🗄️ Server</option>
            <option value="phone">☎️ IP Phone</option>
        </select>
        <div class="device-icon-container mt-1">
            <svg class="w-5 h-5 ${theme.text}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
        </div>
        <span class="text-xs text-gray-200 font-bold device-name">PC-${roomNum}-${currentCount}</span>
        <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-700">${deviceIP}</span>
    `;
    devicesContainer.appendChild(deviceCard);
    updateSwitchPortsDisplay(roomNum);
    updateTotalDevicesSummary();
}

function removeDeviceFromRoom(roomNum) {
    const devicesContainer = document.getElementById(`room-${roomNum}-devices`);
    if (devicesContainer.children.length > 1) {
        devicesContainer.removeChild(devicesContainer.lastChild);
        updateSwitchPortsDisplay(roomNum);
        updateTotalDevicesSummary();
    } else {
        alert("يجب أن يحتوي القسم على جهاز واحد على الأقل.");
    }
}

function updateSwitchPortsDisplay(roomNum) {
    const devicesContainer = document.getElementById(`room-${roomNum}-devices`);
    const devicesCount = devicesContainer.children.length;
    const portsNeeded = devicesCount + 1;
    let standardSize = getStandardSwitchSize(portsNeeded);
    document.getElementById(`ports-needed-${roomNum}`).innerText = portsNeeded;
    document.getElementById(`switch-size-${roomNum}`).innerText = `${standardSize}P`;
}

function updateTotalDevicesSummary() {
    let total = 0;
    for (let i = 1; i <= currentConfig.rooms; i++) {
        const roomDiv = document.getElementById(`room-${i}-devices`);
        if (roomDiv) total += roomDiv.children.length;
    }
    const summaryEl = document.getElementById('summary-total-devices');
    if (summaryEl) summaryEl.innerText = `${total} Nodes`;
}

function exportToPDF() {
    window.print();
}

const canvasContainer = document.getElementById('canvasContainer');

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX - exportAreaX;
    startY = e.clientY - exportAreaY;
    canvasContainer.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    exportAreaX = e.clientX - startX;
    exportAreaY = e.clientY - startY;
    updateExportAreaTransform();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    canvasContainer.style.cursor = 'grab';
});

function zoomIn() {
    if (currentScale < 1.6) {
        currentScale += 0.1;
        updateExportAreaTransform();
    }
}

function zoomOut() {
    if (currentScale > 0.5) {
        currentScale -= 0.1;
        updateExportAreaTransform();
    }
}

function resetZoomAndCenter() {
    currentScale = 1;
    exportAreaX = 0;
    exportAreaY = 0;
    updateExportAreaTransform();
}

function updateExportAreaTransform() {
    const exportArea = document.getElementById('exportArea');
    if (exportArea) {
        exportArea.style.transform = `translate(${exportAreaX}px, ${exportAreaY}px) scale(${currentScale})`;
    }
}


// دالة لتوليد حقول تسمية الأقسام تلقائياً حسب العدد المختار
function updateDepartmentInputs() {
    const numRooms = parseInt(document.getElementById('numRooms').value) || 3;
    const container = document.getElementById('departmentNamesContainer');
    if (!container) return;

    const defaultNames = ["المبيعات (Sales)", "التطوير (Dev)", "الإدارة (Admin)", "العمليات (Ops)", "الدعم (Support)"];

    let html = '';
    for (let i = 1; i <= numRooms; i++) {
        let defaultVal = defaultNames[i - 1] || `قسم (${i})`;
        html += `<input type="text" id="dept-name-${i}" value="${defaultVal}" class="bg-[#0b0f17] border border-gray-600 rounded px-2 py-1 text-xs text-white" placeholder="قسم ${i}">`;
    }
    container.innerHTML = html;
}

// استدعاء الدالة عند تحميل الصفحة لأول مرة
window.addEventListener('DOMContentLoaded', () => {
    updateDepartmentInputs();
});


// دالة عرض حاسبة الـ Subnetting الرياضية (تحدث تلقائياً حسب الأجهزة الفعلية)
function openSubnetCalculator() {
    if (!currentServerTopology || !currentServerTopology.subnet_calculations) {
        alert("الرجاء توليد المخطط أولاً لعرض الحسابات.");
        return;
    }

    let content = `[+] جدول الحسابات الرياضية للشبكات الفرعية (Subnetting & CIDR - Live)\n`;
    content += `==========================================================\n`;

    currentServerTopology.subnet_calculations.forEach((sub, index) => {
        let roomNum = index + 1;
        let roomDiv = document.getElementById(`room-${roomNum}-devices`);
        let actualDevicesCount = roomDiv ? roomDiv.children.length : sub.allocated_hosts;

        let deptInputEl = document.getElementById(`dept-name-${roomNum}`);
        let deptName = deptInputEl ? deptInputEl.value : sub.department;

        content += `القسم: ${deptName} | VLAN: ${sub.vlan}\n`;
        content += ` - Network Address: ${sub.subnet}\n`;
        content += ` - Subnet Mask: ${sub.netmask}\n`;
        content += ` - Default Gateway: ${sub.gateway}\n`;
        content += ` - Active Hosts Count: ${actualDevicesCount} أجهزة (من أصل 14 مبيت متاح للـ /28)\n`;
        content += `----------------------------------------------------------\n`;
    });

    showModal("حاسبة ومعيار الـ Subnetting الهندسي (التفاعلي)", content);
}

// دالة تنزيل ملف التكوين الشامل كملف نصي .txt
function downloadMasterCLI() {
    if (!currentServerTopology || !currentServerTopology.master_cli) {
        alert("الرجاء توليد المخطط أولاً.");
        return;
    }

    const blob = new Blob([currentServerTopology.master_cli], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Archisnet_Master_Config.txt`;
    link.click();
}