(function() {
  'use strict';
  
  // 設定常數
  const CONFIG = {
    VERSION: '5.2.0',
    PAGE_TYPES: {
      DETAIL: 'detail',
      SHIPPING: 'shipping'
    },
    PROVIDERS: {
      SEVEN: { 
        name: '7-11', 
        type: 'store',
        selector: '.div_frame',  // 7-11 批次列印用
        fallbackSelector: 'table',  // 備用選擇器
        keywords: ['統一超商', '7-ELEVEN', '7-11', '交貨便'],
        patterns: {
          order: /寄件訂單編號[：:]\s*([A-Z0-9]+)/i,
          serviceCode: /交貨便服務代碼[：:]\s*([A-Z0-9]+)/i,  // 關鍵配對碼
          store: /取件\s*\n?\s*門市[：:]\s*([^,\n]+)/i,
          recipient: /取件人[：:]\s*([^\n]+)/i,
          barcode: /物流條碼[：:]\s*([A-Z0-9]+)/i
        }
      },
      FAMILY: { 
        name: '全家', 
        type: 'store',
        selector: 'table',
        keywords: ['全家便利商店', 'FamilyMart', '全家'],
        patterns: {
          order: /訂單號碼[：:]\s*([A-Z0-9]+)/i,
          serviceCode: /服務代碼[：:]\s*([A-Z0-9]+)/i,
          store: /店舖名稱[：:]\s*([^,\n]+)/i,
          recipient: /取件人[：:]\s*([^\n]+)/i
        }
      },
      HILIFE: { 
        name: '萊爾富', 
        type: 'store',
        selector: 'table',
        keywords: ['萊爾富', 'Hi-Life'],
        patterns: {
          order: /訂單編號[：:]\s*([A-Z0-9]+)/i,
          serviceCode: /服務代碼[：:]\s*([A-Z0-9]+)/i,
          store: /門市名稱[：:]\s*([^,\n]+)/i,
          recipient: /收件人[：:]\s*([^\n]+)/i
        }
      },
      OKMART: { 
        name: 'OK超商', 
        type: 'store',
        selector: 'table',
        keywords: ['OK.', 'OK超商', 'OKmart'],
        patterns: {
          order: /訂單編號[：:]\s*([A-Z0-9]+)/i,
          serviceCode: /服務代碼[：:]\s*([A-Z0-9]+)/i,
          store: /門市名稱[：:]\s*([^,\n]+)/i,
          recipient: /收件人[：:]\s*([^\n]+)/i
        }
      },
      DELIVERY: { 
        name: '宅配', 
        type: 'delivery',
        subTypes: {
          KERRYTJ: '嘉里大榮',
          HCT: '新竹貨運',
          TCAT: '黑貓宅急便',
          GLOBAL: '全球快遞',
          DHL: 'DHL',
          FEDEX: 'FedEx'
        }
      }
    },
    PRINT_MODES: {
      DETAIL_ONLY: 'detail_only',
      SHIPPING_ONLY: 'shipping_only',
      MANUAL_MATCH: 'manual_match'
    },
    SORT_ORDERS: {
      ASC: 'asc',
      DESC: 'desc'
    }
  };
  
  // 全域狀態
  const state = {
    currentPageType: null,
    currentProvider: null,
    deliverySubType: null,
    isConverted: false,
    isPanelMinimized: false,
    highlightQuantity: false,
    hideExtraInfo: true,
    hideTableHeader: false,
    logoDataUrl: null,
    logoAspectRatio: 1,
    originalBodyStyle: {},
    fontSize: '11',
    shippingData: [],
    pdfShippingData: [],
    shippingDataBatches: [],
    detailPages: [],
    shippingPages: [],
    printMode: CONFIG.PRINT_MODES.DETAIL_ONLY,
    detailSortOrder: CONFIG.SORT_ORDERS.ASC,
    shippingSortOrder: CONFIG.SORT_ORDERS.ASC,
    reverseShipping: false,
    collapsedSections: {},
    lazyLoadObserver: null,
    previewCache: new Map(),
    previewTimeout: null
  };
  
  // 初始化 Intersection Observer
  if (typeof IntersectionObserver !== 'undefined') {
    state.lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            state.lazyLoadObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '100px'
    });
  }
  
  // 頁面偵測
  function detectCurrentPage() {
    const url = window.location.href;
    
    // 檢查是否為 BV SHOP 出貨明細頁面
    if (url.includes('bvshop') && 
        (url.includes('print_order_content') || 
         url.includes('print') && url.includes('order'))) {
      state.currentPageType = CONFIG.PAGE_TYPES.DETAIL;
      initDetailMode();
      return;
    }
    
    // 檢查是否為超商物流單頁面
    for (const [provider, config] of Object.entries(CONFIG.PROVIDERS)) {
      if (provider === 'DELIVERY') continue;
      
      // 使用關鍵字偵測
      if (config.keywords.some(keyword => document.body.textContent.includes(keyword))) {
        state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
        state.currentProvider = provider;
        initShippingMode();
        return;
      }
    }
    
    // 檢查是否為宅配物流單頁面
    const deliveryPatterns = {
      KERRYTJ: /kerrytj\.com/,
      HCT: /hct\.com\.tw/,
      TCAT: /t-cat\.com\.tw/,
      GLOBAL: /global-business\.com\.tw/,
      DHL: /dhl\.com/,
      FEDEX: /fedex\.com/
    };
    
    for (const [subType, pattern] of Object.entries(deliveryPatterns)) {
      if (pattern.test(url)) {
        state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
        state.currentProvider = 'DELIVERY';
        state.deliverySubType = subType;
        initShippingMode();
        return;
      }
    }
  }
  
  // 初始化出貨明細模式
  function initDetailMode() {
    loadSettings();
    createControlPanel();
    
    // 檢查物流單資料
    setTimeout(() => {
      if (state.isConverted) {
        checkShippingDataStatus();
      }
    }, 100);
  }
  
  // 創建控制面板
  function createControlPanel() {
    const existingPanel = document.getElementById('bv-label-control-panel');
    if (existingPanel) existingPanel.remove();
    
    const minimizedButton = document.createElement('div');
    minimizedButton.id = 'bv-minimized-button';
    minimizedButton.className = 'bv-minimized-button';
    minimizedButton.innerHTML = '<span class="material-icons">print</span>';
    minimizedButton.style.display = 'none';
    document.body.appendChild(minimizedButton);
    
    const panel = document.createElement('div');
    panel.id = 'bv-label-control-panel';
    panel.className = 'bv-label-control-panel';
    panel.innerHTML = getPanelContent();
    document.body.appendChild(panel);
    
    const materialIcons = document.createElement('link');
    materialIcons.rel = 'stylesheet';
    materialIcons.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    document.head.appendChild(materialIcons);
    
    const styles = document.createElement('style');
    styles.textContent = getPanelStyles();
    document.head.appendChild(styles);
    
    setupEventListeners();
    initDragFunction();
  }
  
  // 面板樣式
  function getPanelStyles() {
    return `
    /* 字體 */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap');
    
    /* 基礎樣式重置 */
    .bv-label-control-panel * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* 控制面板 */
    .bv-label-control-panel {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      max-height: 90vh;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: rgba(0, 0, 0, 0.87);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .bv-label-control-panel.minimized {
      transform: translateX(calc(100% + 40px));
    }
    
    /* 毛玻璃面板 */
    .bv-glass-panel {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    /* 面板頭部 */
    .bv-panel-header {
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.5);
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: move;
    }
    
    .bv-header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .bv-icon-wrapper {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    
    .bv-icon-wrapper.bv-label-mode {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
    }
    
    .bv-icon-wrapper.bv-shipping-mode {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
    }
    
    .bv-icon-wrapper .material-icons {
      color: white;
      font-size: 24px;
    }
    
    .bv-title-group {
      flex: 1;
    }
    
    .bv-panel-title {
      font-size: 16px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
      margin: 0;
    }
    
    .bv-panel-subtitle {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
      margin: 0;
    }
    
    /* 面板內容 */
    .bv-panel-body {
      padding: 20px;
      max-height: calc(90vh - 180px);
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .bv-panel-content-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    /* 卡片樣式 */
    .bv-settings-card {
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .bv-settings-card.collapsed .bv-card-content {
      display: none;
    }
    
    .bv-card-title {
      padding: 16px;
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    
    .bv-card-title .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-collapse-icon {
      margin-left: auto;
      transition: transform 0.3s ease;
    }
    
    .bv-settings-card.collapsed .bv-collapse-icon {
      transform: rotate(-90deg);
    }
    
    .bv-card-content {
      padding: 0 16px 16px;
    }
    
    /* 按鈕樣式 */
    .bv-glass-button {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: rgba(0, 0, 0, 0.87);
      font-family: inherit;
    }
    
    .bv-glass-button:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .bv-glass-button:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .bv-glass-button .material-icons {
      font-size: 18px;
    }
    
    .bv-glass-button.bv-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
    }
    
    .bv-glass-button.bv-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    /* 主要按鈕 */
    .bv-primary-button {
      width: 100%;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: inherit;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
    }
    
    .bv-primary-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4);
    }
    
    .bv-button-icon {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .bv-button-icon .material-icons {
      font-size: 24px;
    }
    
    .bv-button-content {
      flex: 1;
      text-align: left;
    }
    
    .bv-button-title {
      display: block;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .bv-button-subtitle {
      display: block;
      font-size: 13px;
      font-weight: 400;
      opacity: 0.9;
    }
    
    /* 開關 */
    .bv-glass-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }
    
    .bv-glass-switch input {
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
      background: rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      border-radius: 24px;
    }
    
    .bv-switch-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      transition: all 0.3s ease;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .bv-glass-switch input:checked + .bv-switch-slider {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .bv-glass-switch input:checked + .bv-switch-slider:before {
      transform: translateX(24px);
    }
    
    .bv-glass-switch.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .bv-glass-switch.disabled .bv-switch-slider {
      cursor: not-allowed;
    }
    
    /* 設定項目 */
    .bv-setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    .bv-setting-item:last-child {
      border-bottom: none;
    }
    
    .bv-setting-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    
    .bv-setting-info .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-setting-text {
      flex: 1;
    }
    
    .bv-setting-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.87);
      margin-bottom: 2px;
    }
    
    .bv-setting-desc {
      display: block;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* 滑桿 */
    .bv-slider-group {
      margin: 16px 0;
    }
    
    .bv-slider-item {
      margin-bottom: 20px;
    }
    
    .bv-slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.7);
    }
    
    .bv-value-label {
      font-weight: 600;
      color: #667eea;
    }
    
    .bv-glass-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 3px;
      outline: none;
      position: relative;
      cursor: pointer;
    }
    
    .bv-glass-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      transition: all 0.2s ease;
    }
    
    .bv-glass-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .bv-glass-slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
    
    /* 進度條填充 */
    .bv-glass-slider {
      background-image: linear-gradient(
        to right,
        #667eea 0%,
        #764ba2 var(--value, 0%),
        rgba(0, 0, 0, 0.1) var(--value, 0%),
        rgba(0, 0, 0, 0.1) 100%
      );
    }
    
    /* 最小化按鈕 */
    .bv-minimized-button {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
      transition: all 0.3s ease;
      z-index: 10001;
    }
    
    .bv-minimized-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4);
    }
    
    .bv-minimized-button .material-icons {
      color: white;
      font-size: 24px;
    }
    
    /* 面板頁腳 */
    .bv-panel-footer {
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.5);
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .bv-glass-action-button {
      flex: 1;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    
    .bv-glass-action-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .bv-glass-action-button .material-icons {
      font-size: 20px;
    }
    
    /* 通知樣式 */
    .bv-notification {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10002;
      font-size: 14px;
      font-weight: 500;
      animation: slideDown 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Segoe UI', Roboto, Arial, sans-serif;
    }
    
    .bv-notification .material-icons {
      font-size: 24px;
    }
    
    .bv-notification.success {
      background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
      color: #0a5f3b;
    }
    
    .bv-notification.warning {
      background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
      color: #8b5a00;
    }
    
    .bv-notification.error {
      background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
      color: #8b0000;
    }
    
    .bv-notification.info {
      background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%);
      color: #1b5e20;
    }
    
    @keyframes slideDown {
      from {
        transform: translateX(-50%) translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes slideUp {
      from {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      to {
        transform: translateX(-50%) translateY(-20px);
        opacity: 0;
      }
    }
    
    /* 標籤頁面樣式 */
    .bv-page-container {
      display: block;
      margin: 0;
      padding: 0;
      page-break-inside: avoid;
    }
    
    .bv-label-page {
      width: 377px;
      height: 566px;
      margin: 0 auto 20px;
      background: white;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
    }
    
    .bv-page-content {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    
    .label-background-logo {
      position: absolute;
      z-index: 1;
      pointer-events: none;
      object-fit: contain;
    }
    
    .bv-page-content > * {
      position: relative;
      z-index: 2;
    }
    
    /* 滾動條樣式 */
    .bv-panel-body::-webkit-scrollbar {
      width: 6px;
    }
    
    .bv-panel-body::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
    }
    
    .bv-panel-body::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    }
    
    .bv-panel-body::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.3);
    }
    
    /* 數量標示樣式 */
    .bv-qty-star {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 6px;
      background: #ff6b6b;
      color: white;
      border-radius: 12px;
      font-weight: bold;
      font-size: 12px;
      position: relative;
    }
    
    .bv-qty-star::before {
      content: "★";
      position: absolute;
      right: -8px;
      top: -4px;
      color: #ff6b6b;
      font-size: 16px;
    }
    
    /* 列印時隱藏 */
    @media print {
      .bv-label-control-panel,
      .bv-minimized-button,
      .bv-notification {
        display: none !important;
      }
    }
    
    /* 列印模式選擇器 */
    .bv-print-mode-selector {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .bv-mode-option {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.6);
      border: 2px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-mode-option:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(102, 126, 234, 0.2);
    }
    
    .bv-mode-option.selected {
      background: rgba(102, 126, 234, 0.08);
      border-color: #667eea;
    }
    
    .bv-mode-option input[type="radio"] {
      display: none;
    }
    
    .bv-mode-info {
      flex: 1;
      margin-left: 12px;
    }
    
    .bv-mode-title {
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
      margin-bottom: 2px;
    }
    
    .bv-mode-desc {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* 排序選項 */
    .bv-sort-options {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    .bv-sort-group {
      margin-bottom: 16px;
    }
    
    .bv-sort-label {
      font-size: 13px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.7);
      margin-bottom: 8px;
    }
    
    .bv-sort-buttons {
      display: flex;
      gap: 8px;
    }
    
    .bv-sort-button {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.6);
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    
    .bv-sort-button:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(0, 0, 0, 0.15);
    }
    
    .bv-sort-button.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-color: transparent;
    }
    
    /* 物流單樣式 */
    .bv-shipping-page {
      background: #f8f9fa;
    }
    
    .bv-shipping-content {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    .bv-shipping-wrapper-inner {
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
    }
    
    .bv-store-shipping-content {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .bv-order-label {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 10;
    }
    
    /* 服務代碼標籤 */
    .bv-service-code-label {
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif;
      z-index: 10;
    }
    
    /* 物流單狀態 */
    .bv-integration-status {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 10px;
      margin-bottom: 16px;
    }
    
    .bv-integration-status .material-icons {
      font-size: 32px;
    }
    
    .bv-integration-status.success {
      background: rgba(132, 250, 176, 0.1);
      border: 1px solid rgba(132, 250, 176, 0.3);
    }
    
    .bv-integration-status.success .material-icons {
      color: #10b981;
    }
    
    .bv-integration-status.warning {
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.3);
    }
    
    .bv-integration-status.warning .material-icons {
      color: #f59e0b;
    }
    
    .bv-status-info h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
    }
    
    .bv-status-info p {
      margin: 0;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    /* PDF 上傳區域 */
    .bv-pdf-upload-area {
      border: 2px dashed rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.5);
    }
    
    .bv-pdf-upload-area:hover {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.05);
    }
    
    .bv-pdf-upload-area.has-file {
      border-style: solid;
      border-color: #10b981;
      background: rgba(132, 250, 176, 0.05);
    }
    
    #bv-pdf-upload-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    #bv-pdf-upload-prompt .material-icons {
      font-size: 48px;
      color: rgba(0, 0, 0, 0.3);
    }
    
    .bv-upload-hint {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    .bv-pdf-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .bv-pdf-info .material-icons {
      font-size: 32px;
      color: #10b981;
    }
    
    .bv-pdf-pages-info h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
    }
    
    .bv-pdf-pages-info p {
      margin: 0;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    /* 轉換進度 */
    .bv-conversion-progress {
      display: none;
      margin-top: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    .bv-conversion-progress.active {
      display: block;
    }
    
    .bv-conversion-progress h5 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
    }
    
    .bv-conversion-progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .bv-conversion-progress-fill {
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      width: 0%;
      transition: width 0.3s ease;
    }
    
    .bv-conversion-status {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      text-align: center;
    }
    
    /* 物流單頁面樣式 */
    .bv-shipping-status {
      text-align: center;
      padding: 32px 20px;
    }
    
    .bv-status-count {
      font-size: 48px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 8px;
    }
    
    .bv-status-text {
      font-size: 16px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    .bv-secondary-button {
      width: 100%;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.8);
      border: 2px solid rgba(102, 126, 234, 0.3);
      border-radius: 12px;
      color: #667eea;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: inherit;
    }
    
    .bv-secondary-button:hover {
      background: rgba(102, 126, 234, 0.08);
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
    }
    
    .bv-secondary-button .bv-button-icon {
      background: rgba(102, 126, 234, 0.1);
    }
    
    /* 標籤設定 */
    .bv-counter-icon {
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ff6b6b;
      color: white;
      border-radius: 10px;
      font-weight: bold;
      font-size: 11px;
      position: relative;
    }
    
    .bv-counter-icon::before {
      content: "2";
    }
    
    .bv-counter-icon::after {
      content: "★";
      position: absolute;
      right: -6px;
      top: -3px;
      color: #ff6b6b;
      font-size: 12px;
    }
    
    /* 輸入框 */
    .bv-glass-input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s ease;
      outline: none;
    }
    
    .bv-glass-input:focus {
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    /* 底圖上傳 */
    .bv-logo-upload-area {
      border: 2px dashed rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.5);
      position: relative;
      overflow: hidden;
    }
    
    .bv-logo-upload-area:hover {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.05);
    }
    
    .bv-logo-upload-area.has-logo {
      padding: 12px;
      height: 120px;
    }
    
    .bv-logo-preview {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    .bv-logo-controls {
      display: none;
      margin-top: 16px;
    }
    
    .bv-logo-controls.active {
      display: block;
    }
    
    .bv-remove-logo-btn {
      width: 100%;
      padding: 8px 16px;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.2);
      border-radius: 8px;
      color: #f44336;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      margin-top: 12px;
    }
    
    .bv-remove-logo-btn:hover {
      background: rgba(244, 67, 54, 0.15);
      border-color: #f44336;
    }
    
    /* 設定檔管理 - 簡化版 */
    .bv-preset-simple-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .bv-preset-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    
    .bv-preset-item:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(81, 138, 255, 0.2);
    }
    
    .bv-preset-item.active {
      background: rgba(81, 138, 255, 0.08);
      border-color: #518aff;
    }
    
    .bv-preset-name {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    
    .bv-preset-actions {
      display: flex;
      gap: 4px;
    }
    
    .bv-preset-action-btn {
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    
    .bv-preset-action-btn:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    
    .bv-preset-action-btn .material-icons {
      font-size: 18px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-preset-action-btn.delete:hover .material-icons {
      color: #f44336;
    }
    
    .bv-new-preset-input {
      width: 100%;
      margin-top: 12px;
    }
    
    /* 物流單批次管理 */
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
    
    .bv-batch-item-count span {
      font-size: 11px;
      margin-left: 4px;
    }
    
    .bv-batch-actions {
      display: flex;
      gap: 4px;
    }
    
    .bv-batch-order {
      display: flex;
      gap: 2px;
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
    
    .bv-batch-order-btn .material-icons {
      font-size: 16px;
      color: rgba(0, 0, 0, 0.7);
    }
    
    /* 物流單反序開關 */
    .bv-reverse-shipping-option {
      margin-top: 12px;
      padding: 12px;
      background: rgba(255, 245, 235, 0.5);
      border: 1px solid rgba(255, 152, 0, 0.2);
      border-radius: 8px;
    }
    
    .bv-reverse-shipping-note {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.5);
      margin-top: 4px;
    }
    
    /* 商品圖片欄位 */
    .bv-product-image-col {
      width: 40px !important;
      padding: 4px !important;
      text-align: center !important;
      vertical-align: middle !important;
    }
    
    .bv-product-image-col .orderProductImage {
      width: 32px !important;
      height: 32px !important;
      object-fit: cover !important;
      margin: 0 auto !important;
      display: block !important;
      border-radius: 4px;
    }
    `;
  }
  
  function getPanelContent() {
    const collapseIcon = '<span class="bv-collapse-icon"><span class="material-icons">expand_more</span></span>';
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      return getShippingPanelContent();
    }
    
    if (!state.isConverted) {
      return getA4ModePanelContent();
    } else {
      return getLabelModePanelContent(collapseIcon);
    }
  }
  
  function getA4ModePanelContent() {
    return `
      <div class="bv-glass-panel">
        <div class="bv-panel-header">
          <div class="bv-header-content">
            <div class="bv-icon-wrapper">
              <span class="material-icons">print</span>
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">A4 格式</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="bv-glass-button bv-minimize-btn" id="bv-minimize-btn">
              <span class="material-icons">remove</span>
            </button>
          </div>
        </div>
        
        <div class="bv-panel-body">
          <div class="bv-primary-section">
            <button class="bv-primary-button" id="bv-convert-btn">
              <div class="bv-button-icon">
                <span class="material-icons">transform</span>
              </div>
              <div class="bv-button-content">
                <span class="bv-button-title">轉換成 10×15cm</span>
                <span class="bv-button-subtitle">每頁一張標籤格式</span>
              </div>
            </button>
          </div>
          
          <div class="bv-settings-card">
            <h4 class="bv-card-title">
              <span class="material-icons">settings</span>
              快速設定
            </h4>
            
            <div class="bv-setting-item">
              <div class="bv-setting-info">
                <span class="bv-counter-icon"></span>
                <div class="bv-setting-text">
                  <span class="bv-setting-label">數量標示</span>
                  <span class="bv-setting-desc">標示數量 ≥ 2（★）</span>
                </div>
              </div>
              <label class="bv-glass-switch">
                <input type="checkbox" id="bv-highlight-qty">
                <span class="bv-switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  function getLabelModePanelContent(collapseIcon) {
    return `
      <div class="bv-glass-panel">
        <div class="bv-panel-header">
          <div class="bv-header-content">
            <div class="bv-icon-wrapper bv-label-mode">
              <span class="material-icons">label</span>
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">10×15cm 標籤</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="bv-glass-button" id="bv-revert-btn">
              <span class="material-icons">undo</span>
            </button>
            <button class="bv-glass-button bv-minimize-btn" id="bv-minimize-btn">
              <span class="material-icons">remove</span>
            </button>
          </div>
        </div>
        
        <div class="bv-panel-content-wrapper">
          <div class="bv-panel-body">
            <div class="bv-settings-card" data-section="integration">
              <h4 class="bv-card-title">
                <span class="material-icons">merge_type</span>
                物流單設定
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-integration-status" id="bv-integration-status">
                  <span class="material-icons">info</span>
                  <div class="bv-status-info">
                    <h4>檢查物流單資料...</h4>
                    <p>正在載入資料</p>
                  </div>
                </div>
                
                <div class="bv-pdf-upload-area" id="bv-pdf-upload-area">
                  <input type="file" id="bv-pdf-input" accept="application/pdf" style="display:none;" multiple>
                  <div id="bv-pdf-upload-prompt">
                    <span class="material-icons">picture_as_pdf</span>
                    <div class="bv-upload-hint">點擊上傳宅配物流單 PDF（支援多檔案）</div>
                  </div>
                </div>
                
                <div class="bv-conversion-progress" id="bv-conversion-progress">
                  <h5>正在轉換 PDF...</h5>
                  <div class="bv-conversion-progress-bar">
                    <div class="bv-conversion-progress-fill" id="bv-conversion-progress-fill"></div>
                  </div>
                  <div class="bv-conversion-status" id="bv-conversion-status">準備中...</div>
                </div>
                
                <div class="bv-batch-list" id="bv-batch-list" style="display:none;">
                  <!-- 批次列表會動態插入這裡 -->
                </div>
                
                <button class="bv-glass-button" id="bv-clear-shipping" style="margin-top: 12px; width: 100%;">
                  <span class="material-icons">clear</span>
                  清除物流單資料
                </button>
              </div>
            </div>
            
            <div class="bv-settings-card" data-section="layout">
              <h4 class="bv-card-title">
                <span class="material-icons">tune</span>
                出貨明細設定
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-slider-group">
                  <div class="bv-slider-item">
                    <div class="bv-slider-header">
                      <span>文字大小</span>
                      <span class="bv-value-label" id="bv-font-size-value">11.0</span>
                    </div>
                    <input type="range" id="bv-font-size" min="11" max="13" step="0.1" value="11" class="bv-glass-slider">
                  </div>
                </div>
                
                <div class="bv-settings-list" style="margin-top: 20px;">
                  <div class="bv-setting-item">
                    <div class="bv-setting-info">
                      <span class="bv-counter-icon"></span>
                      <div class="bv-setting-text">
          <span class="material-icons">warning</span>
          <div class="bv-status-info">
            <h4>尚無物流單資料</h4>
            <p>請先前往物流單頁面抓取或上傳 PDF</p>
          </div>
        `;
      }
    });
  }
  
  function setupCollapsibleCards() {
    document.querySelectorAll('.bv-card-title').forEach(title => {
      title.addEventListener('click', function() {
        const card = this.closest('.bv-settings-card');
        const sectionId = card.getAttribute('data-section');
        
        if (card.classList.contains('collapsed')) {
          card.classList.remove('collapsed');
          state.collapsedSections[sectionId] = false;
        } else {
          card.classList.add('collapsed');
          state.collapsedSections[sectionId] = true;
        }
        
        chrome.storage.local.set({ bvCollapsedSections: state.collapsedSections });
      });
    });
  }
  
  function restoreCollapsedStates() {
    Object.keys(state.collapsedSections).forEach(sectionId => {
      if (state.collapsedSections[sectionId]) {
        const card = document.querySelector(`[data-section="${sectionId}"]`);
        if (card) {
          card.classList.add('collapsed');
        }
      }
    });
  }
  
  function initDragFunction() {
    const panel = document.getElementById('bv-label-control-panel');
    const header = panel.querySelector('.bv-panel-header');
    
    if (!panel || !header) return;
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    const transform = panel.style.transform;
    if (transform) {
      const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
      if (match) {
        xOffset = parseFloat(match[1]);
        yOffset = parseFloat(match[2]);
      }
    }
    
    function dragStart(e) {
      if (e.target.closest('.bv-glass-button') || e.target.closest('.bv-minimize-btn')) return;
      
      if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }
      
      if (e.target === header || (header.contains(e.target) && !e.target.closest('.bv-glass-button'))) {
        isDragging = true;
        panel.style.transition = 'none';
        e.preventDefault();
      }
    }
    
    function dragEnd(e) {
      if (!isDragging) return;
      
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      panel.style.transition = '';
      
      chrome.storage.local.set({
        bvPanelPosition: {
          x: xOffset,
          y: yOffset
        }
      });
    }
    
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        
        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        } else {
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
        }
        
        xOffset = currentX;
        yOffset = currentY;
        
        setTranslate(currentX, currentY, panel);
      }
    }
    
    function setTranslate(xPos, yPos, el) {
      el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
    
    chrome.storage.local.get(['bvPanelPosition'], (result) => {
      if (result.bvPanelPosition) {
        xOffset = result.bvPanelPosition.x;
        yOffset = result.bvPanelPosition.y;
        setTranslate(xOffset, yOffset, panel);
      }
    });
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    header.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);
  }
  
  function initLogoUpload() {
    const logoUploadArea = document.getElementById('logo-upload-area');
    const logoInput = document.getElementById('logo-input');
    const logoPreview = document.getElementById('logo-preview');
    const uploadPrompt = document.getElementById('upload-prompt');
    const logoControls = document.getElementById('logo-controls');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    
    const logoSizeSlider = document.getElementById('logo-size-slider');
    const logoXSlider = document.getElementById('logo-x-slider');
    const logoYSlider = document.getElementById('logo-y-slider');
    const logoOpacitySlider = document.getElementById('logo-opacity-slider');
    
    if (logoUploadArea && !logoUploadArea.hasAttribute('data-initialized')) {
      logoUploadArea.setAttribute('data-initialized', 'true');
      
      logoUploadArea.addEventListener('click', function(e) {
        if (!e.target.closest('.bv-remove-logo-btn')) {
          logoInput.click();
        }
      });
    }
    
    if (logoInput && !logoInput.hasAttribute('data-initialized')) {
      logoInput.setAttribute('data-initialized', 'true');
      
      logoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
          const reader = new FileReader();
          reader.onload = function(event) {
            state.logoDataUrl = event.target.result;
            
            const img = new Image();
            img.onload = function() {
              state.logoAspectRatio = img.width / img.height;
              
              logoPreview.src = state.logoDataUrl;
              logoPreview.style.display = 'block';
              uploadPrompt.style.display = 'none';
              logoUploadArea.classList.add('has-logo');
              logoControls.classList.add('active');
              
              saveSettings();
              updateLabelStyles();
              updatePreview();
            };
            img.src = state.logoDataUrl;
          };
          reader.readAsDataURL(file);
        } else {
          showNotification('請上傳 PNG 或 JPG 格式的圖片', 'warning');
        }
      });
    }
    
    if (removeLogoBtn && !removeLogoBtn.hasAttribute('data-initialized')) {
      removeLogoBtn.setAttribute('data-initialized', 'true');
      
      removeLogoBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        state.logoDataUrl = null;
        state.logoAspectRatio = 1;
        logoPreview.style.display = 'none';
        uploadPrompt.style.display = 'block';
        logoUploadArea.classList.remove('has-logo');
        logoControls.classList.remove('active');
        logoInput.value = '';
        
        saveSettings();
        updateLabelStyles();
        updatePreview();
      });
    }
    
    [logoSizeSlider, logoXSlider, logoYSlider, logoOpacitySlider].forEach(slider => {
      if (slider && !slider.hasAttribute('data-initialized')) {
        slider.setAttribute('data-initialized', 'true');
        
        slider.addEventListener('input', function() {
          document.getElementById(this.id.replace('-slider', '')).textContent = this.value + '%';
          updateRangeProgress(this);
          saveSettings();
          updateLabelStyles();
        });
      }
    });
    
    if (state.logoDataUrl) {
      logoPreview.src = state.logoDataUrl;
      logoPreview.style.display = 'block';
      uploadPrompt.style.display = 'none';
      logoUploadArea.classList.add('has-logo');
      logoControls.classList.add('active');
    }
  }
  
  function initPresetSystem() {
    const presetList = document.getElementById('bv-preset-list');
    const addPresetBtn = document.getElementById('bv-add-preset');
    const newPresetRow = document.getElementById('bv-new-preset-row');
    const newPresetName = document.getElementById('bv-new-preset-name');
    const confirmSaveBtn = document.getElementById('bv-confirm-save');
    const cancelSaveBtn = document.getElementById('bv-cancel-save');
    
    if (!presetList) return;
    
    loadPresetList();
    
    if (addPresetBtn) {
      addPresetBtn.addEventListener('click', function() {
        newPresetRow.style.display = 'block';
        newPresetName.value = '';
        newPresetName.focus();
        this.style.display = 'none';
      });
    }
    
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', function() {
        if (!newPresetName) return;
        
        const presetName = newPresetName.value.trim();
        if (!presetName) {
          showNotification('請輸入名稱', 'warning');
          return;
        }
        
        const settings = getCurrentSettings();
        
        chrome.storage.local.get(['presetList'], (result) => {
          const allPresets = result.presetList || [];
          if (!allPresets.includes(presetName)) {
            allPresets.push(presetName);
          }
          
          const storageData = {
            [`bvPreset_${presetName}`]: settings,
            presetList: allPresets,
            lastSelectedPreset: presetName
          };
          
          chrome.storage.local.set(storageData, () => {
            loadPresetList();
            newPresetRow.style.display = 'none';
            addPresetBtn.style.display = 'block';
            showNotification(`設定檔「${presetName}」已儲存`);
          });
        });
      });
    }
    
    if (cancelSaveBtn) {
      cancelSaveBtn.addEventListener('click', function() {
        newPresetRow.style.display = 'none';
        addPresetBtn.style.display = 'block';
      });
    }
    
    if (newPresetName) {
      newPresetName.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && confirmSaveBtn) {
          confirmSaveBtn.click();
        }
      });
    }
  }
  
  function loadPresetList() {
    const presetListEl = document.getElementById('bv-preset-list');
    if (!presetListEl) return;
    
    chrome.storage.local.get(['presetList', 'lastSelectedPreset'], (result) => {
      const allPresets = result.presetList || [];
      const lastSelected = result.lastSelectedPreset;
      
      if (allPresets.length === 0) {
        presetListEl.innerHTML = '<div style="text-align: center; color: rgba(0,0,0,0.5); padding: 20px; font-size: 13px;">尚無設定檔</div>';
        return;
      }
      
      presetListEl.innerHTML = allPresets.map(presetName => `
        <div class="bv-preset-item ${presetName === lastSelected ? 'active' : ''}">
          <div class="bv-preset-name" data-preset="${presetName}">${presetName}</div>
          <div class="bv-preset-actions">
            <button class="bv-preset-action-btn delete" data-preset="${presetName}">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      `).join('');
      
      // 綁定載入事件
      presetListEl.querySelectorAll('.bv-preset-name').forEach(el => {
        el.addEventListener('click', function() {
          const presetName = this.dataset.preset;
          chrome.storage.local.get([`bvPreset_${presetName}`], (result) => {
            const settings = result[`bvPreset_${presetName}`];
            if (settings) {
              applyPresetSettings(settings);
              chrome.storage.local.set({ lastSelectedPreset: presetName });
              
              // 更新選中狀態
              document.querySelectorAll('.bv-preset-item').forEach(item => {
                item.classList.remove('active');
              });
              this.closest('.bv-preset-item').classList.add('active');
              
              showNotification(`已載入設定檔「${presetName}」`);
              updatePreview();
            }
          });
        });
      });
      
      // 綁定刪除事件
      presetListEl.querySelectorAll('.bv-preset-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          
          const presetName = this.dataset.preset;
          if (confirm(`確定要刪除設定檔「${presetName}」嗎？`)) {
            chrome.storage.local.get(['presetList', 'lastSelectedPreset'], (result) => {
              const allPresets = result.presetList || [];
              const updatedPresets = allPresets.filter(name => name !== presetName);
              
              const storageData = { presetList: updatedPresets };
              
              if (result.lastSelectedPreset === presetName) {
                chrome.storage.local.remove(['lastSelectedPreset']);
              }
              
              chrome.storage.local.remove([`bvPreset_${presetName}`], () => {
                chrome.storage.local.set(storageData, () => {
                  loadPresetList();
                  showNotification(`設定檔「${presetName}」已刪除`);
                });
              });
            });
          }
        });
      });
    });
  }
  
  function observeOriginalControls() {
    const checkboxes = document.querySelectorAll('.ignore-print input[type="checkbox"]:not(#showProductImage):not(#fontSize)');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        if (state.isConverted) {
          saveSettings();
          updatePreview();
        }
      });
    });
  }
  
  function convertToLabelFormat() {
    if (state.isConverted) return;
    
    document.querySelectorAll('.order-content:has(.baseImage)').forEach(e => e.remove());
    
    const contents = document.querySelectorAll('.order-content');
    if (!contents.length) {
      showNotification('沒有找到可轉換的訂單內容', 'warning');
      return;
    }
    
    state.originalBodyStyle = {
      width: document.body.style.width,
      maxWidth: document.body.style.maxWidth,
      minWidth: document.body.style.minWidth,
      margin: document.body.style.margin,
      padding: document.body.style.padding
    };
    
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.minWidth = 'auto';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    document.body.classList.add('bv-converted');
    
    triggerOriginalPageUpdate();
    
    updateLabelStyles();
    
    setTimeout(() => {
      handlePagination();
      
      if (state.highlightQuantity) {
        setTimeout(() => {
          applyQuantityHighlight();
        }, 100);
      }
    }, 100);
    
    state.isConverted = true;
    
    updatePanelContent();
    
    showNotification('已成功轉換為10×15cm標籤格式');
  }
  
  function handlePagination() {
    // 清除現有快取
    state.previewCache.clear();
    
    document.querySelectorAll('.bv-page-container').forEach(container => container.remove());
    document.querySelectorAll('.bv-label-page').forEach(page => page.remove());
    
    const paddingMm = 5;
    const paddingPx = paddingMm * 3.78;
    const pageHeight = 566;
    const contentHeight = pageHeight - (paddingPx * 2);
    
    const orderContents = document.querySelectorAll('.order-content');
    const showOrderLabel = document.getElementById('bv-show-order-label')?.checked ?? false;
    
    // 收集所有訂單資料
    state.detailPages = [];
    state.shippingPages = [];
    
    // 根據列印模式處理
    if (state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY) {
      // 純印物流單模式
      createShippingOnlyPages();
    } else {
      // 其他模式：處理出貨明細
      orderContents.forEach((orderContent, orderIndex) => {
        orderContent.classList.add('bv-original');
        
        const orderNo = extractOrderNumber(orderContent);
        const orderData = {
          orderNo: orderNo,
          index: orderIndex,
          element: orderContent,
          pages: []
        };
        
        // 處理明細分頁
        if (state.printMode !== CONFIG.PRINT_MODES.SHIPPING_ONLY) {
          const orderContentClone = orderContent.cloneNode(true);
          
          if (state.hideExtraInfo) {
            processExtraInfoHiding(orderContentClone);
          }
          
          // 處理商品圖片顯示
          processProductImages(orderContentClone);
          
          const elements = Array.from(orderContentClone.children);
          let currentPage = null;
          let currentPageContent = null;
          let currentHeight = 0;
          
          const pageContainer = document.createElement('div');
          pageContainer.className = 'bv-page-container';
          pageContainer.setAttribute('data-order-index', orderIndex);
          pageContainer.setAttribute('data-order-no', orderNo || '');
          orderContent.parentNode.insertBefore(pageContainer, orderContent.nextSibling);
          
          elements.forEach((element, index) => {
            if (state.hideTableHeader && element.classList.contains('list-title')) {
              return;
            }
            
            const clone = element.cloneNode(true);
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
              position: absolute;
              visibility: hidden;
              width: ${377 - paddingPx * 2}px;
            `;
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            
            const elementHeight = wrapper.offsetHeight;
            document.body.removeChild(wrapper);
            
            if (elementHeight === 0) return;
            
            if (!currentPage || (currentHeight + elementHeight > contentHeight && currentHeight > 0)) {
              currentPage = document.createElement('div');
              currentPage.className = 'bv-label-page';
              currentPage.style.padding = `${paddingMm}mm`;
              currentPage.setAttribute('data-page-type', 'detail');
              currentPage.setAttribute('data-order-index', orderIndex);
              currentPage.setAttribute('data-order-no', orderNo || '');
              
              currentPageContent = document.createElement('div');
              currentPageContent.className = 'bv-page-content';
              currentPage.appendChild(currentPageContent);
              
              pageContainer.appendChild(currentPage);
              orderData.pages.push(currentPage);
              currentHeight = 0;
              
              // Lazy load 圖片
              setupLazyLoadForPage(currentPage);
            }
            
            const elementClone = element.cloneNode(true);
            currentPageContent.appendChild(elementClone);
            currentHeight += elementHeight;
          });
        }
        
        state.detailPages.push(orderData);
        
        // 根據列印模式決定是否插入物流單
        if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
          const shippingData = findMatchingShippingData(orderNo, orderIndex);
          if (shippingData) {
            const shippingPage = createShippingPage(shippingData, orderNo, showOrderLabel, orderIndex);
            if (shippingPage) {
              const pageContainer = document.querySelector(`.bv-page-container[data-order-index="${orderIndex}"]`);
              if (pageContainer) {
                pageContainer.appendChild(shippingPage);
                state.shippingPages.push({
                  orderNo: orderNo,
                  index: orderIndex,
                  page: shippingPage
                });
              }
            }
          }
        }
      });
    }
    
    updateLogos();
    applySortOrder();
  }
  
  function processProductImages(container) {
    // 檢查是否顯示商品圖片
    const showProductImage = document.querySelector('.ignore-print #showProductImage')?.checked;
    
    if (!showProductImage) return;
    
    // 找到商品表格
    const productTable = container.querySelector('.list');
    if (!productTable) return;
    
    // 處理標題列
    const headerRow = productTable.querySelector('.list-title');
    if (headerRow && !state.hideTableHeader) {
      // 檢查是否已經有圖片欄位
      const existingImageHeader = headerRow.querySelector('.bv-product-image-col');
      if (!existingImageHeader) {
        // 新增空白商品圖標題
        const imageHeader = document.createElement('th');
        imageHeader.className = 'bv-product-image-col';
        imageHeader.textContent = ''; // 空白標題
        headerRow.insertBefore(imageHeader, headerRow.firstChild);
      }
    }
    
    // 處理每個商品列
    const productRows = productTable.querySelectorAll('.list-item');
    productRows.forEach(row => {
      // 檢查是否已經處理過
      const existingImageCell = row.querySelector('.bv-product-image-col');
      if (existingImageCell) return;
      
      const nameCell = row.querySelector('.list-item-name');
      if (!nameCell) return;
      
      // 提取圖片
      const img = nameCell.querySelector('.orderProductImage');
      
      // 創建圖片欄位
      const imageCell = document.createElement('td');
      imageCell.className = 'bv-product-image-col';
      
      if (img) {
        const imgClone = img.cloneNode(true);
        // 移除原始圖片
        img.remove();
        // 將圖片放入新欄位
        imageCell.appendChild(imgClone);
      }
      
      row.insertBefore(imageCell, row.firstChild);
    });
  }
  
  function processExtraInfoHiding(container) {
    const orderInfo = container.querySelector('.order-info');
    if (!orderInfo) return;
    
    // 移除所有只包含統一編號的 row
    const rows = orderInfo.querySelectorAll('.row');
    rows.forEach(row => {
      const cols = row.querySelectorAll('.col-6');
      let hasOnlyTaxId = true;
      let hasContent = false;
      
      cols.forEach(col => {
        const text = col.textContent.trim();
        if (text) {
          hasContent = true;
          if (!text.includes('統一編號')) {
            hasOnlyTaxId = false;
          }
        }
      });
      
      // 如果整個 row 只有統一編號相關內容，則移除
      if (hasContent && hasOnlyTaxId) {
        row.remove();
      }
    });
    
    // 處理個別的 p 標籤
    const allParagraphs = orderInfo.querySelectorAll('p');
    
    // 精簡模式只保留這五個選項
    const keepPatterns = [
      /訂單編號/,
      /物流編號/,
      /送貨方式/,
      /收件人(?!地址|電話)/,
      /收件人電話/
    ];
    
    allParagraphs.forEach(p => {
      const text = p.textContent.trim();
      let shouldKeep = false;
      
      // 檢查是否包含統一編號
      if (text.includes('統一編號')) {
        p.remove();
        return;
      }
      
      for (let pattern of keepPatterns) {
        if (pattern.test(text)) {
          shouldKeep = true;
          break;
        }
      }
      
      if (!shouldKeep) {
        p.remove();
      }
    });
  }
  
  function setupLazyLoadForPage(page) {
    if (!state.lazyLoadObserver) return;
    
    const images = page.querySelectorAll('img');
    images.forEach((img, index) => {
      if (index > 3) { // 前幾張立即載入
        const src = img.src;
        img.setAttribute('data-src', src);
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        state.lazyLoadObserver.observe(img);
      }
    });
  }
  
  function applySortOrder() {
    // 即時更新排序
    if (state.printMode === CONFIG.PRINT_MODES.DETAIL_ONLY || 
        state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
      sortDetailPages();
    }
    
    if (state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY) {
      sortShippingPages();
    }
  }
  
  function createShippingOnlyPages() {
    // 創建純物流單頁面
    const allShippingData = [...state.shippingData, ...state.pdfShippingData];
    const showOrderLabel = false; // 純印物流單時不顯示訂單編號
    
    allShippingData.forEach((data, index) => {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'bv-page-container';
      pageContainer.setAttribute('data-shipping-index', index);
      
      const shippingInfo = {
        type: data.imageData ? 'image' : 'html',
        data: data
      };
      
      const orderNo = data.orderNo || `單號_${index + 1}`;
      const shippingPage = createShippingPage(shippingInfo, orderNo, showOrderLabel, index);
      
      if (shippingPage) {
        pageContainer.appendChild(shippingPage);
        document.body.appendChild(pageContainer);
        
        state.shippingPages.push({
          orderNo: orderNo,
          index: index,
          page: shippingPage
        });
      }
    });
  }
  
  function extractOrderNumber(orderContent) {
    const patterns = [
      /訂單編號[：:]\s*([A-Z0-9]+)/i,
      /訂單號碼[：:]\s*([A-Z0-9]+)/i,
      /Order\s*No[：:]\s*([A-Z0-9]+)/i,
      /訂單\s*([A-Z0-9]+)/i
    ];
    
    const text = orderContent.textContent || '';
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }
  
  function findMatchingShippingData(orderNo, index) {
    // 使用索引對應
    const allShippingData = [...state.shippingData, ...state.pdfShippingData];
    
    if (allShippingData[index]) {
      return {
        type: allShippingData[index].imageData ? 'image' : 'html',
        data: allShippingData[index]
      };
    }
    
    return null;
  }
  
  // 創建物流單頁面時，顯示服務代碼（如果有）
  function createShippingPage(shippingInfo, orderNo, showOrderLabel, orderIndex) {
    const page = document.createElement('div');
    page.className = 'bv-label-page bv-shipping-page';
    page.style.padding = '5mm';
    page.setAttribute('data-page-type', 'shipping');
    page.setAttribute('data-order-index', orderIndex);
    page.setAttribute('data-order-no', orderNo || '');
    
    // 如果有服務代碼，也設為屬性（方便配對）
    if (shippingInfo.data.serviceCode) {
      page.setAttribute('data-service-code', shippingInfo.data.serviceCode);
    }
    
    const content = document.createElement('div');
    content.className = 'bv-shipping-content';
    
    // 如果是超商截圖
    if (shippingInfo.data.imageData) {
      const img = document.createElement('img');
      img.src = shippingInfo.data.imageData;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
      `;
      content.appendChild(img);
      
      // 在圖片上方顯示服務代碼（如果有）
      if (shippingInfo.data.serviceCode) {
        const serviceCodeLabel = document.createElement('div');
        serviceCodeLabel.className = 'bv-service-code-label';
        serviceCodeLabel.style.cssText = `
          position: absolute;
          top: 5px;
          right: 5px;
          background: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
        `;
        serviceCodeLabel.textContent = `配對碼: ${shippingInfo.data.serviceCode}`;
        content.style.position = 'relative';
        content.appendChild(serviceCodeLabel);
      }
    } else {
      // HTML 內容處理
      const wrapper = document.createElement('div');
      wrapper.className = 'bv-shipping-wrapper-inner';
      wrapper.innerHTML = shippingInfo.data.html;
      
      const scale = 0.85;
      wrapper.style.cssText = `
        transform: scale(${scale});
        transform-origin: center center;
        width: ${100 / scale}%;
        height: ${100 / scale}%;
      `;
      
      content.appendChild(wrapper);
    }
    
    // 處理訂單編號標籤
    if (showOrderLabel && orderNo) {
      const labelOrderNo = getOrderLabelForShipping(orderIndex, orderNo);
      const label = document.createElement('div');
      label.className = 'bv-order-label';
      label.textContent = `訂單：${labelOrderNo}`;
      content.appendChild(label);
    }
    
    page.appendChild(content);
    
    return page;
  }
  
  function getOrderLabelForShipping(shippingIndex, defaultOrderNo) {
    // 手動配對模式下，需要找到對應的明細訂單編號
    if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
      // 根據排序後的順序找到對應的明細
      const sortedDetailContainers = Array.from(document.querySelectorAll('.bv-page-container'))
        .filter(c => c.querySelector('.bv-label-page[data-page-type="detail"]'));
      
      if (state.detailSortOrder === CONFIG.SORT_ORDERS.DESC) {
        sortedDetailContainers.reverse();
      }
      
      // 使用相同索引的明細訂單編號
      if (sortedDetailContainers[shippingIndex]) {
        const detailOrderNo = sortedDetailContainers[shippingIndex].getAttribute('data-order-no');
        if (detailOrderNo) {
          return detailOrderNo;
        }
      }
    }
    
    return defaultOrderNo;
  }
  
  function triggerOriginalPageUpdate() {
    if (typeof $ !== 'undefined') {
      $('.ignore-print input[type="checkbox"]:not(#showProductImage):not(#fontSize)').trigger('change');
      $('.ignore-print select:not(#fontSize)').trigger('change');
    }
  }
  
  function updateLabelStyles() {
    const fontSize = document.getElementById('bv-font-size')?.value || '11';
    const labelPadding = '5';
    const paddingPx = parseFloat(labelPadding) * 3.78;
    
    const logoSize = document.getElementById('logo-size-slider')?.value || '30';
    const logoX = document.getElementById('logo-x-slider')?.value || '50';
    const logoY = document.getElementById('logo-y-slider')?.value || '50';
    const logoOpacity = document.getElementById('logo-opacity-slider')?.value || '20';
    
    const logoHeightMM = logoSize ? parseFloat(150) * parseFloat(logoSize) / 100 : 0;
    const logoWidthMM = logoHeightMM * state.logoAspectRatio;
    
    const oldStyle = document.getElementById('bv-label-styles');
    if (oldStyle) oldStyle.remove();
    
    const labelStyles = document.createElement('style');
    labelStyles.id = 'bv-label-styles';
    labelStyles.textContent = `
      body.bv-converted {
        width: auto !important;
        max-width: none !important;
        min-width: auto !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      .bv-converted .order-content {
        font-family: 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif !important;
        font-size: ${fontSize}px !important;
      }
      
      .bv-label-page * {
        font-family: 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif !important;
        font-size: ${fontSize}px !important;
      }
      
      ${state.hideTableHeader ? `
        .bv-converted .list-title,
        .bv-label-page .list-title {
          display: none !important;
        }
      ` : ''}
      
      .bv-converted .title,
      .bv-label-page .title {
        font-size: ${parseFloat(fontSize) + 2}px !important;
        font-weight: bold !important;
        margin: 0 0 8px 0 !important;
        text-align: center !important;
        letter-spacing: 0.5mm !important;
      }
      
      .bv-converted .order-info,
      .bv-label-page .order-info {
        margin: 0 0 6px 0 !important;
      }
      
      .bv-converted .order-info .row,
      .bv-label-page .order-info .row {
        display: flex !important;
        margin: 0 0 3px 0 !important;
      }
      
      .bv-converted .order-info .col-6,
      .bv-label-page .order-info .col-6 {
        flex: 1 !important;
        padding: 0 1mm !important;
      }
      
      .bv-converted .order-info .col-6:first-child,
      .bv-label-page .order-info .col-6:first-child {
        padding-left: 0 !important;
      }
      
      .bv-converted .order-info .col-6:last-child,
      .bv-label-page .order-info .col-6:last-child {
        padding-right: 0 !important;
      }
      
      .bv-converted .order-info p,
      .bv-label-page .order-info p {
        margin: 0 0 3px 0 !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        line-height: 1.4 !important;
      }
      
      .bv-converted .list,
      .bv-label-page .list {
        width: 100% !important;
        margin: 0 0 6px 0 !important;
        border-collapse: collapse !important;
      }
      
      .bv-converted .list-title,
      .bv-label-page .list-title {
        border-top: 0.5mm solid #000 !important;
        border-bottom: 0.5mm solid #000 !important;
      }
      
      .bv-converted .list-title th,
      .bv-label-page .list-title th {
        padding: 4px 4px !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        font-weight: bold !important;
        text-align: left !important;
        line-height: 1.2 !important;
      }
      
      .bv-converted .list-title th.text-right,
      .bv-converted .list-item td.text-right,
      .bv-label-page .list-title th.text-right,
      .bv-label-page .list-item td.text-right {
        text-align: right !important;
      }
      
      .bv-converted .list-item,
      .bv-label-page .list-item {
        border-bottom: 0.2mm solid #ddd !important;
      }
      
      .bv-converted .list-item td,
      .bv-label-page .list-item td {
        padding: 4px 4px !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        vertical-align: top !important;
        line-height: 1.3 !important;
      }
      
      .bv-converted .list-item-name,
      .bv-label-page .list-item-name {
        word-wrap: break-word !important;
      }
      
      .bv-converted .orderProductImage,
      .bv-label-page .orderProductImage {
        width: 7mm !important;
        height: 7mm !important;
        object-fit: cover !important;
        margin: 0 !important;
        vertical-align: top !important;
        border-radius: 2px;
      }
      
      .bv-converted .order-fee,
      .bv-label-page .order-fee {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 6px 0 !important;
        border-top: 0.3mm solid #000 !important;
        border-bottom: 0.3mm solid #000 !important;
        table-layout: fixed !important;
      }
      
      .bv-converted .order-fee td,
      .bv-label-page .order-fee td {
        padding: 4px 4px !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        line-height: 1.2 !important;
        vertical-align: middle !important;
        font-weight: normal !important;
      }
      
      .bv-converted .order-fee td:first-child,
      .bv-label-page .order-fee td:first-child {
        text-align: right !important;
        width: 80% !important;
        padding-right: 2mm !important;
      }
      
      .bv-converted .order-fee td:last-child,
      .bv-label-page .order-fee td:last-child {
        text-align: right !important;
        width: 20% !important;
        white-space: nowrap !important;
      }
      
      .bv-converted .order-fee .total,
      .bv-label-page .order-fee .total {
        text-align: right !important;
        font-weight: normal !important;
      }
      
      .bv-converted .orderRemark,
      .bv-converted .orderManageRemark,
      .bv-converted .orderPrintRemark,
      .bv-label-page .orderRemark,
      .bv-label-page .orderManageRemark,
      .bv-label-page .orderPrintRemark {
        font-size: ${parseFloat(fontSize) - 2}px !important;
        padding: 4px 6px !important;
        margin: 0 0 3px 0 !important;
        border: 0.2mm solid #ccc !important;
        background-color: #f9f9f9 !important;
      }
      
      .label-background-logo {
        width: ${logoWidthMM}mm !important;
        height: ${logoHeightMM}mm !important;
        left: ${logoX}% !important;
        top: ${logoY}% !important;
        transform: translate(-50%, -50%) !important;
        opacity: ${(100 - logoOpacity) / 100} !important;
      }
    `;
    
    document.head.appendChild(labelStyles);
  }
  
  function updateLogos() {
    document.querySelectorAll('.label-background-logo').forEach(logo => logo.remove());
    
    if (state.logoDataUrl) {
      document.querySelectorAll('.bv-label-page').forEach(page => {
        const logo = document.createElement('img');
        logo.className = 'label-background-logo';
        logo.src = state.logoDataUrl;
        page.insertBefore(logo, page.firstChild);
      });
    }
  }
  
  function preparePrintStyles() {
    const oldPrintStyle = document.getElementById('bv-print-styles');
    if (oldPrintStyle) oldPrintStyle.remove();
    
    const printStyle = document.createElement('style');
    printStyle.id = 'bv-print-styles';
    
    if (state.isConverted) {
      printStyle.textContent = `
        @page {
          size: 100mm 150mm;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        @media print {
          * {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          
          .bv-original {
            display: none !important;
          }
          
          body.bv-converted {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          body.bv-converted .bv-page-container {
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
          }
          
          body.bv-converted .bv-label-page {
            width: 100mm !important;
            height: 150mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            position: relative !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          
          body.bv-converted .bv-label-page:last-child {
            page-break-after: auto !important;
          }
          
          body.bv-converted .bv-label-page .bv-page-content {
            position: relative !important;
            width: 90mm !important;
            height: 140mm !important;
          }
          
          body.bv-converted > *:not(.bv-page-container) {
            display: none !important;
          }
          
          /* 超商物流單特殊處理 */
          .bv-store-shipping-content * {
            image-rendering: optimizeQuality !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    } else {
      printStyle.textContent = `
        @media print {
          body {
            visibility: visible !important;
          }
          .order-content {
            display: block !important;
            visibility: visible !important;
          }
        }
      `;
    }
    
    document.head.appendChild(printStyle);
  }
  
  function revertToOriginal() {
    if (!state.isConverted) return;
    
    if (state.originalBodyStyle) {
      Object.keys(state.originalBodyStyle).forEach(prop => {
        document.body.style[prop] = state.originalBodyStyle[prop];
      });
    }
    
    location.reload();
  }
  
  function toggleQuantityHighlight(e) {
    state.highlightQuantity = e.target.checked;
    saveSettings();
    
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    } else {
      removeQuantityHighlight();
    }
  }
  
  function applyQuantityHighlight() {
    const containers = state.isConverted ? 
      document.querySelectorAll('.bv-label-page') : 
      document.querySelectorAll('.order-content');
    
    containers.forEach(container => {
      container.querySelectorAll('.list-item').forEach(item => {
        let qtyCell = null;
        const cells = item.querySelectorAll('td');
        
        for (let i = cells.length - 2; i >= 0; i--) {
          const text = cells[i].textContent.trim();
          if (/^\d+$/.test(text) && parseInt(text) > 0) {
            qtyCell = cells[i];
            break;
          }
        }
        
        if (qtyCell && !qtyCell.querySelector('.bv-qty-star')) {
          const qty = parseInt(qtyCell.textContent.trim());
          
          if (qty >= 2) {
            qtyCell.innerHTML = `<span class="bv-qty-star">${qty}</span>`;
          }
        }
      });
    });
  }
  
  function removeQuantityHighlight() {
    document.querySelectorAll('.bv-qty-star').forEach(star => {
      const parent = star.parentElement;
      const qty = star.textContent;
      parent.textContent = qty;
    });
  }
  
  function showNotification(message, type = 'success') {
    const existing = document.querySelector('.bv-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `bv-notification ${type}`;
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = type === 'success' ? 'check_circle' : type === 'warning' ? 'warning' : type === 'error' ? 'error' : 'info';
    
    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      setTimeout(() => notification.remove(), 400);
    }, 3000);
  }
  
  function updateRangeProgress(input) {
    const value = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty('--value', value + '%');
  }
  
  function updatePanelContent() {
    const panel = document.getElementById('bv-label-control-panel');
    if (!panel) return;
    
    const wasMinimized = panel.classList.contains('minimized');
    const currentTransform = panel.style.transform;
    
    panel.innerHTML = getPanelContent();
    
    if (wasMinimized) {
      panel.classList.add('minimized');
      document.getElementById('bv-minimized-button').style.display = 'flex';
    }
    
    panel.style.transform = currentTransform;
    
    setupEventListeners();
    
    if (state.isConverted) {
      loadSettings();
      initPresetSystem();
      initLogoUpload();
      restoreCollapsedStates();
      hideOriginalControls();
      checkShippingDataStatus();
    }
    
    initDragFunction();
  }
  
  function hideOriginalControls() {
    const controlsToHide = [
      '#baseImageOpacityLabel',
      '#fontSize',
      '.checkbox-area:has(#fontSize)',
      'button[onclick="printPage()"]'
    ];
    
    controlsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element) {
          element.style.display = 'none';
          const parentLabel = element.closest('label.checkbox-area');
          if (parentLabel) {
            parentLabel.style.display = 'none';
          }
        }
      });
    });
  }
  
  function getCurrentSettings() {
    return {
      highlightQuantity: document.getElementById('bv-highlight-qty')?.checked,
      hideExtraInfo: document.getElementById('bv-hide-extra-info')?.checked,
      hideTableHeader: document.getElementById('bv-hide-table-header')?.checked,
      fontSize: document.getElementById('bv-font-size')?.value || '11',
      showRemark: document.querySelector('.ignore-print #showRemark')?.checked,
      showManageRemark: document.querySelector('.ignore-print #showManageRemark')?.checked,
      showPrintRemark: document.querySelector('.ignore-print #showPrintRemark')?.checked,
      showDeliveryTime: document.querySelector('.ignore-print #showDeliveryTime')?.checked,
      hideInfo: document.querySelector('.ignore-print #hideInfo')?.checked,
      hidePrice: document.querySelector('.ignore-print #hidePrice')?.checked,
      showShippingTime: document.querySelector('.ignore-print #showShippingTime')?.checked,
      showLogTraceId: document.querySelector('.ignore-print #showLogTraceId')?.checked,
      logoDataUrl: state.logoDataUrl,
      logoAspectRatio: state.logoAspectRatio,
      logoSize: document.getElementById('logo-size-slider')?.value || '30',
      logoX: document.getElementById('logo-x-slider')?.value || '50',
      logoY: document.getElementById('logo-y-slider')?.value || '50',
      logoOpacity: document.getElementById('logo-opacity-slider')?.value || '20',
      showOrderLabel: document.getElementById('bv-show-order-label')?.checked,
      printMode: state.printMode,
      detailSortOrder: state.detailSortOrder,
      shippingSortOrder: state.shippingSortOrder,
      reverseShipping: state.reverseShipping
    };
  }
  
  function applyPresetSettings(settings) {
    if (settings.highlightQuantity !== undefined) {
      const qtyCheckbox = document.getElementById('bv-highlight-qty');
      if (qtyCheckbox) qtyCheckbox.checked = settings.highlightQuantity;
      state.highlightQuantity = settings.highlightQuantity;
    }
    
    if (settings.hideExtraInfo !== undefined) {
      const hideExtraCheckbox = document.getElementById('bv-hide-extra-info');
      if (hideExtraCheckbox) hideExtraCheckbox.checked = settings.hideExtraInfo;
      state.hideExtraInfo = settings.hideExtraInfo;
    }
    
    if (settings.hideTableHeader !== undefined) {
      const hideHeaderCheckbox = document.getElementById('bv-hide-table-header');
      if (hideHeaderCheckbox) hideHeaderCheckbox.checked = settings.hideTableHeader;
      state.hideTableHeader = settings.hideTableHeader;
    }
    
    if (settings.fontSize !== undefined) {
      const fontSizeSlider = document.getElementById('bv-font-size');
      if (fontSizeSlider) {
        fontSizeSlider.value = settings.fontSize;
        document.getElementById('bv-font-size-value').textContent = parseFloat(settings.fontSize).toFixed(1);
        updateRangeProgress(fontSizeSlider);
      }
    }
    
    if (settings.showOrderLabel !== undefined) {
      const orderLabelCheckbox = document.getElementById('bv-show-order-label');
      if (orderLabelCheckbox) orderLabelCheckbox.checked = settings.showOrderLabel;
    }
    
    if (settings.printMode !== undefined) {
      state.printMode = settings.printMode;
      const modeRadio = document.querySelector(`input[name="print-mode"][value="${settings.printMode}"]`);
      if (modeRadio) {
        modeRadio.checked = true;
        updatePrintModeUI();
      }
    }
    
    if (settings.detailSortOrder !== undefined) {
      state.detailSortOrder = settings.detailSortOrder;
      const sortBtn = document.querySelector(`.bv-sort-button[data-type="detail"][data-order="${settings.detailSortOrder}"]`);
      if (sortBtn) {
        document.querySelectorAll('.bv-sort-button[data-type="detail"]').forEach(btn => {
          btn.classList.remove('active');
        });
        sortBtn.classList.add('active');
      }
    }
    
    if (settings.shippingSortOrder !== undefined) {
      state.shippingSortOrder = settings.shippingSortOrder;
      const sortBtn = document.querySelector(`.bv-sort-button[data-type="shipping"][data-order="${settings.shippingSortOrder}"]`);
      if (sortBtn) {
        document.querySelectorAll('.bv-sort-button[data-type="shipping"]').forEach(btn => {
          btn.classList.remove('active');
        });
        sortBtn.classList.add('active');
      }
    }
    
    if (settings.reverseShipping !== undefined) {
      state.reverseShipping = settings.reverseShipping;
      const reverseCheckbox = document.getElementById('bv-reverse-shipping');
      if (reverseCheckbox) reverseCheckbox.checked = settings.reverseShipping;
    }
    
    if (settings.logoDataUrl) {
      state.logoDataUrl = settings.logoDataUrl;
      state.logoAspectRatio = settings.logoAspectRatio || 1;
      
      const logoPreview = document.getElementById('logo-preview');
      const uploadPrompt = document.getElementById('upload-prompt');
      const logoUploadArea = document.getElementById('logo-upload-area');
      const logoControls = document.getElementById('logo-controls');
      
      if (logoPreview) {
        logoPreview.src = state.logoDataUrl;
        logoPreview.style.display = 'block';
      }
      if (uploadPrompt) uploadPrompt.style.display = 'none';
      if (logoUploadArea) logoUploadArea.classList.add('has-logo');
      if (logoControls) logoControls.classList.add('active');
    }
    
    const logoSettings = [
      { id: 'logo-size-slider', value: settings.logoSize, valueId: 'logo-size' },
      { id: 'logo-x-slider', value: settings.logoX, valueId: 'logo-x' },
      { id: 'logo-y-slider', value: settings.logoY, valueId: 'logo-y' },
      { id: 'logo-opacity-slider', value: settings.logoOpacity, valueId: 'logo-opacity' }
    ];
    
    logoSettings.forEach(setting => {
      if (setting.value !== undefined) {
        const input = document.getElementById(setting.id);
        if (input) {
          input.value = setting.value;
          document.getElementById(setting.valueId).textContent = setting.value + '%';
          updateRangeProgress(input);
        }
      }
    });
    
    if (state.isConverted) {
      updateLabelStyles();
    }
  }
  
  function saveSettings() {
    const settings = {
      highlightQuantity: state.highlightQuantity,
      hideExtraInfo: state.hideExtraInfo,
      hideTableHeader: state.hideTableHeader,
      fontSize: document.getElementById('bv-font-size')?.value || '11',
      showRemark: document.querySelector('.ignore-print #showRemark')?.checked,
      showManageRemark: document.querySelector('.ignore-print #showManageRemark')?.checked,
      showPrintRemark: document.querySelector('.ignore-print #showPrintRemark')?.checked,
      showDeliveryTime: document.querySelector('.ignore-print #showDeliveryTime')?.checked,
      hideInfo: document.querySelector('.ignore-print #hideInfo')?.checked,
      hidePrice: document.querySelector('.ignore-print #hidePrice')?.checked,
      showShippingTime: document.querySelector('.ignore-print #showShippingTime')?.checked,
      showLogTraceId: document.querySelector('.ignore-print #showLogTraceId')?.checked,
      logoDataUrl: state.logoDataUrl,
      logoAspectRatio: state.logoAspectRatio,
      logoSize: document.getElementById('logo-size-slider')?.value || '30',
      logoX: document.getElementById('logo-x-slider')?.value || '50',
      logoY: document.getElementById('logo-y-slider')?.value || '50',
      logoOpacity: document.getElementById('logo-opacity-slider')?.value || '20',
      showOrderLabel: document.getElementById('bv-show-order-label')?.checked ?? false,
      printMode: state.printMode,
      detailSortOrder: state.detailSortOrder,
      shippingSortOrder: state.shippingSortOrder,
      reverseShipping: state.reverseShipping
    };
    
    chrome.storage.local.set({ bvLabelSettings: settings });
  }
  
  function loadSettings() {
    chrome.storage.local.get(['bvLabelSettings', 'lastSelectedPreset', 'bvPanelMinimized', 'bvCollapsedSections'], (result) => {
      if (result.bvLabelSettings) {
        const settings = result.bvLabelSettings;
        
        if (!state.isConverted) {
          state.highlightQuantity = false;
          const qtyCheckbox = document.getElementById('bv-highlight-qty');
          if (qtyCheckbox) qtyCheckbox.checked = false;
        } else {
          state.highlightQuantity = settings.highlightQuantity !== undefined ? settings.highlightQuantity : false;
          const qtyCheckbox = document.getElementById('bv-highlight-qty');
          if (qtyCheckbox) qtyCheckbox.checked = state.highlightQuantity;
          
          state.hideExtraInfo = settings.hideExtraInfo !== undefined ? settings.hideExtraInfo : true;
          const hideExtraCheckbox = document.getElementById('bv-hide-extra-info');
          if (hideExtraCheckbox) hideExtraCheckbox.checked = state.hideExtraInfo;
          
          state.hideTableHeader = settings.hideTableHeader !== undefined ? settings.hideTableHeader : false;
          const hideHeaderCheckbox = document.getElementById('bv-hide-table-header');
          if (hideHeaderCheckbox) hideHeaderCheckbox.checked = state.hideTableHeader;
          
          const orderLabelCheckbox = document.getElementById('bv-show-order-label');
          if (orderLabelCheckbox && settings.showOrderLabel !== undefined) {
            orderLabelCheckbox.checked = settings.showOrderLabel;
          }
          
          if (settings.printMode !== undefined) {
            state.printMode = settings.printMode;
            const modeRadio = document.querySelector(`input[name="print-mode"][value="${settings.printMode}"]`);
            if (modeRadio) {
              modeRadio.checked = true;
              updatePrintModeUI();
            }
          }
          
          if (settings.detailSortOrder !== undefined) {
            state.detailSortOrder = settings.detailSortOrder;
            const sortBtn = document.querySelector(`.bv-sort-button[data-type="detail"][data-order="${settings.detailSortOrder}"]`);
            if (sortBtn) {
              document.querySelectorAll('.bv-sort-button[data-type="detail"]').forEach(btn => {
                btn.classList.remove('active');
              });
              sortBtn.classList.add('active');
            }
          }
          
          if (settings.shippingSortOrder !== undefined) {
            state.shippingSortOrder = settings.shippingSortOrder;
            const sortBtn = document.querySelector(`.bv-sort-button[data-type="shipping"][data-order="${settings.shippingSortOrder}"]`);
            if (sortBtn) {
              document.querySelectorAll('.bv-sort-button[data-type="shipping"]').forEach(btn => {
                btn.classList.remove('active');
              });
              sortBtn.classList.add('active');
            }
          }
          
          if (settings.reverseShipping !== undefined) {
            state.reverseShipping = settings.reverseShipping;
            const reverseCheckbox = document.getElementById('bv-reverse-shipping');
            if (reverseCheckbox) reverseCheckbox.checked = settings.reverseShipping;
          }
          
          state.fontSize = settings.fontSize || '11';
          if (settings.fontSize) {
            const fontSizeSlider = document.getElementById('bv-font-size');
            if (fontSizeSlider) {
              fontSizeSlider.value = settings.fontSize;
              document.getElementById('bv-font-size-value').textContent = parseFloat(settings.fontSize).toFixed(1);
              updateRangeProgress(fontSizeSlider);
            }
          }
          
          if (settings.logoDataUrl) {
            state.logoDataUrl = settings.logoDataUrl;
            state.logoAspectRatio = settings.logoAspectRatio || 1;
          }
          
          const logoSettings = [
            { id: 'logo-size-slider', value: settings.logoSize, valueId: 'logo-size' },
            { id: 'logo-x-slider', value: settings.logoX, valueId: 'logo-x' },
            { id: 'logo-y-slider', value: settings.logoY, valueId: 'logo-y' },
            { id: 'logo-opacity-slider', value: settings.logoOpacity, valueId: 'logo-opacity' }
          ];
          
          logoSettings.forEach(setting => {
            if (setting.value) {
              const input = document.getElementById(setting.id);
              if (input) {
                input.value = setting.value;
                document.getElementById(setting.valueId).textContent = setting.value + '%';
                updateRangeProgress(input);
              }
            }
          });
        }
      } else {
        // 載入預設值
        if (state.isConverted) {
          state.fontSize = '11';
          state.hideExtraInfo = true;
          
          const fontSizeSlider = document.getElementById('bv-font-size');
          if (fontSizeSlider) {
            fontSizeSlider.value = '11';
            document.getElementById('bv-font-size-value').textContent = '11.0';
            updateRangeProgress(fontSizeSlider);
          }
          
          const hideExtraCheckbox = document.getElementById('bv-hide-extra-info');
          if (hideExtraCheckbox) hideExtraCheckbox.checked = true;
        }
      }
      
      if (result.bvPanelMinimized !== undefined) {
        state.isPanelMinimized = result.bvPanelMinimized;
        const panel = document.getElementById('bv-label-control-panel');
        const minimizedBtn = document.getElementById('bv-minimized-button');
        
        if (state.isPanelMinimized && panel && minimizedBtn) {
          panel.classList.add('minimized');
          minimizedBtn.style.display = 'flex';
        }
      }
      
      if (result.bvCollapsedSections) {
        state.collapsedSections = result.bvCollapsedSections;
      }
      
      if (result.lastSelectedPreset && state.isConverted) {
        chrome.storage.local.get([`bvPreset_${result.lastSelectedPreset}`], (presetResult) => {
          const presetSettings = presetResult[`bvPreset_${result.lastSelectedPreset}`];
          if (presetSettings) {
            applyPresetSettings(presetSettings);
          }
        });
      }
    });
  }
  
  function init() {
    console.log('=== BV SHOP 出貨助手初始化 ===');
    console.log('版本:', CONFIG.VERSION);
    console.log('初始化時間:', new Date().toLocaleString());
    console.log('使用者:', 'DK0124');
    console.log('新功能: 超商物流單截圖整合');
    
    // 偵測頁面類型
    detectCurrentPage();
    
    console.log('當前頁面類型:', state.currentPageType);
    console.log('當前物流商:', state.currentProvider);
    console.log('=== 初始化完成 ===');
  }
  
  // 啟動擴充功能
  try {
    init();
  } catch (error) {
    console.error('BV SHOP 出貨助手初始化失敗:', error);
  }
  
})();
