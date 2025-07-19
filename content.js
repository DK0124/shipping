// BV Shop 出貨小幫手 - 單檔版本
(function() {
    'use strict';

    // 設定常數
    const CONFIG = {
        AUTO_EXTRACT_DELAY: 500,
        BATCH_SIZE: 5,
        MAX_CONCURRENT_DOWNLOADS: 3,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        GRADIENT_PRIMARY: 'linear-gradient(135deg, #518aff 0%, #0040ff 100%)',
        GRADIENT_HOVER: 'linear-gradient(135deg, #6b9fff 0%, #1a5aff 100%)',
        PANEL_WIDTH: '1200px',
        SIMPLIFIED_WIDTH: '400px'
    };

    // 樣式定義
    const STYLES = `
        /* 主要按鈕樣式 */
        .shipping-helper-btn {
            position: fixed;
            right: 20px;
            bottom: 20px;
            background: ${CONFIG.GRADIENT_PRIMARY};
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(81, 138, 255, 0.3);
            z-index: 9999;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .shipping-helper-btn:hover {
            background: ${CONFIG.GRADIENT_HOVER};
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(81, 138, 255, 0.4);
        }

        .shipping-helper-btn svg {
            width: 20px;
            height: 20px;
        }

        /* 主面板樣式 */
        .shipping-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            max-height: 90vh;
            overflow-y: auto;
            width: ${CONFIG.PANEL_WIDTH};
            max-width: 95vw;
            display: none;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translate(-50%, -45%);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }

        /* 簡化模式樣式 */
        .shipping-panel.simplified {
            width: ${CONFIG.SIMPLIFIED_WIDTH};
            padding: 20px;
        }

        .shipping-panel.simplified .full-features {
            display: none;
        }

        /* 隱藏精簡模式下的額外資訊 */
        .simplified-mode .row.order-info,
        .simplified-mode .order-info {
            display: none !important;
        }

        /* 面板頭部 */
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }

        .panel-title {
            font-size: 24px;
            font-weight: bold;
            background: ${CONFIG.GRADIENT_PRIMARY};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .panel-controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        /* 模式切換開關 */
        .mode-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-right: 10px;
        }

        .mode-toggle label {
            font-size: 14px;
            color: #666;
        }

        .toggle-switch {
            position: relative;
            width: 50px;
            height: 26px;
            background: #ddd;
            border-radius: 13px;
            cursor: pointer;
            transition: background 0.3s;
        }

        .toggle-switch.active {
            background: ${CONFIG.GRADIENT_PRIMARY};
        }

        .toggle-slider {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .toggle-switch.active .toggle-slider {
            transform: translateX(24px);
        }

        /* 關閉按鈕 */
        .close-btn {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #999;
            transition: color 0.3s;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }

        .close-btn:hover {
            color: #333;
            background: #f5f5f5;
        }

        /* 控制區塊 */
        .controls-section {
            display: flex;
            gap: 15px;
            margin-bottom: 25px;
            flex-wrap: wrap;
            align-items: center;
        }

        .control-btn {
            background: ${CONFIG.GRADIENT_PRIMARY};
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .control-btn:hover:not(:disabled) {
            background: ${CONFIG.GRADIENT_HOVER};
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(81, 138, 255, 0.3);
        }

        .control-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .control-btn svg {
            width: 18px;
            height: 18px;
        }

        /* 搜尋框 */
        .search-box {
            flex: 1;
            position: relative;
            min-width: 200px;
        }

        .search-input {
            width: 100%;
            padding: 10px 40px 10px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s;
        }

        .search-input:focus {
            outline: none;
            border-color: #518aff;
        }

        .search-clear {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            cursor: pointer;
            color: #999;
            font-size: 18px;
            padding: 5px;
            display: none;
        }

        .search-box.has-value .search-clear {
            display: block;
        }

        /* 統計資訊 */
        .stats-bar {
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }

        .stat-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .stat-label {
            color: #666;
            font-size: 14px;
        }

        .stat-value {
            font-weight: bold;
            color: #333;
            font-size: 16px;
        }

        .stat-value.highlight {
            color: #518aff;
        }

        /* 分頁控制 */
        .pagination {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .page-btn {
            background: white;
            border: 1px solid #ddd;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }

        .page-btn:hover:not(:disabled) {
            border-color: #518aff;
            color: #518aff;
        }

        .page-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .page-info {
            font-size: 14px;
            color: #666;
        }

        /* 訂單表格樣式 */
        .orders-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .orders-table th {
            background: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: #333;
            font-size: 14px;
            border-bottom: 2px solid #e0e0e0;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .orders-table td {
            padding: 15px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
        }

        .orders-table tr:hover {
            background: #f8f9fa;
        }

        .orders-table tr.extracted {
            background: #e8f5e9;
        }

        /* 複選框樣式 */
        .checkbox-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .order-checkbox {
            width: 18px;
            height: 18px;
            cursor: pointer;
            accent-color: #518aff;
        }

        /* 訂單編號樣式 */
        .order-id {
            font-family: monospace;
            color: #518aff;
            font-weight: 500;
        }

        /* 商品資訊樣式 */
        .product-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .product-name {
            font-weight: 500;
            color: #333;
        }

        .product-variant {
            font-size: 12px;
            color: #666;
        }

        /* 數量顯示樣式 - 更新為三角形 */
        .quantity-badge {
            display: inline-flex;
            align-items: center;
            background: #ff5722;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 8px;
        }

        .quantity-badge::before {
            content: '▲';
            margin-right: 2px;
        }

        /* 狀態標籤 */
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }

        .status-badge.pending {
            background: #fff3cd;
            color: #856404;
        }

        .status-badge.extracted {
            background: #d4edda;
            color: #155724;
        }

        .status-badge.error {
            background: #f8d7da;
            color: #721c24;
        }

        /* 動作按鈕 */
        .action-btn {
            background: none;
            border: 1px solid #518aff;
            color: #518aff;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.3s;
        }

        .action-btn:hover {
            background: #518aff;
            color: white;
        }

        .action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* 載入動畫 */
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #518aff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* 進度條 */
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #f0f0f0;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }

        .progress-fill {
            height: 100%;
            background: ${CONFIG.GRADIENT_PRIMARY};
            transition: width 0.3s ease;
            border-radius: 4px;
        }

        /* 提示訊息 */
        .toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10001;
            animation: slideUp 0.3s ease;
        }

        .toast.success {
            background: #4caf50;
        }

        .toast.error {
            background: #f44336;
        }

        .toast.warning {
            background: #ff9800;
        }

        @keyframes slideUp {
            from {
                transform: translate(-50%, 100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }

        /* 浮動面板 */
        .floating-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            padding: 20px;
            max-width: 400px;
            z-index: 9998;
            display: none;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* 物流單預覽 */
        .shipping-preview {
            margin-top: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }

        .preview-header {
            background: #f8f9fa;
            padding: 10px 15px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .preview-title {
            font-weight: 600;
            color: #333;
        }

        .preview-actions {
            display: flex;
            gap: 10px;
        }

        .preview-content {
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
        }

        /* 物流單格子預覽 */
        .shipping-labels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }

        .shipping-label-item {
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            background: white;
        }

        .shipping-label-item:hover {
            border-color: #518aff;
            box-shadow: 0 2px 8px rgba(81, 138, 255, 0.2);
        }

        .shipping-label-item.selected {
            border-color: #518aff;
            background: #f0f5ff;
        }

        .label-preview-img {
            width: 100%;
            height: 100px;
            object-fit: contain;
            margin-bottom: 5px;
            border-radius: 4px;
            background: #f8f9fa;
        }

        .label-info {
            font-size: 12px;
            color: #666;
        }

        .label-checkbox {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 16px;
            height: 16px;
        }

        /* 批次處理提示 */
        .batch-info {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .batch-info-icon {
            color: #1976d2;
            font-size: 20px;
        }

        .batch-info-text {
            flex: 1;
            color: #1565c0;
            font-size: 14px;
        }

        /* 錯誤訊息 */
        .error-message {
            background: #ffebee;
            border: 1px solid #ffcdd2;
            border-radius: 8px;
            padding: 12px 16px;
            margin: 10px 0;
            color: #c62828;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* 空狀態 */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-state-text {
            font-size: 16px;
            margin-bottom: 8px;
        }

        .empty-state-hint {
            font-size: 14px;
            color: #bbb;
        }

        /* 響應式設計 */
        @media (max-width: 768px) {
            .shipping-panel {
                width: 95vw;
                padding: 20px;
                max-height: 95vh;
            }

            .controls-section {
                flex-direction: column;
                width: 100%;
            }

            .search-box {
                width: 100%;
            }

            .stats-bar {
                flex-direction: column;
                align-items: flex-start;
            }

            .orders-table {
                font-size: 12px;
            }

            .orders-table th,
            .orders-table td {
                padding: 10px 5px;
            }

            .panel-title {
                font-size: 20px;
            }
        }

        /* 物流單簡化面板樣式 */
        .shipping-label-panel {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }

        .shipping-label-header {
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
        }

        .shipping-label-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .shipping-label-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
        }

        .shipping-label-key {
            color: #666;
        }

        .shipping-label-value {
            color: #333;
            font-weight: 500;
        }

        /* 動畫效果 */
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(81, 138, 255, 0.4);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(81, 138, 255, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(81, 138, 255, 0);
            }
        }

        .pulse-animation {
            animation: pulse 2s infinite;
        }
    `;

     // 初始化樣式
    function initStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = STYLES;
        document.head.appendChild(styleElement);
    }

    // 主要資料結構
    let ordersData = [];
    let shippingLabels = new Map(); // 儲存物流單資料
    let currentPage = 1;
    let itemsPerPage = 20;
    let searchTerm = '';
    let isSimplifiedMode = false;

    // 建立主要按鈕
    function createMainButton() {
        const button = document.createElement('button');
        button.className = 'shipping-helper-btn';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            出貨小幫手
        `;
        button.addEventListener('click', togglePanel);
        document.body.appendChild(button);
    }

    // 建立主面板
    function createMainPanel() {
        const panel = document.createElement('div');
        panel.className = 'shipping-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h2 class="panel-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="url(#gradient)" stroke="none">
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#518aff;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#0040ff;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    BV Shop 出貨小幫手
                </h2>
                <div class="panel-controls">
                    <div class="mode-toggle">
                        <label>精簡模式</label>
                        <div class="toggle-switch" id="modeToggle">
                            <div class="toggle-slider"></div>
                        </div>
                    </div>
                    <button class="close-btn" onclick="this.closest('.shipping-panel').style.display='none'">×</button>
                </div>
            </div>
            
            <div class="controls-section full-features">
                <button class="control-btn" id="extractBtn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7v10a11 11 0 0 0 11 11 11 11 0 0 0 11-11V7l-10-5z"></path>
                    </svg>
                    提取訂單資料
                </button>
                <button class="control-btn" id="exportSelectedBtn" disabled>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    匯出選取訂單
                </button>
                <button class="control-btn" id="exportAllBtn" disabled>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    匯出全部訂單
                </button>
                <div class="search-box">
                    <input type="text" class="search-input" id="searchInput" placeholder="搜尋訂單編號、商品名稱...">
                    <button class="search-clear" id="searchClear">×</button>
                </div>
            </div>

            <div class="stats-bar full-features">
                <div class="stat-item">
                    <span class="stat-label">總訂單數：</span>
                    <span class="stat-value" id="totalOrders">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已選取：</span>
                    <span class="stat-value highlight" id="selectedOrders">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">總金額：</span>
                    <span class="stat-value" id="totalAmount">NT$ 0</span>
                </div>
                <div class="pagination">
                    <button class="page-btn" id="prevPage" disabled>上一頁</button>
                    <span class="page-info" id="pageInfo">1 / 1</span>
                    <button class="page-btn" id="nextPage" disabled>下一頁</button>
                </div>
            </div>

            <div id="ordersContainer">
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">尚無訂單資料</div>
                    <div class="empty-state-hint">點擊「提取訂單資料」開始</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 綁定事件
        bindPanelEvents();
    }

    // 綁定面板事件
    function bindPanelEvents() {
        // 模式切換
        document.getElementById('modeToggle').addEventListener('click', function() {
            this.classList.toggle('active');
            isSimplifiedMode = !isSimplifiedMode;
            document.querySelector('.shipping-panel').classList.toggle('simplified');
            if (isSimplifiedMode) {
                document.body.classList.add('simplified-mode');
            } else {
                document.body.classList.remove('simplified-mode');
            }
        });

        // 提取訂單
        document.getElementById('extractBtn').addEventListener('click', extractOrders);
        
        // 匯出功能
        document.getElementById('exportSelectedBtn').addEventListener('click', () => exportOrders('selected'));
        document.getElementById('exportAllBtn').addEventListener('click', () => exportOrders('all'));
        
        // 搜尋功能
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            if (searchTerm) {
                searchInput.parentElement.classList.add('has-value');
            } else {
                searchInput.parentElement.classList.remove('has-value');
            }
            currentPage = 1;
            updateOrdersDisplay();
        });
        
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchTerm = '';
            searchInput.parentElement.classList.remove('has-value');
            currentPage = 1;
            updateOrdersDisplay();
        });
        
        // 分頁功能
        document.getElementById('prevPage').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateOrdersDisplay();
            }
        });
        
        document.getElementById('nextPage').addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredOrders().length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                updateOrdersDisplay();
            }
        });
    }

    // 切換面板顯示
    function togglePanel() {
        const panel = document.querySelector('.shipping-panel');
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    // 提取訂單資料
    async function extractOrders() {
        const btn = document.getElementById('extractBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span>提取中...';
        
        try {
            // 清空舊資料
            ordersData = [];
            shippingLabels.clear();
            
            // 提取頁面上的訂單
            const orderRows = document.querySelectorAll('.row.order-row');
            
            for (const row of orderRows) {
                const orderData = extractOrderFromRow(row);
                if (orderData) {
                    ordersData.push(orderData);
                    
                    // 自動下載物流單
                    if (orderData.shippingUrl) {
                        await extractShippingLabel(orderData);
                    }
                }
            }
            
            showToast(`成功提取 ${ordersData.length} 筆訂單`, 'success');
            updateOrdersDisplay();
            updateStats();
            
            // 啟用匯出按鈕
            document.getElementById('exportAllBtn').disabled = ordersData.length === 0;
            
        } catch (error) {
            console.error('提取訂單失敗:', error);
            showToast('提取訂單失敗', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7v10a11 11 0 0 0 11 11 11 11 0 0 0 11-11V7l-10-5z"></path>
                </svg>
                提取訂單資料
            `;
        }
    }

    // 從訂單行提取資料
    function extractOrderFromRow(row) {
        try {
            const orderId = row.querySelector('.row.order-info:first-child')?.textContent.trim() || '';
            const productName = row.querySelector('.row.order-name')?.textContent.trim() || '';
            const variantElement = row.querySelector('.row.order-option');
            const variant = variantElement ? variantElement.textContent.trim() : '';
            
            // 提取數量
            const quantityText = row.querySelector('.row.order-quality')?.textContent.trim() || '1';
            const quantity = parseInt(quantityText.match(/\d+/)?.[0] || '1');
            
            // 提取物流單連結
            const shippingLink = row.querySelector('a[onclick*="ShippingOrder"]');
            const shippingUrl = shippingLink ? extractShippingUrl(shippingLink) : '';
            
            // 提取狀態
            const status = row.querySelector('.order-status')?.textContent.trim() || '待處理';
            
            return {
                id: orderId,
                productName,
                variant,
                quantity,
                shippingUrl,
                status,
                selected: false,
                extracted: false
            };
        } catch (error) {
            console.error('提取訂單資料失敗:', error);
            return null;
        }
    }

    // 提取物流單URL
    function extractShippingUrl(link) {
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/window\.open\('([^']+)'/);
            return match ? match[1] : '';
        }
        return '';
    }

    // 提取物流單資料
    async function extractShippingLabel(orderData) {
        if (!orderData.shippingUrl) return;
        
        try {
            // 判斷物流類型
            const url = orderData.shippingUrl;
            let labelData = null;
            
            if (url.includes('7-11') || url.includes('epayment.7-11.com.tw')) {
                // 7-11 物流單處理
                labelData = await extract711ShippingLabel(url, orderData.id);
            } else if (url.includes('hilife') || url.includes('萊爾富')) {
                // 萊爾富物流單處理
                labelData = await extractHiLifeShippingLabel(url, orderData.id);
            } else if (url.includes('fami') || url.includes('全家')) {
                // 全家物流單處理
                labelData = await extractFamilyShippingLabel(url, orderData.id);
            } else if (url.includes('okmart') || url.includes('OK')) {
                // OK物流單處理
                labelData = await extractOKShippingLabel(url, orderData.id);
            } else {
                // 宅配 PDF 處理
                labelData = await extractPDFShippingLabel(url, orderData.id);
            }
            
            if (labelData) {
                shippingLabels.set(orderData.id, labelData);
                orderData.extracted = true;
            }
            
        } catch (error) {
            console.error('提取物流單失敗:', error);
            orderData.extractError = error.message;
        }
    }

     // 更新訂單顯示
    function updateOrdersDisplay() {
        const container = document.getElementById('ordersContainer');
        const filteredOrders = getFilteredOrders();
        
        if (filteredOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">${ordersData.length === 0 ? '尚無訂單資料' : '沒有符合的搜尋結果'}</div>
                    <div class="empty-state-hint">${ordersData.length === 0 ? '點擊「提取訂單資料」開始' : '請嘗試其他搜尋條件'}</div>
                </div>
            `;
            return;
        }
        
        // 計算分頁
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);
        
        // 建立表格
        let tableHTML = `
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="selectAll" ${isAllSelected() ? 'checked' : ''}>
                            </div>
                        </th>
                        <th>訂單編號</th>
                        <th>商品資訊</th>
                        <th>數量</th>
                        <th>物流單</th>
                        <th>狀態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        pageOrders.forEach(order => {
            const labelData = shippingLabels.get(order.id);
            const hasLabel = !!labelData;
            
            tableHTML += `
                <tr class="${order.extracted ? 'extracted' : ''}">
                    <td>
                        <div class="checkbox-wrapper">
                            <input type="checkbox" class="order-checkbox" data-order-id="${order.id}" ${order.selected ? 'checked' : ''}>
                        </div>
                    </td>
                    <td><span class="order-id">${order.id}</span></td>
                    <td>
                        <div class="product-info">
                            <span class="product-name">${order.productName}</span>
                            ${order.variant ? `<span class="product-variant">${order.variant}</span>` : ''}
                        </div>
                    </td>
                    <td>
                        ${order.quantity > 1 ? `<span class="quantity-badge">${order.quantity}</span>` : order.quantity}
                    </td>
                    <td>
                        ${hasLabel ? `
                            <button class="action-btn" onclick="viewShippingLabel('${order.id}')">
                                查看物流單
                            </button>
                        ` : (order.shippingUrl ? `
                            <button class="action-btn" onclick="extractSingleLabel('${order.id}')">
                                提取物流單
                            </button>
                        ` : '無物流單')}
                    </td>
                    <td>
                        <span class="status-badge ${order.extracted ? 'extracted' : 'pending'}">
                            ${order.extracted ? '已提取' : '待處理'}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn" onclick="viewOrderDetail('${order.id}')">
                            詳情
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
        
        // 更新分頁資訊
        document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
        document.getElementById('prevPage').disabled = currentPage === 1;
        document.getElementById('nextPage').disabled = currentPage === totalPages;
        
        // 綁定複選框事件
        bindCheckboxEvents();
    }

    // 取得篩選後的訂單
    function getFilteredOrders() {
        if (!searchTerm) return ordersData;
        
        const term = searchTerm.toLowerCase();
        return ordersData.filter(order => {
            return order.id.toLowerCase().includes(term) ||
                   order.productName.toLowerCase().includes(term) ||
                   (order.variant && order.variant.toLowerCase().includes(term));
        });
    }

    // 檢查是否全選
    function isAllSelected() {
        const pageOrders = getPageOrders();
        return pageOrders.length > 0 && pageOrders.every(order => order.selected);
    }

    // 取得當前頁訂單
    function getPageOrders() {
        const filteredOrders = getFilteredOrders();
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredOrders.slice(startIndex, endIndex);
    }

    // 綁定複選框事件
    function bindCheckboxEvents() {
        // 全選框
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const pageOrders = getPageOrders();
                
                pageOrders.forEach(order => {
                    order.selected = isChecked;
                });
                
                updateOrdersDisplay();
                updateStats();
                updateExportButton();
            });
        }
        
        // 個別複選框
        document.querySelectorAll('.order-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const orderId = e.target.dataset.orderId;
                const order = ordersData.find(o => o.id === orderId);
                if (order) {
                    order.selected = e.target.checked;
                    updateStats();
                    updateExportButton();
                }
            });
        });
    }

    // 更新統計資訊
    function updateStats() {
        const selectedOrders = ordersData.filter(order => order.selected);
        
        document.getElementById('totalOrders').textContent = ordersData.length;
        document.getElementById('selectedOrders').textContent = selectedOrders.length;
        
        // 計算總金額（如果有價格資訊的話）
        // const totalAmount = selectedOrders.reduce((sum, order) => sum + (order.price || 0), 0);
        // document.getElementById('totalAmount').textContent = `NT$ ${totalAmount.toLocaleString()}`;
    }

    // 更新匯出按鈕狀態
    function updateExportButton() {
        const selectedCount = ordersData.filter(order => order.selected).length;
        document.getElementById('exportSelectedBtn').disabled = selectedCount === 0;
    }

    // 查看物流單
    window.viewShippingLabel = function(orderId) {
        const labelData = shippingLabels.get(orderId);
        if (!labelData) return;
        
        // 建立預覽面板
        const previewPanel = document.createElement('div');
        previewPanel.className = 'floating-panel';
        previewPanel.style.display = 'block';
        
        let labelsHTML = '';
        
        if (labelData.type === 'PDF') {
            labelsHTML = `
                <div class="shipping-label-panel">
                    <div class="shipping-label-header">宅配物流單</div>
                    <div class="shipping-label-content">
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">類型：</span>
                            <span class="shipping-label-value">PDF檔案</span>
                        </div>
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">檔案：</span>
                            <span class="shipping-label-value">
                                <a href="${labelData.labels[0].pdfUrl}" target="_blank" class="action-btn">開啟PDF</a>
                            </span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 顯示截圖的物流單
            labelsHTML = '<div class="shipping-labels-grid">';
            
            labelData.labels.forEach((label, index) => {
                labelsHTML += `
                    <div class="shipping-label-item" data-label-index="${index}">
                        <img src="${label.imageData}" class="label-preview-img" alt="物流單 ${index + 1}">
                        <div class="label-info">
                            ${label.store ? `<div>門市: ${label.store}</div>` : ''}
                            ${label.recipient ? `<div>收件: ${label.recipient}</div>` : ''}
                            ${label.code ? `<div>代碼: ${label.code}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            labelsHTML += '</div>';
        }
        
        previewPanel.innerHTML = `
            <div class="preview-header">
                <span class="preview-title">物流單預覽 - ${orderId}</span>
                <button class="close-btn" onclick="this.closest('.floating-panel').remove()">×</button>
            </div>
            <div class="preview-content">
                ${labelsHTML}
            </div>
            <div class="preview-actions" style="padding: 15px; border-top: 1px solid #e0e0e0;">
                <button class="control-btn" onclick="downloadShippingLabels('${orderId}')">
                    下載物流單
                </button>
                <button class="control-btn" onclick="printShippingLabels('${orderId}')">
                    列印物流單
                </button>
            </div>
        `;
        
        document.body.appendChild(previewPanel);
        
        // 點擊圖片放大
        previewPanel.querySelectorAll('.label-preview-img').forEach(img => {
            img.addEventListener('click', () => {
                window.open(img.src, '_blank');
            });
        });
    };

    // 提取單一物流單
    window.extractSingleLabel = async function(orderId) {
        const order = ordersData.find(o => o.id === orderId);
        if (!order || !order.shippingUrl) return;
        
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = '提取中...';
        
        try {
            await extractShippingLabel(order);
            showToast('物流單提取成功', 'success');
            updateOrdersDisplay();
        } catch (error) {
            showToast('物流單提取失敗', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '提取物流單';
        }
    };

    // 查看訂單詳情
    window.viewOrderDetail = function(orderId) {
        const order = ordersData.find(o => o.id === orderId);
        if (!order) return;
        
        const detailPanel = document.createElement('div');
        detailPanel.className = 'floating-panel';
        detailPanel.style.display = 'block';
        
        detailPanel.innerHTML = `
            <div class="preview-header">
                <span class="preview-title">訂單詳情 - ${orderId}</span>
                <button class="close-btn" onclick="this.closest('.floating-panel').remove()">×</button>
            </div>
            <div class="preview-content">
                <div class="shipping-label-panel">
                    <div class="shipping-label-content">
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">訂單編號：</span>
                            <span class="shipping-label-value">${order.id}</span>
                        </div>
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">商品名稱：</span>
                            <span class="shipping-label-value">${order.productName}</span>
                        </div>
                        ${order.variant ? `
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">規格：</span>
                            <span class="shipping-label-value">${order.variant}</span>
                        </div>
                        ` : ''}
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">數量：</span>
                            <span class="shipping-label-value">${order.quantity}</span>
                        </div>
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">狀態：</span>
                            <span class="shipping-label-value">${order.status}</span>
                        </div>
                        <div class="shipping-label-row">
                            <span class="shipping-label-key">物流單：</span>
                            <span class="shipping-label-value">${order.extracted ? '已提取' : '未提取'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(detailPanel);
    };

    // 下載物流單
    window.downloadShippingLabels = async function(orderId) {
        const labelData = shippingLabels.get(orderId);
        if (!labelData) return;
        
        if (labelData.type === 'PDF') {
            // PDF直接開啟
            window.open(labelData.labels[0].pdfUrl, '_blank');
        } else {
            // 圖片下載
            for (let i = 0; i < labelData.labels.length; i++) {
                const label = labelData.labels[i];
                const link = document.createElement('a');
                link.href = label.imageData;
                link.download = `${orderId}_label_${i + 1}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // 避免一次下載太多
                if (i < labelData.labels.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            showToast('物流單下載完成', 'success');
        }
    };

    // 列印物流單
    window.printShippingLabels = function(orderId) {
        const labelData = shippingLabels.get(orderId);
        if (!labelData) return;
        
        if (labelData.type === 'PDF') {
            // PDF直接開啟列印
            window.open(labelData.labels[0].pdfUrl, '_blank');
        } else {
            // 建立列印視窗
            const printWindow = window.open('', '_blank');
            
            let printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>列印物流單 - ${orderId}</title>
                    <style>
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        body {
                            margin: 0;
                            padding: 20px;
                            font-family: Arial, sans-serif;
                        }
                        .label-container {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 20px;
                            justify-content: center;
                        }
                        .label-item {
                            page-break-inside: avoid;
                            text-align: center;
                        }
                        .label-item img {
                            max-width: 300px;
                            max-height: 450px;
                            border: 1px solid #ddd;
                        }
                        .label-info {
                            margin-top: 10px;
                            font-size: 12px;
                        }
                        @media print {
                            .no-print {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom: 20px;">
                        <button onclick="window.print()">列印</button>
                        <button onclick="window.close()">關閉</button>
                    </div>
                    <div class="label-container">
            `;
            
            labelData.labels.forEach((label, index) => {
                printContent += `
                    <div class="label-item">
                        <img src="${label.imageData}" alt="物流單 ${index + 1}">
                        <div class="label-info">
                            ${label.store ? `門市: ${label.store}<br>` : ''}
                            ${label.recipient ? `收件: ${label.recipient}<br>` : ''}
                            ${label.code ? `代碼: ${label.code}` : ''}
                        </div>
                    </div>
                `;
            });
            
            printContent += `
                    </div>
                </body>
                </html>
            `;
            
            printWindow.document.write(printContent);
            printWindow.document.close();
        }
    };

    // 匯出訂單
    async function exportOrders(type) {
        const ordersToExport = type === 'selected' 
            ? ordersData.filter(order => order.selected)
            : ordersData;
            
        if (ordersToExport.length === 0) {
            showToast('沒有訂單可匯出', 'warning');
            return;
        }
        
        // 建立 CSV 內容
        const headers = ['訂單編號', '商品名稱', '規格', '數量', '狀態', '物流單'];
        const rows = ordersToExport.map(order => [
            order.id,
            order.productName,
            order.variant || '',
            order.quantity,
            order.status,
            order.extracted ? '已提取' : '未提取'
        ]);
        
        // 轉換為 CSV 格式
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // 加入 BOM 以支援中文
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // 下載檔案
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`成功匯出 ${ordersToExport.length} 筆訂單`, 'success');
    }

    // 顯示提示訊息
    function showToast(message, type = 'info') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 批次處理物流單
    async function batchProcessShippingLabels(orders, batchSize = CONFIG.BATCH_SIZE) {
        const totalOrders = orders.length;
        let processed = 0;
        
        // 顯示進度條
        const progressPanel = document.createElement('div');
        progressPanel.className = 'floating-panel';
        progressPanel.style.display = 'block';
        progressPanel.innerHTML = `
            <div class="preview-header">
                <span class="preview-title">批次處理物流單</span>
            </div>
            <div class="preview-content">
                <div class="batch-info">
                    <div class="batch-info-icon">⏳</div>
                    <div class="batch-info-text">
                        正在處理 ${totalOrders} 筆訂單的物流單...
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="batchProgress" style="width: 0%"></div>
                </div>
                <div style="text-align: center; margin-top: 10px;">
                    <span id="progressText">0 / ${totalOrders}</span>
                </div>
            </div>
        `;
        document.body.appendChild(progressPanel);
        
        // 分批處理
        for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (order) => {
                try {
                    await extractShippingLabel(order);
                } catch (error) {
                    console.error(`處理訂單 ${order.id} 失敗:`, error);
                }
                processed++;
                
                // 更新進度
                const progress = (processed / totalOrders) * 100;
                document.getElementById('batchProgress').style.width = `${progress}%`;
                document.getElementById('progressText').textContent = `${processed} / ${totalOrders}`;
            }));
            
            // 避免請求過快
            if (i + batchSize < orders.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // 完成後關閉進度面板
        setTimeout(() => {
            progressPanel.remove();
            showToast('批次處理完成', 'success');
            updateOrdersDisplay();
        }, 1000);
    }

    // 自動提取新訂單
    function setupAutoExtract() {
        // 監聽頁面變化
        const observer = new MutationObserver((mutations) => {
            const hasNewOrders = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    return node.classList && node.classList.contains('order-row');
                });
            });
            
            if (hasNewOrders) {
                setTimeout(() => {
                    extractOrders();
                }, CONFIG.AUTO_EXTRACT_DELAY);
            }
        });
        
        // 開始監聽
        const orderContainer = document.querySelector('.orders-container');
        if (orderContainer) {
            observer.observe(orderContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    // 鍵盤快捷鍵
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + E: 提取訂單
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                document.getElementById('extractBtn')?.click();
            }
            
            // Ctrl/Cmd + S: 匯出選取
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                document.getElementById('exportSelectedBtn')?.click();
            }
            
            // Ctrl/Cmd + A: 全選當前頁
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.querySelector('.shipping-panel').style.display !== 'none') {
                e.preventDefault();
                document.getElementById('selectAll')?.click();
            }
            
            // ESC: 關閉面板
            if (e.key === 'Escape') {
                document.querySelector('.shipping-panel').style.display = 'none';
                document.querySelectorAll('.floating-panel').forEach(panel => panel.remove());
            }
        });
    }

    // 處理多檔案上傳問題
    async function handleMultipleFiles(files) {
        if (files.length <= 3) {
            // 檔案數量較少，直接處理
            return processFiles(files);
        }
        
        // 檔案數量較多，分批處理
        const results = [];
        const batchSize = 3;
        
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const batchResults = await processFiles(batch);
            results.push(...batchResults);
            
            // 批次間延遲，避免系統負載過高
            if (i + batchSize < files.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return results;
    }

    // 處理檔案
    async function processFiles(files) {
        const results = [];
        
        for (const file of files) {
            try {
                const result = await processFile(file);
                results.push(result);
            } catch (error) {
                console.error('處理檔案失敗:', error);
                results.push({
                    file: file.name,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    // 處理單一檔案
    async function processFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve({
                    file: file.name,
                    success: true,
                    data: e.target.result
                });
            };
            
            reader.onerror = (e) => {
                reject(new Error(`讀取檔案失敗: ${file.name}`));
            };
            
            reader.readAsDataURL(file);
        });
    }

    // 儲存設定到本地存儲
    function saveSettings() {
        const settings = {
            isSimplifiedMode: isSimplifiedMode,
            itemsPerPage: itemsPerPage
        };
        
        localStorage.setItem('shippingHelperSettings', JSON.stringify(settings));
    }

    // 載入設定
    function loadSettings() {
        const savedSettings = localStorage.getItem('shippingHelperSettings');
        
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                isSimplifiedMode = settings.isSimplifiedMode || false;
                itemsPerPage = settings.itemsPerPage || 20;
            } catch (error) {
                console.error('載入設定失敗:', error);
            }
        }
    }

    // 初始化 html2canvas
    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('html2canvas.min.js');
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 初始化 PDF.js
    function loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('pdf.js');
            
            script.onload = () => {
                // 設定 worker
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
                }
                resolve();
            };
            
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
