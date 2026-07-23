document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Login & Auth
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const loginForm = document.getElementById('login-form');
    const loginPhoneInput = document.getElementById('login-phone');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const btnLogoutOwner = document.getElementById('btn-logout-owner');

    // DOM Elements - Create Plugin Modal
    const createPluginModal = document.getElementById('create-plugin-modal');
    const createPluginForm = document.getElementById('create-plugin-form');
    const newPluginFilename = document.getElementById('new-plugin-filename');
    const newPluginCode = document.getElementById('new-plugin-code');
    const btnOpenCreateModal = document.getElementById('btn-open-create-modal');
    const btnCancelCreatePlugin = document.getElementById('btn-cancel-create-plugin');

    const dropzoneArea = document.getElementById('dropzone-area');
    const dropzoneFileInput = document.getElementById('dropzone-file-input');
    const dropzoneFileInfo = document.getElementById('dropzone-file-info');
    const dropzoneFilename = document.getElementById('dropzone-filename');
    const btnRemoveDroppedFile = document.getElementById('btn-remove-dropped-file');

    // DOM Elements - Stats
    const statTotalPlugins = document.getElementById('stat-total-plugins');
    const statActivePlugins = document.getElementById('stat-active-plugins');
    const statDisabledPlugins = document.getElementById('stat-disabled-plugins');
    const statErrorPlugins = document.getElementById('stat-error-plugins');

    // DOM Elements - Workspace
    const dashboardPluginList = document.getElementById('dashboard-plugin-list');
    const searchPluginInput = document.getElementById('search-plugin-input');
    const filterButtons = document.querySelectorAll('.btn-filter[data-filter]');
    const btnRefreshStats = document.getElementById('btn-refresh-stats');

    const selectedPluginName = document.getElementById('selected-plugin-name');
    const btnSavePluginCode = document.getElementById('btn-save-plugin-code');
    const btnTogglePluginStatus = document.getElementById('btn-toggle-plugin-status');
    const pluginErrorBanner = document.getElementById('plugin-error-banner');
    const bannerErrorType = document.getElementById('banner-error-type');
    const bannerErrorMsg = document.getElementById('banner-error-msg');
    const pluginCodeEditor = document.getElementById('plugin-code-editor');

    const digitalClock = document.getElementById('digital-clock');
    const toast = document.getElementById('toast-notification');

    let currentStats = null;
    let currentSelectedPlugin = null;
    let currentFilter = 'all';
    let searchQuery = '';

    // Starter Template Code for New Plugin
    const STARTER_PLUGIN_TEMPLATE = `const { fetchJson } = require('../lib/fungsi.js');

module.exports = {
    CmD: ['fiturbaru'],
    aliases: ['fb', 'newcmd'],
    categori: 'utility',
    exec: async (m, { bob, prefix, command, text }) => {
        if (!text) return m.reply(\`Gunakan \${prefix + command} <teks>\`);
        m.reply(\`✅ [Fitur Baru] Output: \${text}\`);
    }
};
`;

    // Clock
    function updateClock() {
        const now = new Date();
        const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        const timeString = new Intl.DateTimeFormat('id-ID', options).format(now);
        if (digitalClock) digitalClock.textContent = `${timeString} WIB`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Toast
    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    // --- AUTHENTICATION HELPERS ---
    function getOwnerToken() {
        return sessionStorage.getItem('owner_token') || '';
    }

    function setOwnerToken(token) {
        if (token) {
            sessionStorage.setItem('owner_token', token);
        } else {
            sessionStorage.removeItem('owner_token');
        }
    }

    async function fetchWithAuth(url, options = {}) {
        const token = getOwnerToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            'Authorization': `Bearer ${token}`
        };

        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            setOwnerToken('');
            showLoginModal();
            throw new Error('Sesi owner habis atau tidak valid. Silakan login kembali.');
        }
        return res;
    }

    function showLoginModal() {
        loginModalOverlay.classList.remove('hidden');
        btnLogoutOwner.style.display = 'none';
    }

    function hideLoginModal() {
        loginModalOverlay.classList.add('hidden');
        btnLogoutOwner.style.display = 'inline-flex';
    }

    // Check Auth State on Page Load
    async function checkAuthState() {
        const token = getOwnerToken();
        if (!token) {
            showLoginModal();
            return;
        }

        try {
            const res = await fetch(`/api/owner/verify?token=${encodeURIComponent(token)}`);
            const data = await res.json();
            if (data.authenticated) {
                hideLoginModal();
                fetchPluginStats();
            } else {
                setOwnerToken('');
                showLoginModal();
            }
        } catch (e) {
            showLoginModal();
        }
    }

    // Handle Login Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorMsg.classList.add('hidden');
        loginErrorMsg.textContent = '';

        const phone = loginPhoneInput.value.trim();
        const password = loginPasswordInput.value.trim();

        if (!phone || !password) {
            loginErrorMsg.textContent = 'Nomor HP dan password wajib diisi!';
            loginErrorMsg.classList.remove('hidden');
            return;
        }

        try {
            const res = await fetch('/api/owner/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });

            const data = await res.json();
            if (data.success) {
                setOwnerToken(data.token);
                hideLoginModal();
                showToast('Selamat datang, Owner! Login berhasil.');
                fetchPluginStats();
            } else {
                loginErrorMsg.textContent = data.error || 'Login gagal. Periksa nomor & password.';
                loginErrorMsg.classList.remove('hidden');
            }
        } catch (err) {
            loginErrorMsg.textContent = 'Terjadi kesalahan koneksi ke server.';
            loginErrorMsg.classList.remove('hidden');
        }
    });

    // Handle Logout
    btnLogoutOwner.addEventListener('click', async () => {
        try {
            await fetchWithAuth('/api/owner/logout', { method: 'POST' });
        } catch (_) {}
        setOwnerToken('');
        showLoginModal();
        showToast('Anda telah logout.');
    });

    // --- FETCH & RENDER PLUGIN STATS ---
    async function fetchPluginStats() {
        try {
            const res = await fetchWithAuth('/api/plugins');
            if (!res.ok) throw new Error('Gagal memuat data');
            currentStats = await res.json();

            statTotalPlugins.textContent = currentStats.totalPlugins || 0;
            statActivePlugins.textContent = currentStats.activeCount || 0;
            statDisabledPlugins.textContent = currentStats.disabledCount || 0;
            statErrorPlugins.textContent = currentStats.erroredCount || 0;

            renderPluginList();
        } catch (e) {
            console.error('Error fetching plugin stats:', e);
            showToast(e.message || 'Gagal memuat statistik plugin.');
        }
    }

    function renderPluginList() {
        if (!currentStats) return;
        dashboardPluginList.innerHTML = '';

        const erroredKeys = Object.keys(currentStats.erroredPlugins || {});
        const disabledKeys = Object.keys(currentStats.disabledPlugins || {});
        const activeKeys = currentStats.activePlugins || [];

        let itemsToRender = [];

        // Collect Errored
        erroredKeys.forEach(filename => {
            itemsToRender.push({ filename, status: 'error', info: currentStats.erroredPlugins[filename] });
        });

        // Collect Disabled
        disabledKeys.forEach(filename => {
            if (!erroredKeys.includes(filename)) {
                itemsToRender.push({ filename, status: 'disabled', info: null });
            }
        });

        // Collect Active
        activeKeys.forEach(filename => {
            if (!erroredKeys.includes(filename) && !disabledKeys.includes(filename)) {
                itemsToRender.push({ filename, status: 'active', info: null });
            }
        });

        // Filter
        if (currentFilter === 'error') {
            itemsToRender = itemsToRender.filter(item => item.status === 'error');
        } else if (currentFilter === 'disabled') {
            itemsToRender = itemsToRender.filter(item => item.status === 'disabled');
        } else if (currentFilter === 'active') {
            itemsToRender = itemsToRender.filter(item => item.status === 'active');
        }

        // Search Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            itemsToRender = itemsToRender.filter(item => item.filename.toLowerCase().includes(q));
        }

        if (itemsToRender.length === 0) {
            dashboardPluginList.innerHTML = '<div class="no-results" style="text-align:center; padding: 20px; color: var(--text-muted); font-size:13px;">Tidak ada plugin ditemukan</div>';
            return;
        }

        itemsToRender.forEach(item => {
            const el = createPluginItemElement(item.filename, item.status);
            dashboardPluginList.appendChild(el);
        });
    }

    function createPluginItemElement(filename, status) {
        const item = document.createElement('div');
        item.className = `plugin-item ${currentSelectedPlugin === filename ? 'active' : ''}`;
        item.dataset.filename = filename;

        let badgeClass = 'badge-ok';
        let badgeText = 'AKTIF';

        if (status === 'error') {
            badgeClass = 'badge-err';
            badgeText = 'ERROR';
        } else if (status === 'disabled') {
            badgeClass = 'badge-disabled';
            badgeText = 'NONAKTIF';
        }

        const isToggleActionDisabled = (status === 'disabled');
        const toggleIcon = isToggleActionDisabled ? 'fa-play' : 'fa-pause';
        const toggleTitle = isToggleActionDisabled ? 'Aktifkan Plugin' : 'Nonaktifkan Plugin';

        item.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span class="plugin-item-name"><i class="fa-regular fa-file-code"></i> ${filename}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="plugin-status-badge ${badgeClass}">${badgeText}</span>
                    <button class="plugin-action-btn" title="${toggleTitle}" data-toggle-file="${filename}" data-action="${isToggleActionDisabled ? 'enable' : 'disable'}">
                        <i class="fa-solid ${toggleIcon}"></i>
                    </button>
                </div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('[data-toggle-file]');
            if (toggleBtn) {
                e.stopPropagation();
                togglePluginStatus(toggleBtn.dataset.toggleFile, toggleBtn.dataset.action);
            } else {
                selectPlugin(filename);
            }
        });

        return item;
    }

    async function selectPlugin(filename) {
        currentSelectedPlugin = filename;
        selectedPluginName.textContent = filename;
        btnSavePluginCode.disabled = true;
        btnTogglePluginStatus.style.display = 'none';

        document.querySelectorAll('.plugin-item').forEach(el => {
            el.classList.toggle('active', el.dataset.filename === filename);
        });

        try {
            const res = await fetchWithAuth(`/api/plugins/code/${filename}`);
            const data = await res.json();

            if (data.success) {
                pluginCodeEditor.value = data.code;
                btnSavePluginCode.disabled = false;

                // Setup toggle status button in editor header
                btnTogglePluginStatus.style.display = 'inline-flex';
                const isDisabled = data.isDisabled;
                btnTogglePluginStatus.innerHTML = isDisabled 
                    ? '<i class="fa-solid fa-play" style="color: #2ecc71;"></i> Aktifkan Plugin' 
                    : '<i class="fa-solid fa-pause" style="color: #f1c40f;"></i> Nonaktifkan Plugin';
                btnTogglePluginStatus.onclick = () => togglePluginStatus(filename, isDisabled ? 'enable' : 'disable');

                if (data.errorInfo) {
                    bannerErrorType.textContent = `[${data.errorInfo.errorType}] Waktu Error: ${data.errorInfo.lastErrorTime}`;
                    bannerErrorMsg.textContent = `${data.errorInfo.errorMessage}\n\nStack Trace:\n${data.errorInfo.stackTrace}`;
                    pluginErrorBanner.classList.remove('hidden');
                } else {
                    pluginErrorBanner.classList.add('hidden');
                }
            } else {
                showToast(`Gagal memuat kode plugin: ${data.error}`);
            }
        } catch (e) {
            console.error('Error fetching plugin code:', e);
            showToast('Gagal memuat kode plugin.');
        }
    }

    async function saveCurrentPluginCode() {
        if (!currentSelectedPlugin) return;
        const newCode = pluginCodeEditor.value;

        btnSavePluginCode.disabled = true;
        btnSavePluginCode.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

        try {
            const res = await fetchWithAuth(`/api/plugins/code/${currentSelectedPlugin}`, {
                method: 'POST',
                body: JSON.stringify({ code: newCode })
            });
            const data = await res.json();

            if (data.success) {
                showToast(`Plugin ${currentSelectedPlugin} berhasil disimpan dan dimuat ulang!`);
                await fetchPluginStats();
                await selectPlugin(currentSelectedPlugin);
            } else {
                showToast(`Gagal menyimpan: ${data.error}`);
            }
        } catch (e) {
            console.error('Error saving plugin code:', e);
            showToast('Terjadi kesalahan saat menyimpan kode.');
        } finally {
            btnSavePluginCode.disabled = false;
            btnSavePluginCode.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Kode & Reload Plugin';
        }
    }

    async function togglePluginStatus(filename, action) {
        try {
            const res = await fetchWithAuth('/api/plugins/toggle', {
                method: 'POST',
                body: JSON.stringify({ filename, action })
            });
            const data = await res.json();
            if (data.success) {
                const actionLabel = action === 'enable' ? 'diaktifkan' : 'dinonaktifkan';
                showToast(`Plugin ${filename} berhasil ${actionLabel}.`);
                await fetchPluginStats();
                if (currentSelectedPlugin === filename) {
                    await selectPlugin(filename);
                }
            } else {
                showToast(`Gagal mengubah status plugin: ${data.error}`);
            }
        } catch (e) {
            showToast('Terjadi kesalahan saat mengubah status plugin.');
        }
    }

    // --- DRAG AND DROP FILE LOGIC ---
    function processDroppedFile(file) {
        if (!file) return;
        if (!file.name.endsWith('.js')) {
            showToast('Hanya file bertipe .js yang diperbolehkan!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            newPluginFilename.value = file.name;
            newPluginCode.value = e.target.result;

            if (dropzoneFilename) dropzoneFilename.textContent = file.name;
            if (dropzoneFileInfo) dropzoneFileInfo.classList.remove('hidden');
            showToast(`File '${file.name}' berhasil dimuat ke editor!`);
        };
        reader.readAsText(file);
    }

    function resetDropzone() {
        if (dropzoneFileInput) dropzoneFileInput.value = '';
        if (dropzoneFileInfo) dropzoneFileInfo.classList.add('hidden');
        if (dropzoneFilename) dropzoneFilename.textContent = '';
    }

    if (dropzoneArea) {
        dropzoneArea.addEventListener('click', () => dropzoneFileInput.click());

        dropzoneFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processDroppedFile(e.target.files[0]);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzoneArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzoneArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneArea.classList.remove('dragover');
            }, false);
        });

        dropzoneArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                processDroppedFile(files[0]);
            }
        });
    }

    if (btnRemoveDroppedFile) {
        btnRemoveDroppedFile.addEventListener('click', (e) => {
            e.stopPropagation();
            resetDropzone();
            newPluginFilename.value = '';
            newPluginCode.value = STARTER_PLUGIN_TEMPLATE;
            showToast('File dibatalkan. Menggunakan template bawaan.');
        });
    }

    // --- CREATE PLUGIN MODAL FLOW ---
    btnOpenCreateModal.addEventListener('click', () => {
        resetDropzone();
        newPluginFilename.value = '';
        newPluginCode.value = STARTER_PLUGIN_TEMPLATE;
        createPluginModal.classList.remove('hidden');
    });

    btnCancelCreatePlugin.addEventListener('click', () => {
        resetDropzone();
        createPluginModal.classList.add('hidden');
    });

    createPluginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const filename = newPluginFilename.value.trim();
        const code = newPluginCode.value;

        if (!filename) {
            showToast('Nama file plugin wajib diisi!');
            return;
        }

        try {
            const res = await fetchWithAuth('/api/plugins/create', {
                method: 'POST',
                body: JSON.stringify({ filename, code })
            });
            const data = await res.json();
            if (data.success) {
                createPluginModal.classList.add('hidden');
                showToast(`Plugin baru '${data.result.filename}' berhasil dibuat!`);
                await fetchPluginStats();
                await selectPlugin(data.result.filename);
            } else {
                showToast(`Gagal membuat plugin: ${data.error}`);
            }
        } catch (e) {
            showToast(e.message || 'Terjadi kesalahan saat membuat plugin.');
        }
    });

    // Filter Buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderPluginList();
        });
    });

    // Search Input
    searchPluginInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderPluginList();
    });

    // Refresh & Save Buttons
    btnRefreshStats.addEventListener('click', fetchPluginStats);
    btnSavePluginCode.addEventListener('click', saveCurrentPluginCode);

    // Check Auth and Initialize
    checkAuthState();
});
