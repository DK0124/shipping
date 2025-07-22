/**
 * BV SHOP 出貨助手 v7.0 - 標籤列印精靈
 * @author DK0124
 * @date 2025-01-22
 * @description 提供出貨明細轉換標籤格式與物流單整合列印功能
 * 
 * 功能特色：
 * - Wizard 引導式操作介面
 * - 支援 10×15cm 和 10×10cm 標籤格式
 * - 明細單獨列印或與物流單整合列印
 * - 自動配對與批次處理
 * - 響應式設計與毛玻璃視覺效果
 * 
 * 系統架構：
 * 1. 核心架構 (Core) - 基礎設定與命名空間
 * 2. 設定管理 (Config) - 系統設定與常數定義
 * 3. 狀態管理 (State) - 響應式狀態管理系統
 * 4. 事件系統 (Events) - 事件驅動架構
 * 5. 工具函數 (Utils) - 通用工具與輔助函數
 * 6. UI 系統 (UI) - 使用者介面與元件
 * 7. 業務邏輯 (Logic) - 核心業務處理
 * 8. Wizard 控制器 (WizardController) - 流程控制
 * 9. 初始化 (Initialize) - 系統啟動
 */

(function() {
    'use strict';
    
    // ========================================
    // 1. 核心架構 (Core)
    // ========================================
    const BVShop = {
        name: 'BV SHOP 出貨助手',
        version: '7.0.0',
        author: 'DK0124',
        lastUpdate: '2025-01-22',
        description: '標籤列印精靈'
    };
    
    // ========================================
    // 2. 設定管理 (Config)
    // ========================================
    BVShop.Config = {
        // 版本與系統設定
        VERSION: '7.0.0',
        DEBUG: false,
        AUTO_SAVE: true,
        AUTO_SAVE_INTERVAL: 5000, // 5 秒自動儲存
        
        // Wizard 步驟定義
        WIZARD_STEPS: {
            FORMAT: {
                id: 'format',
                order: 1,
                title: '選擇標籤格式',
                icon: 'label',
                required: true,
                validator: () => BVShop.State.get('selectedFormat') !== null
            },
            MODE: {
                id: 'mode',
                order: 2,
                title: '列印模式',
                icon: 'print',
                required: true,
                validator: () => BVShop.State.get('selectedMode') !== null
            },
            DETAIL_SETTINGS: {
                id: 'detail_settings',
                order: 3,
                title: '明細設定',
                icon: 'settings',
                required: true,
                validator: () => true // 明細設定總是有效
            },
            SHIPPING_SOURCE: {
                id: 'shipping_source',
                order: 4,
                title: '物流單準備',
                icon: 'local_shipping',
                required: false,
                condition: (state) => state.selectedMode === 'B',
                validator: () => BVShop.State.get('shippingData').length > 0
            },
            MATCHING: {
                id: 'matching',
                order: 5,
                title: '配對設定',
                icon: 'link',
                required: false,
                condition: (state) => state.selectedMode === 'B' && state.shippingData.length > 0,
                validator: () => true
            },
            PREVIEW: {
                id: 'preview',
                order: 6,
                title: '預覽與列印',
                icon: 'preview',
                required: true,
                validator: () => true
            }
        },
        
        // 標籤格式定義
        LABEL_FORMATS: {
            '10x15': {
                id: '10x15',
                name: '10×15cm',
                description: '標準貼紙格式',
                icon: 'description',
                width: 100,  // mm
                height: 150, // mm
                widthPx: 377, // pixels @ 96dpi
                heightPx: 566,
                padding: 5,   // mm
                orientation: 'portrait'
            },
            '10x10': {
                id: '10x10',
                name: '10×10cm',
                description: '正方形貼紙格式',
                icon: 'crop_square',
                width: 100,  // mm
                height: 100, // mm
                widthPx: 377,
                heightPx: 377,
                padding: 5,
                orientation: 'square'
            }
        },
        
        // 列印模式定義
        PRINT_MODES: {
            A: {
                id: 'A',
                name: '僅列印出貨明細',
                description: '快速列印訂單資料',
                icon: 'description',
                requiresShipping: false
            },
            B: {
                id: 'B',
                name: '明細 + 物流單',
                description: '整合列印訂單與物流單',
                icon: 'picture_in_picture',
                requiresShipping: true
            }
        },
        
        // DOM 選擇器
        SELECTORS: {
            WIZARD_CONTAINER: '#bv-wizard-container',
            ORIGINAL_CONTROLS: '.ignore-print',
            ORDER_CONTENT: '.order-content',
            ORDER_ITEM: '.order-item',
            PRINT_AREA: '#print-area'
        },
        
        // 儲存鍵值
        STORAGE_KEYS: {
            SETTINGS: 'bvShopSettings',
            STATE: 'bvShopState',
            PRESETS: 'bvShopPresets',
            LAST_PRESET: 'bvShopLastPreset',
            SHIPPING_DATA: 'bvShopShippingData'
        },
        
        // 預設設定值
        DEFAULT_SETTINGS: {
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
            showRecipientAddress: true
        }
    };
    
    // ========================================
    // 3. 狀態管理 (State)
    // ========================================
    BVShop.State = {
        // 內部狀態儲存
        _state: {
            // Wizard 狀態
            currentStep: null,
            completedSteps: [],
            isWizardOpen: false,
            
            // 使用者選擇
            selectedFormat: null,
            selectedMode: null,
            
            // 詳細設定
            detailSettings: { ...BVShop.Config.DEFAULT_SETTINGS },
            
            // 物流單資料
            shippingData: [],
            shippingBatches: [],
            
            // 配對設定
            matchingSettings: {
                method: 'index',
                detailSort: 'asc',
                reverseShipping: false,
                showOrderLabel: true
            },
            
            // 系統狀態
            isConverted: false,
            isLoading: false,
            errors: [],
            
            // 暫存資料
            orderData: [],
            matchedData: []
        },
        
        // 狀態監聽器
        _listeners: new Map(),
        _saveTimeout: null,
        
        // 獲取狀態
        get(path) {
            if (!path) return this._state;
            
            return path.split('.').reduce((obj, key) => {
                return obj ? obj[key] : undefined;
            }, this._state);
        },
        
        // 設定狀態
        set(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key]) obj[key] = {};
                return obj[key];
            }, this._state);
            
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // 通知監聽器
            this._notify(path, value, oldValue);
            
            // 自動儲存（防抖）
            if (BVShop.Config.AUTO_SAVE) {
                this._scheduleSave();
            }
        },
        
        // 批量更新
        update(updates) {
            Object.entries(updates).forEach(([path, value]) => {
                this.set(path, value);
            });
        },
        
        // 監聽狀態變化
        watch(path, callback) {
            if (!this._listeners.has(path)) {
                this._listeners.set(path, []);
            }
            this._listeners.get(path).push(callback);
            
            // 返回取消監聽的函數
            return () => {
                const callbacks = this._listeners.get(path);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            };
        },
        
        // 通知監聽器
        _notify(path, newValue, oldValue) {
            // 精確匹配的監聽器
            if (this._listeners.has(path)) {
                this._listeners.get(path).forEach(callback => {
                    try {
                        callback(newValue, oldValue, path);
                    } catch (error) {
                        console.error('[State Listener Error]', error);
                    }
                });
            }
            
            // 通配符監聽器
            this._listeners.forEach((callbacks, listenerPath) => {
                if (listenerPath.endsWith('*')) {
                    const prefix = listenerPath.slice(0, -1);
                    if (path.startsWith(prefix)) {
                        callbacks.forEach(callback => {
                            try {
                                callback(newValue, oldValue, path);
                            } catch (error) {
                                console.error('[State Listener Error]', error);
                            }
                        });
                    }
                }
            });
        },
        
        // 排程自動儲存
        _scheduleSave() {
            if (this._saveTimeout) {
                clearTimeout(this._saveTimeout);
            }
            this._saveTimeout = setTimeout(() => {
                this.save();
            }, BVShop.Config.AUTO_SAVE_INTERVAL);
        },
        
        // 儲存狀態
        save() {
            try {
                const stateToSave = {
                    ...this._state,
                    version: BVShop.Config.VERSION,
                    lastSaved: new Date().toISOString()
                };
                
                // 不儲存暫時性資料
                delete stateToSave.isWizardOpen;
                delete stateToSave.isLoading;
                delete stateToSave.errors;
                
                chrome.storage.local.set({
                    [BVShop.Config.STORAGE_KEYS.STATE]: stateToSave
                });
            } catch (error) {
                console.error('[State Save Error]', error);
            }
        },
        
        // 載入狀態
        async load() {
            try {
                const result = await chrome.storage.local.get(BVShop.Config.STORAGE_KEYS.STATE);
                const savedState = result[BVShop.Config.STORAGE_KEYS.STATE];
                
                if (savedState) {
                    // 合併狀態
                    this._state = {
                        ...this._state,
                        ...savedState,
                        // 重置執行時狀態
                        currentStep: null,
                        isWizardOpen: false,
                        isLoading: false,
                        errors: []
                    };
                }
            } catch (error) {
                console.error('[State Load Error]', error);
            }
        },
        
        // 重置狀態
        reset(partial = false) {
            if (partial) {
                // 只重置 Wizard 相關狀態
                this.update({
                    currentStep: null,
                    completedSteps: [],
                    selectedFormat: null,
                    selectedMode: null,
                    shippingData: [],
                    matchedData: []
                });
            } else {
                // 完全重置
                this._state = {
                    ...this._getInitialState(),
                    detailSettings: { ...BVShop.Config.DEFAULT_SETTINGS }
                };
                this.save();
            }
        },
        
        // 獲取初始狀態
        _getInitialState() {
            return {
                currentStep: null,
                completedSteps: [],
                isWizardOpen: false,
                selectedFormat: null,
                selectedMode: null,
                detailSettings: { ...BVShop.Config.DEFAULT_SETTINGS },
                shippingData: [],
                shippingBatches: [],
                matchingSettings: {
                    method: 'index',
                    detailSort: 'asc',
                    reverseShipping: false,
                    showOrderLabel: true
                },
                isConverted: false,
                isLoading: false,
                errors: [],
                orderData: [],
                matchedData: []
            };
        }
    };
    
    // ========================================
    // 4. 事件系統 (Events)
    // ========================================
    BVShop.Events = {
        _events: new Map(),
        
        // 註冊事件
        on(event, handler, options = {}) {
            if (!this._events.has(event)) {
                this._events.set(event, []);
            }
            
            const wrappedHandler = {
                handler,
                once: options.once || false,
                priority: options.priority || 0,
                id: options.id || null
            };
            
            const handlers = this._events.get(event);
            handlers.push(wrappedHandler);
            
            // 按優先級排序
            handlers.sort((a, b) => b.priority - a.priority);
        },
        
        // 一次性事件
        once(event, handler, options = {}) {
            this.on(event, handler, { ...options, once: true });
        },
        
        // 觸發事件
        emit(event, data = {}) {
            if (!this._events.has(event)) return;
            
            const handlers = this._events.get(event);
            const handlersToRemove = [];
            
            handlers.forEach((wrappedHandler, index) => {
                try {
                    const eventData = {
                        type: event,
                        data,
                        timestamp: Date.now(),
                        source: 'BVShop'
                    };
                    
                    wrappedHandler.handler(eventData);
                    
                    if (wrappedHandler.once) {
                        handlersToRemove.push(index);
                    }
                } catch (error) {
                    console.error(`[Event Error] ${event}:`, error);
                }
            });
            
            // 移除一次性處理器
            handlersToRemove.reverse().forEach(index => {
                handlers.splice(index, 1);
            });
        },
        
        // 移除事件處理器
        off(event, handler) {
            if (!this._events.has(event)) return;
            
            const handlers = this._events.get(event);
            const index = handlers.findIndex(h => h.handler === handler);
            
            if (index > -1) {
                handlers.splice(index, 1);
            }
        },
        
        // 移除指定 ID 的處理器
        offById(event, id) {
            if (!this._events.has(event)) return;
            
            const handlers = this._events.get(event);
            const index = handlers.findIndex(h => h.id === id);
            
            if (index > -1) {
                handlers.splice(index, 1);
            }
        },
        
        // 清空事件
        clear(event) {
            if (event) {
                this._events.delete(event);
            } else {
                this._events.clear();
            }
        }
    };
    
    // ========================================
    // 5. 工具函數 (Utils)
    // ========================================
    BVShop.Utils = {
        // DOM 工具
        DOM: {
            // 創建元素
            createElement(tag, attributes = {}, children = []) {
                const element = document.createElement(tag);
                
                // 設定屬性
                Object.entries(attributes).forEach(([key, value]) => {
                    if (key === 'className') {
                        element.className = value;
                    } else if (key === 'style' && typeof value === 'object') {
                        Object.assign(element.style, value);
                    } else if (key.startsWith('data-')) {
                        element.setAttribute(key, value);
                    } else if (key === 'innerHTML') {
                        element.innerHTML = value;
                    } else {
                        element[key] = value;
                    }
                });
                
                // 添加子元素
                children.forEach(child => {
                    if (typeof child === 'string') {
                        element.appendChild(document.createTextNode(child));
                    } else if (child instanceof Node) {
                        element.appendChild(child);
                    }
                });
                
                return element;
            },
            
            // 查詢元素
            $(selector, parent = document) {
                return parent.querySelector(selector);
            },
            
            // 查詢所有元素
            $$(selector, parent = document) {
                return Array.from(parent.querySelectorAll(selector));
            },
            
            // 新增樣式
            addStyles(styles, id = 'bv-shop-styles') {
                let styleElement = document.getElementById(id);
                
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = id;
                    document.head.appendChild(styleElement);
                }
                
                styleElement.textContent = styles;
            },
            
            // 顯示/隱藏元素
            show(element) {
                if (element) element.style.display = '';
            },
            
            hide(element) {
                if (element) element.style.display = 'none';
            },
            
            // 切換顯示
            toggle(element) {
                if (element) {
                    element.style.display = element.style.display === 'none' ? '' : 'none';
                }
            },
            
            // 添加事件監聽器（支援委託）
            on(element, event, selector, handler) {
                if (typeof selector === 'function') {
                    handler = selector;
                    selector = null;
                }
                
                if (selector) {
                    element.addEventListener(event, function(e) {
                        const target = e.target.closest(selector);
                        if (target && element.contains(target)) {
                            handler.call(target, e);
                        }
                    });
                } else {
                    element.addEventListener(event, handler);
                }
            }
        },
        
        // 儲存工具
        Storage: {
            // 儲存資料
            async save(key, data) {
                try {
                    await chrome.storage.local.set({ [key]: data });
                    return true;
                } catch (error) {
                    console.error('[Storage Save Error]', error);
                    return false;
                }
            },
            
            // 讀取資料
            async load(key) {
                try {
                    const result = await chrome.storage.local.get(key);
                    return result[key];
                } catch (error) {
                    console.error('[Storage Load Error]', error);
                    return null;
                }
            },
            
            // 刪除資料
            async remove(key) {
                try {
                    await chrome.storage.local.remove(key);
                    return true;
                } catch (error) {
                    console.error('[Storage Remove Error]', error);
                    return false;
                }
            },
            
            // 清空所有資料
            async clear() {
                try {
                    await chrome.storage.local.clear();
                    return true;
                } catch (error) {
                    console.error('[Storage Clear Error]', error);
                    return false;
                }
            }
        },
        
        // 通用工具
        General: {
            // 防抖
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
            
            // 節流
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
            
            // 深拷貝
            deepClone(obj) {
                if (obj === null || typeof obj !== 'object') return obj;
                if (obj instanceof Date) return new Date(obj.getTime());
                if (obj instanceof Array) return obj.map(item => this.deepClone(item));
                if (obj instanceof Object) {
                    const clonedObj = {};
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            clonedObj[key] = this.deepClone(obj[key]);
                        }
                    }
                    return clonedObj;
                }
            },
            
            // 生成唯一 ID
            generateId(prefix = 'bv') {
                return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            },
            
            // 等待
            sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            },
            
            // 格式化日期
            formatDate(date, format = 'YYYY-MM-DD') {
                const d = new Date(date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                
                return format
                    .replace('YYYY', year)
                    .replace('MM', month)
                    .replace('DD', day)
                    .replace('HH', hours)
                    .replace('mm', minutes);
            }
        },
        
        // 驗證工具
        Validation: {
            // 檢查是否在支援的頁面
            isValidPage() {
                const hostname = window.location.hostname;
                const pathname = window.location.pathname;
                
                // 檢查是否為 BV SHOP 出貨明細頁面
                return hostname.includes('bvshop') && 
                       (pathname.includes('order') || 
                        document.querySelector('.order-content'));
            },
            
            // 驗證步驟完成
            validateStep(stepId) {
                const step = Object.values(BVShop.Config.WIZARD_STEPS)
                    .find(s => s.id === stepId);
                
                return step && step.validator ? step.validator() : false;
            },
            
            // 驗證檔案類型
            validateFileType(file, allowedTypes) {
                const fileType = file.type.toLowerCase();
                return allowedTypes.some(type => fileType.includes(type));
            },
            
            // 驗證檔案大小
            validateFileSize(file, maxSizeMB) {
                return file.size <= maxSizeMB * 1024 * 1024;
            }
        }
    };
    
    // ========================================
    // 6. UI 系統 (UI)
    // ========================================
    BVShop.UI = {
        // UI 設定
        config: {
            colors: {
                primary: '#518aff',
                primaryDark: '#0040ff',
                primaryLight: '#7fa7ff',
                success: '#10b981',
                warning: '#ff9800',
                error: '#f44336',
                text: '#000',
                textSecondary: 'rgba(0, 0, 0, 0.5)',
                background: 'rgba(255, 255, 255, 0.88)',
                border: 'rgba(0, 0, 0, 0.08)'
            },
            animations: {
                duration: '0.3s',
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }
        },
        
        // ========== 樣式定義 ==========
        Styles: {
            // 獲取所有樣式
            getStyles() {
                const { colors, animations } = BVShop.UI.config;
                
                return `
                    /* 字體載入 */
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
                    @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
                    
                    /* Wizard 容器 */
                    #bv-wizard-container {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(0, 0, 0, 0.5);
                        backdrop-filter: blur(4px);
                        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Noto Sans TC', sans-serif;
                        animation: fadeIn ${animations.duration} ease;
                    }
                    
                    /* Wizard 面板 */
                    .bv-wizard-panel {
                        width: 90%;
                        max-width: 800px;
                        max-height: 90vh;
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(24px) saturate(140%);
                        -webkit-backdrop-filter: blur(24px) saturate(140%);
                        border-radius: 16px;
                        border: 1px solid rgba(255, 255, 255, 0.75);
                        box-shadow: 
                            0 20px 60px rgba(0, 0, 0, 0.15),
                            0 0 0 0.5px rgba(255, 255, 255, 0.6) inset,
                            0 0 80px rgba(255, 255, 255, 0.4);
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        animation: slideUp 0.4s ${animations.easing};
                    }
                    
                    /* Wizard 頭部 */
                    .bv-wizard-header {
                        padding: 24px 32px;
                        border-bottom: 1px solid ${colors.border};
                        background: rgba(255, 255, 255, 0.7);
                        flex-shrink: 0;
                    }
                    
                    .bv-wizard-title {
                        margin: 0 0 8px 0;
                        font-size: 20px;
                        font-weight: 600;
                        color: ${colors.text};
                        letter-spacing: -0.02em;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    
                    .bv-wizard-title .bv-icon {
                        width: 32px;
                        height: 32px;
                        background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 18px;
                    }
                    
                    .bv-wizard-subtitle {
                        font-size: 14px;
                        color: ${colors.textSecondary};
                        margin: 0;
                    }
                    
                    /* 步驟指示器 */
                    .bv-step-indicator {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-top: 20px;
                    }
                    
                    .bv-step-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: rgba(0, 0, 0, 0.15);
                        transition: all ${animations.duration} ease;
                        cursor: pointer;
                        position: relative;
                    }
                    
                    .bv-step-dot:hover {
                        background: rgba(0, 0, 0, 0.25);
                    }
                    
                    .bv-step-dot.active {
                        width: 24px;
                        border-radius: 4px;
                        background: ${colors.primary};
                    }
                    
                    .bv-step-dot.completed {
                        background: ${colors.success};
                    }
                    
                    .bv-step-line {
                        flex: 1;
                        height: 2px;
                        background: rgba(0, 0, 0, 0.1);
                        margin: 0 4px;
                        transition: all ${animations.duration} ease;
                    }
                    
                    .bv-step-line.completed {
                        background: ${colors.success};
                    }
                    
                    /* Wizard 內容區 */
                    .bv-wizard-content {
                        flex: 1;
                        padding: 32px;
                        overflow-y: auto;
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    .bv-wizard-content::-webkit-scrollbar {
                        width: 6px;
                    }
                    
                    .bv-wizard-content::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    
                    .bv-wizard-content::-webkit-scrollbar-thumb {
                        background: rgba(0, 0, 0, 0.15);
                        border-radius: 6px;
                    }
                    
                    .bv-wizard-content::-webkit-scrollbar-thumb:hover {
                        background: rgba(0, 0, 0, 0.25);
                    }
                    
                    /* Wizard 底部 */
                    .bv-wizard-footer {
                        padding: 24px 32px;
                        border-top: 1px solid ${colors.border};
                        background: rgba(255, 255, 255, 0.7);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-shrink: 0;
                    }
                    
                    .bv-footer-left,
                    .bv-footer-right {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                    }
                    
                    /* 按鈕樣式 */
                    .bv-button {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 10px;
                        font-size: 15px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all ${animations.duration} ${animations.easing};
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        letter-spacing: -0.01em;
                        outline: none;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .bv-button:focus {
                        box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.2);
                    }
                    
                    .bv-button-primary {
                        background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
                        color: white;
                        box-shadow: 
                            0 3px 12px rgba(81, 138, 255, 0.25),
                            inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
                    }
                    
                    .bv-button-primary:hover {
                        transform: translateY(-1px);
                        box-shadow: 
                            0 6px 20px rgba(81, 138, 255, 0.35),
                            inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
                    }
                    
                    .bv-button-primary:active {
                        transform: translateY(0);
                    }
                    
                    .bv-button-secondary {
                        background: rgba(0, 0, 0, 0.04);
                        color: rgba(0, 0, 0, 0.7);
                        border: 1px solid ${colors.border};
                    }
                    
                    .bv-button-secondary:hover {
                        background: rgba(0, 0, 0, 0.06);
                        transform: translateY(-1px);
                    }
                    
                    .bv-button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                        transform: none !important;
                    }
                    
                    /* 格式選擇卡片 */
                    .bv-format-cards {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-top: 32px;
                    }
                    
                    .bv-format-card {
                        padding: 24px;
                        background: rgba(248, 250, 252, 0.8);
                        border: 2px solid ${colors.border};
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all ${animations.duration} ease;
                        text-align: center;
                        position: relative;
                    }
                    
                    .bv-format-card:hover {
                        background: rgba(248, 250, 252, 1);
                        border-color: rgba(81, 138, 255, 0.3);
                        transform: translateY(-2px);
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                    }
                    
                    .bv-format-card.selected {
                        background: rgba(81, 138, 255, 0.08);
                        border-color: ${colors.primary};
                        box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
                    }
                    
                    .bv-format-card.selected::after {
                        content: '';
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        width: 24px;
                        height: 24px;
                        background: ${colors.primary};
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .bv-format-card.selected::before {
                        content: '✓';
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        color: white;
                        font-size: 16px;
                        font-weight: bold;
                        z-index: 1;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .bv-format-card-icon {
                        margin-bottom: 16px;
                    }
                    
                    .bv-format-card-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: ${colors.text};
                        margin-bottom: 8px;
                    }
                    
                    .bv-format-card-desc {
                        font-size: 14px;
                        color: ${colors.textSecondary};
                    }
                    
                    /* 模式選擇 */
                    .bv-mode-options {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                        margin-top: 32px;
                    }
                    
                    .bv-mode-option {
                        padding: 20px;
                        background: rgba(248, 250, 252, 0.8);
                        border: 2px solid ${colors.border};
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all ${animations.duration} ease;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        position: relative;
                    }
                    
                    .bv-mode-option:hover {
                        background: rgba(248, 250, 252, 1);
                        border-color: rgba(81, 138, 255, 0.3);
                        transform: translateX(4px);
                    }
                    
                    .bv-mode-option.selected {
                        background: rgba(81, 138, 255, 0.08);
                        border-color: ${colors.primary};
                        box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
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
                        color: ${colors.text};
                        margin-bottom: 4px;
                    }
                    
                    .bv-mode-option-desc {
                        font-size: 14px;
                        color: ${colors.textSecondary};
                    }
                    
                    /* 設定表單 */
                    .bv-settings-section {
                        background: rgba(248, 250, 252, 0.5);
                        border: 1px solid ${colors.border};
                        border-radius: 12px;
                        padding: 24px;
                        margin-bottom: 20px;
                    }
                    
                    .bv-settings-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: ${colors.text};
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
                        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                    }
                    
                    .bv-setting-item:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }
                    
                    .bv-setting-label {
                        font-size: 14px;
                        font-weight: 500;
                        color: ${colors.text};
                    }
                    
                    .bv-setting-desc {
                        font-size: 12px;
                        color: ${colors.textSecondary};
                        margin-top: 2px;
                    }
                    
                    /* 開關樣式 */
                    .bv-switch {
                        position: relative;
                        display: inline-block;
                        width: 48px;
                        height: 28px;
                        cursor: pointer;
                    }
                    
                    .bv-switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    
                    .bv-switch-slider {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.1);
                        border-radius: 28px;
                        transition: all ${animations.duration} ${animations.easing};
                    }
                    
                    .bv-switch-slider:before {
                        position: absolute;
                        content: "";
                        height: 24px;
                        width: 24px;
                        left: 2px;
                        bottom: 2px;
                        background: white;
                        border-radius: 50%;
                        transition: all ${animations.duration} ${animations.easing};
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    }
                    
                    .bv-switch input:checked + .bv-switch-slider {
                        background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
                    }
                    
                    .bv-switch input:checked + .bv-switch-slider:before {
                        transform: translateX(20px);
                    }
                    
                    /* 滑桿樣式 */
                    .bv-slider-container {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        min-width: 180px;
                    }
                    
                    .bv-slider {
                        flex: 1;
                        -webkit-appearance: none;
                        height: 6px;
                        background: rgba(0, 0, 0, 0.06);
                        border-radius: 3px;
                        outline: none;
                        position: relative;
                        cursor: pointer;
                    }
                    
                    .bv-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        background: white;
                        border-radius: 50%;
                        cursor: pointer;
                        box-shadow: 
                            0 1px 4px rgba(0, 0, 0, 0.15),
                            0 0 0 0.5px rgba(0, 0, 0, 0.05);
                        transition: all 0.2s ease;
                    }
                    
                    .bv-slider::-webkit-slider-thumb:hover {
                        transform: scale(1.1);
                        box-shadow: 
                            0 2px 8px rgba(0, 0, 0, 0.2),
                            0 0 0 0.5px rgba(0, 0, 0, 0.08);
                    }
                    
                    .bv-slider-value {
                        min-width: 48px;
                        text-align: center;
                        font-size: 14px;
                        font-weight: 600;
                        color: ${colors.primary};
                        background: rgba(81, 138, 255, 0.08);
                        padding: 4px 8px;
                        border-radius: 6px;
                    }
                    
                    /* 檔案上傳區域 */
                    .bv-upload-area {
                        border: 2px dashed ${colors.border};
                        border-radius: 12px;
                        padding: 48px;
                        text-align: center;
                        transition: all ${animations.duration} ease;
                        cursor: pointer;
                        margin-top: 24px;
                    }
                    
                    .bv-upload-area:hover {
                        border-color: ${colors.primary};
                        background: rgba(81, 138, 255, 0.02);
                    }
                    
                    .bv-upload-area.dragover {
                        border-color: ${colors.primary};
                        background: rgba(81, 138, 255, 0.05);
                        transform: scale(1.01);
                    }
                    
                    .bv-upload-icon {
                        font-size: 48px;
                        color: ${colors.primary};
                        margin-bottom: 16px;
                    }
                    
                    .bv-upload-text {
                        font-size: 16px;
                        color: ${colors.text};
                        margin-bottom: 8px;
                        font-weight: 500;
                    }
                    
                    .bv-upload-hint {
                        font-size: 14px;
                        color: ${colors.textSecondary};
                    }
                    
                    /* 檔案列表 */
                    .bv-file-list {
                        margin-top: 24px;
                    }
                    
                    .bv-file-item {
                        display: flex;
                        align-items: center;
                        padding: 12px;
                        background: rgba(248, 250, 252, 0.5);
                        border: 1px solid ${colors.border};
                        border-radius: 8px;
                        margin-bottom: 8px;
                    }
                    
                    .bv-file-icon {
                        margin-right: 12px;
                        color: ${colors.primary};
                    }
                    
                    .bv-file-name {
                        flex: 1;
                        font-size: 14px;
                        color: ${colors.text};
                    }
                    
                    .bv-file-size {
                        font-size: 12px;
                        color: ${colors.textSecondary};
                        margin-right: 12px;
                    }
                    
                    .bv-file-remove {
                        cursor: pointer;
                        color: ${colors.error};
                        transition: opacity ${animations.duration} ease;
                    }
                    
                    .bv-file-remove:hover {
                        opacity: 0.8;
                    }
                    
                    /* 預覽區域 */
                    .bv-preview-container {
                        background: #f5f5f5;
                        padding: 32px;
                        border-radius: 12px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 400px;
                        margin-top: 24px;
                    }
                    
                    .bv-preview-page {
                        background: white;
                        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    
                    /* 載入狀態 */
                    .bv-loading {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 48px;
                        text-align: center;
                    }
                    
                    .bv-loading-spinner {
                        width: 48px;
                        height: 48px;
                        border: 3px solid rgba(81, 138, 255, 0.1);
                        border-top-color: ${colors.primary};
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-bottom: 16px;
                    }
                    
                    .bv-loading-text {
                        font-size: 14px;
                        color: ${colors.textSecondary};
                    }
                    
                    @keyframes spin {
                        to {
                            transform: rotate(360deg);
                        }
                    }
                    
                    /* 動畫 */
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: 1;
                        }
                    }
                    
                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translate(-50%, -20px);
                        }
                        to {
                            opacity: 1;
                            transform: translate(-50%, 0);
                        }
                    }
                    
                    /* 通知樣式 */
                    .bv-notification {
                        position: fixed;
                        top: 32px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(50px) saturate(180%);
                        -webkit-backdrop-filter: blur(50px) saturate(180%);
                        padding: 16px 24px;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 500;
                        box-shadow: 
                            0 8px 32px rgba(0, 0, 0, 0.12),
                            0 0 0 0.5px rgba(0, 0, 0, 0.05),
                            inset 0 0 0 0.5px rgba(255, 255, 255, 0.9);
                        z-index: 100001;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        animation: slideDown 0.4s ${animations.easing};
                        letter-spacing: -0.01em;
                    }
                    
                    .bv-notification.success {
                        color: #248A3D;
                    }
                    
                    .bv-notification.warning {
                        color: #C04C00;
                    }
                    
                    .bv-notification.error {
                        color: #D70015;
                    }
                    
                    /* 啟動按鈕 */
                    #bv-launch-button {
                        position: fixed;
                        bottom: 24px;
                        right: 24px;
                        padding: 14px 28px;
                        background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        box-shadow: 
                            0 4px 16px rgba(81, 138, 255, 0.3),
                            inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
                        z-index: 9999;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all ${animations.duration} ${animations.easing};
                    }
                    
                    #bv-launch-button:hover {
                        transform: translateY(-2px);
                        box-shadow: 
                            0 8px 24px rgba(81, 138, 255, 0.4),
                            inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
                    }
                    
                    #bv-launch-button:active {
                        transform: translateY(0);
                    }
                    
                    /* 響應式設計 */
                    @media (max-width: 768px) {
                        .bv-wizard-panel {
                            width: 100%;
                            max-width: 100%;
                            height: 100%;
                            max-height: 100%;
                            border-radius: 0;
                        }
                        
                        .bv-wizard-header,
                        .bv-wizard-footer {
                            padding: 16px 20px;
                        }
                        
                        .bv-wizard-content {
                            padding: 20px;
                        }
                        
                        .bv-format-cards {
                            grid-template-columns: 1fr;
                        }
                        
                        .bv-footer-left,
                        .bv-footer-right {
                            flex: 1;
                        }
                        
                        #bv-launch-button {
                            bottom: 16px;
                            right: 16px;
                            padding: 12px 20px;
                            font-size: 14px;
                        }
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
                `;
            }
        },
        
        // ========== UI 元件 ==========
        Components: {
            // 創建主容器
            createContainer() {
                const container = BVShop.Utils.DOM.createElement('div', {
                    id: 'bv-wizard-container',
                    className: 'bv-wizard-container'
                });
                
                // 點擊背景關閉
                container.addEventListener('click', (e) => {
                    if (e.target === container) {
                        BVShop.Events.emit('wizard:cancel');
                    }
                });
                
                return container;
            },
            
            // 創建 Wizard 面板
            createPanel() {
                return BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-wizard-panel'
                });
            },
            
            // 創建頭部
            createHeader(title, subtitle) {
                const header = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-wizard-header'
                });
                
                // 標題區
                const titleContainer = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-wizard-title'
                }, [
                    BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-icon',
                        innerHTML: '<span class="material-icons">label</span>'
                    }),
                    title || BVShop.name
                ]);
                
                const subtitleEl = BVShop.Utils.DOM.createElement('p', {
                    className: 'bv-wizard-subtitle',
                    textContent: subtitle || BVShop.description
                });
                
                // 步驟指示器
                const stepIndicator = this.createStepIndicator();
                
                header.appendChild(titleContainer);
                header.appendChild(subtitleEl);
                header.appendChild(stepIndicator);
                
                return header;
            },
            
            // 創建步驟指示器
            createStepIndicator() {
                const indicator = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-step-indicator',
                    id: 'bv-step-indicator'
                });
                
                const steps = Object.values(BVShop.Config.WIZARD_STEPS)
                    .filter(step => !step.condition || step.condition(BVShop.State.get()))
                    .sort((a, b) => a.order - b.order);
                
                steps.forEach((step, index) => {
                    // 步驟點
                    const dot = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-step-dot',
                        'data-step': step.id,
                        title: step.title
                    });
                    
                    // 點擊跳轉（僅限已完成的步驟）
                    dot.addEventListener('click', () => {
                        const completedSteps = BVShop.State.get('completedSteps') || [];
                        if (completedSteps.includes(step.id)) {
                            BVShop.WizardController.goToStep(step.id);
                        }
                    });
                    
                    indicator.appendChild(dot);
                    
                    // 連接線（最後一個不需要）
                    if (index < steps.length - 1) {
                        const line = BVShop.Utils.DOM.createElement('div', {
                            className: 'bv-step-line',
                            'data-step-line': step.id
                        });
                        indicator.appendChild(line);
                    }
                });
                
                return indicator;
            },
            
            // 創建內容區
            createContent() {
                return BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-wizard-content',
                    id: 'bv-wizard-content'
                });
            },
            
            // 創建底部
            createFooter() {
                const footer = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-wizard-footer'
                });
                
                // 左側按鈕組
                const leftButtons = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-footer-left'
                });
                
                // 取消按鈕
                const cancelBtn = this.createButton('取消', {
                    className: 'bv-button bv-button-secondary',
                    id: 'bv-btn-cancel'
                });
                
                // 上一步按鈕
                const prevBtn = this.createButton('上一步', {
                    className: 'bv-button bv-button-secondary',
                    id: 'bv-btn-prev',
                    style: { display: 'none' }
                });
                
                leftButtons.appendChild(cancelBtn);
                leftButtons.appendChild(prevBtn);
                
                // 右側按鈕組
                const rightButtons = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-footer-right'
                });
                
                // 下一步按鈕
                const nextBtn = this.createButton('下一步', {
                    className: 'bv-button bv-button-primary',
                    id: 'bv-btn-next'
                });
                
                rightButtons.appendChild(nextBtn);
                
                footer.appendChild(leftButtons);
                footer.appendChild(rightButtons);
                
                return footer;
            },
            
            // 創建按鈕
            createButton(text, attributes = {}) {
                return BVShop.Utils.DOM.createElement('button', {
                    type: 'button',
                    ...attributes,
                    textContent: text
                });
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
            },
            
            // 創建檔案上傳區域
            createUploadArea(options = {}) {
                const uploadArea = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-upload-area'
                });
                
                uploadArea.innerHTML = `
                    <div class="bv-upload-icon">
                        <span class="material-icons" style="font-size: 48px;">cloud_upload</span>
                    </div>
                    <div class="bv-upload-text">點擊或拖曳檔案到此處</div>
                    <div class="bv-upload-hint">支援 PDF、JPG、PNG 格式</div>
                `;
                
                // 隱藏的檔案輸入
                const fileInput = BVShop.Utils.DOM.createElement('input', {
                    type: 'file',
                    accept: options.accept || '.pdf,.jpg,.jpeg,.png',
                    multiple: options.multiple !== false,
                    style: { display: 'none' }
                });
                
                uploadArea.appendChild(fileInput);
                
                // 點擊上傳
                uploadArea.addEventListener('click', () => {
                    fileInput.click();
                });
                
                // 拖放處理
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.classList.add('dragover');
                });
                
                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.classList.remove('dragover');
                });
                
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.classList.remove('dragover');
                    
                    const files = Array.from(e.dataTransfer.files);
                    if (options.onFiles) {
                        options.onFiles(files);
                    }
                });
                
                // 檔案選擇
                fileInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    if (options.onFiles) {
                        options.onFiles(files);
                    }
                });
                
                return uploadArea;
            }
        },
        
        // ========== 步驟渲染器 ==========
        StepRenderers: {
            // Step 1: 格式選擇
            renderFormatStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '請選擇標籤尺寸',
                    style: {
                        margin: '0 0 8px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                const subtitle = BVShop.Utils.DOM.createElement('p', {
                    textContent: '選擇適合您印表機的標籤格式',
                    style: {
                        margin: '0 0 32px 0',
                        color: 'rgba(0, 0, 0, 0.5)',
                        fontSize: '14px'
                    }
                });
                
                const cards = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-format-cards'
                });
                
                // 根據配置創建格式卡片
                Object.entries(BVShop.Config.LABEL_FORMATS).forEach(([key, format]) => {
                    const card = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-format-card',
                        'data-format': key,
                        innerHTML: `
                            <div class="bv-format-card-icon">
                                <span class="material-icons" style="font-size: 48px; color: #518aff;">${format.icon}</span>
                            </div>
                            <div class="bv-format-card-title">${format.name}</div>
                            <div class="bv-format-card-desc">${format.description}</div>
                        `
                    });
                    
                    // 檢查是否已選擇
                    if (BVShop.State.get('selectedFormat') === key) {
                        card.classList.add('selected');
                    }
                    
                    // 點擊事件
                    card.addEventListener('click', function() {
                        document.querySelectorAll('.bv-format-card').forEach(c => c.classList.remove('selected'));
                        this.classList.add('selected');
                        
                        // 更新狀態
                        BVShop.State.set('selectedFormat', key);
                        
                        // 啟用下一步按鈕
                        const nextBtn = document.getElementById('bv-btn-next');
                        if (nextBtn) nextBtn.disabled = false;
                    });
                    
                    cards.appendChild(card);
                });
                
                container.appendChild(title);
                container.appendChild(subtitle);
                container.appendChild(cards);
                
                return container;
            },
            
            // Step 2: 模式選擇
            renderModeStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '選擇列印模式',
                    style: {
                        margin: '0 0 8px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                const subtitle = BVShop.Utils.DOM.createElement('p', {
                    textContent: '選擇您要的列印方式',
                    style: {
                        margin: '0 0 32px 0',
                        color: 'rgba(0, 0, 0, 0.5)',
                        fontSize: '14px'
                    }
                });
                
                const options = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-mode-options'
                });
                
                // 根據配置創建模式選項
                Object.entries(BVShop.Config.PRINT_MODES).forEach(([key, mode]) => {
                    const option = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-mode-option',
                        'data-mode': key,
                        innerHTML: `
                            <div class="bv-mode-option-icon">
                                <span class="material-icons" style="font-size: 32px; color: #518aff;">${mode.icon}</span>
                            </div>
                            <div class="bv-mode-option-content">
                                <div class="bv-mode-option-title">${mode.name}</div>
                                <div class="bv-mode-option-desc">${mode.description}</div>
                            </div>
                        `
                    });
                    
                    // 檢查是否已選擇
                    if (BVShop.State.get('selectedMode') === key) {
                        option.classList.add('selected');
                    }
                    
                    // 點擊事件
                    option.addEventListener('click', function() {
                        document.querySelectorAll('.bv-mode-option').forEach(o => o.classList.remove('selected'));
                        this.classList.add('selected');
                        
                        // 更新狀態
                        BVShop.State.set('selectedMode', key);
                        
                        // 啟用下一步按鈕
                        const nextBtn = document.getElementById('bv-btn-next');
                        if (nextBtn) nextBtn.disabled = false;
                    });
                    
                    options.appendChild(option);
                });
                
                container.appendChild(title);
                container.appendChild(subtitle);
                container.appendChild(options);
                
                return container;
            },
            
            // Step 3: 明細設定
            renderDetailSettingsStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '明細設定',
                    style: {
                        margin: '0 0 24px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                // 文字設定區塊
                const textSection = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section',
                    innerHTML: `
                        <h3 class="bv-settings-title">
                            <span class="material-icons" style="font-size: 20px;">text_fields</span>
                            文字設定
                        </h3>
                    `
                });
                
                const fontSizeItem = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-setting-item'
                });
                
                const fontSizeLabel = BVShop.Utils.DOM.createElement('div', {
                    innerHTML: `
                        <div class="bv-setting-label">字體大小</div>
                        <div class="bv-setting-desc">調整標籤文字大小</div>
                    `
                });
                
                const fontSizeSlider = BVShop.UI.Components.createSlider({
                    min: 10,
                    max: 14,
                    value: BVShop.State.get('detailSettings.fontSize') || 11,
                    step: 0.5,
                    onChange: (value) => {
                        BVShop.State.set('detailSettings.fontSize', value);
                    }
                });
                
                fontSizeItem.appendChild(fontSizeLabel);
                fontSizeItem.appendChild(fontSizeSlider);
                textSection.appendChild(fontSizeItem);
                
                // 顯示選項區塊
                const displaySection = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section',
                    innerHTML: `
                        <h3 class="bv-settings-title">
                            <span class="material-icons" style="font-size: 20px;">visibility</span>
                            顯示選項
                        </h3>
                    `
                });
                
                // 設定項目
                const displaySettings = [
                    { 
                        key: 'showQuantityMark',
                        label: '數量標示', 
                        desc: '數量 ≥2 時顯示 ▲ 標記', 
                        checked: BVShop.State.get('detailSettings.showQuantityMark') !== false 
                    },
                    { 
                        key: 'compactMode',
                        label: '精簡模式', 
                        desc: '僅顯示必要資訊', 
                        checked: BVShop.State.get('detailSettings.compactMode') !== false 
                    },
                    { 
                        key: 'hideTableHeader',
                        label: '隱藏表格標題', 
                        desc: '隱藏商品列表的標題欄', 
                        checked: BVShop.State.get('detailSettings.hideTableHeader') === true 
                    },
                    { 
                        key: 'showProductImage',
                        label: '顯示商品圖片', 
                        desc: '在標籤上顯示商品縮圖', 
                        checked: BVShop.State.get('detailSettings.showProductImage') !== false 
                    }
                ];
                
                displaySettings.forEach(setting => {
                    const item = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-item'
                    });
                    
                    const label = BVShop.Utils.DOM.createElement('div', {
                        innerHTML: `
                            <div class="bv-setting-label">${setting.label}</div>
                            <div class="bv-setting-desc">${setting.desc}</div>
                        `
                    });
                    
                    const toggle = BVShop.UI.Components.createSwitch(setting.checked);
                    
                    // 監聽開關變化
                    toggle.querySelector('input').addEventListener('change', (e) => {
                        BVShop.State.set(`detailSettings.${setting.key}`, e.target.checked);
                    });
                    
                    item.appendChild(label);
                    item.appendChild(toggle);
                    displaySection.appendChild(item);
                });
                
                // 訂單資訊區塊
                const orderSection = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section',
                    innerHTML: `
                        <h3 class="bv-settings-title">
                            <span class="material-icons" style="font-size: 20px;">receipt</span>
                            訂單資訊設定
                        </h3>
                    `
                });
                
                const orderSettings = [
                    { 
                        key: 'showOrderNo',
                        label: '顯示訂單編號', 
                        desc: '在標籤上顯示訂單編號', 
                        checked: BVShop.State.get('detailSettings.showOrderNo') !== false 
                    },
                    { 
                        key: 'showLogisticsNo',
                        label: '顯示物流編號', 
                        desc: '在標籤上顯示物流單號', 
                        checked: BVShop.State.get('detailSettings.showLogisticsNo') !== false 
                    },
                    { 
                        key: 'showDeliveryMethod',
                        label: '顯示送貨方式', 
                        desc: '顯示物流公司名稱', 
                        checked: BVShop.State.get('detailSettings.showDeliveryMethod') === true 
                    },
                    { 
                        key: 'showRecipient',
                        label: '顯示收件人', 
                        desc: '顯示收件人姓名', 
                        checked: BVShop.State.get('detailSettings.showRecipient') !== false 
                    },
                    { 
                        key: 'showRecipientPhone',
                        label: '顯示收件人電話', 
                        desc: '顯示收件人聯絡電話', 
                        checked: BVShop.State.get('detailSettings.showRecipientPhone') !== false 
                    },
                    { 
                        key: 'showRecipientAddress',
                        label: '顯示收件地址', 
                        desc: '顯示完整收件地址', 
                        checked: BVShop.State.get('detailSettings.showRecipientAddress') !== false 
                    }
                ];
                
                orderSettings.forEach(setting => {
                    const item = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-item'
                    });
                    
                    const label = BVShop.Utils.DOM.createElement('div', {
                        innerHTML: `
                            <div class="bv-setting-label">${setting.label}</div>
                            <div class="bv-setting-desc">${setting.desc}</div>
                        `
                    });
                    
                    const toggle = BVShop.UI.Components.createSwitch(setting.checked);
                    
                    toggle.querySelector('input').addEventListener('change', (e) => {
                        BVShop.State.set(`detailSettings.${setting.key}`, e.target.checked);
                    });
                    
                    item.appendChild(label);
                    item.appendChild(toggle);
                    orderSection.appendChild(item);
                });
                
                // 組裝所有區塊
                container.appendChild(title);
                container.appendChild(textSection);
                container.appendChild(displaySection);
                container.appendChild(orderSection);
                
                return container;
            },
            
            // Step 4: 物流單準備
            renderShippingSourceStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '上傳物流單',
                    style: {
                        margin: '0 0 8px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                const subtitle = BVShop.Utils.DOM.createElement('p', {
                    textContent: '請上傳要與明細配對的物流單檔案',
                    style: {
                        margin: '0 0 24px 0',
                        color: 'rgba(0, 0, 0, 0.5)',
                        fontSize: '14px'
                    }
                });
                
                // 檔案上傳區域
                const uploadArea = BVShop.UI.Components.createUploadArea({
                    accept: '.pdf,.jpg,.jpeg,.png',
                    multiple: true,
                    onFiles: (files) => {
                        BVShop.WizardController.handleShippingFiles(files);
                    }
                });
                
                // 檔案列表
                const fileList = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-file-list',
                    id: 'shipping-file-list'
                });
                
                container.appendChild(title);
                container.appendChild(subtitle);
                container.appendChild(uploadArea);
                container.appendChild(fileList);
                
                // 顯示已上傳的檔案
                this.updateFileList();
                
                return container;
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
                
                // 配對方式區塊
                const methodSection = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section',
                    innerHTML: `
                        <h3 class="bv-settings-title">
                            <span class="material-icons" style="font-size: 20px;">link</span>
                            配對方式
                        </h3>
                    `
                });
                
                const methods = [
                    { value: 'index', label: '依順序配對', desc: '依照檔案順序進行配對' },
                    { value: 'logistics', label: '依物流編號', desc: '根據物流單號自動配對' },
                    { value: 'order', label: '依訂單編號', desc: '根據訂單編號自動配對' }
                ];
                
                const methodSelect = BVShop.Utils.DOM.createElement('select', {
                    style: {
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '14px'
                    }
                });
                
                methods.forEach(method => {
                    const option = BVShop.Utils.DOM.createElement('option', {
                        value: method.value,
                        textContent: method.label
                    });
                    if (BVShop.State.get('matchingSettings.method') === method.value) {
                        option.selected = true;
                    }
                    methodSelect.appendChild(option);
                });
                
                methodSelect.addEventListener('change', (e) => {
                    BVShop.State.set('matchingSettings.method', e.target.value);
                });
                
                methodSection.appendChild(methodSelect);
                
                // 排序設定區塊
                const sortSection = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-settings-section',
                    innerHTML: `
                        <h3 class="bv-settings-title">
                            <span class="material-icons" style="font-size: 20px;">sort</span>
                            排序設定
                        </h3>
                    `
                });
                
                const sortSettings = [
                    {
                        key: 'detailSort',
                        label: '明細排序',
                        desc: '訂單明細的排序方式',
                        type: 'select',
                        options: [
                            { value: 'asc', label: '升序 (A→Z)' },
                            { value: 'desc', label: '降序 (Z→A)' }
                        ]
                    },
                    {
                        key: 'reverseShipping',
                        label: '反轉物流單順序',
                        desc: '從最後一張開始配對',
                        type: 'switch'
                    },
                    {
                        key: 'showOrderLabel',
                        label: '顯示訂單標籤',
                        desc: '在配對結果顯示訂單編號',
                        type: 'switch'
                    }
                ];
                
                sortSettings.forEach(setting => {
                    const item = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-setting-item'
                    });
                    
                    const label = BVShop.Utils.DOM.createElement('div', {
                        innerHTML: `
                            <div class="bv-setting-label">${setting.label}</div>
                            <div class="bv-setting-desc">${setting.desc}</div>
                        `
                    });
                    
                    if (setting.type === 'select') {
                        const select = BVShop.Utils.DOM.createElement('select', {
                            style: {
                                padding: '6px 12px',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }
                        });
                        
                        setting.options.forEach(opt => {
                            const option = BVShop.Utils.DOM.createElement('option', {
                                value: opt.value,
                                textContent: opt.label
                            });
                            if (BVShop.State.get(`matchingSettings.${setting.key}`) === opt.value) {
                                option.selected = true;
                            }
                            select.appendChild(option);
                        });
                        
                        select.addEventListener('change', (e) => {
                            BVShop.State.set(`matchingSettings.${setting.key}`, e.target.value);
                        });
                        
                        item.appendChild(label);
                        item.appendChild(select);
                    } else {
                        const toggle = BVShop.UI.Components.createSwitch(
                            BVShop.State.get(`matchingSettings.${setting.key}`) === true
                        );
                        
                        toggle.querySelector('input').addEventListener('change', (e) => {
                            BVShop.State.set(`matchingSettings.${setting.key}`, e.target.checked);
                        });
                        
                        item.appendChild(label);
                        item.appendChild(toggle);
                    }
                    
                    sortSection.appendChild(item);
                });
                
                container.appendChild(title);
                container.appendChild(methodSection);
                container.appendChild(sortSection);
                
                return container;
            },
            
            // Step 6: 預覽與列印
            renderPreviewStep() {
                const container = BVShop.Utils.DOM.createElement('div');
                
                const title = BVShop.Utils.DOM.createElement('h2', {
                    textContent: '預覽與列印',
                    style: {
                        margin: '0 0 24px 0',
                        fontSize: '20px',
                        fontWeight: '600'
                    }
                });
                
                // 預覽區域
                const previewContainer = BVShop.Utils.DOM.createElement('div', {
                    className: 'bv-preview-container',
                    id: 'label-preview'
                });
                
                // 生成預覽
                const loading = BVShop.UI.Components.createLoading('正在生成預覽...');
                previewContainer.appendChild(loading);
                
                // 操作按鈕
                const actions = BVShop.Utils.DOM.createElement('div', {
                    style: {
                        marginTop: '24px',
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'center'
                    }
                });
                
                const downloadBtn = BVShop.Utils.DOM.createElement('button', {
                    className: 'bv-button bv-button-secondary',
                    innerHTML: '<span class="material-icons">download</span> 下載 PDF',
                    style: { fontSize: '15px' }
                });
                
                const printBtn = BVShop.Utils.DOM.createElement('button', {
                    className: 'bv-button bv-button-primary',
                    innerHTML: '<span class="material-icons">print</span> 開始列印',
                    style: { fontSize: '16px', padding: '14px 32px' }
                });
                
                downloadBtn.addEventListener('click', () => {
                    BVShop.WizardController.handleDownload();
                });
                
                printBtn.addEventListener('click', () => {
                    BVShop.WizardController.handlePrint();
                });
                
                actions.appendChild(downloadBtn);
                actions.appendChild(printBtn);
                
                container.appendChild(title);
                container.appendChild(previewContainer);
                container.appendChild(actions);
                
                // 非同步生成預覽
                setTimeout(() => {
                    BVShop.WizardController.generatePreview();
                }, 100);
                
                return container;
            },
            
            // 更新檔案列表
            updateFileList() {
                const fileList = document.getElementById('shipping-file-list');
                if (!fileList) return;
                
                fileList.innerHTML = '';
                const shippingData = BVShop.State.get('shippingData') || [];
                
                shippingData.forEach((file, index) => {
                    const fileItem = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-file-item'
                    });
                    
                    fileItem.innerHTML = `
                        <span class="material-icons bv-file-icon">insert_drive_file</span>
                        <span class="bv-file-name">${file.filename}</span>
                        <span class="bv-file-size">${this.formatFileSize(file.size)}</span>
                        <span class="material-icons bv-file-remove" data-index="${index}">close</span>
                    `;
                    
                    // 移除檔案
                    const removeBtn = fileItem.querySelector('.bv-file-remove');
                    removeBtn.addEventListener('click', () => {
                        BVShop.WizardController.removeShippingFile(index);
                    });
                    
                    fileList.appendChild(fileItem);
                });
                
                // 更新下一步按鈕狀態
                const nextBtn = document.getElementById('bv-btn-next');
                if (nextBtn) {
                    nextBtn.disabled = shippingData.length === 0;
                }
            },
            
            // 格式化檔案大小
            formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
        },
        
        // ========== UI 初始化 ==========
        init() {
            // 注入樣式
            BVShop.Utils.DOM.addStyles(this.Styles.getStyles());
            
            // 創建並組裝 UI
            const container = this.Components.createContainer();
            const panel = this.Components.createPanel();
            const header = this.Components.createHeader();
            const content = this.Components.createContent();
            const footer = this.Components.createFooter();
            
            panel.appendChild(header);
            panel.appendChild(content);
            panel.appendChild(footer);
            container.appendChild(panel);
            
            // 隱藏容器（等待開啟）
            container.style.display = 'none';
            
            // 加入 DOM
            document.body.appendChild(container);
            
            // 綁定基本事件
            this.bindBaseEvents();
            
            // 創建啟動按鈕
            this.createLaunchButton();
            
            console.log('✅ UI 系統初始化完成');
        },
        
        // ========== 事件綁定 ==========
        bindBaseEvents() {
            // 取消按鈕
            const cancelBtn = document.getElementById('bv-btn-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    if (confirm('確定要取消嗎？未儲存的設定將會遺失。')) {
                        BVShop.Events.emit('wizard:cancel');
                    }
                });
            }
            
            // 上一步按鈕
            const prevBtn = document.getElementById('bv-btn-prev');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    BVShop.Events.emit('wizard:prev');
                });
            }
            
            // 下一步按鈕
            const nextBtn = document.getElementById('bv-btn-next');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    BVShop.Events.emit('wizard:next');
                });
            }
            
            // ESC 鍵關閉
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && BVShop.State.get('isWizardOpen')) {
                    BVShop.Events.emit('wizard:cancel');
                }
            });
        },
        
        // ========== UI 控制方法 ==========
        show() {
            const container = document.getElementById('bv-wizard-container');
            if (container) {
                container.style.display = 'flex';
                BVShop.State.set('isWizardOpen', true);
                BVShop.Events.emit('wizard:opened');
            }
        },
        
        hide() {
            const container = document.getElementById('bv-wizard-container');
            if (container) {
                container.style.display = 'none';
                BVShop.State.set('isWizardOpen', false);
                BVShop.Events.emit('wizard:closed');
            }
        },
        
        // 更新步驟指示器
        updateStepIndicator(currentStep, completedSteps = []) {
            const dots = document.querySelectorAll('.bv-step-dot');
            const lines = document.querySelectorAll('.bv-step-line');
            
            dots.forEach(dot => {
                const stepId = dot.dataset.step;
                dot.classList.remove('active', 'completed');
                
                if (stepId === currentStep) {
                    dot.classList.add('active');
                } else if (completedSteps.includes(stepId)) {
                    dot.classList.add('completed');
                }
            });
            
            lines.forEach(line => {
                const stepId = line.dataset.stepLine;
                if (completedSteps.includes(stepId)) {
                    line.classList.add('completed');
                } else {
                    line.classList.remove('completed');
                }
            });
        },
        
        // 更新內容區
        updateContent(content) {
            const contentEl = document.getElementById('bv-wizard-content');
            if (contentEl) {
                contentEl.innerHTML = '';
                if (typeof content === 'string') {
                    contentEl.innerHTML = content;
                } else if (content instanceof Node) {
                    contentEl.appendChild(content);
                }
                
                // 捲動到頂部
                contentEl.scrollTop = 0;
            }
        },
        
        // 更新按鈕狀態
        updateButtons(config = {}) {
            const prevBtn = document.getElementById('bv-btn-prev');
            const nextBtn = document.getElementById('bv-btn-next');
            const cancelBtn = document.getElementById('bv-btn-cancel');
            
            if (prevBtn) {
                prevBtn.style.display = config.showPrev ? '' : 'none';
                prevBtn.disabled = config.prevDisabled || false;
            }
            
            if (nextBtn) {
                if (config.nextText) {
                    nextBtn.innerHTML = config.nextText.includes('<') ? 
                        config.nextText : 
                        nextBtn.textContent = config.nextText;
                }
                nextBtn.disabled = config.nextDisabled || false;
                
                // 如果是最後一步，改變樣式
                if (config.isLastStep) {
                    nextBtn.innerHTML = '<span class="material-icons">check</span> 完成';
                }
            }
            
            if (cancelBtn) {
                cancelBtn.style.display = config.showCancel !== false ? '' : 'none';
            }
        },
        
        // 創建啟動按鈕
        createLaunchButton() {
            // 檢查是否已存在
            if (document.getElementById('bv-launch-button')) return;
            
            const button = BVShop.Utils.DOM.createElement('button', {
                id: 'bv-launch-button',
                innerHTML: '<span class="material-icons">label</span> 標籤列印'
            });
            
            button.addEventListener('click', () => {
                BVShop.WizardController.start();
            });
            
            document.body.appendChild(button);
        }
    };
    
    // ========================================
    // 7. 業務邏輯 (Logic)
    // ========================================
    BVShop.Logic = {
        // ========== 格式轉換邏輯 ==========
        Format: {
            // 將出貨明細轉換為標籤格式
            convertToLabel(orderData, settings) {
                const format = BVShop.State.get('selectedFormat');
                const labelConfig = BVShop.Config.LABEL_FORMATS[format];
                
                if (!labelConfig) {
                    throw new Error('未選擇有效的標籤格式');
                }
                
                // 建立標籤容器
                const labelContainer = document.createElement('div');
                labelContainer.className = 'label-container';
                labelContainer.style.cssText = `
                    width: ${labelConfig.widthPx}px;
                    height: ${labelConfig.heightPx}px;
                    padding: ${labelConfig.padding * 3.77}px;
                    box-sizing: border-box;
                    position: relative;
                    overflow: hidden;
                    font-size: ${settings.fontSize || 11}px;
                    font-family: 'Noto Sans TC', sans-serif;
                    background: white;
                `;
                
                // 根據設定生成內容
                const content = this.generateLabelContent(orderData, settings);
                labelContainer.appendChild(content);
                
                return labelContainer;
            },
            
            // 生成標籤內容
            generateLabelContent(orderData, settings) {
                const container = document.createElement('div');
                container.className = 'label-content';
                container.style.cssText = 'height: 100%; display: flex; flex-direction: column;';
                
                // 添加訂單資訊
                if (this.shouldShowOrderInfo(settings)) {
                    const orderInfo = this.createOrderInfoSection(orderData, settings);
                    container.appendChild(orderInfo);
                }
                
                // 添加收件人資訊
                if (this.shouldShowRecipientInfo(settings)) {
                    const recipientInfo = this.createRecipientSection(orderData, settings);
                    container.appendChild(recipientInfo);
                }
                
                // 添加商品列表
                if (settings.showProductList !== false) {
                    const productList = this.createProductListSection(orderData, settings);
                    container.appendChild(productList);
                }
                
                return container;
            },
            
            // 判斷是否顯示訂單資訊
            shouldShowOrderInfo(settings) {
                return settings.showOrderNo || 
                       settings.showLogisticsNo || 
                       settings.showDeliveryMethod;
            },
            
            // 判斷是否顯示收件人資訊
            shouldShowRecipientInfo(settings) {
                return settings.showRecipient || 
                       settings.showRecipientPhone || 
                       settings.showRecipientAddress;
            },
            
            // 創建訂單資訊區塊
            createOrderInfoSection(orderData, settings) {
                const section = document.createElement('div');
                section.className = 'order-info-section';
                section.style.cssText = `
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #ddd;
                    font-size: ${settings.fontSize || 11}px;
                `;
                
                const items = [];
                
                // 訂單編號
                if (settings.showOrderNo && orderData.orderNo) {
                    items.push(`訂單編號: ${orderData.orderNo}`);
                }
                
                // 物流編號
                if (settings.showLogisticsNo && orderData.logisticsNo) {
                    items.push(`物流編號: ${orderData.logisticsNo}`);
                }
                
                // 送貨方式
                if (settings.showDeliveryMethod && orderData.deliveryMethod) {
                    items.push(`${orderData.deliveryMethod}`);
                }
                
                section.innerHTML = items.join(' | ');
                return section;
            },
            
            // 創建收件人區塊
            createRecipientSection(orderData, settings) {
                const section = document.createElement('div');
                section.className = 'recipient-section';
                section.style.cssText = `
                    margin-bottom: 10px;
                    font-size: ${settings.fontSize || 11}px;
                `;
                
                const lines = [];
                
                // 收件人姓名
                if (settings.showRecipient && orderData.recipient) {
                    lines.push(`<div style="font-weight: bold; font-size: ${(settings.fontSize || 11) + 1}px;">
                        收件人: ${orderData.recipient}
                    </div>`);
                }
                
                // 精簡模式不顯示詳細資訊
                if (!settings.compactMode) {
                    // 電話
                    if (settings.showRecipientPhone && orderData.recipientPhone) {
                        lines.push(`電話: ${orderData.recipientPhone}`);
                    }
                    
                    // 地址
                    if (settings.showRecipientAddress && orderData.recipientAddress) {
                        lines.push(`地址: ${orderData.recipientAddress}`);
                    }
                }
                
                section.innerHTML = lines.join('<br>');
                return section;
            },
            
            // 創建商品列表區塊
            createProductListSection(orderData, settings) {
                const section = document.createElement('div');
                section.className = 'product-list-section';
                section.style.cssText = 'flex: 1; overflow: auto;';
                
                // 建立表格
                const table = document.createElement('table');
                table.style.cssText = `
                    width: 100%;
                    border-collapse: collapse;
                    font-size: ${settings.fontSize || 11}px;
                `;
                
                // 表頭（根據設定決定是否顯示）
                if (!settings.hideTableHeader) {
                    const thead = document.createElement('thead');
                    thead.innerHTML = `
                        <tr style="border-bottom: 1px solid #ddd;">
                            ${settings.showProductImage ? '<th style="width: 50px; padding: 4px;">圖片</th>' : ''}
                            <th style="text-align: left; padding: 4px;">商品名稱</th>
                            <th style="width: 50px; text-align: center; padding: 4px;">數量</th>
                        </tr>
                    `;
                    table.appendChild(thead);
                }
                
                // 表身
                const tbody = document.createElement('tbody');
                
                if (orderData.products && orderData.products.length > 0) {
                    orderData.products.forEach(product => {
                        const row = document.createElement('tr');
                        row.style.cssText = 'border-bottom: 1px solid #eee;';
                        
                        let rowContent = '';
                        
                        // 商品圖片
                        if (settings.showProductImage) {
                            rowContent += `
                                <td style="padding: 4px;">
                                    ${product.image ? 
                                        `<img src="${product.image}" 
                                             style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` :
                                        '<div style="width: 40px; height: 40px; background: #f0f0f0; border-radius: 4px;"></div>'
                                    }
                                </td>
                            `;
                        }
                        
                        // 商品名稱
                        rowContent += `<td style="padding: 4px; line-height: 1.4;">${product.name || '未命名商品'}</td>`;
                        
                        // 數量（包含標記）
                        const quantityMark = settings.showQuantityMark && product.quantity >= 2 ? ' ▲' : '';
                        rowContent += `
                            <td style="text-align: center; padding: 4px; font-weight: bold;">
                                ${product.quantity || 1}${quantityMark}
                            </td>
                        `;
                        
                        row.innerHTML = rowContent;
                        tbody.appendChild(row);
                    });
                } else {
                    // 無商品資料
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td colspan="${settings.showProductImage ? 3 : 2}" 
                            style="text-align: center; padding: 20px; color: #999;">
                            無商品資料
                        </td>
                    `;
                    tbody.appendChild(row);
                }
                
                table.appendChild(tbody);
                section.appendChild(table);
                
                return section;
            }
        },
        
        // ========== 物流處理邏輯 ==========
        Shipping: {
            // 解析物流單資料
            async parseShippingData(file) {
                try {
                    const fileData = {
                        filename: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified
                    };
                    
                    if (file.type === 'application/pdf') {
                        // PDF 處理
                        fileData.content = await this.parsePDF(file);
                    } else if (file.type.includes('image')) {
                        // 圖片處理
                        fileData.content = await this.parseImage(file);
                    } else {
                        throw new Error('不支援的檔案格式');
                    }
                    
                    return fileData;
                } catch (error) {
                    console.error('解析物流單錯誤:', error);
                    throw error;
                }
            },
            
            // 解析 PDF
            async parsePDF(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    
                    reader.onload = (e) => {
                        // 暫時返回 base64 資料
                        resolve({
                            type: 'pdf',
                            data: e.target.result,
                            pages: 1 // TODO: 實作 PDF 頁數計算
                        });
                    };
                    
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            },
            
            // 解析圖片
            async parseImage(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            resolve({
                                type: 'image',
                                data: e.target.result,
                                width: img.width,
                                height: img.height
                            });
                        };
                        img.onerror = reject;
                        img.src = e.target.result;
                    };
                    
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            },
            
            // 批次處理物流單
            async processBatch(files) {
                const results = [];
                const errors = [];
                
                for (let i = 0; i < files.length; i++) {
                    try {
                        const result = await this.parseShippingData(files[i]);
                        results.push(result);
                    } catch (error) {
                        errors.push({
                            file: files[i].name,
                            error: error.message
                        });
                    }
                }
                
                if (errors.length > 0) {
                    console.warn('部分檔案處理失敗:', errors);
                }
                
                return { results, errors };
            }
        },
        
        // ========== 配對邏輯 ==========
        Matching: {
            // 執行配對
            performMatching(orders, shippingData, settings) {
                const method = settings.method || 'index';
                
                switch (method) {
                    case 'index':
                        return this.matchByIndex(orders, shippingData, settings);
                        
                    case 'logistics':
                        return this.matchByLogisticsNo(orders, shippingData, settings);
                        
                    case 'order':
                        return this.matchByOrderNo(orders, shippingData, settings);
                        
                    default:
                        throw new Error('未知的配對方法');
                }
            },
            
            // 依索引配對
            matchByIndex(orders, shippingData, settings) {
                const sortedOrders = this.sortOrders(orders, settings.detailSort);
                const processedShipping = settings.reverseShipping ? 
                    [...shippingData].reverse() : shippingData;
                
                return sortedOrders.map((order, index) => ({
                    order: order,
                    shipping: processedShipping[index] || null,
                    matched: index < processedShipping.length,
                    method: 'index',
                    index: index + 1
                }));
            },
            
            // 依物流編號配對
            matchByLogisticsNo(orders, shippingData, settings) {
                // TODO: 實作物流編號配對邏輯
                // 暫時使用索引配對
                return this.matchByIndex(orders, shippingData, settings);
            },
            
            // 依訂單編號配對
            matchByOrderNo(orders, shippingData, settings) {
                // TODO: 實作訂單編號配對邏輯
                // 暫時使用索引配對
                return this.matchByIndex(orders, shippingData, settings);
            },
            
            // 排序訂單
            sortOrders(orders, sortType) {
                const sorted = [...orders];
                
                if (sortType === 'asc') {
                    sorted.sort((a, b) => {
                        const aNo = a.orderNo || '';
                        const bNo = b.orderNo || '';
                        return aNo.localeCompare(bNo, 'zh-TW');
                    });
                } else if (sortType === 'desc') {
                    sorted.sort((a, b) => {
                        const aNo = a.orderNo || '';
                        const bNo = b.orderNo || '';
                        return bNo.localeCompare(aNo, 'zh-TW');
                    });
                }
                
                return sorted;
            }
        },
        
        // ========== 列印處理邏輯 ==========
        Print: {
            // 準備列印
            preparePrint(matchedData, settings) {
                // 創建列印容器
                const printContainer = document.createElement('div');
                printContainer.id = 'print-area';
                printContainer.style.cssText = `
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                `;
                
                // 根據選擇的模式處理
                const mode = BVShop.State.get('selectedMode');
                
                if (mode === 'A') {
                    // 僅列印明細
                    this.prepareLabelOnlyPrint(printContainer, matchedData, settings);
                } else if (mode === 'B') {
                    // 明細 + 物流單
                    this.prepareCombinedPrint(printContainer, matchedData, settings);
                }
                
                return printContainer;
            },
            
            // 準備僅標籤列印
            prepareLabelOnlyPrint(container, matchedData, settings) {
                matchedData.forEach((item, index) => {
                    const page = this.createPrintPage(item, settings);
                    container.appendChild(page);
                    
                    // 分頁符號
                    if (index < matchedData.length - 1) {
                        const pageBreak = document.createElement('div');
                        pageBreak.style.cssText = 'page-break-after: always;';
                        container.appendChild(pageBreak);
                    }
                });
            },
            
            // 準備組合列印
            prepareCombinedPrint(container, matchedData, settings) {
                matchedData.forEach((item, index) => {
                    // 先印標籤
                    const labelPage = this.createPrintPage(item, settings);
                    container.appendChild(labelPage);
                    
                    // 分頁
                    const pageBreak1 = document.createElement('div');
                    pageBreak1.style.cssText = 'page-break-after: always;';
                    container.appendChild(pageBreak1);
                    
                    // 再印物流單（如果有）
                    if (item.shipping && item.shipping.content) {
                        const shippingPage = this.createShippingPage(item.shipping);
                        container.appendChild(shippingPage);
                        
                        // 分頁（除了最後一個）
                        if (index < matchedData.length - 1) {
                            const pageBreak2 = document.createElement('div');
                            pageBreak2.style.cssText = 'page-break-after: always;';
                            container.appendChild(pageBreak2);
                        }
                    }
                });
            },
            
            // 創建列印頁面
            createPrintPage(matchedItem, settings) {
                const page = document.createElement('div');
                page.className = 'print-page';
                
                const format = BVShop.State.get('selectedFormat');
                const labelConfig = BVShop.Config.LABEL_FORMATS[format];
                
                page.style.cssText = `
                    width: ${labelConfig.widthPx}px;
                    height: ${labelConfig.heightPx}px;
                    position: relative;
                    margin: 0 auto;
                    page-break-inside: avoid;
                `;
                
                // 添加標籤
                const label = BVShop.Logic.Format.convertToLabel(
                    matchedItem.order, 
                    settings
                );
                
                // 添加配對標記（如果設定顯示）
                if (settings.showOrderLabel && matchedItem.index) {
                    const orderLabel = document.createElement('div');
                    orderLabel.style.cssText = `
                        position: absolute;
                        top: 5px;
                        right: 5px;
                        background: #333;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: bold;
                    `;
                    orderLabel.textContent = `#${matchedItem.index}`;
                    label.appendChild(orderLabel);
                }
                
                page.appendChild(label);
                return page;
            },
            
            // 創建物流單頁面
            createShippingPage(shipping) {
                const page = document.createElement('div');
                page.className = 'shipping-page';
                page.style.cssText = `
                    page-break-inside: avoid;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                `;
                
                if (shipping.content.type === 'image') {
                    const img = document.createElement('img');
                    img.src = shipping.content.data;
                    img.style.cssText = `
                        max-width: 100%;
                        max-height: 100vh;
                        object-fit: contain;
                    `;
                    page.appendChild(img);
                } else if (shipping.content.type === 'pdf') {
                    // TODO: 實作 PDF 顯示
                    const placeholder = document.createElement('div');
                    placeholder.style.cssText = `
                        padding: 40px;
                        background: #f5f5f5;
                        border: 2px dashed #ddd;
                        text-align: center;
                        color: #666;
                    `;
                    placeholder.innerHTML = `
                        <p>PDF 檔案: ${shipping.filename}</p>
                        <p style="font-size: 12px;">請使用 PDF 檢視器開啟</p>
                    `;
                    page.appendChild(placeholder);
                }
                
                return page;
            },
            
            // 執行列印
            executePrint(printContainer) {
                // 先將列印內容加入 DOM
                document.body.appendChild(printContainer);
                
                // 延遲執行列印，確保內容已渲染
                setTimeout(() => {
                    window.print();
                    
                    // 列印完成後移除
                    setTimeout(() => {
                        printContainer.remove();
                    }, 1000);
                }, 100);
            },
            
            // 下載 PDF
            async downloadPDF(printContainer) {
                // TODO: 實作 PDF 下載功能
                BVShop.UI.Components.showNotification('PDF 下載功能開發中', 'info');
            }
        },
        
        // ========== 資料處理 ==========
        Data: {
            // 從頁面擷取訂單資料
            extractOrderData() {
                const orders = [];
                
                // 嘗試多種可能的選擇器
                const orderSelectors = [
                    '.order-content',
                    '.order-item',
                    '[class*="order"]',
                    'table tr:has(td)',
                    '.print-area > div'
                ];
                
                let orderElements = null;
                for (const selector of orderSelectors) {
                    orderElements = document.querySelectorAll(selector);
                    if (orderElements.length > 0) break;
                }
                
                if (!orderElements || orderElements.length === 0) {
                    console.warn('找不到訂單元素');
                    return orders;
                }
                
                orderElements.forEach((element, index) => {
                    // 跳過表頭
                    if (element.querySelector('th')) return;
                    
                    const order = {
                        id: BVShop.Utils.General.generateId('order'),
                        orderNo: this.extractOrderNo(element) || `ORDER-${index + 1}`,
                        logisticsNo: this.extractLogisticsNo(element),
                        deliveryMethod: this.extractDeliveryMethod(element),
                        recipient: this.extractRecipient(element),
                        recipientPhone: this.extractPhone(element),
                        recipientAddress: this.extractAddress(element),
                        products: this.extractProducts(element),
                        rawElement: element
                    };
                    
                    // 只加入有效的訂單
                    if (order.products.length > 0 || order.recipient) {
                        orders.push(order);
                    }
                });
                
                return orders;
            },
            
            // 擷取訂單編號
            extractOrderNo(element) {
                const patterns = [
                    /訂單編號[：:]\s*([A-Z0-9\-]+)/i,
                    /Order\s*#?\s*([A-Z0-9\-]+)/i,
                    /編號[：:]\s*([A-Z0-9\-]+)/i
                ];
                
                const text = element.textContent;
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1];
                }
                
                // 嘗試從特定元素擷取
                const orderNoEl = element.querySelector('.order-no, .order-number, [class*="order-no"]');
                return orderNoEl ? orderNoEl.textContent.trim() : null;
            },
            
            // 擷取物流編號
            extractLogisticsNo(element) {
                const patterns = [
                    /物流編號[：:]\s*([A-Z0-9\-]+)/i,
                    /運單號[：:]\s*([A-Z0-9\-]+)/i,
                    /Tracking[：:]\s*([A-Z0-9\-]+)/i
                ];
                
                const text = element.textContent;
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1];
                }
                
                const logisticsEl = element.querySelector('.logistics-no, .shipping-no, [class*="logistics"]');
                return logisticsEl ? logisticsEl.textContent.trim() : null;
            },
            
            // 擷取送貨方式
            extractDeliveryMethod(element) {
                const methods = ['順豐', '黑貓', '郵局', '7-11', '全家', 'FamilyMart', 'SevenEleven'];
                const text = element.textContent;
                
                for (const method of methods) {
                    if (text.includes(method)) return method;
                }
                
                const deliveryEl = element.querySelector('.delivery-method, .shipping-method');
                return deliveryEl ? deliveryEl.textContent.trim() : null;
            },
            
            // 擷取收件人
            extractRecipient(element) {
                const patterns = [
                    /收件人[：:]\s*([^\s,，]+)/,
                    /姓名[：:]\s*([^\s,，]+)/,
                    /Recipient[：:]\s*([^\s,，]+)/i
                ];
                
                const text = element.textContent;
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1];
                }
                
                const recipientEl = element.querySelector('.recipient, .receiver, [class*="recipient"]');
                return recipientEl ? recipientEl.textContent.trim() : null;
            },
            
            // 擷取電話
            extractPhone(element) {
                const patterns = [
                    /電話[：:]\s*([\d\-\s]+)/,
                    /手機[：:]\s*([\d\-\s]+)/,
                    /Tel[：:]\s*([\d\-\s]+)/i,
                    /\b09\d{2}[\-\s]?\d{3}[\-\s]?\d{3}\b/
                ];
                
                const text = element.textContent;
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1] || match[0];
                }
                
                const phoneEl = element.querySelector('.phone, .tel, [class*="phone"]');
                return phoneEl ? phoneEl.textContent.trim() : null;
            },
            
            // 擷取地址
            extractAddress(element) {
                const patterns = [
                    /地址[：:]\s*([^，,]+(?:號|樓|室))/,
                    /送貨地址[：:]\s*([^，,]+(?:號|樓|室))/,
                    /Address[：:]\s*([^,]+)/i
                ];
                
                const text = element.textContent;
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) return match[1];
                }
                
                const addressEl = element.querySelector('.address, [class*="address"]');
                return addressEl ? addressEl.textContent.trim() : null;
            },
            
            // 擷取商品列表
            extractProducts(container) {
                const products = [];
                
                // 嘗試從表格擷取
                const rows = container.querySelectorAll('tr:has(td)');
                if (rows.length > 0) {
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const product = {
                                name: this.extractProductName(row),
                                quantity: this.extractQuantity(row),
                                image: this.extractProductImage(row)
                            };
                            
                            if (product.name) {
                                products.push(product);
                            }
                        }
                    });
                }
                
                // 如果沒有表格，嘗試其他結構
                if (products.length === 0) {
                    const productEls = container.querySelectorAll('.product-item, .item, [class*="product"]');
                    productEls.forEach(el => {
                        const product = {
                            name: this.extractProductName(el),
                            quantity: this.extractQuantity(el),
                            image: this.extractProductImage(el)
                        };
                        
                        if (product.name) {
                            products.push(product);
                        }
                    });
                }
                
                return products;
            },
            
            // 擷取商品名稱
            extractProductName(element) {
                // 優先查找特定類別
                const nameEl = element.querySelector('.product-name, .item-name, [class*="name"]');
                if (nameEl) return nameEl.textContent.trim();
                
                // 從表格結構擷取（通常是第二個 td）
                const cells = element.querySelectorAll('td');
                if (cells.length >= 2) {
                    // 跳過可能是圖片的欄位
                    const nameCell = cells[0].querySelector('img') ? cells[1] : cells[0];
                    return nameCell.textContent.trim();
                }
                
                // 最後嘗試直接取文字
                const text = element.textContent.trim();
                // 移除數量等資訊
                return text.replace(/\s*\d+\s*$/, '').trim();
            },
            
            // 擷取數量
            extractQuantity(element) {
                // 查找數量元素
                const qtyEl = element.querySelector('.quantity, .qty, [class*="quantity"]');
                if (qtyEl) {
                    const qty = parseInt(qtyEl.textContent);
                    return isNaN(qty) ? 1 : qty;
                }
                
                // 從文字中擷取數字
                const text = element.textContent;
                const matches = text.match(/\b(\d+)\s*(?:個|件|pcs|片|組|套|包|盒|箱|瓶|罐|支|隻|條|份)?\s*$/i);
                if (matches) {
                    const qty = parseInt(matches[1]);
                    return isNaN(qty) ? 1 : qty;
                }
                
                // 從表格最後一欄擷取
                const cells = element.querySelectorAll('td');
                if (cells.length >= 2) {
                    const lastCell = cells[cells.length - 1];
                    const qty = parseInt(lastCell.textContent);
                    return isNaN(qty) ? 1 : qty;
                }
                
                return 1;
            },
            
            // 擷取商品圖片
            extractProductImage(element) {
                const img = element.querySelector('img');
                if (img) {
                    // 確保是完整的 URL
                    const src = img.src;
                    if (src && !src.includes('placeholder') && !src.includes('default')) {
                        return src;
                    }
                }
                return null;
            },
            
            // 取得模擬資料（用於測試）
            getMockOrderData() {
                return {
                    orderNo: 'BV2025072200001',
                    logisticsNo: 'SF1234567890',
                    deliveryMethod: '順豐速運',
                    recipient: '王大明',
                    recipientPhone: '0912-345-678',
                    recipientAddress: '台北市信義區市府路45號12樓',
                    products: [
                        { 
                            name: '【限量版】BV 經典 T-Shirt - 深藍/XL', 
                            quantity: 2, 
                            image: 'https://via.placeholder.com/50x50/4a5568/ffffff?text=BV' 
                        },
                        { 
                            name: 'BV 運動褲 - 黑色/L', 
                            quantity: 1, 
                            image: 'https://via.placeholder.com/50x50/2d3748/ffffff?text=BV' 
                        },
                        { 
                            name: 'BV 配件組合包（帽子+手環）', 
                            quantity: 3, 
                            image: 'https://via.placeholder.com/50x50/718096/ffffff?text=BV' 
                        }
                    ]
                };
            }
        }
    };
    
    // ========================================
    // 8. Wizard 控制器 (WizardController)
    // ========================================
    BVShop.WizardController = {
        // 當前步驟索引
        currentStepIndex: -1,
        
        // 取得步驟列表
        getSteps() {
            const state = BVShop.State.get();
            return Object.values(BVShop.Config.WIZARD_STEPS)
                .filter(step => !step.condition || step.condition(state))
                .sort((a, b) => a.order - b.order);
        },
        
        // 啟動 Wizard
        start() {
            // 載入儲存的狀態
            BVShop.State.load().then(() => {
                // 重置 Wizard 狀態
                BVShop.State.update({
                    currentStep: null,
                    completedSteps: [],
                    selectedFormat: null,
                    selectedMode: null,
                    shippingData: [],
                    matchedData: []
                });
                
                // 擷取頁面資料
                const orderData = BVShop.Logic.Data.extractOrderData();
                if (orderData.length === 0 && BVShop.Config.DEBUG) {
                    // 測試模式使用模擬資料
                    orderData.push(BVShop.Logic.Data.getMockOrderData());
                }
                
                BVShop.State.set('orderData', orderData);
                
                // 顯示 UI
                BVShop.UI.show();
                
                // 進入第一步
                this.goToStep('format');
            });
        },
        
        // 前往指定步驟
        goToStep(stepId) {
            const steps = this.getSteps();
            const step = steps.find(s => s.id === stepId);
            
            if (!step) {
                console.error('無效的步驟:', stepId);
                return;
            }
            
            // 更新當前步驟
            BVShop.State.set('currentStep', stepId);
            this.currentStepIndex = steps.findIndex(s => s.id === stepId);
            
            // 渲染步驟內容
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
                    content = '<p>未知的步驟</p>';
            }
            
            // 更新 UI
            BVShop.UI.updateContent(content);
            
            // 更新按鈕狀態
            this.updateButtonStates();
            
            // 更新步驟指示器
            const completedSteps = BVShop.State.get('completedSteps') || [];
            BVShop.UI.updateStepIndicator(stepId, completedSteps);
            
            // 觸發事件
            BVShop.Events.emit('step:changed', { step: stepId });
        },
        
        // 下一步
        nextStep() {
            const currentStep = BVShop.State.get('currentStep');
            
            // 驗證當前步驟
            if (!BVShop.Utils.Validation.validateStep(currentStep)) {
                BVShop.UI.Components.showNotification('請完成當前步驟的必要設定', 'warning');
                return;
            }
            
            // 加入已完成步驟
            const completedSteps = BVShop.State.get('completedSteps') || [];
            if (!completedSteps.includes(currentStep)) {
                completedSteps.push(currentStep);
                BVShop.State.set('completedSteps', completedSteps);
            }
            
            // 特殊處理：最後一步
            if (currentStep === 'preview') {
                this.complete();
                return;
            }
            
            // 進入下一步
            const steps = this.getSteps();
            if (this.currentStepIndex < steps.length - 1) {
                const nextStep = steps[this.currentStepIndex + 1];
                this.goToStep(nextStep.id);
            }
        },
        
        // 上一步
        prevStep() {
            const steps = this.getSteps();
            if (this.currentStepIndex > 0) {
                const prevStep = steps[this.currentStepIndex - 1];
                this.goToStep(prevStep.id);
            }
        },
        
        // 更新按鈕狀態
        updateButtonStates() {
            const steps = this.getSteps();
            const isFirstStep = this.currentStepIndex === 0;
            const isLastStep = this.currentStepIndex === steps.length - 1;
            const currentStep = BVShop.State.get('currentStep');
            
            // 根據步驟設定按鈕
            const buttonConfig = {
                showPrev: !isFirstStep,
                showCancel: true,
                nextDisabled: false
            };
            
            // 特定步驟的按鈕設定
            switch (currentStep) {
                case 'format':
                    buttonConfig.nextText = '下一步';
                    buttonConfig.nextDisabled = !BVShop.State.get('selectedFormat');
                    break;
                    
                case 'mode':
                    buttonConfig.nextText = '下一步';
                    buttonConfig.nextDisabled = !BVShop.State.get('selectedMode');
                    break;
                    
                case 'detail_settings':
                    buttonConfig.nextText = BVShop.State.get('selectedMode') === 'B' ? 
                        '下一步' : '開始轉換';
                    break;
                    
                case 'shipping_source':
                    buttonConfig.nextText = '下一步';
                    buttonConfig.nextDisabled = (BVShop.State.get('shippingData') || []).length === 0;
                    break;
                    
                case 'matching':
                    buttonConfig.nextText = '開始轉換';
                    break;
                    
                case 'preview':
                    buttonConfig.nextText = '完成';
                    buttonConfig.isLastStep = true;
                    break;
            }
            
            BVShop.UI.updateButtons(buttonConfig);
        },
        
        // 處理物流檔案上傳
        async handleShippingFiles(files) {
            // 顯示載入中
            BVShop.UI.Components.showNotification('正在處理檔案...', 'info', 0);
            
            try {
                // 驗證檔案
                const validFiles = [];
                for (const file of files) {
                    if (!BVShop.Utils.Validation.validateFileType(file, ['pdf', 'image'])) {
                        throw new Error(`不支援的檔案格式: ${file.name}`);
                    }
                    if (!BVShop.Utils.Validation.validateFileSize(file, 10)) {
                        throw new Error(`檔案過大: ${file.name} (最大 10MB)`);
                    }
                    validFiles.push(file);
                }
                
                // 處理檔案
                const result = await BVShop.Logic.Shipping.processBatch(validFiles);
                
                // 更新狀態
                const currentData = BVShop.State.get('shippingData') || [];
                const newData = [...currentData, ...result.results];
                BVShop.State.set('shippingData', newData);
                
                // 更新檔案列表
                BVShop.UI.StepRenderers.updateFileList();
                
                // 顯示成功訊息
                const existing = document.querySelector('.bv-notification');
                if (existing) existing.remove();
                
                if (result.errors.length > 0) {
                    BVShop.UI.Components.showNotification(
                        `已上傳 ${result.results.length} 個檔案，${result.errors.length} 個失敗`,
                        'warning'
                    );
                } else {
                    BVShop.UI.Components.showNotification(
                        `成功上傳 ${result.results.length} 個檔案`,
                        'success'
                    );
                }
                
            } catch (error) {
                console.error('檔案處理錯誤:', error);
                const existing = document.querySelector('.bv-notification');
                if (existing) existing.remove();
                BVShop.UI.Components.showNotification(error.message, 'error');
            }
        },
        
        // 移除物流檔案
        removeShippingFile(index) {
            const shippingData = BVShop.State.get('shippingData') || [];
            shippingData.splice(index, 1);
            BVShop.State.set('shippingData', shippingData);
            
            // 更新檔案列表
            BVShop.UI.StepRenderers.updateFileList();
            
            BVShop.UI.Components.showNotification('檔案已移除', 'info');
        },
        
        // 生成預覽
        async generatePreview() {
            const previewContainer = document.getElementById('label-preview');
            if (!previewContainer) return;
            
            try {
                // 取得設定和資料
                const settings = BVShop.State.get('detailSettings');
                const orderData = BVShop.State.get('orderData') || [];
                const shippingData = BVShop.State.get('shippingData') || [];
                const matchingSettings = BVShop.State.get('matchingSettings');
                const selectedMode = BVShop.State.get('selectedMode');
                
                // 執行配對
                let matchedData;
                if (selectedMode === 'B' && shippingData.length > 0) {
                    matchedData = BVShop.Logic.Matching.performMatching(
                        orderData,
                        shippingData,
                        matchingSettings
                    );
                } else {
                    // 模式 A：只有訂單
                    matchedData = orderData.map((order, index) => ({
                        order: order,
                        shipping: null,
                        matched: true,
                        method: 'none',
                        index: index + 1
                    }));
                }
                
                // 儲存配對結果
                BVShop.State.set('matchedData', matchedData);
                
                // 清空預覽容器
                previewContainer.innerHTML = '';
                
                // 顯示第一個標籤作為預覽
                if (matchedData.length > 0) {
                    const firstItem = matchedData[0];
                    const previewLabel = BVShop.Logic.Format.convertToLabel(
                        firstItem.order,
                        settings
                    );
                    
                    // 添加預覽樣式
                    const previewWrapper = BVShop.Utils.DOM.createElement('div', {
                        className: 'bv-preview-page',
                        style: {
                            transform: 'scale(0.8)',
                            transformOrigin: 'center',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: 'white',
                            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
                        }
                    });
                    
                    previewWrapper.appendChild(previewLabel);
                    previewContainer.appendChild(previewWrapper);
                    
                    // 顯示統計資訊
                    const stats = BVShop.Utils.DOM.createElement('div', {
                        style: {
                            marginTop: '20px',
                            textAlign: 'center',
                            fontSize: '14px',
                            color: '#666'
                        },
                        innerHTML: `
                            <p>共 ${matchedData.length} 筆訂單
                            ${selectedMode === 'B' ? `，${shippingData.length} 張物流單` : ''}
                            </p>
                            <p style="font-size: 12px; margin-top: 8px;">
                                這是第 1 筆訂單的預覽
                            </p>
                        `
                    });
                    
                    previewContainer.appendChild(stats);
                } else {
                    previewContainer.innerHTML = '<p style="text-align: center; color: #999;">無資料可預覽</p>';
                }
                
            } catch (error) {
                console.error('預覽生成錯誤:', error);
                previewContainer.innerHTML = `
                    <p style="text-align: center; color: #f44336;">
                        預覽生成失敗: ${error.message}
                    </p>
                `;
            }
        },
        
        // 處理列印
        handlePrint() {
            const matchedData = BVShop.State.get('matchedData');
            const settings = BVShop.State.get('detailSettings');
            
            if (!matchedData || matchedData.length === 0) {
                BVShop.UI.Components.showNotification('沒有可列印的資料', 'warning');
                return;
            }
            
            BVShop.UI.Components.showNotification('正在準備列印...', 'info');
            
            try {
                // 準備列印內容
                const printContainer = BVShop.Logic.Print.preparePrint(matchedData, settings);
                
                // 執行列印
                setTimeout(() => {
                    BVShop.Logic.Print.executePrint(printContainer);
                    
                    // 記錄列印
                    BVShop.Events.emit('print:completed', {
                        count: matchedData.length,
                        mode: BVShop.State.get('selectedMode'),
                        timestamp: new Date().toISOString()
                    });
                }, 500);
                
            } catch (error) {
                console.error('列印錯誤:', error);
                BVShop.UI.Components.showNotification('列印失敗: ' + error.message, 'error');
            }
        },
        
        // 處理下載
        async handleDownload() {
            const matchedData = BVShop.State.get('matchedData');
            const settings = BVShop.State.get('detailSettings');
            
            if (!matchedData || matchedData.length === 0) {
                BVShop.UI.Components.showNotification('沒有可下載的資料', 'warning');
                return;
            }
            
            try {
                const printContainer = BVShop.Logic.Print.preparePrint(matchedData, settings);
                await BVShop.Logic.Print.downloadPDF(printContainer);
            } catch (error) {
                console.error('下載錯誤:', error);
                BVShop.UI.Components.showNotification('下載失敗: ' + error.message, 'error');
            }
        },
        
        // 完成 Wizard
        complete() {
            BVShop.UI.Components.showNotification('轉換完成！', 'success');
            
            // 儲存狀態
            BVShop.State.save();
            
            // 觸發完成事件
            BVShop.Events.emit('wizard:completed', {
                orderCount: BVShop.State.get('orderData').length,
                mode: BVShop.State.get('selectedMode'),
                timestamp: new Date().toISOString()
            });
            
            // 延遲關閉
            setTimeout(() => {
                BVShop.UI.hide();
                BVShop.State.reset(true);
            }, 2000);
        }
    };
    
    // ========================================
    // 9. 初始化 (Initialize)
    // ========================================
    BVShop.init = function() {
        console.log(`🚀 ${this.name} v${this.version} 初始化中...`);
        
        // 檢查頁面是否支援
        if (!BVShop.Utils.Validation.isValidPage() && !BVShop.Config.DEBUG) {
            console.warn('⚠️ 此頁面不支援 BV SHOP 出貨助手');
            return;
        }
        
        // 初始化 UI
        BVShop.UI.init();
        
        // 綁定事件
        this.bindEvents();
        
        // 載入儲存的狀態
        BVShop.State.load().then(() => {
            console.log('✅ 狀態載入完成');
        });
        
        console.log(`✅ ${this.name} 初始化完成`);
        console.log('💡 點擊右下角「標籤列印」按鈕開始使用');
    };
    
    // 綁定全域事件
    BVShop.bindEvents = function() {
        // Wizard 事件
        BVShop.Events.on('wizard:next', () => {
            BVShop.WizardController.nextStep();
        });
        
        BVShop.Events.on('wizard:prev', () => {
            BVShop.WizardController.prevStep();
        });
        
        BVShop.Events.on('wizard:cancel', () => {
            BVShop.UI.hide();
            BVShop.State.reset(true);
        });
        
        // 狀態變化監聽
        BVShop.State.watch('selectedMode', (newValue) => {
            if (newValue) {
                console.log('選擇模式:', newValue);
            }
        });
        
        // 自動儲存
        if (BVShop.Config.AUTO_SAVE) {
            BVShop.State.watch('*', BVShop.Utils.General.debounce(() => {
                BVShop.State.save();
            }, BVShop.Config.AUTO_SAVE_INTERVAL));
        }
    };
    
    // 等待 DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            BVShop.init();
        });
    } else {
        BVShop.init();
    }
    
    // 暴露到全域（用於除錯）
    window.BVShop = BVShop;
    
})();
