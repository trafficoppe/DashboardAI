// 🌟 ใส่ Web App URL ของคุณที่นี่
const API_URL = 'https://script.google.com/macros/s/AKfycbxEa04C1LQcDMolFkXSKmClCC4FrQfi7oNmps4gNCy1Mz09_88snd1ZX7Qq9ACd0jkQ/exec';

let allData = [];
let currentFilteredData = []; 
let currentIncidentIndex = 0; 
let imageInterval = null; 

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates(); 
    fetchDashboardData();

    // กรองข้อมูลใหม่ทันทีเมื่อมีการเปลี่ยนวันที่
    document.getElementById('startDate').addEventListener('change', filterAndProcessData);
    document.getElementById('endDate').addEventListener('change', filterAndProcessData);
});

// 🌟 ตั้งค่าเริ่มต้น: วันที่ 1 ของเดือนปัจจุบัน ถึง วันนี้
function setDefaultDates() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    document.getElementById('startDate').value = `${year}-${month}-01`;
    document.getElementById('endDate').value = `${year}-${month}-${day}`;
}

async function fetchDashboardData() {
    try {
        const response = await fetch(API_URL, { method: 'GET', redirect: 'follow' });
        const result = await response.json();
        
        if (result.status === 'success') {
            allData = result.data.slice(1); 
            filterAndProcessData();
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// 🌟 ฟังก์ชันกรองข้อมูลด้วยช่วงวันที่ (Date Range)
function filterAndProcessData() {
    const startVal = document.getElementById('startDate').value;
    const endVal = document.getElementById('endDate').value;
    
    if (!startVal || !endVal) return;

    const startDate = new Date(startVal);
    startDate.setHours(0,0,0,0);
    const endDate = new Date(endVal);
    endDate.setHours(23,59,59,999);

    currentFilteredData = allData.filter(row => {
        const dateStr = row[6] || ''; 
        if (!dateStr || dateStr === '-') return false;
        
        const normalized = dateStr.replace(/\//g, '-').trim();
        const parts = normalized.split('-');
        let rowDate;
        
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                rowDate = new Date(parts[0], parts[1] - 1, parts[2]); 
            } else {
                rowDate = new Date(parts[2], parts[1] - 1, parts[0]); 
            }
        } else {
            rowDate = new Date(normalized);
        }
        
        return rowDate >= startDate && rowDate <= endDate;
    });

    processStats(currentFilteredData);
    // 🌟 เพิ่มบรรทัดนี้ลงไป 1 บรรทัด เพื่อส่งข้อมูลให้ map.js ทำงาน
    updateAccidentMap(currentFilteredData);
    currentIncidentIndex = 0;
    renderCurrentIncident();
}

// (ฟังก์ชัน processStats คงเดิมตามบริบท)
function processStats(data) {
    let accRoad = 0, accGen = 0, accWork = 0;
    let injRoad = 0, injGen = 0, injWork = 0;
    let injStudent = 0, injStaff = 0, injOutsider = 0, injOutsource = 0, deaths = 0;

    data.forEach(row => {
        const incidentType = row[12] || '';  
        const injuredCount = parseInt(row[20]) || 0; 
        const injuredDetails = row[21] || ''; 

        if (incidentType.includes('ยานพาหนะ') || incidentType.includes('จราจร')) {
            accRoad++; injRoad += injuredCount;
        } else if (incidentType.includes('ทำงาน')) {
            accWork++; injWork += injuredCount;
        } else {
            accGen++; injGen += injuredCount;
        }

        injStudent += (injuredDetails.match(/ประเภท:\s*นักศึกษา/g) || []).length;
        injStaff += (injuredDetails.match(/ประเภท:\s*บุคลากร/g) || []).length;
        injOutsider += (injuredDetails.match(/ประเภท:\s*ภายนอก/g) || []).length;
        injOutsource += (injuredDetails.match(/ประเภท:\s*(Outsource|ผู้รับเหมา)/gi) || []).length;
        deaths += (injuredDetails.match(/เสียชีวิต/g) || []).length;
    });

    document.getElementById('totalAcc').innerText = accRoad + accGen + accWork;
    document.getElementById('accRoad').innerText = accRoad;
    document.getElementById('accGen').innerText = accGen;
    document.getElementById('accWork').innerText = accWork;

    // ... โค้ดส่วนบน (นับจำนวนตามปกติ) ...

    const totalInj = injRoad + injGen + injWork;
    document.getElementById('totalInj').innerText = totalInj;
    document.getElementById('injRoad').innerText = injRoad;
    document.getElementById('injGen').innerText = injGen;
    document.getElementById('injWork').innerText = injWork;

    // 🌟 เปลี่ยนจากการเอา totalInj ไปแสดงตรงๆ เป็นการเอาตัวเลขที่นับได้จริงมาบวกกัน 🌟
    const actualSumTypes = injStudent + injStaff + injOutsider + injOutsource;
    document.getElementById('totalInjType').innerText = actualSumTypes; 
    
    document.getElementById('injStudent').innerText = injStudent;
    document.getElementById('injStaff').innerText = injStaff;
    document.getElementById('injOutsider').innerText = injOutsider;
    document.getElementById('injOutsource').innerText = injOutsource;
    document.getElementById('deaths').innerText = deaths;
}

// แปลงรูปแบบวันที่เป็นภาษาไทย (แบบเต็ม และ แบบย่อ)
function formatThaiDateFull(dateString) {
    if (!dateString || dateString === '-') return '-';
    const parts = dateString.replace(/\//g, '-').split('-'); 
    if (parts.length !== 3) return dateString;

    let y, m, d;
    if (parts[0].length === 4) { y = parseInt(parts[0]); m = parseInt(parts[1]) - 1; d = parseInt(parts[2]); }
    else { y = parseInt(parts[2]); m = parseInt(parts[1]) - 1; d = parseInt(parts[0]); }
    
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${d} ${months[m]} ${y > 2500 ? y : y + 543}`;
}

function formatThaiShortDate(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    if(parts.length !== 3) return dateStr;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parseInt(parts[0]) + 543}`;
}

function parseInjuredDetails(rawText, totalCount) {
    if (!rawText || rawText === '-') return '';
    let sections = rawText.split(/\[คนที่\s*\d+\s*\]/).map(s => s.trim()).filter(s => s !== '');
    let finalHTML = '';

    sections.forEach((item, idx) => {
        // ดึงข้อมูลแต่ละส่วน
        const extract = (regex) => (item.match(regex) || [])[1]?.trim() || '-';
        const type = extract(/ประเภท:\s*([^\n•|]+)/);
        const section = extract(/(?:ส่วนงาน|คณะ\/วิทยาลัย):\s*([^\n•|]+)/) !== '-' ? extract(/(?:ส่วนงาน|คณะ\/วิทยาลัย):\s*([^\n•|]+)/) : extract(/ส่วนงาน:\s*([^\n•|]+)/);
        const name = extract(/ชื่อ:\s*([^\n•|]+)/);
        const symptom = extract(/อาการ:\s*([^\n•|]+)/);

        // 🌟 ใส่ <strong> ให้ตัวหนาที่คำว่า ผู้ได้รับบาดเจ็บเป็น:
        let sentence = `<strong>ผู้ได้รับบาดเจ็บเป็น:</strong> ${type} ของ ${section} ชื่อ ${name} อาการ ${symptom}`;
        
        // ถ้ามีผู้บาดเจ็บมากกว่า 1 คน ให้เติม "คนที่..." ไว้ด้านหน้า
        if (totalCount > 1) {
            sentence = `<strong>คนที่ ${idx + 1}:</strong> ${sentence}`;
        }

        // แสดงผลบรรทัดเดียว พร้อมจัด margin
        finalHTML += `<div style="margin-bottom: 12px; font-size: 1em; line-height: 1.6;">${sentence}</div>`;
    });
    return finalHTML;
}

function renderCurrentIncident() {
    const viewerContainer = document.getElementById('incidentViewer');
    
    if (imageInterval) clearInterval(imageInterval);

    if (currentFilteredData.length === 0) {
        viewerContainer.innerHTML = '<div style="padding: 50px; text-align: center; color: #888; font-size: 1.1em;">ไม่มีข้อมูลเหตุการณ์ในช่วงวันที่เลือก</div>';
        return;
    }

    const row = currentFilteredData[currentIncidentIndex];

    const rawImgUrl = row[28] || ''; 
    let imgUrls = [];
    if (rawImgUrl && rawImgUrl !== '-') {
        imgUrls = rawImgUrl.split(',').map(u => u.trim()).filter(u => u).map(u => {
            const match = u.match(/d\/([a-zA-Z0-9_-]+)/);
            return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1200` : u;
        });
    }
    if (imgUrls.length === 0) imgUrls.push('https://via.placeholder.com/1200x800?text=ไม่มีรูปภาพประกอบ');

    let detailsHTML = '';
    
    const kpiFull = row[29] || ''; 
    const kpiParts = kpiFull.split('|').map(p => p.trim());
    let kpiStatusRaw = kpiParts[0] || 'ไม่มีข้อมูล KPI';
    
    const kpiColor = kpiStatusRaw.includes('✅') ? '#0d703b' : (kpiStatusRaw.includes('❌') ? '#9a1a1a' : '#555');
    let kpiStatus = kpiStatusRaw.replace(/[✅❌]/g, '').trim(); 
    let kpiDesc = kpiParts.length > 1 ? kpiParts.slice(1).join('<br>') : ''; 

    detailsHTML += `<div style="margin-bottom: 8px; font-size: 0.9em;">
        <strong style="color:${kpiColor}; font-size:1.05em;">${kpiStatus}</strong>
        ${kpiDesc ? `<div style="color: #444; margin-top: 3px;">${kpiDesc}</div>` : ''}
    </div>`;

    // 🌟 เปลี่ยน font-size เป็น 1em และ margin-bottom เป็น 12px เพื่อให้อ่านง่ายและมีช่องว่าง
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>วันที่เกิดเหตุ:</strong> ${formatThaiDateFull(row[6])} เวลา ${row[7] || '-'} น.</div>`;
    
    // ... โค้ดส่วนบน ...
    
    const reporterName = row[4] || '-'; 
    const reporterDept = row[5] || '-'; 
    const reportChannel = row[3] || '-'; 
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>รับแจ้งจาก:</strong> ${reporterName} (${reporterDept}) รับแจ้งทาง ${reportChannel}</div>`;
    
// บรรทัดแสดงเหตุการณ์เดิม
    const incidentType = row[12] || '-';
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>เหตุการณ์:</strong> ${incidentType}</div>`;

    // 🌟 1. เช็คว่าเป็นอุบัติเหตุยานพาหนะหรือไม่ 🌟
    if (incidentType.includes('ยานพาหนะ') || incidentType.includes('จราจร')) {
        
        // 🌟 2. ดึงข้อมูลจากคอลัมน์ N, O, P, Q
        const v1 = (row[13] && row[13] !== '-') ? row[13].trim() : '';
        const d1 = (row[14] && row[14] !== '-') ? row[14].trim() : '';
        const v2 = (row[15] && row[15] !== '-') ? row[15].trim() : '';
        const d2 = (row[16] && row[16] !== '-') ? row[16].trim() : '';

        let vehicleText = '';

        // ประกอบข้อความคันที่ 1 (เช่น "รถจักรยานของนักศึกษา")
        if (v1) {
            vehicleText += v1;
            if (d1) vehicleText += `ของ${d1}`;
        }

        // ประกอบข้อความคันที่ 2 หรือ คู่กรณี
        if (v2) {
            // กรณีล้มเอง หรือชนทรัพย์สิน จะไม่มีคนขับคันที่ 2
            if (v2 === 'ล้มเอง' || v2 === 'ชนทรัพย์สิน') {
                vehicleText += ` (${v2})`;
            } else {
                // กรณีมีรถคันที่ 2 (เช่น " ชนกับ รถยนต์ของบุคลากร")
                vehicleText += ` ชนกับ ${v2}`;
                if (d2) vehicleText += `ของ${d2}`;
            }
        }

        // 🌟 3. นำมาแสดงผลใต้ "เหตุการณ์" (ปรับให้เหมือนหัวข้ออื่นๆ)
        if (vehicleText) {
            detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em; color: #333;">
                <strong>ยานพาหนะที่เกิดเหตุ:</strong> ${vehicleText}
            </div>`;
        }
    }

    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>สถานที่:</strong> ${row[10] || '-'}</div>`;

    const hasInjury = row[19] || '-';
    const injuredCount = parseInt(row[20]) || 0;
    if (injuredCount === 0 || hasInjury === 'ไม่มี') {
        detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em; color: #2e7d32;"><strong>ไม่มีผู้ได้รับบาดเจ็บ</strong></div>`;
    } else {
        // 🌟 แยกหัวข้อหลักไว้ 1 บรรทัด แล้วเอาฟังก์ชันมาต่อท้ายตรงๆ ไม่ต้องมี div ครอบ 🌟
        detailsHTML += parseInjuredDetails(row[21] || '', injuredCount);
    }
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>สาเหตุ:</strong> ${row[22] || '-'}</div>`;
    
    let aiSummary = (row[31] && row[31] !== '-') ? row[31] : (row[30] || row[27] || '-');
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;">
        <strong>รายละเอียดเหตุการณ์:</strong><br> 
        <span style="line-height:1.6; display:inline-block; margin-top:6px; word-break: break-word;">${aiSummary}</span>
    </div>`;

    const isPrevDisabled = currentIncidentIndex === 0;
    const isNextDisabled = currentIncidentIndex === currentFilteredData.length - 1;

    const html = `
        <div class="incident-img-container" style="position: relative; background: #e0e0e0; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 350px;">
            <img id="sliderImage" src="${imgUrls[0]}" style="width: 100%; height: 100%; object-fit: contain; transition: opacity 0.8s ease-in-out; opacity: 1;">
            ${imgUrls.length > 1 ? `<div id="sliderCounter" style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.65); color:white; padding:4px 12px; border-radius:20px; font-size:0.75em; font-weight:bold;">รูปภาพ 1 / ${imgUrls.length}</div>` : ''}
        </div>
        
        <div class="incident-details-container" style="padding: 15px 20px;">
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 2px solid #1a237e; padding-bottom: 10px;">
                <button onclick="prevIncident()" ${isPrevDisabled ? 'disabled' : ''} style="background: ${isPrevDisabled ? '#d1d5db' : '#1a237e'}; color: white; border: none; border-radius: 6px; width: 35px; height: 35px; font-size: 1.2em; font-weight: bold; cursor: ${isPrevDisabled ? 'not-allowed' : 'pointer'}; transition: 0.2s;">
                    &lt;
                </button>
                
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 1.1em; color: #1a237e; font-weight: bold;">
                        เหตุการณ์ที่ ${currentIncidentIndex + 1} / ${currentFilteredData.length}
                    </div>
                </div>
                
                <button onclick="nextIncident()" ${isNextDisabled ? 'disabled' : ''} style="background: ${isNextDisabled ? '#d1d5db' : '#1a237e'}; color: white; border: none; border-radius: 6px; width: 35px; height: 35px; font-size: 1.2em; font-weight: bold; cursor: ${isNextDisabled ? 'not-allowed' : 'pointer'}; transition: 0.2s;">
                    &gt;
                </button>
            </div>

            ${detailsHTML}
        </div>
    `;

    viewerContainer.innerHTML = html;

    if (imgUrls.length > 1) {
        let currentImgIdx = 0;
        imageInterval = setInterval(() => {
            const imgEl = document.getElementById('sliderImage');
            const counterEl = document.getElementById('sliderCounter');
            if (imgEl) {
                imgEl.style.opacity = 0;
                setTimeout(() => {
                    currentImgIdx = (currentImgIdx + 1) % imgUrls.length;
                    imgEl.src = imgUrls[currentImgIdx];
                    if(counterEl) counterEl.innerText = `รูปภาพ ${currentImgIdx + 1} / ${imgUrls.length}`;
                    imgEl.style.opacity = 1;
                }, 800);
            } else {
                clearInterval(imageInterval);
            }
        }, 4000);
    }
}

function nextIncident() {
    if (currentIncidentIndex < currentFilteredData.length - 1) {
        currentIncidentIndex++;
        renderCurrentIncident();
    }
}

function prevIncident() {
    if (currentIncidentIndex > 0) {
        currentIncidentIndex--;
        renderCurrentIncident();
    }
}

let chatHistory = [];       // ตัวแปรเก็บประวัติการสนทนา
let inactivityTimer;       // ตัวแปรจับเวลาสะกิด
let isChatOpen = false;     // สถานะเปิด/ปิดหน้าต่างแชท
let unreadCount = 0;        // ยอดแจ้งเตือนข้อความใหม่

// ฟังก์ชันเปิด-ปิดแชทบับเบิ้ล
function toggleChat() {
    const widget = document.getElementById("chat-widget");
    const badge = document.getElementById("chat-badge");
    const bubble = document.getElementById("chat-bubble");
    
    isChatOpen = !isChatOpen;
    
    if (isChatOpen) {
        widget.style.display = "flex";
        bubble.style.transform = "scale(0.9)";
        bubble.style.background = "#1e3c72";
        
        unreadCount = 0;
        badge.style.display = "none";
        badge.textContent = "0";
        
        const chatMessages = document.getElementById("chat-messages");
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
        widget.style.display = "none";
        bubble.style.transform = "scale(1)";
        bubble.style.background = "#2a5298";
    }
}

// แจ้งเตือนข้อความใหม่ตอนพับจอ
function notifyNewMessage() {
    if (!isChatOpen) {
        unreadCount++;
        const badge = document.getElementById("chat-badge");
        const bubble = document.getElementById("chat-bubble");
        
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = "flex";
        }
        if (bubble) {
            bubble.style.transform = "scale(1.1)";
            setTimeout(() => { bubble.style.transform = "scale(1)"; }, 150);
        }
    }
}

// รีเซ็ตตัวนับเวลาสะกิด 1 นาที (60000 ms)
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        triggerInactivityPrompt();
    }, 60000); 
}

// ฟังก์ชันสะกิดเมื่อผู้ใช้เงียบ
function triggerInactivityPrompt() {
    appendMessage("AI", "มีรายงานหรือข้อมูลส่วนไหนที่สนใจดูเพิ่มเติมไหมครับ? หรือสามารถเลือกคลิกหัวข้อสำคัญด้านล่างนี้ได้เลยครับ:", "flex-start", "#e1f5fe");
    appendInlineSuggestions();
}

// เพิ่มปุ่มคำถามแนะนำเข้าไปในกล่องแชท
function appendInlineSuggestions() {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return;

    const sugContainer = document.createElement("div");
    sugContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px; align-self: flex-start; width: 85%; margin-top: 5px;";
    
    const quickQuestions = [
        { label: "📋 สรุปภาพรวมอุบัติเหตุเดือนนี้", query: "สรุปภาพรวมอุบัติเหตุของเดือนนี้" },
        { label: "📍 จุดเสี่ยงที่เกิดอุบัติเหตุบ่อยที่สุด", query: "เดือนนี้จุดไหนเกิดอุบัติเหตุบ่อยที่สุด" },
        { label: "🚗 ประเภทอุบัติเหตุที่เกิดบ่อยที่สุด", query: "ประเภทอุบัติเหตุที่เกิดบ่อยที่สุดในเดือนนี้คืออะไร" }
    ];

    quickQuestions.forEach(q => {
        const btn = document.createElement("button");
        btn.textContent = q.label;
        btn.style.cssText = "background: white; color: #1565c0; border: 1px solid #1565c0; border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer; text-align: left; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.2s;";
        
        btn.onclick = () => {
            const input = document.getElementById("chat-input");
            if (input) {
                input.value = q.query;
                sendMessage();
                sugContainer.remove();
            }
        };
        btn.onmouseover = () => { btn.style.background = "#e3f2fd"; };
        btn.onmouseout = () => { btn.style.background = "white"; };
        sugContainer.appendChild(btn);
    });

    chatMessages.appendChild(sugContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    notifyNewMessage();
}

// ฟังก์ชันส่งข้อความ
async function sendMessage() {
    const input = document.getElementById("chat-input");
    const messageText = input.value.trim();
    if (!messageText) return;

    clearTimeout(inactivityTimer);

    appendMessage("คุณ", messageText, "flex-end", "#dcf8c6");
    input.value = ""; 

    chatHistory.push({ role: "user", text: messageText });

    const typingId = "typing-" + Date.now();
    appendMessage("AI", "กำลังประมวลผล...", "flex-start", "#e1f5fe", typingId);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: "chat", 
                message: messageText,
                history: chatHistory
            })
        });
        
        const data = await response.json();
        const typingIndicator = document.getElementById(typingId);
        if(typingIndicator) typingIndicator.remove();
        
        if(data.status === 'success') {
            appendMessage("AI", data.reply, "flex-start", "#e1f5fe");
            chatHistory.push({ role: "AI", text: data.reply });
            
            if (chatHistory.length > 6) chatHistory.shift(); // ล็อคความจำไว้ที่ 6 ประโยคล่าสุด
        } else {
            appendMessage("System", "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์", "flex-start", "#ffcdd2");
        }
    } catch (error) {
        const typingIndicator = document.getElementById(typingId);
        if(typingIndicator) typingIndicator.remove();
        appendMessage("System", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "flex-start", "#ffcdd2");
        console.error(error);
    }

    resetInactivityTimer();
}

function appendMessage(sender, text, align, bgColor, id = "") {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return;
    const msgDiv = document.createElement("div");
    if(id) msgDiv.id = id;
    msgDiv.style.cssText = `background: ${bgColor}; padding: 10px; border-radius: 8px; align-self: ${align}; max-width: 80%; font-size: 14px; white-space: pre-wrap; word-break: break-word;`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if ((sender === "AI" || sender === "System") && id === "") {
        notifyNewMessage();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
        chatInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") sendMessage();
        });
    }
    resetInactivityTimer();
});
