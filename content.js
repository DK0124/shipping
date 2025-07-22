// BV SHOP 出貨助手 - Wizard 版本 (v2.0)
(function() {
    'use strict';
    
    // ========================================
    // 1. 全域命名空間與基礎設定
    // ========================================
    window.BVShop = {
        name: 'BV SHOP 出貨助手',
        version: '2.0.0',
        author: 'DK0124',
        description: '整合式出貨標籤列印系統'
    };
    
    // ========================================
    // 2. 配置管理 (Config)
    // ========================================
    BVShop.Config = {
        // 開發模式
        DEBUG: true,
        
        // 自動儲存設定
        AUTO_SAVE: true,
        AUTO_SAVE_INTERVAL: 3000, // ms
        
        // 頁面類型
        PAGE_TYPES: {
            ORDER_PRINT: 'order_print',
            SHIPPING: 'shipping'
        },
        
        // 物流商設定
        PROVIDERS: {
            // 超商取貨
            SEVEN: { 
                name: '7-11', 
                domains: ['myship.7-11.com.tw', 'epayment.7-11.com.tw', 'eship.7-11.com.tw'], 
                selector: '.div_frame, table',
                type: 'store',
                patterns: {
                    order: [/交貨便服務代碼[：:]\s*([A-Z0-9-]+)/i, /服務代碼[：:]\s*([A-Z0-9-]+)/i],
                    store: [/門市名稱[：:]\s*([^,\n]+)/i, /取件門市[：:]\s*([^,\n]+)/i],
                    storeId: [/門市店號[：:]\s*(\d+)/i, /統一編號[：:]\s*(\d+)/i],
                    recipient: [/取件人[：:]\s*([^\n]+)/i, /收件人[：:]\s*([^\n]+)/i],
                    phone: [/取件人電話[：:]\s*([\d-]+)/i, /電話[：:]\s*([\d-]+)/i]
                }
            },
            FAMILY: { 
                name: '全家', 
                domains: ['family.com.tw', 'famiport.com.tw'], 
                selector: '.print-area', 
                type: 'store',
                patterns: {
                    order: [/訂單號碼[：:]\s*([A-Z0-9]+)/i, /取件編號[：:]\s*([A-Z0-9]+)/i],
                    store: [/店舖名稱[：:]\s*([^,\n]+)/i, /取件門市[：:]\s*([^,\n]+)/i],
                    storeId: [/店舖代號[：:]\s*(\d+)/i],
                    recipient: [/取件人姓名[：:]\s*([^\n]+)/i, /收件人[：:]\s*([^\n]+)/i],
                    phone: [/取件人電話[：:]\s*([\d-]+)/i]
                }
            },
            HILIFE: { 
                name: '萊爾富', 
                domains: ['hilife.com.tw'], 
                selector: '.print_area', 
                type: 'store',
                patterns: {
                    order: [/訂單編號[：:]\s*([A-Z0-9]+)/i],
                    store: [/門市名稱[：:]\s*([^,\n]+)/i],
                    storeId: [/門市代號[：:]\s*(\d+)/i],
                    recipient: [/收件人[：:]\s*([^\n]+)/i],
                    phone: [/電話[：:]\s*([\d-]+)/i]
                }
            },
            OKMART: { 
                name: 'OK超商', 
                domains: ['okmart.com.tw'], 
                selector: '.printarea', 
                type: 'store',
                patterns: {
                    order: [/訂單編號[：:]\s*([A-Z0-9]+)/i],
                    store: [/門市名稱[：:]\s*([^,\n]+)/i],
                    storeId: [/門市編號[：:]\s*(\d+)/i],
                    recipient: [/收件人[：:]\s*([^\n]+)/i],
                    phone: [/電話[：:]\s*([\d-]+)/i]
                }
            },
            
            // 宅配
            DELIVERY: { 
                name: '宅配', 
                domains: ['kerrytj.com', 'hct.com.tw', 't-cat.com.tw', 'global-business.com.tw', 'fedex.com'], 
                selector: 'iframe', 
                type: 'delivery',
                subTypes: {
                    KERRY: '嘉里大榮',
                    HCT: '新竹貨運',
                    TCAT: '黑貓宅急便',
                    GLOBAL: '全球快遞',
                    FEDEX: 'FedEx'
                }
            }
        },
        
        // 標籤格式
        LABEL_FORMATS: {
            '10x15': {
                name: '10×15cm',
                description: '標準物流貼紙',
                icon: 'rectangle',
                width: 100,
                height: 150,
                widthPx: 377,
                heightPx: 566,
                padding: 5
            },
            '10x10': {
                name: '10×10cm',
                description: '正方形貼紙',
                icon: 'square',
                width: 100,
                height: 100,
                widthPx: 377,
                heightPx: 377,
                padding: 5
            }
        },
        
        // 列印模式
        PRINT_MODES: {
            A: 'mode_a', // 只印明細
            B: 'mode_b'  // 明細 + 物流單
        },
        
        // Wizard 步驟
        WIZARD_STEPS: {
            format: {
                id: 'format',
                title: '格式選擇',
                icon: 'aspect_ratio',
                order: 1
            },
            mode: {
                id: 'mode',
                title: '模式選擇',
                icon: 'print',
                order: 2
            },
            detail_settings: {
                id: 'detail_settings',
                title: '明細設定',
                icon: 'settings',
                order: 3
            },
            shipping_source: {
                id: 'shipping_source',
                title: '物流單準備',
                icon: 'local_shipping',
                order: 4,
                condition: (state) => state.selectedMode === 'mode_b'
            },
            matching: {
                id: 'matching',
                title: '配對設定',
                icon: 'link',
                order: 5,
                condition: (state) => state.selectedMode === 'mode_b'
            },
            preview: {
                id: 'preview',
                title: '預覽列印',
                icon: 'preview',
                order: 6
            }
        }
    };
    
    // ========================================
    // 3. 狀態管理 (State)
    // ========================================
    BVShop.State = {
        // 狀態資料
        data: {
            // Wizard 狀態
            currentStep: null,
            completedSteps: [],
            isWizardOpen: false,
            
            // 使用者選擇
            selectedFormat: '10x15',
            selectedMode: null,
            
            // 明細設定
            detailSettings: {
                fontSize: 11,
                showQuantityMark: true,
                compactMode: true,
                hideTableHeader: false,
                showProductImage: true,
                showOrderNo: true,
                showLogisticsNo: true,
                showDeliveryMethod: false,
                showRecipient: true,
                showRecipientPhone: true,
                showRecipientAddress: true,
                logoDataUrl: null,
                logoSize: 30,
                logoX: 50,
                logoY: 50,
                logoOpacity: 20
            },
            
            // 配對設定
            matchingSettings: {
                method: 'index',
                detailSort: 'asc',
                reverseShipping: false,
                showOrderLabel: false
            },
            
            // 資料
            orderData: [],
            shippingData: [],
            shippingDataBatches: [],
            matchedData: [],
            
            // 系統狀態
            currentPageType: null,
            currentProvider: null,
            presets: []
        },
        
        // 監聽器
        listeners: {},
        
        // 取得狀態
        get(path) {
            if (!path) return this.data;
            
            const keys = path.split('.');
            let value = this.data;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return undefined;
                }
            }
            
            return value;
        },
        
        // 設定狀態
        set(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = this.data;
            
            for (const key of keys) {
                if (!(key in target) || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }
            
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // 觸發監聽器
            this.notify(path, value, oldValue);
            
            return value;
        },
        
        // 更新多個狀態
        update(updates) {
            Object.entries(updates).forEach(([path, value]) => {
                this.set(path, value);
            });
        },
        
        // 監聽狀態變化
        watch(path, callback) {
            if (!this.listeners[path]) {
                this.listeners[path] = [];
            }
            this.listeners[path].push(callback);
            
            return () => {
                const index = this.listeners[path].indexOf(callback);
                if (index > -1) {
                    this.listeners[path].splice(index, 1);
                }
            };
        },
        
        // 通知監聽器
        notify(path, newValue, oldValue) {
            // 精確匹配
            if (this.listeners[path]) {
                this.listeners[path].forEach(cb => cb(newValue, oldValue));
            }
            
            // 萬用字元匹配
            if (this.listeners['*']) {
                this.listeners['*'].forEach(cb => cb({ path, newValue, oldValue }));
            }
            
            // 部分路徑匹配
            const parts = path.split('.');
            for (let i = parts.length - 1; i > 0; i--) {
                const partialPath = parts.slice(0, i).join('.') + '.*';
                if (this.listeners[partialPath]) {
                    this.listeners[partialPath].forEach(cb => cb({ path, newValue, oldValue }));
                }
            }
        },
        
        // 重置狀態
        reset(preserveData = false) {
            const preserved = preserveData ? {
                orderData: this.data.orderData,
                shippingData: this.data.shippingData,
                shippingDataBatches: this.data.shippingDataBatches
            } : {};
            
            this.data = {
                ...this.getDefaultState(),
                ...preserved
            };
        },
        
        // 取得預設狀態
        getDefaultState() {
            return {
                currentStep: null,
                completedSteps: [],
                isWizardOpen: false,
                selectedFormat: '10x15',
                selectedMode: null,
                detailSettings: {
                    fontSize: 11,
                    showQuantityMark: true,
                    compactMode: true,
                    hideTableHeader: false,
                    showProductImage: true,
                    showOrderNo: true,
                    showLogisticsNo: true,
                    showDeliveryMethod: false,
                    showRecipient: true,
                    showRecipientPhone: true,
                    showRecipientAddress: true,
                    logoDataUrl: null,
                    logoSize: 30,
                    logoX: 50,
                    logoY: 50,
                    logoOpacity: 20
                },
                matchingSettings: {
                    method: 'index',
                    detailSort: 'asc',
                    reverseShipping: false,
                    showOrderLabel: false
                },
                orderData: [],
                shippingData: [],
                shippingDataBatches: [],
                matchedData: [],
                currentPageType: null,
                currentProvider: null,
                presets: []
            };
        },
        
        // 儲存到 Chrome Storage
        async save() {
            try {
                const dataToSave = {
                    bvWizardState: this.data,
                    bvStateTimestamp: new Date().toISOString()
                };
                
                await chrome.storage.local.set(dataToSave);
                return true;
            } catch (error) {
                console.error('儲存狀態失敗:', error);
                return false;
            }
        },
        
        // 從 Chrome Storage 載入
        async load() {
            try {
                const result = await chrome.storage.local.get(['bvWizardState']);
                if (result.bvWizardState) {
                    this.data = {
                        ...this.getDefaultState(),
                        ...result.bvWizardState
                    };
                }
                return true;
            } catch (error) {
                console.error('載入狀態失敗:', error);
                return false;
            }
        }
    };
    
    // ========================================
    // 4. 事件系統 (Events)
    // ========================================
    BVShop.Events = {
        listeners: {},
        
        on(event, callback) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
        },
        
        off(event, callback) {
            if (!this.listeners[event]) return;
            
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        },
        
        emit(event, data) {
            if (!this.listeners[event]) return;
            
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件處理錯誤 [${event}]:`, error);
                }
            });
        }
    };
    
    // ========================================
    // 5. 工具函數 (Utils)
    // ========================================
    BVShop.Utils = {
        // DOM 操作
        DOM: {
            createElement(tag, attributes = {}, children = []) {
                const element = document.createElement(tag);
                
                Object.entries(attributes).forEach(([key, value]) => {
                    if (key === 'className') {
                        element.className = value;
                    } else if (key === 'innerHTML') {
                        element.innerHTML = value;
                    } else if (key === 'textContent') {
                        element.textContent = value;
                    } else if (key === 'style' && typeof value === 'object') {
                        Object.assign(element.style, value);
                    } else if (key.startsWith('data-')) {
                        element.setAttribute(key, value);
                    } else {
                        element[key] = value;
                    }
                });
                
                if (Array.isArray(children)) {
                    children.forEach(child => {
                        if (child instanceof Node) {
                            element.appendChild(child);
                        } else if (typeof child === 'string') {
                            element.appendChild(document.createTextNode(child));
                        }
                    });
                }
                
                return element;
            },
            
            addStyles(styles) {
                const styleElement = document.createElement('style');
                styleElement.textContent = styles;
                document.head.appendChild(styleElement);
                return styleElement;
            },
            
            removeElement(element) {
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }
        },
        
        // 通用工具
        General: {
            debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },
            
            throttle(func, limit) {
                let inThrottle;
                return function(...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },
            
            generateId(prefix = 'bv') {
                return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            },
            
            deepClone(obj) {
                return JSON.parse(JSON.stringify(obj));
            },
            
            formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
                const d = new Date(date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                
                return format
                    .replace('YYYY', year)
                    .replace('MM', month)
                    .replace('DD', day)
                    .replace('HH', hours)
                    .replace('mm', minutes)
                    .replace('ss', seconds);
            }
        },
        
        // 驗證工具
        Validation: {
            isValidPage() {
                const hostname = window.location.hostname;
                const pathname = window.location.pathname;
                
                // 檢查是否為支援的頁面
                return hostname.includes('bvshop') || 
                       Object.values(BVShop.Config.PROVIDERS).some(provider => 
                           provider.domains && provider.domains.some(domain => 
                               hostname.includes(domain)
                           )
                       );
            },
            
            validateStep(stepId) {
                const state = BVShop.State.get();
                
                switch (stepId) {
                    case 'format':
                        return !!state.selectedFormat;
                        
                    case 'mode':
                        return !!state.selectedMode;
                        
                    case 'detail_settings':
                        return true; // 明細設定總是有效的
                        
                    case 'shipping_source':
                        return state.shippingData.length > 0 || 
                               state.shippingDataBatches.length > 0;
                        
                    case 'matching':
                        return true; // 配對設定總是有效的
                        
                    default:
                        return true;
                }
            },
            
            validateFileType(file, allowedTypes) {
                const fileType = file.type.toLowerCase();
                const fileName = file.name.toLowerCase();
                
                const typeMap = {
                    'pdf': ['application/pdf'],
                    'image': ['image/jpeg', 'image/jpg', 'image/png']
                };
                
                return allowedTypes.some(type => {
                    if (typeMap[type]) {
                        return typeMap[type].includes(fileType);
                    }
                    return fileType.includes(type) || fileName.endsWith(`.${type}`);
                });
            },
            
            validateFileSize(file, maxSizeMB) {
                return file.size <= maxSizeMB * 1024 * 1024;
            }
        },
        
        // 頁面偵測
        PageDetection: {
            detectCurrentPage() {
                const hostname = window.location.hostname;
                const pathname = window.location.pathname;
                const url = window.location.href;
                
                console.log('=== 頁面偵測 ===');
                console.log('Hostname:', hostname);
                console.log('Pathname:', pathname);
                console.log('Full URL:', url);
                
                // 檢查宅配頁面
                if (BVShop.Config.PROVIDERS.DELIVERY.domains.some(domain => hostname.includes(domain))) {
                    BVShop.State.set('currentProvider', 'DELIVERY');
                    BVShop.State.set('currentPageType', BVShop.Config.PAGE_TYPES.SHIPPING);
                    
                    // 識別具體的宅配商
                    if (hostname.includes('kerrytj.com')) {
                        BVShop.State.set('deliverySubType', 'KERRY');
                    } else if (hostname.includes('hct.com.tw')) {
                        BVShop.State.set('deliverySubType', 'HCT');
                    } else if (hostname.includes('t-cat.com.tw')) {
                        BVShop.State.set('deliverySubType', 'TCAT');
                    } else if (hostname.includes('global-business.com.tw')) {
                        BVShop.State.set('deliverySubType', 'GLOBAL');
                    } else if (hostname.includes('fedex.com')) {
                        BVShop.State.set('deliverySubType', 'FEDEX');
                    }
                    
                    console.log('✓ 偵測到宅配頁面');
                    return 'shipping';
                }
                
                // 檢查超商頁面
                for (const [key, provider] of Object.entries(BVShop.Config.PROVIDERS)) {
                    if (key !== 'DELIVERY' && provider.domains.some(domain => hostname.includes(domain))) {
                        BVShop.State.set('currentProvider', key);
                        BVShop.State.set('currentPageType', BVShop.Config.PAGE_TYPES.SHIPPING);
                        console.log('✓ 偵測到物流單頁面:', provider.name);
                        return 'shipping';
                    }
                }
                
                // 出貨明細頁面檢測
                if (hostname.includes('bvshop')) {
                    const orderPatterns = [
                        'order_print',
                        'orderprint',
                        'order-print',
                        'order/print',
                        'orders/print',
                        'admin/order',
                        'manage/order'
                    ];
                    
                    const hasOrderPath = orderPatterns.some(pattern => 
                        pathname.toLowerCase().includes(pattern) || 
                        url.toLowerCase().includes(pattern)
                    );
                    
                    if (hasOrderPath || pathname.includes('order')) {
                        BVShop.State.set('currentPageType', BVShop.Config.PAGE_TYPES.ORDER_PRINT);
                        console.log('✓ 偵測到出貨明細頁面');
                        return 'order';
                    }
                    
                    // 延遲檢查內容
                    setTimeout(() => {
                        const hasOrderContent = document.querySelector('.order-content') || 
                                              document.querySelector('[class*="order"]') ||
                                              document.body.textContent.includes('訂單編號');
                        
                        if (hasOrderContent) {
                            BVShop.State.set('currentPageType', BVShop.Config.PAGE_TYPES.ORDER_PRINT);
                            console.log('✓ 透過內容偵測到出貨明細頁面');
                        }
                    }, 1000);
                    
                    return 'order';
                }
                
                console.log('✗ 未偵測到支援的頁面類型');
                return null;
            }
        }
    };
    
    // ========================================
    // 6. UI 系統 (UI)
    // ========================================
    BVShop.UI = {
        // ========== 樣式定義 ==========
        Styles: {
            getStyles() {
                return `
                /* Material Icons */
                @font-face {
                    font-family: 'Material Icons';
                    font-style: normal;
                    font-weight: 400;
                    src: url(https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2) format('woff2');
                }
                
                .material-icons {
                    font-family: 'Material Icons' !important;
                    font-weight: normal;
                    font-style: normal;
                    font-size: 24px;
                    line-height: 1;
                    letter-spacing: normal;
                    text-transform: none;
                    display: inline-block;
                    white-space: nowrap;
                    word-wrap: normal;
                    direction: ltr;
                    font-feature-settings: 'liga';
                    -webkit-font-smoothing: antialiased;
                    text-rendering: optimizeLegibility;
                    -moz-osx-font-smoothing: grayscale;
                }
                
                /* 字體 */
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');
                
                /* 全域樣式 */
                * {
                    box-sizing: border-box;
                }
                
                /* Wizard 容器 */
                #bv-wizard-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    font-family: 'Inter', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, sans-serif;
                    animation: fadeIn 0.3s ease;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                
                /* Wizard 面板 */
                #bv-wizard-panel {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    border-radius: 24px;
                    box-shadow: 
                        0 20px 60px rgba(0, 0, 0, 0.15),
                        0 0 0 1px rgba(255, 255, 255, 0.5) inset;
                    width: 100%;
                    max-width: 900px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                @keyframes slideUp {
                    from {
                        transform: translateY(30px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                /* Wizard 頭部 */
                #bv-wizard-header {
                    padding: 32px 40px 24px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                    background: rgba(255, 255, 255, 0.8);
                }
                
                .bv-wizard-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin: 0 0 8px 0;
                    letter-spacing: -0.02em;
                }
                
                .bv-wizard-subtitle {
                    font-size: 16px;
                    color: #666;
                    margin: 0;
                }
                
                /* 步驟指示器 */
                .bv-step-indicator {
                    margin-top: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    position: relative;
                }
                
                .bv-step-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #e0e0e0;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    position: relative;
                    z-index: 2;
                }
                
                .bv-step-dot.active {
                    width: 32px;
                    border-radius: 6px;
                    background: #518aff;
                }
                
                .bv-step-dot.completed {
                    background: #10b981;
                }
                
                .bv-step-line {
                    position: absolute;
                    height: 2px;
                    background: #e0e0e0;
                    top: 50%;
                    transform: translateY(-50%);
                    transition: all 0.3s ease;
                    z-index: 1;
                }
                
                .bv-step-line.completed {
                    background: #10b981;
                }
                
                /* Wizard 內容 */
                #bv-wizard-content {
                    flex: 1;
                    padding: 40px;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                
                /* Wizard 底部 */
                #bv-wizard-footer {
                    padding: 24px 40px;
                    border-top: 1px solid rgba(0, 0, 0, 0.08);
                    background: rgba(255, 255, 255, 0.8);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                }
                
                /* 按鈕樣式 */
                .bv-button {
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    outline: none;
                    letter-spacing: -0.01em;
                }
                
                .bv-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .bv-button-primary {
                    background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
                    color: white;
                    box-shadow: 0 4px 16px rgba(81, 138, 255, 0.24);
                }
                
                .bv-button-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(81, 138, 255, 0.32);
                }
                
                .bv-button-secondary {
                    background: rgba(0, 0, 0, 0.04);
                    color: #333;
                }
                
                .bv-button-secondary:hover:not(:disabled) {
                    background: rgba(0, 0, 0, 0.08);
                }
                
                .bv-button-text {
                    background: transparent;
                    color: #666;
                    padding: 12px 16px;
                }
                
                .bv-button-text:hover:not(:disabled) {
                    color: #333;
                    background: rgba(0, 0, 0, 0.04);
                }
                
                /* 格式卡片 */
                .bv-format-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                }
                
                .bv-format-card {
                    padding: 24px;
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: center;
                }
                
                .bv-format-card:hover {
                    border-color: #518aff;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
                }
                
                .bv-format-card.selected {
                    border-color: #518aff;
                    background: rgba(81, 138, 255, 0.04);
                }
                
                .bv-format-card-icon {
                    margin-bottom: 16px;
                }
                
                .bv-format-card-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin-bottom: 8px;
                }
                
                .bv-format-card-desc {
                    font-size: 14px;
                    color: #666;
                }
                
                /* 模式選項 */
                .bv-mode-options {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                .bv-mode-option {
                    padding: 20px;
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }
                
                .bv-mode-option:hover {
                    border-color: #518aff;
                    background: rgba(81, 138, 255, 0.02);
                }
                
                .bv-mode-option.selected {
                    border-color: #518aff;
                    background: rgba(81, 138, 255, 0.04);
                }
                
                .bv-mode-option-icon {
                    flex-shrink: 0;
                }
                
                .bv-mode-option-content {
                    flex: 1;
                }
                
                .bv-mode-option-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin-bottom: 4px;
                }
                
                .bv-mode-option-desc {
                    font-size: 14px;
                    color: #666;
                }
                
                /* 設定區塊 */
                .bv-settings-section {
                    background: rgba(248, 250, 252, 0.8);
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                }
                
                .bv-settings-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 20px 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .bv-setting-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                }
                
                .bv-setting-item:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                
                .bv-setting-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #333;
                }
                
                .bv-setting-desc {
                    font-size: 12px;
                    color: #666;
                    margin-top: 2px;
                }
                
                /* 開關元件 */
                .bv-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                
                .bv-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                
                .bv-switch-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    border-radius: 24px;
                    transition: 0.3s;
                }
                
                .bv-switch-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    border-radius: 50%;
                    transition: 0.3s;
                }
                
                .bv-switch input:checked + .bv-switch-slider {
                    background-color: #518aff;
                }
                
                .bv-switch input:checked + .bv-switch-slider:before {
                    transform: translateX(20px);
                }
                
                /* 滑桿元件 */
                .bv-slider-container {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                
                .bv-slider {
                    flex: 1;
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: rgba(0, 0, 0, 0.06);
                    outline: none;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                
                .bv-slider:hover {
                    opacity: 1;
                }
                
                .bv-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #518aff;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(81, 138, 255, 0.3);
                }
                
                .bv-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #518aff;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(81, 138, 255, 0.3);
                }
                
                .bv-slider-value {
                    min-width: 48px;
                    text-align: center;
                    font-size: 14px;
                    font-weight: 600;
                    color: #518aff;
                    background: rgba(81, 138, 255, 0.08);
                    padding: 4px 8px;
                    border-radius: 6px;
                }
                
                /* 檔案上傳區域 */
                .bv-upload-area {
                    border: 2px dashed #e5e7eb;
                    border-radius: 12px;
                    padding: 40px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: rgba(248, 250, 252, 0.5);
                }
                
                .bv-upload-area:hover {
                    border-color: #518aff;
                    background: rgba(81, 138, 255, 0.02);
                }
                
                .bv-upload-area.dragover {
                    border-color: #518aff;
                    background: rgba(81, 138, 255, 0.04);
                }
                
                .bv-upload-icon {
                    margin-bottom: 16px;
                }
                
                .bv-upload-text {
                    font-size: 16px;
                    font-weight: 500;
                    color: #333;
                    margin-bottom: 8px;
                }
                
                .bv-upload-hint {
                    font-size: 14px;
                    color: #666;
                }
                
                /* 檔案列表 */
                .bv-file-list {
                    margin-top: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .bv-file-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    gap: 12px;
                }
                
                .bv-file-icon {
                    color: #666;
                }
                
                .bv-file-name {
                    flex: 1;
                    font-size: 14px;
                    color: #333;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .bv-file-size {
                    font-size: 12px;
                    color: #666;
                }
                
                .bv-file-remove {
                    color: #999;
                    cursor: pointer;
                    transition: color 0.2s ease;
                }
                
                .bv-file-remove:hover {
                    color: #ef4444;
                }
                
                /* 預覽區域 */
                .bv-preview-container {
                    background: #f5f5f5;
                    border-radius: 12px;
                    padding: 24px;
                    min-height: 400px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .bv-preview-page {
                    background: white;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                /* 載入動畫 */
                .bv-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }
                
                .bv-loading-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid rgba(81, 138, 255, 0.2);
                    border-top-color: #518aff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
                
                .bv-loading-text {
                    font-size: 14px;
                    color: #666;
                }
                
                /* 通知樣式 */
                .bv-notification {
                    position: fixed;
                    top: 32px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 1000000;
                    animation: slideDown 0.3s ease;
                }
                
                @keyframes slideDown {
                    from {
                        transform: translate(-50%, -20px);
                        opacity: 0;
                    }
                    to {
                        transform: translate(-50%, 0);
                        opacity: 1;
                    }
                }
                
                .bv-notification.success {
                    color: #10b981;
                }
                
                .bv-notification.warning {
                    color: #f59e0b;
                }
                
                .bv-notification.error {
                    color: #ef4444;
                }
                
                /* 啟動按鈕 */
                #bv-launch-button {
                    position: fixed;
                    bottom: 32px;
                    right: 32px;
                    background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
                    color: white;
                    border: none;
                    border-radius: 16px;
                    padding: 16px 24px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 8px 32px rgba(81, 138, 255, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    z-index: 9999;
                    transition: all 0.3s ease;
                }
                
                #bv-launch-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 40px rgba(81, 138, 255, 0.4);
                }
                
                /* Modal 樣式 */
                .bv-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    padding: 20px;
                }
                
                /* 即時預覽 */
                #live-preview {
                    min-height: 300px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                /* 標籤樣式 */
                .bv-label-page {
                    font-family: 'Noto Sans TC', sans-serif;
                    position: relative;
                    background: white;
                }
                
                .bv-qty-star {
                    font-weight: 700;
                    color: inherit;
                }
                
                .bv-qty-star::before {
                    content: "▲ ";
                    color: #000;
                    font-weight: normal;
                }
                
                /* 列印樣式 */
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    
                    #print-area,
                    #print-area * {
                        visibility: visible;
                    }
                    
                    #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                    }
                }
                
                /* 批次列表 */
                .bv-batch-list {
                    margin-top: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .bv-batch-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: rgba(248, 250, 252, 0.8);
                    border: 1px solid rgba(0, 0, 0, 0.06);
                    border-radius: 6px;
                    font-size: 12px;
                }
                
                .bv-batch-item-info {
                    flex: 1;
                }
                
                .bv-batch-item-name {
                    font-weight: 500;
                    color: #000;
                }
                
                .bv-batch-item-count {
                    color: rgba(0, 0, 0, 0.5);
                    font-size: 11px;
                }
                
                .bv-batch-actions {
                    display: flex;
                    gap: 4px;
                }
                
                .bv-batch-order-btn {
                    width: 24px;
                    height: 24px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                }
                
                .bv-batch-order-btn:hover {
                    background: rgba(0, 0, 0, 0.05);
                }
                
                .bv-batch-order-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }
                
                /* 響應式設計 */
                @media (max-width: 768px) {
                    #bv-wizard-panel {
                        max-width: 100%;
                        max-height: 100%;
                        border-radius: 0;
                    }
                    
                    #bv-wizard-header,
                    #bv-wizard-content,
                    #bv-wizard-footer {
                        padding-left: 20px;
                        padding-right: 20px;
                    }
                    
                    .bv-format-cards {
                        grid-template-columns: 1fr;
                    }
                    
                    .bv-settings-section {
                        display: block;
                    }
                }
                `;
            }
        },
        
        // ========== UI 元件 ==========
        Components: {
            // 創建容器
            createContainer() {
                return BVShop.Utils.DOM.createElement('div', {
                    id: 'bv-wizard-container'
                });
            },
            
            // 創建面板
            createPanel() {
                return BVShop.Utils.DOM.createElement('div', {
                    id: 'bv-wizard-panel'
                });
            },
            
            // 創建頭部
            createHeader() {
                const header = BVShop.Utils.DOM.createElement('div', {
                    id: 'bv-wizard-header'
                });
                
                const title = BVShop.Utils.DOM.createElement('h1', {
                    className: 'bv-wizard-title',
                    textContent: 'BV SHOP 標籤列印精靈'
                });
                
                const subtitle = BVShop.Utils.DOM.createElement('p', {
                    className: 'bv-wizard-subtitle',
                    textContent: '快速設定並列印出貨標籤'
                });
                
                const stepIndicator = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-step-indicator',
                    id: 'bv-step-indicator'
                });
                
                // 動態創建步驟指示器
                const steps = Object.values(BVShop.Config.WIZARD_STEPS)
                    .sort((a, b) => a.order - b.order);
                
                steps.forEach((step, index) => {
                    const dot = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-step-dot',
                        'data-step': step.id
                    });
                    
                    stepIndicator.appendChild(dot);
                    
                    // 添加連接線
                    if (index < steps.length - 1) {
                        const line = BVShop.Utils.DOM.createElement('div', {
                            className: 'bv-step-line',
                            'data-step-line': step.id,
                            style: {
                                left: `${(index + 0.5) * (100 / steps.length)}%`,
                                width: `${100 / steps.length}%`
                            }
                        });
                        stepIndicator.appendChild(line);
                    }
                });
                
                header.appendChild(title);
                header.appendChild(subtitle);
                header.appendChild(stepIndicator);
                
                return header;
            },
            
            // 創建內容區
            createContent() {
                return BVShop.Utils.DOM.createElement('div', {
                    id: 'bv-wizard-content'
                });
            },
            
            // 創建底部
            createFooter() {
                const footer = BVShop.Utils.DOM.createElement('div', {
                    id: 'bv-wizard-footer'
                });
                
                const leftButtons = BVShop.Utils.DOM.createElement('div', {
                    style: { display: 'flex', gap: '12px' }
                });
                
                const cancelBtn = BVShop.Utils.DOM.createElement('button', {
                    id: 'bv-btn-cancel',
                    className: 'bv-button bv-button-text',
                    innerHTML: '<span class="material-icons">close</span> 取消'
                });
                
                const prevBtn = BVShop.Utils.DOM.createElement('button', {
                    id: 'bv-btn-prev',
                    className: 'bv-button bv-button-secondary',
                    innerHTML: '<span class="material-icons">arrow_back</span> 上一步',
                    style: { display: 'none' }
                });
                
                leftButtons.appendChild(cancelBtn);
                leftButtons.appendChild(prevBtn);
                
                const nextBtn = BVShop.Utils.DOM.createElement('button', {
                    id: 'bv-btn-next',
                    className: 'bv-button bv-button-primary',
                    innerHTML: '下一步 <span class="material-icons">arrow_forward</span>',
                    disabled: true
                });
                
                footer.appendChild(leftButtons);
                footer.appendChild(nextBtn);
                
                return footer;
            },
            
            // 創建開關
            createSwitch(checked = false) {
                const label = BVShop.Utils.DOM.createElement('label', {
                    className: 'bv-switch'
                });
                
                const input = BVShop.Utils.DOM.createElement('input', {
                    type: 'checkbox',
                    checked: checked
                });
                
                const slider = BVShop.Utils.DOM.createElement('span', {
                    className: 'bv-switch-slider'
                });
                
                label.appendChild(input);
                label.appendChild(slider);
                
                return label;
            },
            
            // 創建滑桿
            createSlider(options = {}) {
                const container = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-slider-container'
                });
                
                const slider = BVShop.Utils.DOM.createElement('input', {
                    type: 'range',
                    className: 'bv-slider',
                    min: options.min || 0,
                    max: options.max || 100,
                    value: options.value || 50,
                    step: options.step || 1
                });
                
                const value = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-slider-value',
                    textContent: options.value || 50
                });
                
                // 更新顯示值
                slider.addEventListener('input', (e) => {
                    value.textContent = e.target.value;
                    // 更新滑桿填充
                    const percent = (e.target.value - e.target.min) / (e.target.max - e.target.min) * 100;
                    e.target.style.background = `linear-gradient(to right, #518aff ${percent}%, rgba(0,0,0,0.06) ${percent}%)`;
                    
                    // 觸發回調
                    if (options.onChange) {
                        options.onChange(parseFloat(e.target.value));
                    }
                });
                
                // 初始化滑桿填充
                const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
                slider.style.background = `linear-gradient(to right, #518aff ${percent}%, rgba(0,0,0,0.06) ${percent}%)`;
                
                container.appendChild(slider);
                container.appendChild(value);
                
                return container;
            },
            
            // 顯示通知
            showNotification(message, type = 'success', duration = 3000) {
                // 移除現有通知
                const existing = document.querySelector('.bv-notification');
                if (existing) existing.remove();
                
                const icons = {
                    success: 'check_circle',
                    warning: 'warning',
                    error: 'error',
                    info: 'info'
                };
                
                const notification = BVShop.Utils.DOM.createElement('div', {
                    className: `bv-notification ${type}`
                }, [
                    BVShop.Utils.DOM.createElement('span', {
                        className: 'material-icons',
                        textContent: icons[type] || 'info'
                    }),
                    BVShop.Utils.DOM.createElement('span', {
                        textContent: message
                    })
                ]);
                
                document.body.appendChild(notification);
                
                // 自動移除
                if (duration > 0) {
                    setTimeout(() => {
                        notification.style.animation = 'slideUp 0.3s ease forwards';
                        setTimeout(() => notification.remove(), 300);
                    }, duration);
                }
                
                return notification;
            },
            
            // 創建載入畫面
            createLoading(message = '載入中...') {
                return BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-loading'
                }, [
                    BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-loading-spinner'
                    }),
                    BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-loading-text',
                        textContent: message
                    })
                ]);
            }
        },
        
        // ========== 步驟渲染器 ==========
        StepRenderers: {
            // Step 1: 格式選擇
            renderFormatStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '請選擇標籤格式',
                    style: {
                        fontSize: '24px',
                        fontWeight: '600',
                        marginBottom: '32px',
                        textAlign: 'center'
                    }
                });
                
                const cards = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-format-cards'
                });
                
                // 創建格式卡片
                Object.entries(BVShop.Config.LABEL_FORMATS).forEach(([key, format]) => {
                    const card = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-format-card',
                        'data-format': key
                    });
                    
                    if (BVShop.State.get('selectedFormat') === key) {
                        card.classList.add('selected');
                    }
                    
                    const icon = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-format-card-icon',
                        innerHTML: `<span class="material-icons" style="font-size: 64px; color: #518aff;">${format.icon}</span>`
                    });
                    
                    const title = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-format-card-title',
                        textContent: format.name
                    });
                    
                    const desc = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-format-card-desc',
                        textContent: format.description
                    });
                    
                    card.appendChild(icon);
                    card.appendChild(title);
                    card.appendChild(desc);
                    
                    // 點擊事件
                    card.addEventListener('click', () => {
                        // 移除其他選中狀態
                        cards.querySelectorAll('.bv-format-card').forEach(c => {
                            c.classList.remove('selected');
                        });
                        
                        // 設定選中狀態
                        card.classList.add('selected');
                        BVShop.State.set('selectedFormat', key);
                        
                        // 啟用下一步按鈕
                        document.getElementById('bv-btn-next').disabled = false;
                    });
                    
                    cards.appendChild(card);
                });
                
                container.appendChild(title);
                container.appendChild(cards);
                
                return container;
            },
            
            // Step 2: 模式選擇
            renderModeStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '請選擇列印模式',
                    style: {
                        fontSize: '24px',
                        fontWeight: '600',
                        marginBottom: '32px',
                        textAlign: 'center'
                    }
                });
                
                const options = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-options'
                });
                
                // 模式 A
                const modeA = this.createModeOption({
                    id: 'mode_a',
                    icon: 'description',
                    title: '模式 A：只印明細',
                    desc: '只列印出貨明細，不需要物流單'
                });
                
                // 模式 B
                const modeB = this.createModeOption({
                    id: 'mode_b',
                    icon: 'layers',
                    title: '模式 B：明細 + 物流單',
                    desc: '出貨明細與物流單交錯列印'
                });
                
                options.appendChild(modeA);
                options.appendChild(modeB);
                
                container.appendChild(title);
                container.appendChild(options);
                
                return container;
            },
            
            // 創建模式選項
            createModeOption(config) {
                const option = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-option',
                    'data-mode': config.id
                });
                
                if (BVShop.State.get('selectedMode') === config.id) {
                    option.classList.add('selected');
                }
                
                const icon = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-option-icon',
                    innerHTML: `<span class="material-icons" style="font-size: 48px; color: #518aff;">${config.icon}</span>`
                });
                
                const content = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-option-content'
                });
                
                const title = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-option-title',
                    textContent: config.title
                });
                
                const desc = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-option-desc',
                    textContent: config.desc
                });
                
                content.appendChild(title);
                content.appendChild(desc);
                
                option.appendChild(icon);
                option.appendChild(content);
                
                // 點擊事件
                option.addEventListener('click', () => {
                    // 移除其他選中狀態
                    document.querySelectorAll('.bv-mode-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    
                    // 設定選中狀態
                    option.classList.add('selected');
                    BVShop.State.set('selectedMode', config.id);
                    
                    // 啟用下一步按鈕
                    document.getElementById('bv-btn-next').disabled = false;
                });
                
                return option;
            },
            
            // Step 3: 明細設定
            renderDetailSettingsStep() {
                const container = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '32px',
                        height: '100%'
                    }
                });
                
                // 左側：設定區
                const settingsPanel = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        overflowY: 'auto',
                        paddingRight: '16px'
                    }
                });
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '明細設定',
                    style: {
                        margin: '0 0 24px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                // 文字設定
                const textSection = this.createSettingsSection('文字設定', 'text_fields', [
                    {
                        type: 'slider',
                        label: '文字大小',
                        desc: '調整明細文字大小',
                        id: 'fontSize',
                        min: 10,
                        max: 16,
                        step: 0.5,
                        value: BVShop.State.get('detailSettings.fontSize')
                    }
                ]);
                
                // 顯示選項
                const displaySection = this.createSettingsSection('顯示選項', 'visibility', [
                    {
                        type: 'switch',
                        label: '數量標示',
                        desc: '標示數量 ≥ 2（▲）',
                        id: 'showQuantityMark',
                        checked: BVShop.State.get('detailSettings.showQuantityMark')
                    },
                    {
                        type: 'switch',
                        label: '精簡模式',
                        desc: '只顯示重要資訊',
                        id: 'compactMode',
                        checked: BVShop.State.get('detailSettings.compactMode')
                    },
                    {
                        type: 'switch',
                        label: '隱藏表格標題',
                        desc: '隱藏商品列表標題列',
                        id: 'hideTableHeader',
                        checked: BVShop.State.get('detailSettings.hideTableHeader')
                    },
                    {
                        type: 'switch',
                        label: '顯示商品圖片',
                        desc: '在商品列表顯示圖片',
                        id: 'showProductImage',
                        checked: BVShop.State.get('detailSettings.showProductImage')
                    }
                ]);
                
                // 訂單資訊
                const orderSection = this.createSettingsSection('訂單資訊', 'receipt', [
                    {
                        type: 'switch',
                        label: '訂單編號',
                        id: 'showOrderNo',
                        checked: BVShop.State.get('detailSettings.showOrderNo')
                    },
                    {
                        type: 'switch',
                        label: '物流編號',
                        id: 'showLogisticsNo',
                        checked: BVShop.State.get('detailSettings.showLogisticsNo')
                    },
                    {
                        type: 'switch',
                        label: '送貨方式',
                        id: 'showDeliveryMethod',
                        checked: BVShop.State.get('detailSettings.showDeliveryMethod')
                    },
                    {
                        type: 'switch',
                        label: '收件人',
                        id: 'showRecipient',
                        checked: BVShop.State.get('detailSettings.showRecipient')
                    },
                    {
                        type: 'switch',
                        label: '收件人電話',
                        id: 'showRecipientPhone',
                        checked: BVShop.State.get('detailSettings.showRecipientPhone')
                    },
                    {
                        type: 'switch',
                        label: '收件人地址',
                        id: 'showRecipientAddress',
                        checked: BVShop.State.get('detailSettings.showRecipientAddress')
                    }
                ]);
                
                // 底圖設定
                const logoSection = this.createLogoSection();
                
                settingsPanel.appendChild(title);
                settingsPanel.appendChild(textSection);
                settingsPanel.appendChild(displaySection);
                settingsPanel.appendChild(orderSection);
                settingsPanel.appendChild(logoSection);
                
                // 右側：即時預覽
                const previewPanel = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        background: '#f5f5f5',
                        borderRadius: '12px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                });
                
                const previewTitle = BVShop.Utils.DOM.createElement('h3', {
                    textContent: '即時預覽',
                    style: {
                        margin: '0 0 16px 0',
                        fontSize: '16px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    },
                    innerHTML: '<span class="material-icons">preview</span> 即時預覽'
                });
                
                const previewContainer = BVShop.Utils.DOM.createElement('div', {
                    id: 'live-preview',
                    style: {
                        flex: '1',
                        background: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }
                });
                
                previewPanel.appendChild(previewTitle);
                previewPanel.appendChild(previewContainer);
                
                container.appendChild(settingsPanel);
                container.appendChild(previewPanel);
                
                // 初始化即時預覽
                this.updateLivePreview();
                
                // 監聽設定變化，更新預覽
                BVShop.State.watch('detailSettings.*', BVShop.Utils.General.debounce(() => {
                    this.updateLivePreview();
                }, 300));
                
                return container;
            },
            
            // 創建設定區塊
            createSettingsSection(title, icon, items) {
                const section = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section'
                });
                
                const sectionTitle = BVShop.Utils.DOM.createElement('h3', {
                    className: 'bv-settings-title',
                    innerHTML: `<span class="material-icons">${icon}</span> ${title}`
                });
                
                section.appendChild(sectionTitle);
                
                items.forEach(item => {
                    const settingItem = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-item'
                    });
                    
                    const info = BVShop.Utils.DOM.createElement('div');
                    const label = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-label',
                        textContent: item.label
                    });
                    info.appendChild(label);
                    
                    if (item.desc) {
                        const desc = BVShop.Utils.DOM.createElement('div', {
                            className: 'bv-setting-desc',
                            textContent: item.desc
                        });
                        info.appendChild(desc);
                    }
                    
                    let control;
                    if (item.type === 'switch') {
                        control = BVShop.UI.Components.createSwitch(item.checked);
                        const input = control.querySelector('input');
                        input.addEventListener('change', (e) => {
                            BVShop.State.set(`detailSettings.${item.id}`, e.target.checked);
                        });
                    } else if (item.type === 'slider') {
                        control = BVShop.UI.Components.createSlider({
                            min: item.min,
                            max: item.max,
                            step: item.step,
                            value: item.value,
                            onChange: (value) => {
                                BVShop.State.set(`detailSettings.${item.id}`, value);
                            }
                        });
                    }
                    
                    settingItem.appendChild(info);
                    settingItem.appendChild(control);
                    section.appendChild(settingItem);
                });
                
                return section;
            },
            
            // 創建底圖設定區塊
            createLogoSection() {
                const section = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section'
                });
                
                const title = BVShop.Utils.DOM.createElement('h3', {
                    className: 'bv-settings-title',
                    innerHTML: '<span class="material-icons">image</span> 底圖設定'
                });
                
                const uploadArea = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-upload-area',
                    id: 'logo-upload-area',
                    style: { marginBottom: '20px', padding: '20px' }
                });
                
                const currentLogo = BVShop.State.get('detailSettings.logoDataUrl');
                
                if (currentLogo) {
                    // 顯示已上傳的圖片
                    const preview = BVShop.Utils.DOM.createElement('img', {
                        src: currentLogo,
                        style: {
                            maxWidth: '100%',
                            maxHeight: '120px',
                            marginBottom: '12px'
                        }
                    });
                    
                    const removeBtn = BVShop.Utils.DOM.createElement('button', {
                        className: 'bv-button bv-button-secondary',
                        innerHTML: '<span class="material-icons">delete</span> 移除底圖',
                        onclick: () => {
                            BVShop.State.set('detailSettings.logoDataUrl', null);
                            this.renderDetailSettingsStep();
                        }
                    });
                    
                    uploadArea.appendChild(preview);
                    uploadArea.appendChild(removeBtn);
                } else {
                    // 顯示上傳提示
                    uploadArea.innerHTML = `
                        <div class="bv-upload-icon">
                            <span class="material-icons" style="font-size: 48px; color: #999;">add_photo_alternate</span>
                        </div>
                        <div class="bv-upload-text">點擊上傳底圖</div>
                        <div class="bv-upload-hint">支援 PNG / JPG 格式</div>
                    `;
                    
                    // 點擊上傳
                    uploadArea.addEventListener('click', () => {
                        const input = BVShop.Utils.DOM.createElement('input', {
                            type: 'file',
                            accept: 'image/png,image/jpeg,image/jpg',
                            onchange: (e) => this.handleLogoUpload(e)
                        });
                        input.click();
                    });
                }
                
                section.appendChild(title);
                section.appendChild(uploadArea);
                
                // 如果有底圖，顯示調整選項
                if (currentLogo) {
                    const controls = this.createLogoControls();
                    section.appendChild(controls);
                }
                
                return section;
            },
            
            // 創建底圖控制項
            createLogoControls() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const settings = [
                    {
                        label: '底圖大小',
                        id: 'logoSize',
                        min: 10,
                        max: 100,
                        value: BVShop.State.get('detailSettings.logoSize')
                    },
                    {
                        label: '水平位置',
                        id: 'logoX',
                        min: 0,
                        max: 100,
                        value: BVShop.State.get('detailSettings.logoX')
                    },
                    {
                        label: '垂直位置',
                        id: 'logoY',
                        min: 0,
                        max: 100,
                        value: BVShop.State.get('detailSettings.logoY')
                    },
                    {
                        label: '淡化程度',
                        id: 'logoOpacity',
                        min: 0,
                        max: 100,
                        value: BVShop.State.get('detailSettings.logoOpacity')
                    }
                ];
                
                settings.forEach(setting => {
                    const item = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-item'
                    });
                    
                    const label = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-label',
                        textContent: setting.label
                    });
                    
                    const slider = BVShop.UI.Components.createSlider({
                        min: setting.min,
                        max: setting.max,
                        value: setting.value,
                        onChange: (value) => {
                            BVShop.State.set(`detailSettings.${setting.id}`, value);
                        }
                    });
                    
                    item.appendChild(label);
                    item.appendChild(slider);
                    container.appendChild(item);
                });
                
                return container;
            },
            
            // 處理底圖上傳
            handleLogoUpload(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                if (!BVShop.Utils.Validation.validateFileType(file, ['image'])) {
                    BVShop.UI.Components.showNotification('請上傳 PNG 或 JPG 格式的圖片', 'warning');
                    return;
                }
                
                if (!BVShop.Utils.Validation.validateFileSize(file, 5)) {
                    BVShop.UI.Components.showNotification('圖片大小不能超過 5MB', 'warning');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    BVShop.State.set('detailSettings.logoDataUrl', e.target.result);
                    // 重新渲染設定頁面
                    const content = document.getElementById('bv-wizard-content');
                    content.innerHTML = '';
                    content.appendChild(this.renderDetailSettingsStep());
                };
                reader.readAsDataURL(file);
            },
            
            // Step 4: 物流單準備
            renderShippingSourceStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '請選擇物流單來源',
                    style: {
                        margin: '0 0 24px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                // 選項容器
                const options = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        display: 'grid',
                        gap: '20px',
                        marginBottom: '32px'
                    }
                });
                
                // 超商物流單選項
                const convenienceOption = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-shipping-option',
                    style: {
                        padding: '24px',
                        background: 'rgba(248, 250, 252, 0.8)',
                        border: '2px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    },
                    innerHTML: `
                        <div style="display: flex; align-items: flex-start; gap: 16px;">
                            <div style="font-size: 40px;">🏪</div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">超商物流單</h3>
                                <p style="margin: 0 0 12px 0; color: rgba(0, 0, 0, 0.6); font-size: 14px;">
                                    前往物流網站抓取<br>
                                    支援: 7-11、全家、萊爾富、OK
                                </p>
                                <button class="bv-button bv-button-primary" style="font-size: 14px;">
                                    前往抓取
                                </button>
                            </div>
                        </div>
                    `
                });
                
                // 宅配物流單選項
                const deliveryOption = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-shipping-option',
                    style: {
                        padding: '24px',
                        background: 'rgba(248, 250, 252, 0.8)',
                        border: '2px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    },
                    innerHTML: `
                        <div style="display: flex; align-items: flex-start; gap: 16px;">
                            <div style="font-size: 40px;">🚚</div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">宅配物流單</h3>
                                <p style="margin: 0 0 12px 0; color: rgba(0, 0, 0, 0.6); font-size: 14px;">
                                    上傳 PDF 檔案<br>
                                    支援: 黑貓、新竹貨運、嘉里大榮
                                </p>
                                <button class="bv-button bv-button-secondary" style="font-size: 14px;">
                                    選擇檔案
                                </button>
                            </div>
                        </div>
                    `
                });
                
                // 檔案輸入（隱藏）
                const fileInput = BVShop.Utils.DOM.createElement('input', {
                    type: 'file',
                    accept: '.pdf,.jpg,.jpeg,.png',
                    multiple: true,
                    style: { display: 'none' }
                });
                
                // 狀態顯示
                const statusSection = BVShop.Utils.DOM.createElement('div', {
                    id: 'shipping-status',
                    style: {
                        padding: '16px',
                        background: 'rgba(81, 138, 255, 0.08)',
                        borderRadius: '8px',
                        marginBottom: '20px'
                    }
                });
                
                this.updateShippingStatus();
                
                // 已上傳檔案列表
                const fileList = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-file-list',
                    id: 'shipping-file-list',
                    style: { marginTop: '20px' }
                });
                
                // 手動重新載入按鈕
                const reloadBtn = BVShop.Utils.DOM.createElement('button', {
                    className: 'bv-button bv-button-secondary',
                    innerHTML: '<span class="material-icons">refresh</span> 重新載入物流單',
                    style: {
                        marginTop: '20px',
                        width: '100%'
                    },
                    onclick: () => {
                        this.checkCrossTabData();
                    }
                });
                
                // 事件處理
                convenienceOption.querySelector('button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showConvenienceGuide();
                });
                
                deliveryOption.querySelector('button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    fileInput.click();
                });
                
                fileInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        BVShop.WizardController.handleShippingFiles(files);
                    }
                });
                
                // 新增略過按鈕功能
                const nextBtn = document.getElementById('bv-btn-next');
                if (nextBtn) {
                    const shippingData = BVShop.State.get('shippingData') || [];
                    const shippingDataBatches = BVShop.State.get('shippingDataBatches') || [];
                    
                    if (shippingData.length === 0 && shippingDataBatches.length === 0) {
                        nextBtn.textContent = '略過';
                        nextBtn.disabled = false;
                    } else {
                        nextBtn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
                        nextBtn.disabled = false;
                    }
                }
                
                options.appendChild(convenienceOption);
                options.appendChild(deliveryOption);
                
                container.appendChild(title);
                container.appendChild(statusSection);
                container.appendChild(options);
                container.appendChild(fileList);
                container.appendChild(reloadBtn);
                container.appendChild(fileInput);
                
                // 更新檔案列表
                this.updateFileList();
                
                // 檢查是否有跨分頁資料
                this.checkCrossTabData();
                
                return container;
            },
            
            // 更新物流單狀態
            updateShippingStatus() {
                const statusEl = document.getElementById('shipping-status');
                if (!statusEl) return;
                
                const shippingData = BVShop.State.get('shippingData') || [];
                const shippingDataBatches = BVShop.State.get('shippingDataBatches') || [];
                const totalCount = shippingData.length + 
                    shippingDataBatches.reduce((sum, batch) => sum + batch.data.length, 0);
                
                if (totalCount > 0) {
                    statusEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; color: #10b981;">
                            <span class="material-icons">check_circle</span>
                            <span>已載入 ${totalCount} 張物流單</span>
                        </div>
                    `;
                } else {
                    statusEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-icons" style="color: #518aff;">info</span>
                            <span>目前狀態: 尚無物流單資料</span>
                        </div>
                    `;
                }
            },
            
            // 顯示超商抓取指引
            showConvenienceGuide() {
                const modal = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-modal',
                    style: {
                        position: 'fixed',
                        top: '0',
                        left: '0',
                        right: '0',
                        bottom: '0',
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: '10001'
                    }
                });
                
                const content = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        background: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    },
                    innerHTML: `
                        <h2 style="margin: 0 0 24px 0; display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 32px;">🏪</span>
                            超商物流單抓取指引
                        </h2>
                        
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; margin: 0 0 16px 0;">📋 操作步驟：</h3>
                            
                            <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                                <li style="margin-bottom: 12px;">
                                    <strong>請在 BV 後台開啟新分頁</strong>
                                </li>
                                <li style="margin-bottom: 12px;">
                                    前往 <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">
                                    訂單管理 → 批次列印物流單</code>
                                </li>
                                <li style="margin-bottom: 12px;">
                                    選擇要列印的訂單
                                </li>
                                <li style="margin-bottom: 12px;">
                                    在物流單頁面會看到抓取按鈕<br>
                                    點擊 <button class="bv-button bv-button-primary" style="font-size: 12px; padding: 4px 12px;">
                                        <span class="material-icons" style="font-size: 14px;">download</span> 抓取並儲存
                                    </button>
                                </li>
                                <li style="margin-bottom: 12px;">
                                    抓取完成後，回到此分頁
                                </li>
                            </ol>
                        </div>
                        
                        <div style="background: rgba(81, 138, 255, 0.08); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                                <span class="material-icons" style="font-size: 18px; color: #518aff;">lightbulb</span>
                                小提示：
                            </h4>
                            <ul style="margin: 0; padding-left: 24px; font-size: 14px; color: #666;">
                                <li>請勿關閉此分頁</li>
                                <li>抓取後會自動偵測</li>
                                <li>支援多批次抓取</li>
                            </ul>
                        </div>
                        
                        <div id="capture-status" style="text-align: center; padding: 16px; background: #f5f5f5; border-radius: 8px; margin-bottom: 24px;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <div class="bv-loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
                                <span>狀態：等待抓取中...</span>
                            </div>
                            <div style="margin-top: 8px; font-size: 14px; color: #666;">
                                已抓取: <strong id="captured-count">0</strong> 張
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="bv-button bv-button-secondary" onclick="this.closest('.bv-modal').remove()">
                                返回
                            </button>
                            <button class="bv-button bv-button-primary" id="manual-refresh">
                                <span class="material-icons">refresh</span> 手動重新整理
                            </button>
                        </div>
                    `
                });
                
                modal.appendChild(content);
                document.body.appendChild(modal);
                
                // 點擊背景關閉
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.remove();
                    }
                });
                
                // 手動重新整理
                content.querySelector('#manual-refresh').addEventListener('click', () => {
                    this.checkCrossTabData();
                });
                
                // 開始輪詢檢查
                this.startPollingForData();
            },
            
            // 檢查跨分頁資料
            async checkCrossTabData() {
                try {
                    const result = await chrome.storage.local.get(['capturedShippingData', 'shippingDataBatches']);
                    
                    if (result.capturedShippingData && result.capturedShippingData.length > 0) {
                        // 創建新批次
                        const newBatch = {
                            id: Date.now(),
                            type: 'screenshot',
                            provider: result.capturedShippingData[0].provider || 'UNKNOWN',
                            name: `${new Date().toLocaleTimeString()} - 抓取`,
                            data: result.capturedShippingData,
                            timestamp: new Date().toISOString()
                        };
                        
                        // 更新狀態
                        const currentBatches = BVShop.State.get('shippingDataBatches') || [];
                        currentBatches.push(newBatch);
                        BVShop.State.set('shippingDataBatches', currentBatches);
                        
                        // 清除 storage
                        await chrome.storage.local.remove('capturedShippingData');
                        
                        // 更新顯示
                        this.updateFileList();
                        this.updateShippingStatus();
                        this.updateCaptureStatus(result.capturedShippingData.length);
                        
                        // 顯示成功訊息
                        BVShop.UI.Components.showNotification(
                            `成功載入 ${result.capturedShippingData.length} 張物流單`,
                            'success'
                        );
                        
                        // 關閉指引視窗
                        const modal = document.querySelector('.bv-modal');
                        if (modal) modal.remove();
                        
                        // 更新按鈕狀態
                        const nextBtn = document.getElementById('bv-btn-next');
                        if (nextBtn) {
                            nextBtn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
                            nextBtn.disabled = false;
                        }
                    } else if (result.shippingDataBatches) {
                        // 載入已儲存的批次資料
                        BVShop.State.set('shippingDataBatches', result.shippingDataBatches);
                        this.updateFileList();
                        this.updateShippingStatus();
                    }
                } catch (error) {
                    console.error('檢查跨分頁資料錯誤:', error);
                }
            },
            
            // 開始輪詢檢查資料
            startPollingForData() {
                // 停止之前的輪詢
                if (this.pollingInterval) {
                    clearInterval(this.pollingInterval);
                }
                
                // 每2秒檢查一次
                this.pollingInterval = setInterval(() => {
                    this.checkCrossTabData();
                }, 2000);
                
                // 5分鐘後停止輪詢
                setTimeout(() => {
                    if (this.pollingInterval) {
                        clearInterval(this.pollingInterval);
                        this.pollingInterval = null;
                    }
                }, 300000);
            },
            
            // 更新抓取狀態
            updateCaptureStatus(count) {
                const countEl = document.getElementById('captured-count');
                if (countEl) {
                    countEl.textContent = count;
                }
                
                const statusEl = document.getElementById('capture-status');
                if (statusEl && count > 0) {
                    statusEl.innerHTML = `
                        <div style="color: #10b981; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span class="material-icons">check_circle</span>
                            <span>抓取完成！</span>
                        </div>
                        <div style="margin-top: 8px; font-size: 14px; color: #666;">
                            已抓取: <strong>${count}</strong> 張
                        </div>
                    `;
                }
            },
            
            // 更新檔案列表
            updateFileList() {
                const fileListEl = document.getElementById('shipping-file-list');
                if (!fileListEl) return;
                
                const batches = BVShop.State.get('shippingDataBatches') || [];
                
                if (batches.length === 0) {
                    fileListEl.innerHTML = '';
                    return;
                }
                
                fileListEl.innerHTML = `
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">已載入的物流單批次：</h4>
                    ${batches.map((batch, index) => `
                        <div class="bv-file-item">
                            <span class="material-icons bv-file-icon">
                                ${batch.type === 'pdf' ? 'picture_as_pdf' : 'collections'}
                            </span>
                            <div class="bv-file-name">${batch.name}</div>
                            <div class="bv-file-size">${batch.data.length} 張</div>
                            <span class="material-icons bv-file-remove" data-index="${index}">close</span>
                        </div>
                    `).join('')}
                `;
                
                // 綁定刪除事件
                fileListEl.querySelectorAll('.bv-file-remove').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const index = parseInt(e.target.dataset.index);
                        BVShop.WizardController.removeShippingBatch(index);
                    });
                });
            },
            
            // Step 5: 配對設定
            renderMatchingStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '配對設定',
                    style: {
                        margin: '0 0 24px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                // 配對方式
                const matchingSection = this.createSettingsSection('配對方式', 'link', [
                    {
                        type: 'radio',
                        name: 'matching-method',
                        options: [
                            { value: 'index', label: '依索引順序', desc: '明細與物流單按順序配對' },
                            { value: 'order', label: '依訂單編號', desc: '使用訂單編號進行配對' },
                            { value: 'logistics', label: '依物流編號', desc: '使用物流編號進行配對' }
                        ],
                        value: BVShop.State.get('matchingSettings.method'),
                        onChange: (value) => {
                            BVShop.State.set('matchingSettings.method', value);
                        }
                    }
                ]);
                
                // 排序設定
                const sortSection = this.createSettingsSection('排序設定', 'sort', [
                    {
                        type: 'radio',
                        name: 'detail-sort',
                        label: '出貨明細排序',
                        options: [
                            { value: 'asc', label: '新到舊' },
                            { value: 'desc', label: '舊到新' }
                        ],
                        value: BVShop.State.get('matchingSettings.detailSort'),
                        onChange: (value) => {
                            BVShop.State.set('matchingSettings.detailSort', value);
                        }
                    },
                    {
                        type: 'switch',
                        label: '物流單反序',
                        desc: '當物流單順序與明細相反時使用',
                        id: 'reverseShipping',
                        checked: BVShop.State.get('matchingSettings.reverseShipping')
                    }
                ]);
                
                // 其他設定
                const otherSection = this.createSettingsSection('其他設定', 'settings', [
                    {
                        type: 'switch',
                        label: '在物流單上顯示訂單編號',
                        desc: '方便識別對應的訂單',
                        id: 'showOrderLabel',
                        checked: BVShop.State.get('matchingSettings.showOrderLabel')
                    }
                ]);
                
                // 配對預覽
                const previewSection = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section',
                    style: { marginTop: '24px' }
                });
                
                const previewTitle = BVShop.Utils.DOM.createElement('h3', {
                    className: 'bv-settings-title',
                    innerHTML: '<span class="material-icons">preview</span> 配對預覽'
                });
                
                const previewContent = BVShop.Utils.DOM.createElement('div', {
                    id: 'matching-preview',
                    style: {
                        padding: '16px',
                        background: 'white',
                        borderRadius: '8px',
                        minHeight: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }
                });
                
                previewSection.appendChild(previewTitle);
                previewSection.appendChild(previewContent);
                
                container.appendChild(title);
                container.appendChild(matchingSection);
                container.appendChild(sortSection);
                container.appendChild(otherSection);
                container.appendChild(previewSection);
                
                // 更新配對預覽
                this.updateMatchingPreview();
                
                return container;
            },
            
            // 更新配對預覽
            updateMatchingPreview() {
                const previewEl = document.getElementById('matching-preview');
                if (!previewEl) return;
                
                const orderData = BVShop.State.get('orderData') || [];
                const shippingDataBatches = BVShop.State.get('shippingDataBatches') || [];
                const matchingMethod = BVShop.State.get('matchingSettings.method');
                
                // 合併所有物流單資料
                const allShippingData = [];
                shippingDataBatches.forEach(batch => {
                    allShippingData.push(...batch.data);
                });
                
                if (orderData.length === 0 || allShippingData.length === 0) {
                    previewEl.innerHTML = `
                        <div style="text-align: center; color: #999;">
                            <span class="material-icons" style="font-size: 48px;">info</span>
                            <p>暫無資料可預覽</p>
                        </div>
                    `;
                    return;
                }
                
                // 執行配對
                const matchedData = BVShop.Logic.Matching.performMatching(
                    orderData,
                    allShippingData,
                    BVShop.State.get('matchingSettings')
                );
                
                // 顯示配對結果統計
                const successCount = matchedData.filter(m => m.matched).length;
                const totalCount = matchedData.length;
                
                previewEl.innerHTML = `
                    <div style="width: 100%;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600;">配對結果</h4>
                            <span style="font-size: 14px; color: ${successCount === totalCount ? '#10b981' : '#f59e0b'};">
                                ${successCount} / ${totalCount} 成功配對
                            </span>
                        </div>
                        <div style="display: grid; gap: 8px;">
                            ${matchedData.slice(0, 3).map(item => `
                                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                                    <span class="material-icons" style="color: ${item.matched ? '#10b981' : '#ef4444'}; font-size: 20px;">
                                        ${item.matched ? 'check_circle' : 'cancel'}
                                    </span>
                                    <span style="font-size: 13px;">
                                        訂單 ${item.order.orderNo || `#${item.index}`}
                                        ${item.matched ? ` → 物流單 ${item.shipping?.orderNo || item.shipping?.logisticsNo || `#${item.index}`}` : ' (無配對)'}
                                    </span>
                                </div>
                            `).join('')}
                            ${matchedData.length > 3 ? `
                                <div style="text-align: center; color: #666; font-size: 12px; padding: 8px;">
                                    ... 還有 ${matchedData.length - 3} 筆資料
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            },
            
            // 創建單選按鈕組
            createRadioGroup(options) {
                const container = BVShop.Utils.DOM.createElement('div', {
                    style: { display: 'flex', flexDirection: 'column', gap: '8px' }
                });
                
                options.options.forEach(opt => {
                    const label = BVShop.Utils.DOM.createElement('label', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '6px',
                            transition: 'background 0.2s'
                        }
                    });
                    
                    const radio = BVShop.Utils.DOM.createElement('input', {
                        type: 'radio',
                        name: options.name,
                        value: opt.value,
                        checked: options.value === opt.value,
                        onchange: () => {
                            if (options.onChange) {
                                options.onChange(opt.value);
                            }
                        }
                    });
                    
                    const text = BVShop.Utils.DOM.createElement('div');
                    const mainLabel = BVShop.Utils.DOM.createElement('div', {
                        textContent: opt.label,
                        style: { fontWeight: '500' }
                    });
                    text.appendChild(mainLabel);
                    
                    if (opt.desc) {
                        const desc = BVShop.Utils.DOM.createElement('div', {
                            textContent: opt.desc,
                            style: { fontSize: '12px', color: '#666' }
                        });
                        text.appendChild(desc);
                    }
                    
                    label.appendChild(radio);
                    label.appendChild(text);
                    
                    // Hover 效果
                    label.addEventListener('mouseenter', () => {
                        label.style.background = 'rgba(0, 0, 0, 0.02)';
                    });
                    label.addEventListener('mouseleave', () => {
                        label.style.background = 'transparent';
                    });
                    
                    container.appendChild(label);
                });
                
                return container;
            },
            
            // Step 6: 預覽列印
            renderPreviewStep() {
                const container = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                });
                
                const header = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '24px'
                    }
                });
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '預覽與列印',
                    style: {
                        margin: '0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                const actions = BVShop.Utils.DOM.createElement('div', {
                    style: { display: 'flex', gap: '12px' }
                });
                
                const printBtn = BVShop.Utils.DOM.createElement('button', {
                    className: 'bv-button bv-button-primary',
                    innerHTML: '<span class="material-icons">print</span> 列印',
                    onclick: () => BVShop.WizardController.handlePrint()
                });
                
                const downloadBtn = BVShop.Utils.DOM.createElement('button', {
                    className: 'bv-button bv-button-secondary',
                    innerHTML: '<span class="material-icons">download</span> 下載 PDF',
                    onclick: () => BVShop.WizardController.handleDownload()
                });
                
                actions.appendChild(printBtn);
                actions.appendChild(downloadBtn);
                
                header.appendChild(title);
                header.appendChild(actions);
                
                const previewContainer = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-preview-container',
                    id: 'label-preview',
                    style: { flex: '1' }
                });
                
                container.appendChild(header);
                container.appendChild(previewContainer);
                
                // 生成預覽
                setTimeout(() => {
                    BVShop.WizardController.generatePreview();
                }, 100);
                
                return container;
            },
            
            // 更新即時預覽
            updateLivePreview() {
                const previewContainer = document.getElementById('live-preview');
                if (!previewContainer) return;
                
                try {
                    const settings = BVShop.State.get('detailSettings');
                    const orderData = BVShop.State.get('orderData')[0] || BVShop.Logic.Data.getMockOrderData();
                    
                    // 生成預覽標籤
                    const previewLabel = BVShop.Logic.Format.convertToLabel(orderData, settings);
                    
                    // 縮放以適應預覽區域
                    const wrapper = BVShop.Utils.DOM.createElement('div', {
                        style: {
                            transform: 'scale(0.6)',
                            transformOrigin: 'center'
                        }
                    });
                    
                    wrapper.appendChild(previewLabel);
                    
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(wrapper);
                    
                } catch (error) {
                    console.error('預覽更新錯誤:', error);
                    previewContainer.innerHTML = `
                        <div style="text-align: center; color: #999;">
                            <span class="material-icons" style="font-size: 48px;">error_outline</span>
                            <p>預覽生成失敗</p>
                        </div>
                    `;
                }
            }
        },
        
        // ========== UI 管理 ==========
        init() {
            // 載入樣式
            this.loadStyles();
            
            // 創建啟動按鈕
            this.createLaunchButton();
            
            // 載入 Material Icons
            this.loadMaterialIcons();
            
            // 綁定全域鍵盤事件
            this.bindKeyboardEvents();
        },
        
        loadStyles() {
            const styleId = 'bv-wizard-styles';
            if (!document.getElementById(styleId)) {
                const style = BVShop.Utils.DOM.createElement('style', {
                    id: styleId,
                    textContent: this.Styles.getStyles()
                });
                document.head.appendChild(style);
            }
        },
        
        loadMaterialIcons() {
            if (!document.querySelector('link[href*="Material+Icons"]')) {
                const link = BVShop.Utils.DOM.createElement('link', {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/icon?family=Material+Icons'
                });
                document.head.appendChild(link);
            }
        },
        
        createLaunchButton() {
            // 檢查頁面類型
            const pageType = BVShop.Utils.PageDetection.detectCurrentPage();
            
            if (pageType === 'shipping') {
                // 物流單頁面：顯示抓取按鈕
                this.createCaptureButton();
            } else if (pageType === 'order') {
                // 訂單頁面：顯示標籤列印按鈕
                const button = BVShop.Utils.DOM.createElement('button', {
                    id: 'bv-launch-button',
                    innerHTML: '<span class="material-icons">local_print_shop</span> 標籤列印'
                });
                
                button.addEventListener('click', () => {
                    BVShop.WizardController.start();
                });
                
                document.body.appendChild(button);
            }
        },
        
        createCaptureButton() {
            const button = BVShop.Utils.DOM.createElement('button', {
                id: 'bv-launch-button',
                innerHTML: '<span class="material-icons">download</span> 抓取並儲存',
                style: {
                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                }
            });
            
            button.addEventListener('click', () => {
                BVShop.Logic.Shipping.captureCurrentPage();
            });
            
            document.body.appendChild(button);
        },
        
        bindKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // ESC 關閉 Wizard
                if (e.key === 'Escape' && BVShop.State.get('isWizardOpen')) {
                    BVShop.UI.hide();
                }
            });
        },
        
        show() {
            if (BVShop.State.get('isWizardOpen')) return;
            
            const container = this.Components.createContainer();
            const panel = this.Components.createPanel();
            const header = this.Components.createHeader();
            const content = this.Components.createContent();
            const footer = this.Components.createFooter();
            
            panel.appendChild(header);
            panel.appendChild(content);
            panel.appendChild(footer);
            container.appendChild(panel);
            
            document.body.appendChild(container);
            
            BVShop.State.set('isWizardOpen', true);
            
            // 綁定事件
            this.bindWizardEvents();
        },
        
        hide() {
            const container = document.getElementById('bv-wizard-container');
            if (container) {
                container.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    container.remove();
                    BVShop.State.set('isWizardOpen', false);
                }, 300);
            }
        },
        
        updateContent(content) {
            const contentEl = document.getElementById('bv-wizard-content');
            if (contentEl) {
                contentEl.innerHTML = '';
                if (typeof content === 'string') {
                    contentEl.innerHTML = content;
                } else if (content instanceof Node) {
                    contentEl.appendChild(content);
                }
            }
        },
        
        updateButtons(config) {
            const prevBtn = document.getElementById('bv-btn-prev');
            const nextBtn = document.getElementById('bv-btn-next');
            
            if (prevBtn) {
                prevBtn.style.display = config.showPrev ? 'flex' : 'none';
            }
            
            if (nextBtn) {
                nextBtn.textContent = config.nextText || '下一步';
                nextBtn.innerHTML = config.nextText || '下一步 <span class="material-icons">arrow_forward</span>';
                nextBtn.disabled = config.nextDisabled || false;
                
                if (config.isLastStep) {
                    nextBtn.className = 'bv-button bv-button-primary';
                    nextBtn.innerHTML = '<span class="material-icons">check</span> 完成';
                }
            }
        },
        
        bindWizardEvents() {
            // 取消按鈕
            document.getElementById('bv-btn-cancel')?.addEventListener('click', () => {
                if (confirm('確定要取消嗎？已設定的內容將不會儲存。')) {
                    this.hide();
                }
            });
            
            // 上一步按鈕
            document.getElementById('bv-btn-prev')?.addEventListener('click', () => {
                BVShop.WizardController.previousStep();
            });
            
            // 下一步按鈕
            document.getElementById('bv-btn-next')?.addEventListener('click', () => {
                BVShop.WizardController.nextStep();
            });
            
            // 步驟指示器點擊
            document.querySelectorAll('.bv-step-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    const stepId = dot.dataset.step;
                    if (BVShop.State.get('completedSteps').includes(stepId)) {
                        BVShop.WizardController.goToStep(stepId);
                    }
                });
            });
        },
        
        updateStepIndicator(currentStep) {
            const dots = document.querySelectorAll('.bv-step-dot');
            const lines = document.querySelectorAll('.bv-step-line');
            const completedSteps = BVShop.State.get('completedSteps');
            
            dots.forEach(dot => {
                const stepId = dot.dataset.step;
                dot.classList.remove('active', 'completed');
                
                if (stepId === currentStep) {
                    dot.classList.add('active');
                } else if (completedSteps.includes(stepId)) {
                    dot.classList.add('completed');
                }
            });
            
            // 更新連接線
            lines.forEach(line => {
                const stepId = line.dataset.stepLine;
                line.classList.toggle('completed', completedSteps.includes(stepId));
            });
        }
    };
    
    // ========================================
    // 7. 業務邏輯 (Logic)
    // ========================================
    BVShop.Logic = {
        // ========== 資料處理 ==========
        Data: {
            // 從頁面提取訂單資料
            extractOrderData() {
                const orderContents = document.querySelectorAll('.order-content');
                const orders = [];
                
                orderContents.forEach((content, index) => {
                    const orderData = {
                        index: index,
                        orderNo: this.extractOrderNumber(content),
                        logisticsNo: this.extractLogisticsNumber(content),
                        deliveryMethod: this.extractDeliveryMethod(content),
                        recipient: this.extractRecipient(content),
                        recipientPhone: this.extractRecipientPhone(content),
                        recipientAddress: this.extractRecipientAddress(content),
                        products: this.extractProducts(content),
                        notes: this.extractNotes(content),
                        element: content
                    };
                    
                    orders.push(orderData);
                });
                
                return orders;
            },
            
            // 提取訂單編號
            extractOrderNumber(content) {
                const patterns = [
                    /訂單編號[：:]\s*([A-Z0-9]+)/i,
                    /訂單號碼[：:]\s*([A-Z0-9]+)/i,
                    /Order\s*No[：:]\s*([A-Z0-9]+)/i
                ];
                
                const text = content.textContent || '';
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            },
            
            // 提取物流編號
            extractLogisticsNumber(content) {
                const patterns = [
                    /物流編號[：:]\s*([A-Z0-9-]+)/i,
                    /物流單號[：:]\s*([A-Z0-9-]+)/i,
                    /交貨便服務代碼[：:]\s*([A-Z0-9-]+)/i,
                    /服務代碼[：:]\s*([A-Z0-9-]+)/i
                ];
                
                const text = content.textContent || '';
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            },
            
            // 提取送貨方式
            extractDeliveryMethod(content) {
                const patterns = [
                    /送貨方式[：:]\s*([^,\n]+)/i,
                    /配送方式[：:]\s*([^,\n]+)/i
                ];
                
                const text = content.textContent || '';
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            },
            
            // 提取收件人
            extractRecipient(content) {
                const patterns = [
                    /收件人[：:]\s*([^\n,]+)/i,
                    /收貨人[：:]\s*([^\n,]+)/i
                ];
                
                const text = content.textContent || '';
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            },
            
            // 提取收件人電話
            extractRecipientPhone(content) {
                const patterns = [
                    /收件人電話[：:]\s*([\d-]+)/i,
                    /電話[：:]\s*([\d-]+)/i,
                    /手機[：:]\s*([\d-]+)/i
                ];
                
                const text = content.textContent || '';
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            },
            
            // 提取收件人地址
            extractRecipientAddress(content) {
                const patterns = [
                    /收件人地址[：:]\s*([^\n]+)/i,
                    /送貨地址[：:]\s*([^\n]+)/i,
                    /地址[：:]\s*([^\n]+)/i
                ];
                
                const text = content.textContent || '';
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            },
            
            // 提取商品資料
            extractProducts(content) {
                const products = [];
                const rows = content.querySelectorAll('.list-item');
                
                rows.forEach(row => {
                    const product = {
                        name: row.querySelector('.list-item-name')?.textContent?.trim() || '',
                        quantity: this.extractQuantity(row),
                        price: row.querySelector('.text-right')?.textContent?.trim() || '',
                        image: this.extractProductImage(row)
                    };
                    
                    products.push(product);
                });
                
                return products;
            },
            
            // 提取數量
            extractQuantity(row) {
                const cells = row.querySelectorAll('td');
                
                // 從右往左數第二個開始尋找純數字的欄位
                for (let i = cells.length - 2; i >= 0; i--) {
                    const text = cells[i].textContent.trim();
                    if (/^\d+$/.test(text)) {
                        return parseInt(text);
                    }
                }
                
                return 1;
            },
            
            // 提取商品圖片
            extractProductImage(row) {
                const img = row.querySelector('.orderProductImage') || row.querySelector('img');
                return img ? img.src : null;
            },
            
            // 提取備註
            extractNotes(content) {
                const noteElement = content.querySelector('.order-extra p');
                return noteElement ? noteElement.textContent.trim() : '';
            },
            
            // 取得模擬資料（用於預覽）
            getMockOrderData() {
                return {
                    orderNo: 'BV2024010001',
                    logisticsNo: 'S123456789',
                    deliveryMethod: '7-11 超商取貨',
                    recipient: '王小明',
                    recipientPhone: '0912-345-678',
                    recipientAddress: '台北市信義區信義路五段7號',
                    products: [
                        {
                            name: '示範商品 A - 紅色/M',
                            quantity: 2,
                            price: 'NT$ 399',
                            image: null
                        },
                        {
                            name: '示範商品 B - 藍色/L',
                            quantity: 1,
                            price: 'NT$ 599',
                            image: null
                        }
                    ],
                    notes: '請小心包裝，謝謝！'
                };
            }
        },
        
        // ========== 格式轉換 ==========
        Format: {
            // 將訂單資料轉換為標籤格式
            convertToLabel(orderData, settings) {
                const format = BVShop.Config.LABEL_FORMATS[BVShop.State.get('selectedFormat')];
                
                const page = BVShop.Utils.DOM.createElement('div', {
                    className: `bv-label-page format-${BVShop.State.get('selectedFormat')}`,
                    style: {
                        width: `${format.widthPx}px`,
                        height: `${format.heightPx}px`,
                        padding: `${format.padding}mm`,
                        fontFamily: 'Noto Sans TC, sans-serif',
                        fontSize: `${settings.fontSize}px`,
                        position: 'relative',
                        background: 'white',
                        overflow: 'hidden'
                    }
                });
                
                // 如果有底圖，添加底圖
                if (settings.logoDataUrl) {
                    const logo = this.createBackgroundLogo(settings);
                    page.appendChild(logo);
                }
                
                // 標題
                const title = BVShop.Utils.DOM.createElement('h1', {
                    textContent: '出貨明細',
                    style: {
                        margin: '0 0 8px 0',
                        fontSize: `${settings.fontSize + 2}px`,
                        textAlign: 'center',
                        fontWeight: 'bold'
                    }
                });
                
                // 訂單資訊
                const orderInfo = this.createOrderInfo(orderData, settings);
                
                // 商品列表
                const productList = this.createProductList(orderData, settings);
                
                // 備註
                const notes = this.createNotes(orderData, settings);
                
                page.appendChild(title);
                page.appendChild(orderInfo);
                page.appendChild(productList);
                if (notes) page.appendChild(notes);
                
                return page;
            },
            
            // 創建底圖
            createBackgroundLogo(settings) {
                const logo = BVShop.Utils.DOM.createElement('img', {
                    src: settings.logoDataUrl,
                    className: 'label-background-logo',
                    style: {
                        position: 'absolute',
                        left: `${settings.logoX}%`,
                        top: `${settings.logoY}%`,
                        width: 'auto',
                        height: `${settings.logoSize}%`,
                        transform: 'translate(-50%, -50%)',
                        opacity: settings.logoOpacity / 100,
                        zIndex: 1,
                        pointerEvents: 'none',
                        objectFit: 'contain'
                    }
                });
                
                return logo;
            },
            
            // 創建訂單資訊區塊
            createOrderInfo(orderData, settings) {
                const info = BVShop.Utils.DOM.createElement('div', {
                    className: 'order-info',
                    style: {
                        marginBottom: '6px',
                        position: 'relative',
                        zIndex: 2
                    }
                });
                
                const fields = [];
                
                if (settings.showOrderNo && orderData.orderNo) {
                    fields.push(`訂單編號：${orderData.orderNo}`);
                }
                
                if (settings.showLogisticsNo && orderData.logisticsNo) {
                    fields.push(`物流編號：${orderData.logisticsNo}`);
                }
                
                if (settings.showDeliveryMethod && orderData.deliveryMethod) {
                    fields.push(`送貨方式：${orderData.deliveryMethod}`);
                }
                
                if (settings.showRecipient && orderData.recipient) {
                    fields.push(`收件人：${orderData.recipient}`);
                }
                
                if (settings.showRecipientPhone && orderData.recipientPhone) {
                    fields.push(`收件人電話：${orderData.recipientPhone}`);
                }
                
                if (settings.showRecipientAddress && orderData.recipientAddress) {
                    fields.push(`收件人地址：${orderData.recipientAddress}`);
                }
                
                // 如果是精簡模式，只保留重要資訊
                if (settings.compactMode) {
                    const importantFields = ['訂單編號', '物流編號', '送貨方式', '收件人'];
                    fields.filter(field => 
                        importantFields.some(important => field.includes(important))
                    );
                }
                
                fields.forEach(field => {
                    const p = BVShop.Utils.DOM.createElement('p', {
                        textContent: field,
                        style: {
                            margin: '0 0 3px 0',
                            fontSize: `${settings.fontSize - 1}px`,
                            lineHeight: '1.4'
                        }
                    });
                    info.appendChild(p);
                });
                
                return info;
            },
            
            // 創建商品列表
            createProductList(orderData, settings) {
                const table = BVShop.Utils.DOM.createElement('table', {
                    className: 'list',
                    style: {
                        width: '100%',
                        borderCollapse: 'collapse',
                        marginBottom: '6px',
                        position: 'relative',
                        zIndex: 2
                    }
                });
                
                // 表格標題（如果不隱藏）
                if (!settings.hideTableHeader) {
                    const thead = BVShop.Utils.DOM.createElement('thead');
                    const headerRow = BVShop.Utils.DOM.createElement('tr', {
                        className: 'list-title',
                        style: {
                            borderTop: '0.5mm solid #000',
                            borderBottom: '0.5mm solid #000'
                        }
                    });
                    
                    const headers = [];
                    if (settings.showProductImage) {
                        headers.push({ text: '', width: '8mm' });
                    }
                    headers.push(
                        { text: '商品名稱', align: 'left' },
                        { text: '數量', align: 'right', width: '30px' },
                        { text: '小計', align: 'right' }
                    );
                    
                    headers.forEach(header => {
                        const th = BVShop.Utils.DOM.createElement('th', {
                            textContent: header.text,
                            style: {
                                padding: '4px',
                                fontSize: `${settings.fontSize - 1}px`,
                                fontWeight: 'bold',
                                textAlign: header.align || 'left',
                                width: header.width || 'auto'
                            }
                        });
                        headerRow.appendChild(th);
                    });
                    
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                }
                
                // 商品列表
                const tbody = BVShop.Utils.DOM.createElement('tbody');
                
                orderData.products.forEach((product, index) => {
                    const row = BVShop.Utils.DOM.createElement('tr', {
                        className: 'list-item',
                        style: {
                            borderBottom: index < orderData.products.length - 1 ? '0.2mm solid #ddd' : 'none'
                        }
                    });
                    
                    // 商品圖片（如果啟用）
                    if (settings.showProductImage) {
                        const imageCell = BVShop.Utils.DOM.createElement('td', {
                            className: 'bv-product-image-col',
                            style: {
                                width: '8mm',
                                padding: '2px',
                                verticalAlign: 'top'
                            }
                        });
                        
                        if (product.image) {
                            const img = BVShop.Utils.DOM.createElement('img', {
                                src: product.image,
                                className: 'bv-product-img',
                                style: {
                                    display: 'block',
                                    width: '7mm',
                                    height: '7mm',
                                    objectFit: 'cover',
                                    borderRadius: '2px'
                                }
                            });
                            imageCell.appendChild(img);
                        }
                        
                        row.appendChild(imageCell);
                    }
                    
                    // 商品名稱
                    const nameCell = BVShop.Utils.DOM.createElement('td', {
                        className: 'list-item-name',
                        textContent: product.name,
                        style: {
                            padding: '4px',
                            fontSize: `${settings.fontSize}px`,
                            fontWeight: '500'
                        }
                    });
                    
                    // 數量
                    const qtyCell = BVShop.Utils.DOM.createElement('td', {
                        style: {
                            padding: '4px',
                            fontSize: `${settings.fontSize}px`,
                            textAlign: 'right'
                        }
                    });
                    
                    if (settings.showQuantityMark && product.quantity >= 2) {
                        qtyCell.innerHTML = `<span class="bv-qty-star">${product.quantity}</span>`;
                    } else {
                        qtyCell.textContent = product.quantity;
                    }
                    
                    // 小計
                    const priceCell = BVShop.Utils.DOM.createElement('td', {
                        textContent: product.price,
                        style: {
                            padding: '4px',
                            fontSize: `${settings.fontSize}px`,
                            textAlign: 'right'
                        }
                    });
                    
                    row.appendChild(nameCell);
                    row.appendChild(qtyCell);
                    row.appendChild(priceCell);
                    
                    tbody.appendChild(row);
                });
                
                table.appendChild(tbody);
                
                return table;
            },
            
            // 創建備註
            createNotes(orderData, settings) {
                if (!orderData.notes || settings.compactMode) return null;
                
                const notes = BVShop.Utils.DOM.createElement('div', {
                    className: 'order-extra',
                    style: {
                        margin: '0',
                        position: 'relative',
                        zIndex: 2
                    }
                });
                
                const p = BVShop.Utils.DOM.createElement('p', {
                    textContent: `備註：${orderData.notes}`,
                    style: {
                        margin: '0',
                        fontSize: `${settings.fontSize - 1}px`,
                        lineHeight: '1.4'
                    }
                });
                
                notes.appendChild(p);
                
                return notes;
            }
        },
        
        // ========== 物流單處理 ==========
        Shipping: {
            // 抓取當前頁面物流單
            async captureCurrentPage() {
                const provider = BVShop.State.get('currentProvider');
                if (!provider) {
                    BVShop.UI.Components.showNotification('無法識別物流商', 'error');
                    return;
                }
                
                const providerConfig = BVShop.Config.PROVIDERS[provider];
                if (!providerConfig) return;
                
                // 顯示載入狀態
                const loading = BVShop.UI.Components.showNotification('正在抓取物流單...', 'info', 0);
                
                try {
                    let elements = document.querySelectorAll(providerConfig.selector);
                    if (elements.length === 0) {
                        throw new Error('未找到物流單');
                    }
                    
                    // 7-11 特殊處理
                    if (provider === 'SEVEN') {
                        const frames = document.querySelectorAll('.div_frame');
                        if (frames.length > 0) {
                            elements = frames;
                        }
                    }
                    
                    const capturedData = [];
                    const processedOrders = new Set();
                    
                    // 載入 html2canvas
                    await this.loadHtml2Canvas();
                    
                    // 處理每個元素
                    for (const element of elements) {
                        const data = this.extractShippingData(element, provider);
                        if (!data || !data.orderNo || processedOrders.has(data.orderNo)) continue;
                        
                        processedOrders.add(data.orderNo);
                        
                        // 截圖
                        const canvas = await html2canvas(element, {
                            backgroundColor: '#ffffff',
                            scale: 3,
                            logging: false,
                            useCORS: true,
                            allowTaint: true
                        });
                        
                        const imageData = canvas.toDataURL('image/jpeg', 0.95);
                        
                        capturedData.push({
                            ...data,
                            imageData: imageData,
                            width: canvas.width,
                            height: canvas.height
                        });
                    }
                    
                    if (capturedData.length > 0) {
                        // 儲存到 Chrome Storage（跨分頁共享）
                        await chrome.storage.local.set({
                            capturedShippingData: capturedData,
                            captureTimestamp: new Date().toISOString()
                        });
                        
                        loading.remove();
                        BVShop.UI.Components.showNotification(`成功抓取 ${capturedData.length} 張物流單`, 'success');
                        
                        // 顯示完成訊息
                        this.showCaptureSuccess(capturedData.length);
                    } else {
                        throw new Error('沒有可抓取的物流單');
                    }
                    
                } catch (error) {
                    console.error('抓取錯誤:', error);
                    loading.remove();
                    BVShop.UI.Components.showNotification(error.message || '抓取失敗', 'error');
                }
            },
            
            // 載入 html2canvas
            async loadHtml2Canvas() {
                if (typeof html2canvas !== 'undefined') return;
                
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            },
            
            // 提取物流單資料
            extractShippingData(element, provider) {
                const providerConfig = BVShop.Config.PROVIDERS[provider];
                if (!providerConfig) return null;
                
                const data = {
                    provider: provider,
                    orderNo: '',
                    storeId: '',
                    storeName: '',
                    recipientName: '',
                    recipientPhone: '',
                    logisticsNo: '',
                    timestamp: new Date().toISOString()
                };
                
                const text = element.textContent || '';
                
                // 使用設定的模式提取資料
                if (providerConfig.patterns) {
                    for (const [key, patterns] of Object.entries(providerConfig.patterns)) {
                        for (const pattern of patterns) {
                            const match = text.match(pattern);
                            if (match) {
                                switch(key) {
                                    case 'order': 
                                        data.orderNo = match[1].trim();
                                        data.logisticsNo = match[1].trim();
                                        break;
                                    case 'store': data.storeName = match[1].trim(); break;
                                    case 'storeId': data.storeId = match[1].trim(); break;
                                    case 'recipient': data.recipientName = match[1].trim(); break;
                                    case 'phone': data.recipientPhone = match[1].trim(); break;
                                }
                                break;
                            }
                        }
                    }
                }
                
                return (data.orderNo || data.logisticsNo) ? data : null;
            },
            
            // 顯示抓取成功訊息
            showCaptureSuccess(count) {
                const modal = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-modal',
                    style: {
                        position: 'fixed',
                        top: '0',
                        left: '0',
                        right: '0',
                        bottom: '0',
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: '10001'
                    }
                });
                
                const content = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        background: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        textAlign: 'center',
                        maxWidth: '400px'
                    },
                    innerHTML: `
                        <div style="color: #10b981; margin-bottom: 16px;">
                            <span class="material-icons" style="font-size: 64px;">check_circle</span>
                        </div>
                        <h2 style="margin: 0 0 16px 0; font-size: 24px;">抓取成功！</h2>
                        <p style="margin: 0 0 24px 0; color: #666;">
                            已成功抓取 ${count} 張物流單<br>
                            請返回出貨明細頁面繼續列印
                        </p>
                        <button class="bv-button bv-button-primary" onclick="this.closest('.bv-modal').remove()">
                            確定
                        </button>
                    `
                });
                
                modal.appendChild(content);
                document.body.appendChild(modal);
                
                // 點擊背景關閉
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.remove();
                    }
                });
            },
            
            // 處理 PDF 檔案
            async processPdfFiles(files) {
                const results = [];
                
                // 載入 PDF.js
                await this.loadPdfJs();
                
                for (const file of files) {
                    try {
                        const arrayBuffer = await file.arrayBuffer();
                        const typedArray = new Uint8Array(arrayBuffer);
                        
                        const pdf = await pdfjsLib.getDocument(typedArray).promise;
                        const numPages = pdf.numPages;
                        
                        for (let i = 1; i <= numPages; i++) {
                            const page = await pdf.getPage(i);
                            const viewport = page.getViewport({ scale: 2 });
                            
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            
                            await page.render({
                                canvasContext: context,
                                viewport: viewport
                            }).promise;
                            
                            const imageData = canvas.toDataURL('image/png');
                            
                            // 嘗試提取文字
                            const textContent = await page.getTextContent();
                            const text = textContent.items.map(item => item.str).join(' ');
                            const logisticsNo = this.extractLogisticsFromText(text);
                            
                            results.push({
                                provider: 'DELIVERY',
                                orderNo: logisticsNo || `PDF_${i}`,
                                logisticsNo: logisticsNo,
                                pageNumber: i,
                                fileName: file.name,
                                imageData: imageData,
                                width: viewport.width,
                                height: viewport.height,
                                timestamp: new Date().toISOString()
                            });
                        }
                    } catch (error) {
                        console.error('PDF 處理錯誤:', error);
                        throw error;
                    }
                }
                
                return results;
            },
            
            // 載入 PDF.js
            async loadPdfJs() {
                if (typeof pdfjsLib !== 'undefined') return;
                
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = chrome.runtime.getURL('pdf.js');
                    script.onload = () => {
                        if (typeof pdfjsLib !== 'undefined') {
                            pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
                            resolve();
                        } else {
                            reject(new Error('PDF.js 載入失敗'));
                        }
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            },
            
            // 從文字提取物流編號
            extractLogisticsFromText(text) {
                const patterns = [
                    /物流編號[：:]\s*([A-Z0-9-]+)/i,
                    /配送單號[：:]\s*([A-Z0-9-]+)/i,
                    /託運單號[：:]\s*([A-Z0-9-]+)/i,
                    /運單號碼[：:]\s*([A-Z0-9-]+)/i,
                    /Tracking\s*No[：:]\s*([A-Z0-9-]+)/i
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1].trim();
                }
                
                return null;
            }
        },
        
        // ========== 配對邏輯 ==========
        Matching: {
            // 執行配對
            performMatching(orderData, shippingData, settings) {
                const method = settings.method;
                const reverseShipping = settings.reverseShipping;
                
                // 排序處理
                const sortedOrders = this.sortData(orderData, settings.detailSort);
                let sortedShipping = [...shippingData];
                
                if (reverseShipping) {
                    sortedShipping.reverse();
                }
                
                const results = [];
                
                sortedOrders.forEach((order, index) => {
                    let matchedShipping = null;
                    
                    switch (method) {
                        case 'index':
                            // 索引配對
                            matchedShipping = sortedShipping[index];
                            break;
                            
                        case 'order':
                            // 訂單編號配對
                            matchedShipping = this.findByOrderNo(sortedShipping, order.orderNo);
                            break;
                            
                        case 'logistics':
                            // 物流編號配對
                            matchedShipping = this.findByLogisticsNo(sortedShipping, order.logisticsNo);
                            break;
                    }
                    
                    results.push({
                        index: index,
                        order: order,
                        shipping: matchedShipping,
                        matched: !!matchedShipping
                    });
                });
                
                return results;
            },
            
            // 資料排序
            sortData(data, order) {
                const sorted = [...data];
                
                if (order === 'desc') {
                    sorted.reverse();
                }
                
                return sorted;
            },
            
            // 根據訂單編號尋找
            findByOrderNo(shippingData, orderNo) {
                if (!orderNo) return null;
                
                return shippingData.find(shipping => 
                    shipping.orderNo === orderNo
                );
            },
            
            // 根據物流編號尋找
            findByLogisticsNo(shippingData, logisticsNo) {
                if (!logisticsNo) return null;
                
                const cleanNo = logisticsNo.trim().toUpperCase();
                
                return shippingData.find(shipping => {
                    const candidates = [
                        shipping.orderNo,
                        shipping.logisticsNo,
                        shipping.barcode
                    ].filter(Boolean);
                    
                    return candidates.some(candidate => 
                        candidate.trim().toUpperCase() === cleanNo
                    );
                });
            }
        },
        
        // ========== 列印處理 ==========
        Printing: {
            // 準備列印
            preparePrint(matchedData, settings) {
                // 創建列印區域
                const printArea = BVShop.Utils.DOM.createElement('div', {
                    id: 'print-area',
                    style: {
                        position: 'absolute',
                        left: '0',
                        top: '0'
                    }
                });
                
                const mode = BVShop.State.get('selectedMode');
                
                if (mode === 'mode_a') {
                    // 只印明細
                    matchedData.forEach(item => {
                        if (item.order) {
                            const label = BVShop.Logic.Format.convertToLabel(item.order, settings);
                            printArea.appendChild(label);
                        }
                    });
                } else {
                    // 明細 + 物流單
                    matchedData.forEach(item => {
                        // 明細頁
                        if (item.order) {
                            const label = BVShop.Logic.Format.convertToLabel(item.order, settings);
                            printArea.appendChild(label);
                        }
                        
                        // 物流單頁
                        if (item.shipping) {
                            const shippingPage = this.createShippingPage(item.shipping, item.order, settings);
                            printArea.appendChild(shippingPage);
                        }
                    });
                }
                
                // 暫時添加到 body
                document.body.appendChild(printArea);
                
                // 列印
                window.print();
                
                // 移除列印區域
                setTimeout(() => {
                    printArea.remove();
                }, 100);
            },
            
            // 創建物流單頁面
            createShippingPage(shippingData, orderData, settings) {
                const format = BVShop.Config.LABEL_FORMATS[BVShop.State.get('selectedFormat')];
                
                const page = BVShop.Utils.DOM.createElement('div', {
                    className: `bv-label-page bv-shipping-page format-${BVShop.State.get('selectedFormat')}`,
                    style: {
                        width: `${format.widthPx}px`,
                        height: `${format.heightPx}px`,
                        padding: '3mm',
                        background: '#f5f5f5',
                        pageBreakAfter: 'always',
                        position: 'relative'
                    }
                });
                
                const content = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        width: '100%',
                        height: '100%',
                        background: 'white',
                        position: 'relative',
                        overflow: 'hidden'
                    }
                });
                
                // 如果是圖片資料
                if (shippingData.imageData) {
                    const img = BVShop.Utils.DOM.createElement('img', {
                        src: shippingData.imageData,
                        style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }
                    });
                    content.appendChild(img);
                }
                
                // 訂單標籤（如果啟用）
                if (settings.showOrderLabel && orderData) {
                    const label = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-order-label',
                        textContent: `訂單：${orderData.orderNo}`,
                        style: {
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            padding: '6px 12px',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            zIndex: '1000',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }
                    });
                    content.appendChild(label);
                }
                
                page.appendChild(content);
                
                return page;
            },
            
            // 生成 PDF
            async generatePdf(matchedData, settings) {
                // 這裡可以整合 jsPDF 或其他 PDF 生成庫
                // 目前先顯示提示
                BVShop.UI.Components.showNotification('PDF 下載功能開發中', 'info');
            }
        }
    };
    
    // ========================================
    // 8. Wizard 控制器 (WizardController)
    // ========================================
    BVShop.WizardController = {
        // 當前步驟
        currentStep: null,
        
        // 步驟列表
        steps: [],
        
        // 初始化
        init() {
            // 建立步驟列表
            this.steps = Object.values(BVShop.Config.WIZARD_STEPS)
                .sort((a, b) => a.order - b.order)
                .map(step => step.id);
        },
        
        // 啟動 Wizard
        async start() {
            // 載入儲存的狀態
            await BVShop.State.load();
            
            // 抓取頁面資料
            const orderData = BVShop.Logic.Data.extractOrderData();
            BVShop.State.set('orderData', orderData);
            
            // 顯示 UI
            BVShop.UI.show();
            
            // 開始第一步
            this.goToStep('format');
        },
        
        // 前往指定步驟
        goToStep(stepId) {
            const step = BVShop.Config.WIZARD_STEPS[stepId];
            if (!step) return;
            
            // 檢查條件
            if (step.condition && !step.condition(BVShop.State.data)) {
                // 跳過此步驟
                const currentIndex = this.steps.indexOf(stepId);
                const nextStep = this.steps[currentIndex + 1];
                if (nextStep) {
                    this.goToStep(nextStep);
                }
                return;
            }
            
            this.currentStep = stepId;
            BVShop.State.set('currentStep', stepId);
            
            // 更新內容
            this.renderStep(stepId);
            
            // 更新按鈕
            this.updateButtons();
            
            // 更新步驟指示器
            BVShop.UI.updateStepIndicator(stepId);
        },
        
        // 渲染步驟內容
        renderStep(stepId) {
            let content;
            
            switch (stepId) {
                case 'format':
                    content = BVShop.UI.StepRenderers.renderFormatStep();
                    break;
                    
                case 'mode':
                    content = BVShop.UI.StepRenderers.renderModeStep();
                    break;
                    
                case 'detail_settings':
                    content = BVShop.UI.StepRenderers.renderDetailSettingsStep();
                    break;
                    
                case 'shipping_source':
                    content = BVShop.UI.StepRenderers.renderShippingSourceStep();
                    break;
                    
                case 'matching':
                    content = BVShop.UI.StepRenderers.renderMatchingStep();
                    break;
                    
                case 'preview':
                    content = BVShop.UI.StepRenderers.renderPreviewStep();
                    break;
                    
                default:
                    content = BVShop.Utils.DOM.createElement('div', {
                        textContent: '未知步驟'
                    });
            }
            
            BVShop.UI.updateContent(content);
        },
        
        // 下一步
        nextStep() {
            // 驗證當前步驟
            if (!BVShop.Utils.Validation.validateStep(this.currentStep)) {
                BVShop.UI.Components.showNotification('請完成當前步驟的設定', 'warning');
                return;
            }
            
            // 標記為已完成
            const completedSteps = BVShop.State.get('completedSteps') || [];
            if (!completedSteps.includes(this.currentStep)) {
                completedSteps.push(this.currentStep);
                BVShop.State.set('completedSteps', completedSteps);
            }
            
            // 自動儲存
            if (BVShop.Config.AUTO_SAVE) {
                BVShop.State.save();
            }
            
            // 尋找下一個步驟
            const currentIndex = this.steps.indexOf(this.currentStep);
            let nextIndex = currentIndex + 1;
            
            // 檢查條件，跳過不符合的步驟
            while (nextIndex < this.steps.length) {
                const nextStepId = this.steps[nextIndex];
                const nextStep = BVShop.Config.WIZARD_STEPS[nextStepId];
                
                if (!nextStep.condition || nextStep.condition(BVShop.State.data)) {
                    this.goToStep(nextStepId);
                    return;
                }
                
                nextIndex++;
            }
            
            // 已經是最後一步
            this.finish();
        },
        
        // 上一步
        previousStep() {
            const currentIndex = this.steps.indexOf(this.currentStep);
            let prevIndex = currentIndex - 1;
            
            // 檢查條件，跳過不符合的步驟
            while (prevIndex >= 0) {
                const prevStepId = this.steps[prevIndex];
                const prevStep = BVShop.Config.WIZARD_STEPS[prevStepId];
                
                if (!prevStep.condition || prevStep.condition(BVShop.State.data)) {
                    this.goToStep(prevStepId);
                    return;
                }
                
                prevIndex--;
            }
        },
        
        // 更新按鈕狀態
        updateButtons() {
            const currentIndex = this.steps.indexOf(this.currentStep);
            const isFirstStep = currentIndex === 0;
            const isLastStep = this.currentStep === 'preview';
            
            BVShop.UI.updateButtons({
                showPrev: !isFirstStep,
                nextDisabled: false,
                nextText: isLastStep ? '完成' : '下一步',
                isLastStep: isLastStep
            });
        },
        
        // 完成 Wizard
        finish() {
            // 最終儲存
            BVShop.State.save();
            
            // 關閉 Wizard
            BVShop.UI.hide();
            
            // 顯示完成訊息
            BVShop.UI.Components.showNotification('設定完成！可以開始列印了。', 'success');
        },
        
        // 處理物流單檔案
        async handleShippingFiles(files) {
            const loading = BVShop.UI.Components.showNotification('正在處理檔案...', 'info', 0);
            
            try {
                let processedData = [];
                
                // 檢查檔案類型
                const pdfFiles = files.filter(f => f.type === 'application/pdf');
                const imageFiles = files.filter(f => f.type.startsWith('image/'));
                
                // 處理 PDF
                if (pdfFiles.length > 0) {
                    const pdfData = await BVShop.Logic.Shipping.processPdfFiles(pdfFiles);
                    processedData.push(...pdfData);
                }
                
                // 處理圖片
                if (imageFiles.length > 0) {
                    for (const file of imageFiles) {
                        const reader = new FileReader();
                        const imageData = await new Promise((resolve) => {
                            reader.onload = (e) => resolve(e.target.result);
                            reader.readAsDataURL(file);
                        });
                        
                        processedData.push({
                            provider: 'DELIVERY',
                            orderNo: file.name.replace(/\.[^/.]+$/, ''),
                            fileName: file.name,
                            imageData: imageData,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                
                if (processedData.length > 0) {
                    // 創建新批次
                    const newBatch = {
                        id: Date.now(),
                        type: 'upload',
                        provider: 'DELIVERY',
                        name: `${files.length} 個檔案`,
                        data: processedData,
                        timestamp: new Date().toISOString()
                    };
                    
                    const currentBatches = BVShop.State.get('shippingDataBatches') || [];
                    currentBatches.push(newBatch);
                    BVShop.State.set('shippingDataBatches', currentBatches);
                    
                    // 更新顯示
                    BVShop.UI.StepRenderers.updateFileList();
                    BVShop.UI.StepRenderers.updateShippingStatus();
                    
                    loading.remove();
                    BVShop.UI.Components.showNotification(`成功處理 ${processedData.length} 張物流單`, 'success');
                } else {
                    throw new Error('沒有成功處理的檔案');
                }
                
            } catch (error) {
                console.error('檔案處理錯誤:', error);
                loading.remove();
                BVShop.UI.Components.showNotification(error.message || '檔案處理失敗', 'error');
            }
        },
        
        // 移除物流單批次
        removeShippingBatch(index) {
            const batches = BVShop.State.get('shippingDataBatches') || [];
            
            if (index >= 0 && index < batches.length) {
                batches.splice(index, 1);
                BVShop.State.set('shippingDataBatches', batches);
                
                // 更新顯示
                BVShop.UI.StepRenderers.updateFileList();
                BVShop.UI.StepRenderers.updateShippingStatus();
                
                BVShop.UI.Components.showNotification('已移除批次', 'success');
            }
        },
        
        // 生成預覽
        generatePreview() {
            const previewContainer = document.getElementById('label-preview');
            if (!previewContainer) return;
            
            previewContainer.innerHTML = '';
            
            const loading = BVShop.Utils.DOM.createElement('div', {
                className: 'bv-loading',
                innerHTML: '<div class="bv-loading-spinner"></div><div class="bv-loading-text">正在生成預覽...</div>'
            });
            
            previewContainer.appendChild(loading);
            
            setTimeout(() => {
                try {
                    const orderData = BVShop.State.get('orderData') || [];
                    const shippingDataBatches = BVShop.State.get('shippingDataBatches') || [];
                    const settings = BVShop.State.get('detailSettings');
                    const matchingSettings = BVShop.State.get('matchingSettings');
                    
                    // 合併所有物流單資料
                    const allShippingData = [];
                    shippingDataBatches.forEach(batch => {
                        allShippingData.push(...batch.data);
                    });
                    
                    // 執行配對
                    const matchedData = BVShop.Logic.Matching.performMatching(
                        orderData,
                        allShippingData,
                        matchingSettings
                    );
                    
                    // 儲存配對結果
                    BVShop.State.set('matchedData', matchedData);
                    
                    // 生成預覽頁面
                    const previewPages = BVShop.Utils.DOM.createElement('div', {
                        style: {
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '20px',
                            justifyContent: 'center',
                            padding: '20px'
                        }
                    });
                    
                    const mode = BVShop.State.get('selectedMode');
                    let pageCount = 0;
                    const maxPreviewPages = 3; // 最多預覽3頁
                    
                    matchedData.forEach((item, index) => {
                        if (pageCount >= maxPreviewPages) return;
                        
                        // 明細頁
                        if (item.order) {
                            const label = BVShop.Logic.Format.convertToLabel(item.order, settings);
                            label.style.transform = 'scale(0.5)';
                            label.style.transformOrigin = 'top left';
                            label.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                            
                            const wrapper = BVShop.Utils.DOM.createElement('div', {
                                className: 'bv-preview-page',
                                style: {
                                    width: `${label.offsetWidth * 0.5}px`,
                                    height: `${label.offsetHeight * 0.5}px`,
                                    overflow: 'hidden'
                                }
                            });
                            
                            wrapper.appendChild(label);
                            previewPages.appendChild(wrapper);
                            pageCount++;
                        }
                        
                        // 物流單頁（模式 B）
                        if (mode === 'mode_b' && item.shipping && pageCount < maxPreviewPages) {
                            const shippingPage = BVShop.Logic.Printing.createShippingPage(
                                item.shipping,
                                item.order,
                                matchingSettings
                            );
                            
                            shippingPage.style.transform = 'scale(0.5)';
                            shippingPage.style.transformOrigin = 'top left';
                            
                            const wrapper = BVShop.Utils.DOM.createElement('div', {
                                className: 'bv-preview-page',
                                style: {
                                    width: `${shippingPage.offsetWidth * 0.5}px`,
                                    height: `${shippingPage.offsetHeight * 0.5}px`,
                                    overflow: 'hidden'
                                }
                            });
                            
                            wrapper.appendChild(shippingPage);
                            previewPages.appendChild(wrapper);
                            pageCount++;
                        }
                    });
                    
                    // 如果有更多頁面，顯示提示
                    if (matchedData.length > maxPreviewPages / (mode === 'mode_b' ? 2 : 1)) {
                        const morePages = BVShop.Utils.DOM.createElement('div', {
                            style: {
                                width: '100%',
                                textAlign: 'center',
                                padding: '20px',
                                color: '#666',
                                fontSize: '14px'
                            },
                            textContent: `...還有更多頁面（共 ${matchedData.length} 筆資料）`
                        });
                        previewPages.appendChild(morePages);
                    }
                    
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(previewPages);
                    
                } catch (error) {
                    console.error('預覽生成錯誤:', error);
                    previewContainer.innerHTML = `
                        <div style="text-align: center; color: #999;">
                            <span class="material-icons" style="font-size: 48px;">error_outline</span>
                            <p>預覽生成失敗</p>
                        </div>
                    `;
                }
            }, 100);
        },
        
        // 處理列印
        handlePrint() {
            const matchedData = BVShop.State.get('matchedData');
            const settings = BVShop.State.get('detailSettings');
            const matchingSettings = BVShop.State.get('matchingSettings');
            
            if (!matchedData || matchedData.length === 0) {
                BVShop.UI.Components.showNotification('沒有可列印的資料', 'warning');
                return;
            }
            
            // 合併設定
            const allSettings = {
                ...settings,
                ...matchingSettings
            };
            
            // 執行列印
            BVShop.Logic.Printing.preparePrint(matchedData, allSettings);
        },
        
        // 處理下載
        async handleDownload() {
            const matchedData = BVShop.State.get('matchedData');
            const settings = BVShop.State.get('detailSettings');
            
            if (!matchedData || matchedData.length === 0) {
                BVShop.UI.Components.showNotification('沒有可下載的資料', 'warning');
                return;
            }
            
            // 生成 PDF
            await BVShop.Logic.Printing.generatePdf(matchedData, settings);
        }
    };
    
    // ========================================
    // 9. 初始化 (Initialization)
    // ========================================
    BVShop.init = function() {
        console.log('BV SHOP 出貨助手初始化中...');
        
        // 檢查頁面
        if (!BVShop.Utils.Validation.isValidPage()) {
            console.log('不支援的頁面，停止初始化');
            return;
        }
        
        // 初始化各模組
        BVShop.WizardController.init();
        BVShop.UI.init();
        
        console.log('BV SHOP 出貨助手初始化完成');
    };
    
    // 當 DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', BVShop.init);
    } else {
        BVShop.init();
    }
    
})();
