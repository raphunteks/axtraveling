import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.18.5/package/xlsx.mjs';

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & STORAGE MANAGEMENT ---
    const STORAGE_KEY = 'axa_premium_rundown';
    
    const defaultData = [
        { id: "1", title: "Arrival & VIP Lounge", day: "1", time: "08:00", dest: "Soekarno-Hatta Terminal 3", desc: "Pertemuan di VIP Lounge. Proses imigrasi jalur khusus dan sarapan pagi." },
        { id: "2", title: "Check-in & Welcoming", day: "1", time: "14:00", dest: "The Ritz-Carlton Hotel", desc: "Check-in eksklusif. Acara sambutan oleh manajemen representatif AXA." },
        { id: "3", title: "Gala Dinner & Networking", day: "2", time: "19:00", dest: "Sky Ballroom", desc: "Makan malam eksklusif, hiburan live, dan sesi networking bersama jajaran eksekutif." }
    ];

    let rundownData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!rundownData || rundownData.length === 0) {
        rundownData = defaultData;
        saveToStorage();
    }

    let currentFilter = 'all';
    let itemToDeleteId = null;

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rundownData));
    }

    // --- DOM ELEMENTS ---
    const timelineContainer = document.getElementById('timelineContainer');
    const filterBtns = document.querySelectorAll('.nav-link:not(.btn-accent)');
    
    const formModal = document.getElementById('formModal');
    const rundownForm = document.getElementById('rundownForm');
    const modalTitle = document.getElementById('modalTitle');
    const confirmModal = document.getElementById('confirmModal');
    
    const inputId = document.getElementById('agendaId');
    const inputTitle = document.getElementById('agendaTitle');
    const inputDay = document.getElementById('agendaDay');
    const inputTime = document.getElementById('agendaTime');
    const inputDest = document.getElementById('agendaDest');
    const inputDesc = document.getElementById('agendaDesc');

    // --- RENDER ENGINE & ANIMATION ---
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -20px 0px" });

    function renderTimeline() {
        timelineContainer.innerHTML = '';
        
        let filteredData = rundownData;
        if (currentFilter !== 'all') {
            filteredData = rundownData.filter(item => item.day === currentFilter);
        }

        filteredData.sort((a, b) => {
            if (a.day === b.day) return a.time.localeCompare(b.time);
            return parseInt(a.day) - parseInt(b.day);
        });

        if (filteredData.length === 0) {
            timelineContainer.innerHTML = `
                <div class="empty-state">
                    <h3 style="margin-bottom: 12px; font-size: 20px;">Jadwal Kosong</h3>
                    <p style="color: var(--color-text-muted); font-size: 14px;">Belum ada agenda perjalanan yang ditambahkan untuk filter ini.</p>
                </div>`;
            return;
        }

        filteredData.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'timeline-item';
            el.style.transition = `opacity 0.6s ease, transform 0.6s ease ${index * 0.08}s`;
            
            el.innerHTML = `
                <div class="timeline-node"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="time-badge">Day ${item.day} • ${item.time} WITA</span>
                        <div class="action-icons">
                            <button class="icon-btn btn-edit" data-id="${item.id}" title="Edit">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button class="icon-btn btn-delete" data-id="${item.id}" title="Hapus">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <h3>${item.title}</h3>
                    <p>${item.desc}</p>
                    <span class="tag-location">
                        <svg width="16" height="16" fill="none" stroke="var(--color-accent)" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        ${item.dest}
                    </span>
                </div>
            `;
            timelineContainer.appendChild(el);
            revealObserver.observe(el);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => openModal(e.currentTarget.closest('.btn-edit').dataset.id)));
        document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => confirmDelete(e.currentTarget.closest('.btn-delete').dataset.id)));
    }

    // --- MODAL & CRUD LOGIC ---
    function openModal(id = null) {
        rundownForm.reset();
        if (id) {
            modalTitle.textContent = "Edit Agenda";
            const item = rundownData.find(i => i.id === id);
            if (item) {
                inputId.value = item.id;
                inputTitle.value = item.title;
                inputDay.value = item.day;
                inputTime.value = item.time;
                inputDest.value = item.dest;
                inputDesc.value = item.desc;
            }
        } else {
            modalTitle.textContent = "Tambah Agenda";
            inputId.value = "";
            if (currentFilter !== 'all') inputDay.value = currentFilter;
        }
        formModal.classList.add('active');
    }

    function closeModal() { formModal.classList.remove('active'); }
    
    function confirmDelete(id) {
        itemToDeleteId = id;
        confirmModal.classList.add('active');
    }
    function closeConfirmModal() {
        confirmModal.classList.remove('active');
        itemToDeleteId = null;
    }

    document.getElementById('btnOpenAddModal').addEventListener('click', () => openModal());
    document.getElementById('footerAddBtn').addEventListener('click', (e) => { e.preventDefault(); openModal(); window.scrollTo({top: 0, behavior: 'smooth'}); });
    document.getElementById('btnCancelModal').addEventListener('click', closeModal);
    document.getElementById('btnCancelDelete').addEventListener('click', closeConfirmModal);
    
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        if (itemToDeleteId) {
            rundownData = rundownData.filter(i => i.id !== itemToDeleteId);
            saveToStorage();
            renderTimeline();
            closeConfirmModal();
        }
    });

    rundownForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const agendaData = {
            id: inputId.value || Date.now().toString(),
            title: inputTitle.value,
            day: inputDay.value,
            time: inputTime.value,
            dest: inputDest.value,
            desc: inputDesc.value
        };

        if (inputId.value) {
            const index = rundownData.findIndex(i => i.id === inputId.value);
            if (index !== -1) rundownData[index] = agendaData;
        } else {
            rundownData.push(agendaData);
        }
        saveToStorage();
        renderTimeline();
        closeModal();
    });

    // --- FILTERING LOGIC ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.day;
            renderTimeline();
        });
    });

    // --- EXCEL EXPORT (XLSX) ---
    const exportExcel = () => {
        if(rundownData.length === 0) return;
        const excelData = rundownData.map(item => ({
            "Day": `Hari Ke-${item.day}`,
            "Time (WITA)": item.time,
            "Activity": item.title,
            "Location / Destination": item.dest,
            "Description": item.desc
        })).sort((a, b) => {
            if (a.Day === b.Day) return a["Time (WITA)"].localeCompare(b["Time (WITA)"]);
            return a.Day.localeCompare(b.Day);
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        worksheet['!cols'] = [{wch: 12}, {wch: 15}, {wch: 35}, {wch: 35}, {wch: 55}];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Itinerary");
        XLSX.writeFile(workbook, "AXA_Exclusive_Itinerary.xlsx");
    };

    document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
    document.getElementById('footerExportBtn').addEventListener('click', (e) => { e.preventDefault(); exportExcel(); });

    // --- INIT ---
    window.addEventListener('click', (e) => {
        if (e.target === formModal) closeModal();
        if (e.target === confirmModal) closeConfirmModal();
    });

    renderTimeline();
});