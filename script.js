const API_URL = 'https://script.google.com/macros/s/AKfycbzdmfAEPZfVOVyexYmALF3ecRZYFGDbpFtxwp7L0-9bimLuxlDm3VzhibZ8dniHtrKU_Q/exec'; // ⚠️ เปลี่ยนเป็น URL ของ Apps Script ตัวเอง
let allData = [];
let currentFilteredData = []; 
let currentIncidentIndex = 0; 
let imageInterval = null; 

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates(); 
    fetchDashboardData(); // เปิดใช้งานดึงข้อมูลจากชีทจริง

    document.getElementById('startDate').addEventListener('change', filterAndProcessData);
    document.getElementById('endDate').addEventListener('change', filterAndProcessData);
});

function setDefaultDates() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // ตั้งค่าเริ่มต้นเป็นต้นเดือนถึงวันนี้
    document.getElementById('startDate').value = `${year}-${month}-01`;
    document.getElementById('endDate').value = `${year}-${month}-${day}`;
}

// ดึงข้อมูลจาก Google Sheets ผ่าน Apps Script
async function fetchDashboardData() {
    try {
        const lastUpdateElem = document.getElementById('lastUpdate');
        if (lastUpdateElem) {
            lastUpdateElem.style.display = 'block';
            lastUpdateElem.innerText = 'กำลังโหลดข้อมูลจาก Google Sheets...';
        }

        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            allData = result.data;
            if (lastUpdateElem) lastUpdateElem.style.display = 'none';
            filterAndProcessData();
            
            initAccidentChart(); // 🌟 เพิ่มบรรทัดนี้ เพื่อสั่งให้กราฟวาดตัวเองหลังจากได้ข้อมูลแล้ว
            
        } else {
            if (lastUpdateElem) {
                lastUpdateElem.innerText = `เกิดข้อผิดพลาด: ${result.message || 'โครงสร้างข้อมูลไม่ถูกต้อง'}`;
                lastUpdateElem.style.color = 'red';
            }
            console.error("เซิร์ฟเวอร์ตอบกลับมาว่า:", result);
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

// แปลง String วันที่รูปแบบ YYYY-MM-DD (คอลัมน์ I) เป็น Date Object
function parseThaiDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr.trim() === '') return null;
    
    const cleanStr = dateStr.trim().replace(/\//g, '-');
    const parts = cleanStr.split('-');
    
    if (parts.length === 3) {
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let day = parseInt(parts[2], 10);
        
        if (year > 2500) year -= 543; // แปลง พ.ศ. เป็น ค.ศ. ถ้ามี
        
        return new Date(year, month, day);
    }
    return new Date(cleanStr);
}

function filterAndProcessData() {
    if (!allData || allData.length <= 1) return;

    const startVal = document.getElementById('startDate').value;
    const endVal = document.getElementById('endDate').value;
    
    if (!startVal || !endVal) return;

    const startDate = new Date(startVal);
    startDate.setHours(0,0,0,0);
    
    const endDate = new Date(endVal);
    endDate.setHours(23,59,59,999);

    // 🌟 ดึงวันที่จาก คอลัมน์ I (row[8])
    currentFilteredData = allData.slice(1).filter(row => {
        const dateStr = row[8] || ''; 
        const rowDate = parseThaiDate(dateStr);
        if (!rowDate || isNaN(rowDate.getTime())) return false;
        
        return rowDate >= startDate && rowDate <= endDate;
    });

    processStats(currentFilteredData);
    if (typeof updateAccidentMap === 'function') updateAccidentMap(currentFilteredData);
    currentIncidentIndex = 0;
    renderCurrentIncident();
}

function processStats(data) {
    let accRoad = 0, accGen = 0, accWork = 0, accPatient = 0;
    let injRoad = 0, injGen = 0, injWork = 0;
    let injStudent = 0, injStaff = 0, injOutsider = 0, injOutsource = 0, deaths = 0;
    
    // 🌟 ตัวแปรใหม่สำหรับนับแยกประเภทรับส่งผู้ป่วย
    let patStudent = 0, patStaff = 0, patOutsider = 0, patOutsource = 0;

    data.forEach(row => {
        const incidentType = String(row[14] || '').trim();   
        const injuredCount = parseInt(row[22]) || 0; 
        const injuredDetails = row[23] || ''; // คอลัมน์ X

        if (incidentType.includes('รับส่งผู้ป่วย')) {
            accPatient++;
            // 🌟 นับแยกประเภทผู้ป่วย (ดักคำว่า ภายนอก และ บุคคลภายนอก)
            patStudent += (injuredDetails.match(/ประเภท:\s*นักศึกษา/g) || []).length;
            patStaff += (injuredDetails.match(/ประเภท:\s*บุคลากร/g) || []).length;
            patOutsider += (injuredDetails.match(/ประเภท:\s*(บุคคลภายนอก|ภายนอก)/g) || []).length;
            patOutsource += (injuredDetails.match(/ประเภท:\s*(Outsource|ผู้รับเหมา)/gi) || []).length;
        } else {
            // หมวดหมู่อุบัติเหตุอื่นๆ
            if (incidentType.includes('ยานพาหนะ') || incidentType.includes('จราจร') || incidentType.includes('ถนน') || incidentType.includes('รถ')) {
                accRoad++; 
                injRoad += injuredCount;
            } else if (incidentType.includes('ทำงาน') || incidentType.includes('ปฏิบัติงาน') || incidentType.includes('งาน')) {
                accWork++; 
                injWork += injuredCount;
            } else if (incidentType.includes('ทั่วไป') || incidentType.includes('อุบัติเหตุทั่วไป')) {
                accGen++; 
                injGen += injuredCount;
            }

            // 🌟 นับผู้บาดเจ็บ (เฉพาะเหตุการณ์ที่ไม่ใช่รับส่งผู้ป่วย)
            injStudent += (injuredDetails.match(/ประเภท:\s*นักศึกษา/g) || []).length;
            injStaff += (injuredDetails.match(/ประเภท:\s*บุคลากร/g) || []).length;
            injOutsider += (injuredDetails.match(/ประเภท:\s*(บุคคลภายนอก|ภายนอก)/g) || []).length;
            injOutsource += (injuredDetails.match(/ประเภท:\s*(Outsource|ผู้รับเหมา)/gi) || []).length;
        }

        deaths += (injuredDetails.match(/เสียชีวิต/g) || []).length;
    });

    // อัปเดตสถิติอุบัติเหตุ
    if(document.getElementById('totalAcc')) document.getElementById('totalAcc').innerText = accRoad + accGen + accWork;
    if(document.getElementById('accRoad')) document.getElementById('accRoad').innerText = accRoad;
    if(document.getElementById('accGen')) document.getElementById('accGen').innerText = accGen;
    if(document.getElementById('accWork')) document.getElementById('accWork').innerText = accWork;

    // อัปเดตสถิติผู้บาดเจ็บ
    const totalInj = injRoad + injGen + injWork;
    if(document.getElementById('totalInj')) document.getElementById('totalInj').innerText = totalInj;
    if(document.getElementById('injRoad')) document.getElementById('injRoad').innerText = injRoad;
    if(document.getElementById('injGen')) document.getElementById('injGen').innerText = injGen;
    if(document.getElementById('injWork')) document.getElementById('injWork').innerText = injWork;

    const actualSumTypes = injStudent + injStaff + injOutsider + injOutsource;
    if(document.getElementById('totalInjType')) document.getElementById('totalInjType').innerText = actualSumTypes; 
    
    if(document.getElementById('injStudent')) document.getElementById('injStudent').innerText = injStudent;
    if(document.getElementById('injStaff')) document.getElementById('injStaff').innerText = injStaff;
    if(document.getElementById('injOutsider')) document.getElementById('injOutsider').innerText = injOutsider;
    if(document.getElementById('injOutsource')) document.getElementById('injOutsource').innerText = injOutsource;
    if(document.getElementById('deaths')) document.getElementById('deaths').innerText = deaths;
    
    // 🌟 อัปเดตข้อมูลกล่อง รับส่งผู้ป่วย (ถ้าเป็น 0 จะแสดงเป็น - ตามที่ตั้งค่าไว้)
    if(document.getElementById('accPatient')) document.getElementById('accPatient').innerText = accPatient || '-';
    if(document.getElementById('patStudent')) document.getElementById('patStudent').innerText = patStudent || '-';
    if(document.getElementById('patStaff')) document.getElementById('patStaff').innerText = patStaff || '-';
    if(document.getElementById('patOutsider')) document.getElementById('patOutsider').innerText = patOutsider || '-';
    if(document.getElementById('patOutsource')) document.getElementById('patOutsource').innerText = patOutsource || '-';
}

function formatThaiDateFull(dateString) {
    if (!dateString || dateString === '-') return '-';
    const parsedDate = parseThaiDate(dateString);
    if (!parsedDate || isNaN(parsedDate.getTime())) return dateString;

    const d = parsedDate.getDate();
    const m = parsedDate.getMonth();
    const y = parsedDate.getFullYear() + 543;
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${d} ${months[m]} ${y}`;
}

function parseInjuredDetails(rawText, totalCount, incidentType) {
    if (!rawText || rawText === '-') return '';
    let sections = rawText.split(/\[คนที่\s*\d+\s*\]/).map(s => s.trim()).filter(s => s !== '');
    let finalHTML = '';

    // เช็กประเภทเหตุการณ์เพื่อกำหนดคำนำหน้า
    const isPatientTransfer = String(incidentType).includes('รับส่งผู้ป่วย');
    const personLabel = isPatientTransfer ? 'ผู้ป่วยเป็น' : 'ผู้ได้รับบาดเจ็บเป็น';

    sections.forEach((item, idx) => {
        const extract = (regex) => (item.match(regex) || [])[1]?.trim() || '-';
        const type = extract(/ประเภท:\s*([^\n•|]+)/);
        const section = extract(/(?:ส่วนงาน|คณะ\/วิทยาลัย):\s*([^\n•|]+)/) !== '-' ? extract(/(?:ส่วนงาน|คณะ\/วิทยาลัย):\s*([^\n•|]+)/) : extract(/ส่วนงาน:\s*([^\n•|]+)/);
        const name = extract(/ชื่อ:\s*([^\n•|]+)/);
        const symptom = extract(/อาการ:\s*([^\n•|]+)/);

        // เช็กถ้าไม่มีส่วนงาน หรือเป็น '-' (เช่น บุคคลภายนอก) ไม่ต้องแสดงคำว่า "ของ ..."
        const sectionText = (section && section !== '-') ? ` ของ ${section}` : '';
        const nameText = (name && name !== '-') ? ` ชื่อ ${name}` : '';
        const personPrefix = totalCount > 1 ? `<strong>คนที่ ${idx + 1}:</strong> ` : '';

        // ประกอบร่างบรรทัดผู้บาดเจ็บ/ผู้ป่วย และ บรรทัดอาการ
        let personLine = `${personPrefix}<strong>${personLabel}:</strong> ${type}${sectionText}${nameText}`;
        let symptomLine = `<div style="margin-top: 4px;"><strong>อาการ:</strong> ${symptom}</div>`;

        finalHTML += `<div style="margin-bottom: 12px; font-size: 1em; line-height: 1.6;">${personLine}${symptomLine}</div>`;
    });
    return finalHTML;
}

function renderCurrentIncident() {
    const viewerContainer = document.getElementById('incidentViewer');
    if (!viewerContainer) return; // ป้องกัน Error หากไม่มี ID นี้ใน HTML
    
    if (imageInterval) clearInterval(imageInterval);

    if (currentFilteredData.length === 0) {
        viewerContainer.innerHTML = '<div style="padding: 50px; text-align: center; color: #888; font-size: 1.1em;">ไม่มีข้อมูลเหตุการณ์ในช่วงวันที่เลือก</div>';
        return;
    }

    const row = currentFilteredData[currentIncidentIndex];
    
    // 🌟 อัปเดต Index สำหรับแสดงรายละเอียดเหตุการณ์ แปลงลิงก์ Google Drive เป็นรูปลง HTML
    const rawImgUrl = row[30] || ''; // คอลัมน์ AE (index 30)
    let displayImgUrl = 'https://via.placeholder.com/1200x800?text=ไม่มีรูปภาพประกอบ';

    if (rawImgUrl.includes('drive.google.com')) {
        // ดึง File ID ออกจากลิงก์ Drive เพื่อนำมาสร้างลิงก์แสดงผลตรง
        const match = rawImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawImgUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            displayImgUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
        }
    } else if (rawImgUrl.trim() !== '') {
        displayImgUrl = rawImgUrl;
    }
    
    let imgUrls = [displayImgUrl];

    let detailsHTML = '';
    const kpiFull = row[31] || ''; // คอลัมน์ AF (index 31)
    const kpiParts = kpiFull.split('|').map(p => p.trim());
    let kpiStatusRaw = kpiParts[0] || 'ไม่มีข้อมูล KPI';
    
    const kpiColor = kpiStatusRaw.includes('✅') ? '#0d703b' : (kpiStatusRaw.includes('❌') ? '#9a1a1a' : '#555');
    let kpiStatus = kpiStatusRaw.replace(/[✅❌]/g, '').trim(); 
    let kpiDesc = kpiParts.length > 1 ? kpiParts.slice(1).join('<br>') : ''; 

    detailsHTML += `<div style="margin-bottom: 8px; font-size: 0.9em;">
        <strong style="color:${kpiColor}; font-size:1.05em;">${kpiStatus}</strong>
        ${kpiDesc ? `<div style="color: #444; margin-top: 3px;">${kpiDesc}</div>` : ''}
    </div>`;

    // คอลัมน์ I (row[8]) = วันที่, คอลัมน์ J (row[9]) = เวลา
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>วันที่เกิดเหตุ:</strong> ${formatThaiDateFull(row[8])} เวลา ${row[9] || '-'} น.</div>`;
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>รับแจ้งจาก:</strong> ${row[6] || '-'} (${row[7] || '-'}) รับแจ้งทาง ${row[5] || '-'}</div>`;
    
    const incidentType = row[14] || '-'; // คอลัมน์ O
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>เหตุการณ์:</strong> ${incidentType}</div>`;

    if (incidentType.includes('ยานพาหนะ') || incidentType.includes('จราจร')) {
        const v1 = (row[15] && row[15] !== '-') ? row[15].trim() : '';
        const d1 = (row[16] && row[16] !== '-') ? row[16].trim() : '';
        const v2 = (row[17] && row[17] !== '-') ? row[17].trim() : '';
        const d2 = (row[18] && row[18] !== '-') ? row[18].trim() : '';

        let vehicleText = '';
        if (v1) {
            vehicleText += v1;
            if (d1) vehicleText += `ของ${d1}`;
        }
        if (v2) {
            if (v2 === 'ล้มเอง' || v2 === 'ชนทรัพย์สิน') vehicleText += ` (${v2})`;
            else {
                vehicleText += ` ชนกับ ${v2}`;
                if (d2) vehicleText += `ของ${d2}`;
            }
        }
        if (vehicleText) {
            detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em; color: #333;"><strong>ยานพาหนะที่เกิดเหตุ:</strong> ${vehicleText}</div>`;
        }
    }

    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>สถานที่:</strong> ${row[12] || '-'}</div>`; // คอลัมน์ M

    const hasInjury = row[21] || '-'; // คอลัมน์ V
    const injuredCount = parseInt(row[22]) || 0; // คอลัมน์ W
    if (injuredCount === 0 || hasInjury === 'ไม่มี') {
        detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em; color: #2e7d32;"><strong>ไม่มีผู้ได้รับบาดเจ็บ</strong></div>`;
    } else {
        // เพิ่มตัวแปร incidentType ต่อท้ายเข้าไป เพื่อให้ฟังก์ชันรู้ว่าต้องใช้คำนำหน้าแบบไหน
        detailsHTML += parseInjuredDetails(row[23] || '', injuredCount, incidentType); 
    }
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>สาเหตุ:</strong> ${row[24] || '-'}</div>`; // คอลัมน์ Y
    
    let aiSummary = row[33] || row[32] || '-'; 
    detailsHTML += `<div style="margin-bottom: 12px; font-size: 1em;"><strong>รายละเอียดเหตุการณ์:</strong><br><span style="line-height:1.6; display:inline-block; margin-top:6px;">${aiSummary}</span></div>`;

    const isPrevDisabled = currentIncidentIndex === 0;
    const isNextDisabled = currentIncidentIndex === currentFilteredData.length - 1;

    viewerContainer.innerHTML = `
        <div class="incident-img-container" style="position: relative; background: #e0e0e0; display: flex; align-items: center; justify-content: center; overflow: hidden; min-height: 350px;">
            <img id="sliderImage" src="${imgUrls[0]}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div class="incident-details-container" style="padding: 15px 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 2px solid #1a237e; padding-bottom: 10px;">
                <button onclick="prevIncident()" ${isPrevDisabled ? 'disabled' : ''} style="background: ${isPrevDisabled ? '#d1d5db' : '#1a237e'}; color: white; border: none; border-radius: 6px; width: 35px; height: 35px; cursor: ${isPrevDisabled ? 'not-allowed' : 'pointer'};"> &lt; </button>
                <div style="font-size: 1.1em; color: #1a237e; font-weight: bold;">เหตุการณ์ที่ ${currentIncidentIndex + 1} / ${currentFilteredData.length}</div>
                <button onclick="nextIncident()" ${isNextDisabled ? 'disabled' : ''} style="background: ${isNextDisabled ? '#d1d5db' : '#1a237e'}; color: white; border: none; border-radius: 6px; width: 35px; height: 35px; cursor: ${isNextDisabled ? 'not-allowed' : 'pointer'};"> &gt; </button>
            </div>
            ${detailsHTML}
        </div>`;
}

function nextIncident() { if (currentIncidentIndex < currentFilteredData.length - 1) { currentIncidentIndex++; renderCurrentIncident(); } }
function prevIncident() { if (currentIncidentIndex > 0) { currentIncidentIndex--; renderCurrentIncident(); } }
// ==========================================
// ส่วนการทำงานของ Chatbot AI
// ==========================================
let chatHistoryList = []; // เก็บประวัติการสนทนา

// เปิด/ปิด หน้าต่างแชท
function toggleChat() {
    const chatWin = document.getElementById('chat-widget');
    if (chatWin.style.display === 'none' || chatWin.style.display === '') {
        chatWin.style.display = 'flex';
        // ซ่อน Badge แจ้งเตือนเมื่อเปิดอ่าน
        const badge = document.getElementById('chat-badge');
        if(badge) badge.style.display = 'none';
    } else {
        chatWin.style.display = 'none';
    }
}

// ส่งข้อความหา AI
async function sendMessage() {
    const inputElem = document.getElementById('chat-input');
    const userMessage = inputElem.value.trim();
    if (!userMessage) return;

    // 1. แสดงข้อความฝั่งผู้ใช้
    appendMessage('User', userMessage);
    inputElem.value = '';

    // บันทึกลง ประวัติการสนทนา
    chatHistoryList.push({ role: 'User', text: userMessage });

    // 2. แสดงสถานะกำลังพิมพ์
    const loadingId = appendLoadingMessage();

    try {
        // 3. ยิง API ไปยัง Apps Script (ใช้ API_URL ตัวเดียวกับที่ดึงข้อมูลแดชบอร์ด)
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'chat',
                userMessage: userMessage,
                chatHistory: chatHistoryList
            })
        });

        const result = await response.json();
        removeLoadingMessage(loadingId);

        if (result.status === 'success') {
            const aiReply = result.reply;
            appendMessage('AI', aiReply);
            chatHistoryList.push({ role: 'AI', text: aiReply });
        } else {
            appendMessage('AI', '⚠️ ไม่สามารถดึงข้อมูลได้: ' + (result.message || 'เกิดข้อผิดพลาด'));
        }
    } catch (error) {
        removeLoadingMessage(loadingId);
        appendMessage('AI', '❌ เกิดข้อผิดพลาดในการเชื่อมต่อระบบ ให้ตรวจสอบการตั้งค่า Deploy ใหม่');
        console.error('Chatbot Error:', error);
    }
}

// ==========================================
// ชุดคำถามอัตโนมัติสำหรับผู้บริหาร (Quick Replies)
// ==========================================
const executiveQuestions = [
    "📊 สรุปภาพรวมสถิติอุบัติเหตุทั้งหมดให้ฟังหน่อย",
    "📍 จุดไหนภายใน ม.มหิดล ที่เกิดอุบัติเหตุซ้ำซากบ่อยที่สุด?",
    "🚨 ช่วงที่ผ่านมามีเคสอุบัติเหตุรุนแรง หรือผู้เสียชีวิตบ้างไหม?",
    "⏱️ ภาพรวมการทำงานเข้าถึงพื้นที่ ทำได้ตาม KPI หรือไม่?",
    "👥 ผู้บาดเจ็บส่วนใหญ่เป็นกลุ่มนักศึกษา หรือบุคลากร?",
    "🚑 สรุปข้อมูลการรับส่งผู้ป่วยฉุกเฉินให้หน่อย",
    "🚗 สาเหตุหลักของการเกิดอุบัติเหตุจราจรคืออะไร?"
];

function renderQuickReplies() {
    const container = document.getElementById('quick-replies');
    if (!container) return;
    
    // ซ่อน Scrollbar สำหรับ Chrome/Safari
    container.style.cssText += "::-webkit-scrollbar { display: none; }";
    
    executiveQuestions.forEach(q => {
        const btn = document.createElement('button');
        btn.innerText = q;
        btn.style.cssText = `
            background: #ffffff; 
            border: 1px solid #2a5298; 
            color: #2a5298; 
            padding: 8px 12px; 
            border-radius: 16px; 
            font-size: 13px; 
            cursor: pointer; 
            white-space: normal; /* ให้ข้อความตัดบรรทัดได้ */
            text-align: left; /* จัดข้อความชิดซ้าย */
            align-self: flex-start; /* ให้ปุ่มอยู่ฝั่งซ้ายของแชท */
            width: fit-content; /* ขนาดปุ่มพอดีกับข้อความ */
            max-width: 90%; /* ไม่ให้ปุ่มกว้างเกินจอ */
            transition: all 0.2s ease;
        `;
        
        // เอฟเฟกต์ตอนชี้เมาส์
        btn.onmouseover = () => {
            btn.style.background = '#2a5298';
            btn.style.color = '#ffffff';
        };
        btn.onmouseout = () => {
            btn.style.background = '#ffffff';
            btn.style.color = '#2a5298';
        };
        
        // เมื่อกดปุ่ม ให้ส่งข้อความทันที
        btn.onclick = () => {
            document.getElementById('chat-input').value = q;
            sendMessage();
            // เลื่อนแถบคำถามกลับไปซ้ายสุด
            container.scrollLeft = 0; 
        };
        
        container.appendChild(btn);
    });
}

// เรียกใช้ฟังก์ชันตอนโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    renderQuickReplies();
});

// แสดงข้อความในกล่องแชท
function appendMessage(role, text) {
    const messagesContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    
    const isUser = role === 'User';
    msgDiv.style.cssText = `
        padding: 10px 14px;
        border-radius: 8px;
        max-width: 80%;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
        ${isUser 
            ? 'background: #2a5298; color: white; align-self: flex-end;' 
            : 'background: #e1f5fe; color: #333; align-self: flex-start;'
        }
    `;
    msgDiv.innerText = text;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// แสดงสถานะกำลังโหลด
function appendLoadingMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    const loadingDiv = document.createElement('div');
    const id = 'loading-' + Date.now();
    loadingDiv.id = id;
    loadingDiv.style.cssText = 'background: #e1f5fe; color: #333; padding: 10px 14px; border-radius: 8px; max-width: 80%; align-self: flex-start; font-size: 14px; font-style: italic;';
    loadingDiv.innerText = '🤖 กำลังพิมพ์...';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

// ลบสถานะกำลังโหลด
function removeLoadingMessage(id) {
    const elem = document.getElementById(id);
    if (elem) elem.remove();
}

// ตั้งค่าให้กด Enter เพื่อส่งข้อความได้ทันที
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});
let accidentChartInstance = null;

function initAccidentChart() {
    const yearSelect = document.getElementById('chartYearSelect');
    if (!yearSelect || !allData || allData.length <= 1) return;

    // 1. ดึงปีทั้งหมดที่มีในข้อมูลมาสร้างเป็นตัวเลือก (Dropdown)
    const years = new Set();
    
    // 🌟 ใช้ allData.slice(1) เพื่อให้กราฟแสดงข้อมูลทั้งปี ไม่ถูกจำกัดด้วยตัวกรองวันที่ด้านบน
    allData.slice(1).forEach(row => {
        const dateStr = row[8] || ''; // คอลัมน์ I (วันที่)
        if (dateStr.includes('-')) {
            let y = parseInt(dateStr.split('-')[0], 10);
            if (y < 2500) y += 543; // แปลง ค.ศ. เป็น พ.ศ.
            years.add(y);
        }
    });

    if (years.size === 0) years.add(2569);

    yearSelect.innerHTML = '';
    Array.from(years).sort().reverse().forEach(y => {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = `พ.ศ. ${y}`;
        yearSelect.appendChild(option);
    });

    yearSelect.removeEventListener('change', updateAccidentChart);
    yearSelect.addEventListener('change', updateAccidentChart);
    
    // 2. สั่งวาดกราฟครั้งแรก
    updateAccidentChart();
}

function updateAccidentChart() {
    const yearSelect = document.getElementById('chartYearSelect');
    if (!yearSelect) return;

    const selectedYear = parseInt(yearSelect.value, 10);
    document.getElementById('chartTitle').textContent = `สถิติอุบัติเหตุทั้งหมด ปี พ.ศ. ${selectedYear}`;

    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    // อาเรย์เก็บจำนวนข้อมูล 12 เดือน แยก 4 ประเภท
    const vehicleData = new Array(12).fill(0);
    const workData = new Array(12).fill(0);
    const generalData = new Array(12).fill(0);
    const patientData = new Array(12).fill(0); // 🌟 เพิ่มประเภทรับส่งผู้ป่วย

    // 1. กรองข้อมูลและนับจำนวนตามเดือน/ประเภท
    allData.slice(1).forEach(row => {
        const dateStr = row[8] || '';
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            let y = parseInt(parts[0], 10);
            if (y < 2500) y += 543;
            
            if (y === selectedYear) {
                const m = parseInt(parts[1], 10) - 1; // เดือน 0-11
                if (m >= 0 && m <= 11) {
                    const incidentType = String(row[14] || '').trim(); // คอลัมน์ O
                    
                    if (incidentType.includes('รับส่งผู้ป่วย')) {
                        patientData[m]++;
                    } else if (incidentType.includes('ยานพาหนะ') || incidentType.includes('จราจร') || incidentType.includes('รถ')) {
                        vehicleData[m]++;
                    } else if (incidentType.includes('ทำงาน')) {
                        workData[m]++;
                    } else {
                        generalData[m]++;
                    }
                }
            }
        }
    });

    // 🌟 ฟังก์ชันแปลงค่า 0 ให้เป็น null เพื่อไม่ให้ Chart.js จองพื้นที่ว่าง
    const formatData = (arr) => arr.map(v => v > 0 ? v : null);

    // 2. วาดกราฟ Chart.js
    const ctx = document.getElementById('accidentTypeChart').getContext('2d');
    
    if (accidentChartInstance) {
        accidentChartInstance.destroy();
    }

    accidentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'อุบัติเหตุจากยานพาหนะ',
                    data: formatData(vehicleData),
                    backgroundColor: '#3498db', // สีฟ้า
                    skipNull: true
                },
                {
                    label: 'อุบัติเหตุจากการทำงาน',
                    data: formatData(workData),
                    backgroundColor: '#e74c3c', // สีแดง
                    skipNull: true
                },
                {
                    label: 'อุบัติเหตุทั่วไป',
                    data: formatData(generalData),
                    backgroundColor: '#e67e22', // สีส้ม
                    skipNull: true
                },
                {
                    label: 'รับส่งผู้ป่วย',
                    data: formatData(patientData),
                    backgroundColor: '#9b59b6', // สีม่วง
                    skipNull: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: "'Sarabun', sans-serif", size: 14, weight: 'bold' }, color: '#000' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { family: "'Sarabun', sans-serif", size: 14, weight: 'bold' }, color: '#000' },
                    grid: { color: '#f0f0f0' }
                },
                x: {
                    ticks: { font: { family: "'Sarabun', sans-serif", size: 14, weight: 'bold' }, color: '#000' },
                    grid: { display: false }
                }
            }
        }
    });
}
