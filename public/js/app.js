document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const iframePlayer = document.getElementById('iframe-player');
    const hlsPlayer = document.getElementById('hls-player');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    const playerContainer = document.getElementById('video-player-container');

    const headerActiveChannel = document.getElementById('header-active-channel');
    const headerChannelLogo = document.getElementById('header-channel-logo');
    const headerChannelName = document.getElementById('header-channel-name');

    const detailChannelLogo = document.getElementById('detail-channel-logo');
    const detailChannelName = document.getElementById('detail-channel-name');
    const detailChannelCategory = document.getElementById('detail-channel-category');
    const detailChannelResolution = document.getElementById('detail-channel-resolution');

    const sidebarChannelList = document.getElementById('sidebar-channel-list');
    const searchInput = document.getElementById('search-channel-input');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnShare = document.getElementById('btn-share-link');
    const btnErrorHome = document.getElementById('btn-error-home');
    const digitalClock = document.getElementById('digital-clock');
    const toast = document.getElementById('toast-notification');

    // Tabs Elements
    const tabChannelsBtn = document.getElementById('tab-channels-btn');
    const tabChatBtn = document.getElementById('tab-chat-btn');
    const sidebarChannelsTabContent = document.getElementById('sidebar-channels-tab-content');
    const sidebarChatTabContent = document.getElementById('sidebar-chat-tab-content');

    // Chat Elements
    const chatSetupScreen = document.getElementById('chat-setup-screen');
    const chatSetupForm = document.getElementById('chat-setup-form');
    const chatNicknameInput = document.getElementById('chat-nickname-input');
    const chatMainScreen = document.getElementById('chat-main-screen');
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    const chatMessageInput = document.getElementById('chat-message-input');
    const btnChatSend = document.getElementById('btn-chat-send');
    const chatUserAvatar = document.getElementById('chat-user-avatar');
    const chatNicknameDisplay = document.getElementById('chat-nickname-display');
    const btnChangeNickname = document.getElementById('btn-change-nickname');

    // State Variables
    let channels = [];
    let activeChannel = null;
    let hlsInstance = null;
    let chatSource = null;
    let chatNickname = localStorage.getItem('ncs_chat_nickname') || '';

    // --- 1. DIGITAL CLOCK ---
    function updateClock() {
        const now = new Date();
        const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        const timeString = new Intl.DateTimeFormat('id-ID', options).format(now);
        digitalClock.textContent = `${timeString} WIB`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- 2. FETCH CHANNELS DATA ---
    async function loadChannels() {
        try {
            const response = await fetch('/api/channels');
            if (!response.ok) throw new Error('Gagal mengambil data channel');
            channels = await response.json();
            
            buildSidebarList(channels);
            handleRouting();
        } catch (error) {
            console.error('Error loading channels:', error);
            showError('Gagal memuat saluran televisi. Silakan periksa koneksi server.');
        }
    }

    // --- 3. BUILD SIDEBAR ---
    function buildSidebarList(channelsToRender) {
        sidebarChannelList.innerHTML = '';
        if (channelsToRender.length === 0) {
            sidebarChannelList.innerHTML = '<div class="no-results">Saluran tidak ditemukan</div>';
            return;
        }

        channelsToRender.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.dataset.id = channel.id;
            if (activeChannel && activeChannel.id === channel.id) {
                item.classList.add('active');
            }

            item.innerHTML = `
                <img src="${channel.logo}" alt="${channel.name} Logo" class="channel-item-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23222%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2240%22 text-anchor=%22middle%22 dominant-baseline=%22central%22 fill=%22%23fff%22>📺</text></svg>'">
                <div class="channel-item-info">
                    <span class="channel-item-name">${channel.name}</span>
                    <span class="channel-item-meta">${channel.category} • ${channel.resolution}</span>
                </div>
                <i class="fa-solid fa-circle channel-item-badge"></i>
            `;

            item.addEventListener('click', () => {
                switchChannel(channel);
            });

            sidebarChannelList.appendChild(item);
        });
    }

    // --- 4. CHANNEL SWITCHING LOGIC (Without Reload) ---
    function switchChannel(channel) {
        if (activeChannel && activeChannel.id === channel.id) return;
        
        activeChannel = channel;
        
        // Update URL path without page reload
        history.pushState(null, '', `/watch/${channel.id}`);
        
        // Highlight active list item
        document.querySelectorAll('.channel-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.id === channel.id) {
                el.classList.add('active');
            }
        });

        playChannel(channel);
    }

    // --- 5. STREAM PLAYER ENGINE ---
    function playChannel(channel) {
        showLoading(true);
        hideError();

        // Update active channel details UI
        updateDetailUI(channel);

        // Reset previous player configurations
        resetPlayers();

        // Connect to chat for the selected channel
        connectToChat(channel.id);

        if (channel.type === 'iframe') {
            // PLAY IFRAME (sindikasi.inews.id, vidio.com, dailymotion)
            iframePlayer.classList.remove('hidden');
            iframePlayer.src = channel.streamUrl;
            
            // Iframe loading completion
            iframePlayer.onload = () => {
                showLoading(false);
            };
            
            // Fallback: hide loading after 4 seconds if onload doesn't trigger
            setTimeout(() => {
                if (!iframePlayer.classList.contains('hidden')) {
                    showLoading(false);
                }
            }, 4000);

        } else if (channel.type === 'hls') {
            // PLAY DIRECT HLS (.m3u8)
            hlsPlayer.classList.remove('hidden');
            
            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    maxMaxBufferLength: 10,
                    enableWorker: true,
                    lowLatencyMode: true
                });
                hlsInstance.loadSource(channel.streamUrl);
                hlsInstance.attachMedia(hlsPlayer);
                
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                    hlsPlayer.play()
                        .then(() => showLoading(false))
                        .catch(err => {
                            console.warn("Autoplay blocked, waiting for user click:", err);
                            showLoading(false);
                        });
                });

                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error("Fatal network error in HLS, attempting recovery...");
                                hlsInstance.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error("Fatal media error in HLS, attempting recovery...");
                                hlsInstance.recoverMediaError();
                                break;
                            default:
                                console.error("Fatal unrecoverable HLS error");
                                hlsInstance.destroy();
                                showError("Gagal memuat siaran langsung. Tautan streaming mungkin sedang luring.");
                                break;
                        }
                    }
                });
            } else if (hlsPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari Native support
                hlsPlayer.src = channel.streamUrl;
                hlsPlayer.addEventListener('loadedmetadata', () => {
                    hlsPlayer.play()
                        .then(() => showLoading(false))
                        .catch(() => showLoading(false));
                });
                hlsPlayer.addEventListener('error', () => {
                    showError("Siaran TV tidak dapat diputar di peramban ini.");
                });
            } else {
                showLoading(false);
                showError("Peramban Anda tidak mendukung pemutaran siaran HLS (.m3u8).");
            }
        }
    }

    function resetPlayers() {
        // Stop and destroy Hls instance
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        // Reset video tag
        hlsPlayer.pause();
        hlsPlayer.removeAttribute('src');
        hlsPlayer.load();
        hlsPlayer.classList.add('hidden');

        // Reset iframe
        iframePlayer.src = 'about:blank';
        iframePlayer.classList.add('hidden');
    }

    function updateDetailUI(channel) {
        document.title = `${channel.name} LIVE Streaming | NCS PLAY`;
        
        // Header
        headerActiveChannel.style.display = 'flex';
        headerChannelLogo.src = channel.logo;
        headerChannelName.textContent = channel.name;

        // Details Box
        detailChannelLogo.src = channel.logo;
        detailChannelName.textContent = channel.name;
        detailChannelCategory.innerHTML = `<i class="fa-solid fa-tags"></i> ${channel.category}`;
        detailChannelResolution.innerHTML = `<i class="fa-solid fa-tv"></i> ${channel.resolution}`;
    }

    // --- 6. ROUTING LOGIC (SPA) ---
    function handleRouting() {
        const path = window.location.pathname;
        const watchMatch = path.match(/^\/watch\/([a-z0-9]+)/i);
        
        let channelId = '';
        if (watchMatch) {
            channelId = watchMatch[1];
        }

        if (channelId) {
            const channel = channels.find(c => c.id === channelId.toLowerCase());
            if (channel) {
                activeChannel = channel;
                
                // Set active sidebar element
                document.querySelectorAll('.channel-item').forEach(el => {
                    el.classList.toggle('active', el.dataset.id === channel.id);
                });
                
                playChannel(channel);
            } else {
                showError(`Saluran TV "${channelId}" tidak ditemukan.`);
            }
        } else {
            // Welcome experience - auto-select the first channel (e.g. RCTI)
            if (channels.length > 0) {
                switchChannel(channels[0]);
            }
        }
    }

    // Listen to browser Back/Forward navigation
    window.addEventListener('popstate', () => {
        handleRouting();
    });

    // --- 7. SEARCH FILTERING ---
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = channels.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.id.toLowerCase().includes(query) ||
            c.category.toLowerCase().includes(query)
        );
        buildSidebarList(filtered);
    });

    // --- 8. FULLSCREEN API ---
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            playerContainer.requestFullscreen()
                .then(() => {
                    btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i>';
                })
                .catch(err => {
                    console.error(`Gagal masuk ke mode Fullscreen: ${err.message}`);
                });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    });

    // --- 9. TABS NAVIGATION ---
    tabChannelsBtn.addEventListener('click', () => {
        tabChannelsBtn.classList.add('active');
        tabChatBtn.classList.remove('active');
        sidebarChannelsTabContent.classList.remove('hidden');
        sidebarChatTabContent.classList.add('hidden');
    });

    tabChatBtn.addEventListener('click', () => {
        tabChatBtn.classList.add('active');
        tabChannelsBtn.classList.remove('active');
        sidebarChatTabContent.classList.remove('hidden');
        sidebarChannelsTabContent.classList.add('hidden');
        scrollToBottom();
    });

    // --- 10. LIVE CHAT SYSTEM ---
    function initChatUI() {
        if (chatNickname) {
            chatSetupScreen.classList.add('hidden');
            chatMainScreen.classList.remove('hidden');
            chatNicknameDisplay.textContent = chatNickname;
            chatUserAvatar.textContent = chatNickname.charAt(0).toUpperCase();
            chatUserAvatar.style.backgroundColor = getUserColor(chatNickname);
        } else {
            chatSetupScreen.classList.remove('hidden');
            chatMainScreen.classList.add('hidden');
        }
    }

    chatSetupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nicknameVal = chatNicknameInput.value.trim();
        if (nicknameVal) {
            chatNickname = nicknameVal;
            localStorage.setItem('ncs_chat_nickname', chatNickname);
            initChatUI();
        }
    });

    btnChangeNickname.addEventListener('click', () => {
        chatNickname = '';
        localStorage.removeItem('ncs_chat_nickname');
        chatNicknameInput.value = '';
        initChatUI();
    });

    const USER_COLORS = [
        '#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6',
        '#1abc9c', '#fd79a8', '#e84393', '#eccc68', '#78e08f'
    ];
    function getUserColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % USER_COLORS.length;
        return USER_COLORS[index];
    }

    function connectToChat(channelId) {
        if (chatSource) {
            chatSource.close();
            chatSource = null;
        }

        chatMessagesContainer.innerHTML = '<div class="chat-system-message">Menghubungkan ke live chat...</div>';

        const streamUrl = `/api/chat/stream?channel=${encodeURIComponent(channelId)}`;
        chatSource = new EventSource(streamUrl);

        chatSource.onmessage = (event) => {
            try {
                const eventData = JSON.parse(event.data);
                if (eventData.type === 'history') {
                    chatMessagesContainer.innerHTML = '';
                    if (eventData.data.length === 0) {
                        chatMessagesContainer.innerHTML = '<div class="chat-system-message">Selamat datang! Belum ada pesan di sini. Mari mulai mengobrol!</div>';
                    } else {
                        eventData.data.forEach(msg => appendMessage(msg));
                    }
                    scrollToBottom();
                } else if (eventData.type === 'message') {
                    const systemMsg = chatMessagesContainer.querySelector('.chat-system-message');
                    if (systemMsg) {
                        systemMsg.remove();
                    }
                    
                    const isNearBottom = chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop - chatMessagesContainer.clientHeight < 100;
                    appendMessage(eventData.data);
                    
                    if (isNearBottom) {
                        scrollToBottom();
                    }
                }
            } catch (err) {
                console.error('Error parsing SSE message:', err);
            }
        };

        chatSource.onerror = (err) => {
            console.error('SSE connection error, attempting reconnect...', err);
            chatSource.close();
            chatSource = null;
            chatMessagesContainer.innerHTML = '<div class="chat-system-message text-error">Koneksi chat terputus. Menghubungkan kembali...</div>';
            
            setTimeout(() => {
                if (activeChannel && activeChannel.id === channelId) {
                    connectToChat(channelId);
                }
            }, 3000);
        };
    }

    function appendMessage(msg) {
        const item = document.createElement('div');
        item.className = 'chat-message-item';
        
        const timeStr = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
            <span class="chat-msg-avatar" style="background-color: ${msg.color}">${msg.nickname.charAt(0).toUpperCase()}</span>
            <div class="chat-msg-content-wrapper">
                <div class="chat-msg-header">
                    <span class="chat-msg-nickname" style="color: ${msg.color}">${escapeHTML(msg.nickname)}</span>
                    <span class="chat-msg-time">${timeStr}</span>
                </div>
                <p class="chat-msg-text">${escapeHTML(msg.message)}</p>
            </div>
        `;
        
        chatMessagesContainer.appendChild(item);
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function scrollToBottom() {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    async function sendMessage() {
        const messageText = chatMessageInput.value.trim();
        if (!messageText || !activeChannel) return;
        if (!chatNickname) {
            showToast('Harap isi nama panggilan terlebih dahulu!');
            return;
        }

        btnChatSend.disabled = true;
        chatMessageInput.disabled = true;

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: chatNickname,
                    message: messageText,
                    channel: activeChannel.id
                })
            });

            if (!response.ok) throw new Error('Gagal mengirim pesan');

            chatMessageInput.value = '';
        } catch (err) {
            console.error('Error sending chat message:', err);
            showToast('Gagal mengirim pesan. Silakan coba lagi.');
        } finally {
            btnChatSend.disabled = false;
            chatMessageInput.disabled = false;
            chatMessageInput.focus();
        }
    }

    btnChatSend.addEventListener('click', sendMessage);
    chatMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // --- 11. SHARE LINK COPYING (Web Share API Support) ---
    btnShare.addEventListener('click', () => {
        const shareUrl = window.location.href;
        const shareTitle = document.title;
        const shareText = `Nonton live streaming ${activeChannel ? activeChannel.name : 'TV'} gratis di NCS PLAY!`;
        
        if (navigator.share) {
            navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
            })
            .catch(err => {
                console.warn('Native share failed or cancelled:', err);
            });
        } else {
            navigator.clipboard.writeText(shareUrl)
                .then(() => {
                    showToast('Tautan streaming berhasil disalin!');
                })
                .catch(err => {
                    console.error('Gagal menyalin link:', err);
                    showToast('Gagal menyalin link.');
                });
        }
    });

    // --- 12. ERROR DISPLAY & RESTORE ---
    btnErrorHome.addEventListener('click', () => {
        if (channels.length > 0) {
            switchChannel(channels[0]);
        } else {
            window.location.href = '/';
        }
    });

    function showLoading(show) {
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }

    function showError(message) {
        showLoading(false);
        resetPlayers();
        
        errorMessage.textContent = message;
        errorOverlay.classList.remove('hidden');
        
        headerActiveChannel.style.display = 'none';
        detailChannelName.textContent = 'Tidak Ditemukan';
        detailChannelCategory.innerHTML = '<i class="fa-solid fa-tags"></i> -';
        detailChannelResolution.innerHTML = '<i class="fa-solid fa-tv"></i> -';
    }

    function hideError() {
        errorOverlay.classList.add('hidden');
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2000);
    }

    // Initialize UI on load
    initChatUI();

    // Start loading application
    loadChannels();
});
