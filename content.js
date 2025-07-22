// BV SHOP 出貨助手 (完整整合版 v7.0)
(function() {
  'use strict';
  
  // ========================================
  // 1. 初始化區段 - 載入必要的資源
  // ========================================
  
  // 載入 Material Icons
  const iconLink = document.createElement('link');
  iconLink.rel = 'stylesheet';
  iconLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  document.head.appendChild(iconLink);
  
  // 強制載入 Material Icons 樣式
  const iconStyle = document.createElement('style');
  iconStyle.textContent = `
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
  `;
  document.head.appendChild(iconStyle);
  
  // 載入 Noto Sans TC 字體
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
  document.head.appendChild(fontLink);
  
  // ========================================
  // 2. 設定區段 - 定義常數和狀態
  // ========================================
  
  const CONFIG = {
    PAGE_TYPES: {
      ORDER_PRINT: 'order_print',
      SHIPPING: 'shipping'
    },
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
      
      // 宅配 (支援 PDF)
      DELIVERY: { 
        name: '宅配', 
        domains: ['kerrytj.com', 'hct.com.tw', 't-cat.com.tw', 'global-business.com.tw', 'fedex.com'], 
        selector: 'iframe', 
        type: 'delivery',
        subTypes: {
          KERRY: '嘉里大榮',
          HCT: '新竹貨運',
          TCAT: '黑貓宅急便',
          GLOBAL: '全球快遞Global Express',
          FEDEX: 'FedEx'
        }
      }
    },

    // 新增標籤格式
    LABEL_FORMATS: {
      '10x15': {
        name: '10×15cm',
        width: 100,  // mm
        height: 150, // mm
        widthPx: 377,
        heightPx: 566,
        padding: 5   // mm
      },
      '10x10': {
        name: '10×10cm', 
        width: 100,  // mm
        height: 100, // mm
        widthPx: 377,
        heightPx: 377,
        padding: 5   // mm
      }
    },
    
    // 列印模式
    PRINT_MODES: {
      DETAIL_ONLY: 'detail_only',           // 出貨明細
      SHIPPING_ONLY: 'shipping_only',       // 物流單
      MANUAL_MATCH: 'manual_match'          // 出貨明細-物流單
    },
    
    // 排序方式
    SORT_ORDERS: {
      ASC: 'asc',   // 新到舊
      DESC: 'desc'  // 舊到新
    },
    
    // 配對模式
    MATCH_MODES: {
      INDEX: 'index',
      ORDER: 'order',
      LOGISTICS: 'logistics'
    },
    
    // 新增介面模式
    UI_MODES: {
      WIZARD: 'wizard',    // 精靈模式（新增）
      ADVANCED: 'advanced' // 進階模式（原版）
    }
  };
  
  // 全域狀態管理
  let state = {
    isConverted: false,
    highlightQuantity: false,
    hideExtraInfo: true,  // 預設開啟精簡模式
    hideTableHeader: false,
    originalBodyStyle: null,
    isPanelMinimized: false,
    logoDataUrl: null,
    logoAspectRatio: 1,
    collapsedSections: {},
    currentPageType: null,
    currentProvider: null,
    shippingData: [],
    detailData: [],
    pdfShippingData: [],
    enableIntegration: false,
    cachedProviderSettings: {},
    previewCache: new Map(),
    lazyLoadObserver: null,
    detailPages: [],
    shippingPages: [],
    shippingDataBatches: [],
    matchingResults: [],
    matchMode: CONFIG.MATCH_MODES.INDEX,
    labelFormat: '10x15',
    printMode: CONFIG.PRINT_MODES.DETAIL_ONLY,
    detailSortOrder: CONFIG.SORT_ORDERS.ASC,
    shippingSortOrder: CONFIG.SORT_ORDERS.ASC,
    reverseShipping: false,
    isExtensionEnabled: true,
    fontSize: '11',
    sevenBatchCache: new Map(),
    autoCheckInterval: null,
    
    // 新增：介面模式狀態
    uiMode: CONFIG.UI_MODES.ADVANCED  // 預設為進階模式
  };
  
  // ========================================
  // 3. 頁面偵測區段 - 識別當前頁面類型
  // ========================================
  
  function detectCurrentPage() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const url = window.location.href;
    
    console.log('=== 頁面偵測 ===');
    console.log('Hostname:', hostname);
    console.log('Pathname:', pathname);
    console.log('Full URL:', url);
    
    // 檢查宅配頁面
    if (CONFIG.PROVIDERS.DELIVERY.domains.some(domain => hostname.includes(domain))) {
      state.currentProvider = 'DELIVERY';
      state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
      
      // 識別具體的宅配商
      if (hostname.includes('kerrytj.com')) {
        state.deliverySubType = 'KERRY';
      } else if (hostname.includes('hct.com.tw')) {
        state.deliverySubType = 'HCT';
      } else if (hostname.includes('t-cat.com.tw')) {
        state.deliverySubType = 'TCAT';
      } else if (hostname.includes('global-business.com.tw')) {
        state.deliverySubType = 'GLOBAL';
      } else if (hostname.includes('fedex.com')) {
        state.deliverySubType = 'FEDEX';
      }
      
      console.log('✓ 偵測到宅配頁面:', CONFIG.PROVIDERS.DELIVERY.subTypes[state.deliverySubType]);
      createControlPanel();
      return;
    }
    
    // 檢查超商頁面
    for (const [key, provider] of Object.entries(CONFIG.PROVIDERS)) {
      if (key !== 'DELIVERY' && provider.domains.some(domain => hostname.includes(domain))) {
        state.currentProvider = key;
        state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
        console.log('✓ 偵測到物流單頁面:', provider.name);
        createControlPanel();
        return;
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
        state.currentPageType = CONFIG.PAGE_TYPES.ORDER_PRINT;
        console.log('✓ 偵測到出貨明細頁面');
        createControlPanel();
        
        // 預設自動轉換為 10×15 模式
        setTimeout(() => {
          if (!state.isConverted) {
            convertToLabelFormat();
          }
        }, 500);
        return;
      }
      
      setTimeout(() => {
        const hasOrderContent = document.querySelector('.order-content') || 
                              document.querySelector('[class*="order"]') ||
                              document.body.textContent.includes('訂單編號');
        
        if (hasOrderContent) {
          state.currentPageType = CONFIG.PAGE_TYPES.ORDER_PRINT;
          console.log('✓ 透過內容偵測到出貨明細頁面');
          createControlPanel();
          
          // 預設自動轉換為 10×15 模式
          setTimeout(() => {
            if (!state.isConverted) {
              convertToLabelFormat();
            }
          }, 500);
        }
      }, 1000);
    }
    
    state.currentPageType = null;
    console.log('✗ 未偵測到支援的頁面類型');
  }
  
  // ========================================
  // 4. UI 建立區段 - 創建控制面板
  // ========================================
  
  function createControlPanel() {
    // 只在支援的頁面創建面板
    if (!state.currentPageType) return;
    
    if (document.getElementById('bv-label-control-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'bv-label-control-panel';
    panel.innerHTML = getPanelContent();
    
    const style = document.createElement('style');
    style.textContent = getPanelStyles();
    document.head.appendChild(style);
    document.body.appendChild(panel);
    
    // 最小化按鈕
    const minimizedButton = document.createElement('button');
    minimizedButton.className = 'bv-minimized-button';
    minimizedButton.id = 'bv-minimized-button';
    minimizedButton.innerHTML = '<span class="material-icons">apps</span>';
    minimizedButton.style.display = 'none';
    document.body.appendChild(minimizedButton);
    
    setupEventListeners();
    loadSettings();
    initDragFunction();
    initLazyLoad();
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      initShippingMode();
    } else if (state.isConverted) {
      checkShippingDataStatus();
    }
  }
  
  // ========================================
  // 5. 樣式區段 - 定義所有 CSS 樣式
  // ========================================
  
  function getPanelStyles() {
    return `
    /* 基礎樣式 */
    * {
      outline: none !important;
    }
    
    *:focus,
    *:focus-visible,
    *:focus-within,
    *:active {
      outline: none !important;
      box-shadow: none !important;
    }
    
    /* 控制面板主體樣式 */
    #bv-label-control-panel {
      position: fixed;
      right: 24px;
      top: 24px;
      bottom: 24px;
      width: 360px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Noto Sans TC', sans-serif;
      transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    /* 精靈模式樣式 */
    #bv-label-control-panel.wizard-mode {
      width: 320px;
    }
    
    .bv-wizard-mode {
      background: rgba(255, 255, 255, 0.92);
    }
    
    .bv-wizard-step {
      padding: 24px;
      display: none;
    }
    
    .bv-wizard-step.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    
    .bv-wizard-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #000;
    }
    
    .bv-wizard-subtitle {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 24px;
    }
    
    .bv-wizard-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .bv-wizard-option {
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      border: 2px solid transparent;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .bv-wizard-option:hover {
      border-color: rgba(81, 138, 255, 0.3);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .bv-wizard-option.selected {
      border-color: #518aff;
      background: rgba(81, 138, 255, 0.08);
    }
    
    .bv-wizard-option-icon {
      width: 40px;
      height: 40px;
      background: rgba(81, 138, 255, 0.1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #518aff;
    }
    
    .bv-wizard-option-content {
      flex: 1;
    }
    
    .bv-wizard-option-title {
      font-size: 15px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2px;
    }
    
    .bv-wizard-option-desc {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-wizard-nav {
      padding: 16px 24px;
      background: rgba(248, 250, 252, 0.8);
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    
    .bv-wizard-nav button {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-wizard-back {
      background: rgba(0, 0, 0, 0.05);
      color: rgba(0, 0, 0, 0.7);
    }
    
    .bv-wizard-back:hover {
      background: rgba(0, 0, 0, 0.08);
    }
    
    .bv-wizard-next {
      background: #518aff;
      color: white;
      flex: 1;
    }
    
    .bv-wizard-next:hover {
      background: #0040ff;
      transform: translateY(-1px);
    }
    
    .bv-wizard-next:disabled {
      background: rgba(0, 0, 0, 0.1);
      color: rgba(0, 0, 0, 0.3);
      cursor: not-allowed;
      transform: none;
    }
    
    /* 模式切換按鈕 */
    .bv-mode-toggle {
      position: absolute;
      bottom: 16px;
      right: 16px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.05);
      border: none;
      border-radius: 6px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-mode-toggle:hover {
      background: rgba(0, 0, 0, 0.08);
      color: rgba(0, 0, 0, 0.8);
    }

    /* 格式選擇器樣式 */
    .bv-format-selector {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .bv-format-option {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-format-option:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(81, 138, 255, 0.2);
    }
    
    .bv-format-option.selected {
      background: rgba(81, 138, 255, 0.08);
      border-color: #518aff;
    }
    
    .bv-format-option input[type="radio"] {
      margin-right: 12px;
    }
    
    .bv-format-info {
      flex: 1;
    }
    
    .bv-format-title {
      font-size: 14px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2px;
    }
    
    .bv-format-desc {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* 10×10 格式的頁面樣式 */
    .bv-label-page.format-10x10 {
      width: 377px !important;
      height: 377px !important;
    }
    
    /* 10×10 格式的物流單特殊處理 */
    .bv-shipping-page.format-10x10 {
      padding: 3mm !important;
    }
    
    .bv-shipping-page.format-10x10 .bv-shipping-content {
      width: calc(100% - 6mm);
      height: calc(100% - 6mm);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    
    /* 10×10 格式下的超商物流單 */
    .format-10x10 .bv-store-shipping-content {
      transform: scale(0.6);
      transform-origin: center center;
    }
    
    @media screen {
      .bv-label-page.format-10x10 {
        width: 377px !important;
        height: 377px !important;
        margin-bottom: 20px;
      }
      
      .bv-shipping-page.format-10x10 {
        background: #f5f5f5 !important;
      }
    }
    
    /* 列印時的頁面設定 - 這是關鍵部分 */
    @media print {
      /* 10×15 格式 */
      body.bv-converted.format-10x15 .bv-label-page {
        width: 100mm !important;
        height: 150mm !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
      }
      
      /* 10×10 格式 */
      body.bv-converted.format-10x10 .bv-label-page {
        width: 100mm !important;
        height: 100mm !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
      }
      
      .bv-shipping-page.format-10x10 {
        padding: 3mm !important;
      }
    }
       
    .bv-glass-panel {
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(24px) saturate(140%);
      -webkit-backdrop-filter: blur(24px) saturate(140%);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.75);
      box-shadow: 
        0 10px 40px rgba(0, 0, 0, 0.05),
        0 0 0 0.5px rgba(255, 255, 255, 0.6) inset,
        0 0 60px rgba(255, 255, 255, 0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    #bv-label-control-panel.minimized {
      display: none !important;
    }
    
    .bv-minimized-button {
      position: fixed;
      bottom: 32px;
      right: 32px;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      color: white;
      border: none;
      border-radius: 28px;
      box-shadow: 
        0 4px 24px rgba(81, 138, 255, 0.3),
        0 0 0 0.5px rgba(255, 255, 255, 0.2),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    .bv-minimized-button:hover {
      transform: scale(1.05) translateY(-2px);
      box-shadow: 
        0 8px 32px rgba(81, 138, 255, 0.4),
        0 0 0 0.5px rgba(255, 255, 255, 0.3),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.4);
    }
    
    .bv-minimized-button:active {
      transform: scale(0.98);
    }
    
    .bv-minimized-button .material-icons {
      font-size: 28px;
    }
    
    #bv-label-control-panel.minimized ~ .bv-minimized-button {
      display: flex;
    }
    
    .bv-panel-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(20px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      cursor: move;
      user-select: none;
    }
    
    .bv-header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
    }
    
    .bv-icon-wrapper {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 
        0 2px 8px rgba(81, 138, 255, 0.2),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
    }
    
    .bv-icon-wrapper.bv-label-mode {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 
        0 2px 8px rgba(16, 185, 129, 0.2),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
    }
    
    .bv-icon-wrapper.bv-shipping-mode {
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      box-shadow: 
        0 2px 8px rgba(255, 152, 0, 0.2),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
    }
    
    .bv-icon-wrapper .material-icons {
      font-size: 22px;
    }
    
    .bv-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .bv-panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #000;
      letter-spacing: -0.02em;
    }
    
    .bv-panel-subtitle {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.5);
      font-weight: 400;
    }
    
    .bv-glass-button {
      width: 32px;
      height: 32px;
      background: rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: rgba(0, 0, 0, 0.7);
    }
    
    .bv-glass-button:hover {
      background: rgba(0, 0, 0, 0.05);
      transform: scale(1.04);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .bv-glass-button:active {
      transform: scale(0.96);
    }
    
    .bv-glass-button .material-icons {
      font-size: 20px;
    }
    
    .bv-glass-button.bv-primary {
      background: rgba(81, 138, 255, 0.08);
      color: #518aff;
      border-color: rgba(81, 138, 255, 0.15);
    }
    
    .bv-glass-button.bv-primary:hover {
      background: rgba(81, 138, 255, 0.12);
    }
    
    .bv-panel-content-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }
    
    .bv-panel-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      -webkit-overflow-scrolling: touch;
    }
    
    .bv-primary-section {
      margin-bottom: 28px;
    }
    
    .bv-primary-button,
    .bv-secondary-button {
      width: 100%;
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      box-shadow: 
        0 3px 12px rgba(81, 138, 255, 0.25),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      color: white;
    }
    
    .bv-secondary-button {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 
        0 3px 12px rgba(16, 185, 129, 0.25),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
    }
    
    .bv-primary-button:hover {
      transform: translateY(-1px);
      box-shadow: 
        0 6px 20px rgba(81, 138, 255, 0.35),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
    }
    
    .bv-secondary-button:hover {
      transform: translateY(-1px);
      box-shadow: 
        0 6px 20px rgba(16, 185, 129, 0.35),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
    }
    
    .bv-primary-button:active,
    .bv-secondary-button:active {
      transform: translateY(0);
    }
    
    .bv-button-icon {
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(20px);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .bv-button-icon .material-icons {
      font-size: 26px;
    }
    
    .bv-button-content {
      flex: 1;
      text-align: left;
    }
    
    .bv-button-title {
      display: block;
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 2px;
      letter-spacing: -0.01em;
    }
    
    .bv-button-subtitle {
      display: block;
      font-size: 13px;
      opacity: 0.8;
    }
    
    .bv-settings-card {
      background: rgba(248, 250, 252, 0.5);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    
    .bv-settings-card:hover {
      background: rgba(248, 250, 252, 0.7);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }
    
    .bv-card-title {
      margin: 0 0 20px 0;
      font-size: 14px;
      font-weight: 600;
      color: #000;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      position: relative;
      padding-right: 28px;
    }
    
    .bv-card-title .material-icons {
      font-size: 18px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-collapse-icon {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }
    
    .bv-collapse-icon .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.4);
    }
    
    .bv-settings-card.collapsed .bv-collapse-icon {
      transform: translateY(-50%) rotate(-90deg);
    }
    
    .bv-card-content {
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .bv-settings-card.collapsed .bv-card-content {
      max-height: 0 !important;
      margin-top: -20px;
      opacity: 0;
    }
    
    .bv-setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 0;
      border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
    }
    
    .bv-setting-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    
    .bv-setting-item:first-child {
      padding-top: 0;
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
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .bv-setting-label {
      font-size: 14px;
      font-weight: 500;
      color: #000;
      letter-spacing: -0.01em;
    }
    
    .bv-setting-desc {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-glass-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 28px;
      cursor: pointer;
    }
    
    .bv-glass-switch input {
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
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
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
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .bv-glass-switch input:checked + .bv-switch-slider {
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
    }
    
    .bv-glass-switch input:checked + .bv-switch-slider:before {
      transform: translateX(20px);
    }
    
    .bv-glass-switch.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .bv-glass-switch.disabled input {
      cursor: not-allowed;
    }
    
    .bv-slider-group {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .bv-slider-item {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 8px;
    }
    
    .bv-slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: #000;
    }
    
    .bv-value-label {
      background: rgba(81, 138, 255, 0.08);
      color: #518aff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', monospace;
      min-width: 48px;
      text-align: center;
    }
    
    .bv-glass-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: 3px;
      outline: none;
      position: relative;
      cursor: pointer;
      margin: 12px 0;
      overflow: visible;
    }
    
    .bv-glass-slider:before {
      content: '';
      position: absolute;
      height: 6px;
      border-radius: 3px;
      background: #518aff;
      width: var(--value, 0%);
      pointer-events: none;
    }
    
    .bv-glass-slider::-webkit-slider-thumb {
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
      position: relative;
      z-index: 1;
    }
    
    .bv-glass-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 
        0 2px 8px rgba(0, 0, 0, 0.2),
        0 0 0 0.5px rgba(0, 0, 0, 0.08);
    }
    
    .bv-glass-slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      transition: all 0.2s ease;
      border: none;
    }
    
    .bv-preset-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .bv-glass-select {
      flex: 1;
      height: 36px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(20px);
      border: 0.5px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 0 12px;
      font-size: 14px;
      color: #000;
      cursor: pointer;
      transition: all 0.2s ease;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    }
    
    .bv-glass-select:hover {
      background-color: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
    }
    
    .bv-glass-select:focus {
      background-color: white;
      border-color: #518aff;
      box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
    }
    
    .bv-preset-buttons {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    
    .bv-preset-save-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      align-items: center;
    }
    
    .bv-glass-input {
      flex: 1;
      height: 36px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(20px);
      border: 0.5px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 0 12px;
      font-size: 14px;
      color: #000;
      transition: all 0.2s ease;
    }
    
    .bv-glass-input::placeholder {
      color: rgba(0, 0, 0, 0.4);
    }
    
    .bv-glass-input:hover {
      background-color: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
    }
    
    .bv-glass-input:focus {
      background-color: white;
      border-color: #518aff;
      box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
    }
    
    .bv-panel-footer {
      padding: 16px 24px 24px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      flex-shrink: 0;
    }
    
    .bv-glass-action-button {
      width: 100%;
      height: 48px;
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      box-shadow: 
        0 3px 12px rgba(81, 138, 255, 0.25),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
      letter-spacing: -0.01em;
    }
    
    .bv-glass-action-button:hover {
      transform: translateY(-1px);
      box-shadow: 
        0 6px 20px rgba(81, 138, 255, 0.35),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
    }
    
    .bv-glass-action-button:active {
      transform: translateY(0);
    }
    
    .bv-glass-action-button .material-icons {
      font-size: 22px;
    }
    
    .bv-panel-body::-webkit-scrollbar {
      width: 6px;
    }
    
    .bv-panel-body::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .bv-panel-body::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      transition: background 0.2s ease;
    }
    
    .bv-panel-body::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.25);
    }
    
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
      animation: slideDown 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
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
    
    .bv-notification .material-icons {
      font-size: 20px;
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
    
    @keyframes slideUp {
      from {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      to {
        opacity: 0;
        transform: translate(-50%, -20px);
      }
    }
    
    .bv-qty-star {
      font-weight: 700;
      color: inherit;
      position: relative;
      padding-left: 1.2em;
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
    
    @media print {
      .bv-qty-star {
        font-weight: 700 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .bv-qty-star::before {
        content: "▲ " !important;
        color: #000 !important;
      }
    }
    
    .bv-counter-icon {
      font-family: 'Material Icons';
      font-weight: normal;
      font-style: normal;
      font-size: 20px;
      display: inline-block;
      line-height: 1;
      text-transform: none;
      letter-spacing: normal;
      word-wrap: normal;
      white-space: nowrap;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      -moz-osx-font-smoothing: grayscale;
      font-feature-settings: 'liga';
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-counter-icon::before {
      content: "star";
    }
    
    body.bv-converted {
      width: auto !important;
      max-width: none !important;
      min-width: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    .bv-logo-upload-area {
      border: 2px dashed rgba(0, 0, 0, 0.08);
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(248, 250, 252, 0.3);
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }
    
    .bv-logo-upload-area:hover {
      border-color: #518aff;
      background: rgba(81, 138, 255, 0.02);
    }
    
    .bv-logo-upload-area.has-logo {
      border-style: solid;
      padding: 20px;
      background: rgba(255, 255, 255, 0.6);
    }
    
    .bv-logo-upload-area .material-icons {
      vertical-align: middle;
      line-height: 1;
    }
    
    .bv-logo-preview {
      max-width: 100%;
      max-height: 120px;
      margin: 0 auto;
      display: block;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }
    
    .bv-upload-hint {
      color: rgba(0, 0, 0, 0.5);
      font-size: 14px;
      margin-top: 12px;
      font-weight: 500;
    }
    
    .bv-logo-controls {
      display: none;
    }
    
    .bv-logo-controls.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .bv-remove-logo-btn {
      background: linear-gradient(135deg, #FF3B30 0%, #D70015 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }
    
    .bv-remove-logo-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 59, 48, 0.4);
    }
    
    .bv-remove-logo-btn .material-icons {
      font-size: 18px;
      vertical-align: middle;
      line-height: 1;
    }
    
    .label-background-logo {
      position: absolute !important;
      z-index: 1 !important;
      pointer-events: none;
      object-fit: contain !important;
    }
    
    .bv-label-page > *:not(.label-background-logo) {
      position: relative !important;
      z-index: 2 !important;
    }
    
    @media screen {
      body.bv-converted {
        background: white;
        padding: 20px 0;
      }
      
      .bv-page-container {
        margin: 0 auto 20px;
        width: fit-content;
      }
      
      .bv-label-page {
        width: 377px !important;
        height: 566px !important;
        background: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        padding: 18.9px !important;
      }
      
      .bv-label-page.bv-shipping-page {
        padding: 3mm !important;  /* 改為 3mm */
        background: #f5f5f5 !important;
      }
      
      .bv-shipping-content {
        width: calc(100% - 6mm);  /* 扣除兩邊的 3mm */
        height: calc(100% - 6mm);
        position: relative;
        overflow: hidden;
        background: white;
        margin: 0;
        box-sizing: border-box;
      }
      
      .bv-converted .order-content.bv-original {
        display: none !important;
      }
    }
    
    @page {
      size: 100mm 150mm;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    @media print {
      #bv-label-control-panel,
      .bv-minimized-button {
        display: none !important;
      }
      
      body:not(.bv-converted) {
        visibility: visible !important;
      }
      
      body:not(.bv-converted) .order-content {
        display: block !important;
        visibility: visible !important;
      }
      
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
      
      body.bv-converted {
        width: auto !important;
        max-width: none !important;
        min-width: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
      }
      
      body.bv-converted .bv-original {
        display: none !important;
      }
      
      body.bv-converted .bv-page-container {
        page-break-inside: avoid !important;
        page-break-after: auto !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      body.bv-converted .bv-label-page {
        width: 100mm !important;
        height: 150mm !important;
        margin: 0 !important;
        padding: 5mm !important;
        box-sizing: border-box !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
        box-shadow: none !important;
        border: none !important;
        position: relative !important;
        display: block !important;
        background: white !important;
      }
      
      body.bv-converted .bv-label-page.bv-shipping-page {
        padding: 0 !important;
      }
      
      body.bv-converted .bv-label-page:last-child {
        page-break-after: auto !important;
      }
      
      body.bv-converted .bv-page-content {
        position: relative !important;
        page-break-inside: avoid !important;
        width: 90mm !important;
        height: 140mm !important;
      }
      
      body.bv-converted .bv-shipping-page .bv-page-content {
        width: 100mm !important;
        height: 150mm !important;
      }
      
      body.bv-converted > *:not(.bv-page-container) {
        display: none !important;
      }
    }
    
    /* 其他樣式... (繼續原本的樣式) */
    
    .bv-shipping-status {
      background: rgba(248, 250, 252, 0.8);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .bv-status-count {
      font-size: 48px;
      font-weight: 700;
      color: #ff9800;
      margin: 8px 0;
    }
    
    .bv-status-text {
      color: #666;
      font-size: 14px;
    }
    
    /* ... 其他樣式保持不變 ... */
    `;
  }
  
  // ========================================
  // 6. UI 內容生成區段 - 根據模式生成不同內容
  // ========================================
  
  function getPanelContent() {
    const collapseIcon = '<span class="bv-collapse-icon"><span class="material-icons">expand_more</span></span>';
    
    // 物流單頁面
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      return getShippingPanelContent();
    }
    
    // 出貨明細頁面
    if (!state.isConverted) {
      // A4 模式 - 根據 UI 模式顯示不同介面
      if (state.uiMode === CONFIG.UI_MODES.WIZARD) {
        return getWizardModePanelContent();
      } else {
        return getA4ModePanelContent();
      }
    } else {
      // 標籤模式 - 根據 UI 模式顯示不同介面
      if (state.uiMode === CONFIG.UI_MODES.WIZARD) {
        return getWizardLabelModePanelContent();
      } else {
        return getLabelModePanelContent(collapseIcon);
      }
    }
  }
  
  // 精靈模式 - A4 格式
  function getWizardModePanelContent() {
    return `
      <div class="bv-glass-panel bv-wizard-mode">
        <div class="bv-panel-header">
          <div class="bv-header-content">
            <div class="bv-icon-wrapper">
              <span class="material-icons">print</span>
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">精靈模式</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="bv-glass-button bv-minimize-btn" id="bv-minimize-btn">
              <span class="material-icons">remove</span>
            </button>
          </div>
        </div>
        
        <div class="bv-wizard-content">
          <!-- Step 1: 選擇格式 -->
          <div class="bv-wizard-step active" data-step="1">
            <h4 class="bv-wizard-title">選擇列印格式</h4>
            <p class="bv-wizard-subtitle">請選擇您要使用的列印格式</p>
            
            <div class="bv-wizard-options">
              <div class="bv-wizard-option" data-value="a4">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">description</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">A4 格式</div>
                  <div class="bv-wizard-option-desc">保持原始格式列印</div>
                </div>
              </div>
              
              <div class="bv-wizard-option" data-value="label">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">label</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">標籤格式</div>
                  <div class="bv-wizard-option-desc">轉換為 10×15cm 或 10×10cm</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 2: A4 設定 -->
          <div class="bv-wizard-step" data-step="2-a4">
            <h4 class="bv-wizard-title">A4 列印設定</h4>
            <p class="bv-wizard-subtitle">選擇您需要的列印選項</p>
            
            <div class="bv-setting-item">
              <div class="bv-setting-info">
                <span class="bv-counter-icon"></span>
                <div class="bv-setting-text">
                  <span class="bv-setting-label">數量標示</span>
                  <span class="bv-setting-desc">標示數量 ≥ 2（▲）</span>
                </div>
              </div>
              <label class="bv-glass-switch">
                <input type="checkbox" id="bv-wizard-highlight-qty">
                <span class="bv-switch-slider"></span>
              </label>
            </div>
          </div>
          
          <!-- Step 2: 標籤格式選擇 -->
          <div class="bv-wizard-step" data-step="2-label">
            <h4 class="bv-wizard-title">選擇標籤尺寸</h4>
            <p class="bv-wizard-subtitle">請選擇您的標籤紙尺寸</p>
            
            <div class="bv-wizard-options">
              <div class="bv-wizard-option" data-value="10x15">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">crop_portrait</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">10×15cm</div>
                  <div class="bv-wizard-option-desc">標準貼紙格式</div>
                </div>
              </div>
              
              <div class="bv-wizard-option" data-value="10x10">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">crop_square</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">10×10cm</div>
                  <div class="bv-wizard-option-desc">正方形貼紙格式</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 3: 列印模式 -->
          <div class="bv-wizard-step" data-step="3">
            <h4 class="bv-wizard-title">選擇列印模式</h4>
            <p class="bv-wizard-subtitle">您要列印什麼內容？</p>
            
            <div class="bv-wizard-options">
              <div class="bv-wizard-option" data-value="detail_only">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">receipt_long</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">只印出貨明細</div>
                  <div class="bv-wizard-option-desc">只列印訂單明細資料</div>
                </div>
              </div>
              
              <div class="bv-wizard-option" data-value="shipping_only">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">local_shipping</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">只印物流單</div>
                  <div class="bv-wizard-option-desc">只列印物流單資料</div>
                </div>
              </div>
              
              <div class="bv-wizard-option" data-value="manual_match">
                <div class="bv-wizard-option-icon">
                  <span class="material-icons">compare_arrows</span>
                </div>
                <div class="bv-wizard-option-content">
                  <div class="bv-wizard-option-title">明細＋物流單</div>
                  <div class="bv-wizard-option-desc">交錯列印明細和物流單</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Step 4: 基本設定 -->
          <div class="bv-wizard-step" data-step="4">
            <h4 class="bv-wizard-title">基本設定</h4>
            <p class="bv-wizard-subtitle">調整您的列印設定</p>
            
            <div class="bv-setting-item">
              <div class="bv-setting-info">
                <span class="bv-counter-icon"></span>
                <div class="bv-setting-text">
                  <span class="bv-setting-label">數量標示</span>
                  <span class="bv-setting-desc">標示數量 ≥ 2（▲）</span>
                </div>
              </div>
              <label class="bv-glass-switch">
                <input type="checkbox" id="bv-wizard-final-highlight-qty">
                <span class="bv-switch-slider"></span>
              </label>
            </div>
            
            <div class="bv-setting-item">
              <div class="bv-setting-info">
                <span class="material-icons">compress</span>
                <div class="bv-setting-text">
                  <span class="bv-setting-label">精簡模式</span>
                  <span class="bv-setting-desc">僅顯示必要資訊</span>
                </div>
              </div>
              <label class="bv-glass-switch">
                <input type="checkbox" id="bv-wizard-hide-extra" checked>
                <span class="bv-switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="bv-wizard-nav">
          <button class="bv-wizard-back" id="bv-wizard-back" style="display: none;">
            返回
          </button>
          <button class="bv-wizard-next" id="bv-wizard-next" disabled>
            下一步
          </button>
        </div>
        
        <button class="bv-mode-toggle" id="bv-mode-toggle">
          切換到進階模式
        </button>
      </div>
    `;
  }
  
  // 精靈模式 - 標籤格式（已轉換）
  function getWizardLabelModePanelContent() {
    return `
      <div class="bv-glass-panel bv-wizard-mode">
        <div class="bv-panel-header">
          <div class="bv-header-content">
            <div class="bv-icon-wrapper bv-label-mode">
              <span class="material-icons">label</span>
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">${CONFIG.LABEL_FORMATS[state.labelFormat].name} - 精靈模式</span>
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
        
        <div class="bv-panel-body">
          <div class="bv-wizard-quick-actions">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">快速操作</h4>
            
            <button class="bv-glass-action-button" id="bv-wizard-print-now">
              <span class="material-icons">print</span>
              <span>立即列印</span>
            </button>
            
            <div style="margin-top: 24px;">
              <h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500;">常用設定</h5>
              
              <div class="bv-setting-item">
                <div class="bv-setting-info">
                  <span class="bv-counter-icon"></span>
                  <div class="bv-setting-text">
                    <span class="bv-setting-label">數量標示</span>
                  </div>
                </div>
                <label class="bv-glass-switch">
                  <input type="checkbox" id="bv-wizard-qty-toggle">
                  <span class="bv-switch-slider"></span>
                </label>
              </div>
              
              <div class="bv-setting-item">
                <div class="bv-setting-info">
                  <span class="material-icons">compress</span>
                  <div class="bv-setting-text">
                    <span class="bv-setting-label">精簡模式</span>
                  </div>
                </div>
                <label class="bv-glass-switch">
                  <input type="checkbox" id="bv-wizard-simple-toggle" checked>
                  <span class="bv-switch-slider"></span>
                </label>
              </div>
            </div>
            
            <div style="margin-top: 24px;">
              <h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500;">物流單</h5>
              
              <div class="bv-shipping-status" id="bv-wizard-shipping-status">
                <div class="bv-status-text">尚無物流單資料</div>
              </div>
              
              <button class="bv-glass-button" id="bv-wizard-upload-pdf" style="width: 100%;">
                <span class="material-icons">upload_file</span>
                上傳物流單 PDF
              </button>
              
              <input type="file" id="bv-wizard-pdf-input" accept="application/pdf" style="display:none;" multiple>
            </div>
          </div>
        </div>
        
        <button class="bv-mode-toggle" id="bv-mode-toggle">
          切換到進階模式
        </button>
      </div>
    `;
  }
  
  // 原本的 A4 模式內容（進階模式）
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
              <span class="bv-panel-subtitle">A4 格式 - 進階模式</span>
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
                  <span class="bv-setting-desc">標示數量 ≥ 2（▲）</span>
                </div>
              </div>
              <label class="bv-glass-switch">
                <input type="checkbox" id="bv-highlight-qty">
                <span class="bv-switch-slider"></span>
              </label>
            </div>
          </div>
          
          <button class="bv-mode-toggle" id="bv-mode-toggle" style="position: static; margin-top: 16px; width: 100%;">
            切換到精靈模式
          </button>
        </div>
      </div>
    `;
  }
  
  // ========================================
  // 7. 事件處理區段 - 設定所有事件監聽器
  // ========================================
  
  function setupEventListeners() {
    const convertBtn = document.getElementById('bv-convert-btn');
    const revertBtn = document.getElementById('bv-revert-btn');
    const minimizeBtn = document.getElementById('bv-minimize-btn');
    const minimizedButton = document.getElementById('bv-minimized-button');
    const highlightQty = document.getElementById('bv-highlight-qty');
    const applyPrint = document.getElementById('bv-apply-print');
    const modeToggle = document.getElementById('bv-mode-toggle');
    
    // 模式切換按鈕
    if (modeToggle) {
      modeToggle.addEventListener('click', toggleUIMode);
    }
    
    // 精靈模式事件
    if (state.uiMode === CONFIG.UI_MODES.WIZARD) {
      setupWizardEventListeners();
    }
    
    // 原有的事件監聽器保持不變...
    if (convertBtn) {
      convertBtn.addEventListener('click', convertToLabelFormat);
    }
    
    if (revertBtn) {
      revertBtn.addEventListener('click', revertToOriginal);
    }
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', function() {
        const panel = document.getElementById('bv-label-control-panel');
        const minButton = document.getElementById('bv-minimized-button');
        
        panel.classList.add('minimized');
        if (minButton) {
          minButton.style.display = 'flex';
        }
        state.isPanelMinimized = true;
        
        chrome.storage.local.set({ bvPanelMinimized: state.isPanelMinimized });
      });
    }
    
    if (minimizedButton) {
      minimizedButton.addEventListener('click', function() {
        const panel = document.getElementById('bv-label-control-panel');
        
        panel.classList.remove('minimized');
        this.style.display = 'none';
        state.isPanelMinimized = false;
        
        chrome.storage.local.set({ bvPanelMinimized: state.isPanelMinimized });
      });
    }
    
    if (highlightQty) {
      highlightQty.addEventListener('change', toggleQuantityHighlight);
    }
    
    if (applyPrint) {
      applyPrint.addEventListener('click', function() {
        if (!state.isConverted) {
          if (state.highlightQuantity) {
            applyQuantityHighlight();
          }
          window.print();
        } else {
          preparePrintWithMode();
        }
      });
    }
    
    // 其他原有的事件監聽器...
    setupPrintModeEventListeners();
    setupFormatEventListeners();
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      setupShippingEventListeners();
    }
    
    if (state.isConverted) {
      setupLabelModeEventListeners();
    }
    
    setupCollapsibleCards();
  }
  
  // 設定精靈模式事件監聽器
  function setupWizardEventListeners() {
    // 精靈模式導航
    const wizardNext = document.getElementById('bv-wizard-next');
    const wizardBack = document.getElementById('bv-wizard-back');
    
    if (wizardNext) {
      wizardNext.addEventListener('click', handleWizardNext);
    }
    
    if (wizardBack) {
      wizardBack.addEventListener('click', handleWizardBack);
    }
    
    // 選項點擊
    document.querySelectorAll('.bv-wizard-option').forEach(option => {
      option.addEventListener('click', function() {
        // 移除其他選中狀態
        this.parentElement.querySelectorAll('.bv-wizard-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        // 設定選中狀態
        this.classList.add('selected');
        
        // 啟用下一步按鈕
        const nextBtn = document.getElementById('bv-wizard-next');
        if (nextBtn) {
          nextBtn.disabled = false;
        }
        
        // 儲存選擇
        const step = this.closest('.bv-wizard-step').dataset.step;
        const value = this.dataset.value;
        state.wizardChoices = state.wizardChoices || {};
        state.wizardChoices[step] = value;
      });
    });
    
    // 標籤模式的精靈事件
    if (state.isConverted) {
      const wizardPrintNow = document.getElementById('bv-wizard-print-now');
      const wizardQtyToggle = document.getElementById('bv-wizard-qty-toggle');
      const wizardSimpleToggle = document.getElementById('bv-wizard-simple-toggle');
      const wizardUploadPdf = document.getElementById('bv-wizard-upload-pdf');
      const wizardPdfInput = document.getElementById('bv-wizard-pdf-input');
      
      if (wizardPrintNow) {
        wizardPrintNow.addEventListener('click', () => {
          preparePrintWithMode();
        });
      }
      
      if (wizardQtyToggle) {
        wizardQtyToggle.checked = state.highlightQuantity;
        wizardQtyToggle.addEventListener('change', function() {
          state.highlightQuantity = this.checked;
          toggleQuantityHighlight();
        });
      }
      
      if (wizardSimpleToggle) {
        wizardSimpleToggle.checked = state.hideExtraInfo;
        wizardSimpleToggle.addEventListener('change', function() {
          state.hideExtraInfo = this.checked;
          saveSettings();
          updatePreview();
        });
      }
      
      if (wizardUploadPdf) {
        wizardUploadPdf.addEventListener('click', () => {
          wizardPdfInput.click();
        });
      }
      
      if (wizardPdfInput) {
        wizardPdfInput.addEventListener('change', function(e) {
          const files = Array.from(e.target.files);
          if (files.length > 0) {
            handleMultiplePdfUpload(files);
            updateWizardShippingStatus();
          }
        });
      }
      
      // 初始化物流單狀態
      updateWizardShippingStatus();
    }
  }
  
  // 精靈模式導航處理
  function handleWizardNext() {
    const currentStep = document.querySelector('.bv-wizard-step.active');
    const currentStepNum = currentStep.dataset.step;
    let nextStepNum;
    
    // 決定下一步
    switch(currentStepNum) {
      case '1':
        const format = state.wizardChoices['1'];
        if (format === 'a4') {
          nextStepNum = '2-a4';
        } else {
          nextStepNum = '2-label';
        }
        break;
      case '2-a4':
        // A4 格式直接列印
        applyWizardSettings();
        window.print();
        return;
      case '2-label':
        nextStepNum = '3';
        break;
      case '3':
        nextStepNum = '4';
        break;
      case '4':
        // 完成設定並轉換
        applyWizardSettings();
        convertToLabelFormat();
        return;
    }
    
    // 切換步驟
    currentStep.classList.remove('active');
    const nextStep = document.querySelector(`.bv-wizard-step[data-step="${nextStepNum}"]`);
    if (nextStep) {
      nextStep.classList.add('active');
      
      // 顯示返回按鈕
      document.getElementById('bv-wizard-back').style.display = 'block';
      
      // 重置下一步按鈕
      const nextBtn = document.getElementById('bv-wizard-next');
      nextBtn.disabled = true;
      
      // 特定步驟處理
      if (nextStepNum === '4') {
        nextBtn.textContent = '完成設定';
        nextBtn.disabled = false;
      }
    }
  }
  
  function handleWizardBack() {
    const currentStep = document.querySelector('.bv-wizard-step.active');
    const currentStepNum = currentStep.dataset.step;
    let prevStepNum;
    
    // 決定上一步
    switch(currentStepNum) {
      case '2-a4':
      case '2-label':
        prevStepNum = '1';
        break;
      case '3':
        const format = state.wizardChoices['1'];
        prevStepNum = format === 'a4' ? '2-a4' : '2-label';
        break;
      case '4':
        prevStepNum = '3';
        break;
    }
    
    // 切換步驟
    currentStep.classList.remove('active');
    const prevStep = document.querySelector(`.bv-wizard-step[data-step="${prevStepNum}"]`);
    if (prevStep) {
      prevStep.classList.add('active');
      
      // 處理返回按鈕顯示
      if (prevStepNum === '1') {
        document.getElementById('bv-wizard-back').style.display = 'none';
      }
      
      // 恢復下一步按鈕
      const nextBtn = document.getElementById('bv-wizard-next');
      nextBtn.textContent = '下一步';
      nextBtn.disabled = false;
    }
  }
  
  // 套用精靈模式設定
  function applyWizardSettings() {
    const choices = state.wizardChoices || {};
    
    // 格式設定
    if (choices['2-label']) {
      state.labelFormat = choices['2-label'];
    }
    
    // 列印模式
    if (choices['3']) {
      state.printMode = choices['3'];
    }
    
    // 基本設定
    const finalHighlight = document.getElementById('bv-wizard-final-highlight-qty');
    const hideExtra = document.getElementById('bv-wizard-hide-extra');
    
    if (finalHighlight) {
      state.highlightQuantity = finalHighlight.checked;
    }
    
    if (hideExtra) {
      state.hideExtraInfo = hideExtra.checked;
    }
    
    saveSettings();
  }
  
  // 切換 UI 模式
  function toggleUIMode() {
    state.uiMode = state.uiMode === CONFIG.UI_MODES.WIZARD ? 
                 CONFIG.UI_MODES.ADVANCED : 
                 CONFIG.UI_MODES.WIZARD;
    
    chrome.storage.local.set({ bvUIMode: state.uiMode });
    
    // 重新渲染面板
    updatePanelContent();
    
    showNotification(`已切換到${state.uiMode === CONFIG.UI_MODES.WIZARD ? '精靈' : '進階'}模式`);
  }
  
  // 更新精靈模式的物流單狀態
  function updateWizardShippingStatus() {
    const statusEl = document.getElementById('bv-wizard-shipping-status');
    if (!statusEl) return;
    
    const totalCount = state.shippingData.length + state.pdfShippingData.length;
    
    if (totalCount > 0) {
      statusEl.innerHTML = `
        <div class="bv-status-count" style="font-size: 24px;">${totalCount}</div>
        <div class="bv-status-text">張物流單已載入</div>
      `;
    } else {
      statusEl.innerHTML = '<div class="bv-status-text">尚無物流單資料</div>';
    }
  }
  
  // ========================================
  // 8. 列印模式處理區段
  // ========================================
  
  function setupPrintModeEventListeners() {
    // 列印模式選擇
    document.querySelectorAll('input[name="print-mode"]').forEach(radio => {
      radio.addEventListener('change', function() {
        state.printMode = this.value;
        updatePrintModeUI();
        updatePreview();
        saveSettings();
        
        // 更新選中狀態
        document.querySelectorAll('.bv-mode-option').forEach(option => {
          option.classList.remove('selected');
        });
        this.closest('.bv-mode-option').classList.add('selected');
      });
    });
    
    // 配對模式選擇
    document.querySelectorAll('input[name="match-mode"]').forEach(radio => {
      radio.addEventListener('change', function() {
        state.matchMode = this.value;
        updatePreview();
        saveSettings();
      });
    });
    
    // 排序按鈕
    document.querySelectorAll('.bv-sort-button').forEach(btn => {
      btn.addEventListener('click', function() {
        const type = this.dataset.type;
        const order = this.dataset.order;
        
        // 更新按鈕狀態
        document.querySelectorAll(`.bv-sort-button[data-type="${type}"]`).forEach(b => {
          b.classList.remove('active');
        });
        this.classList.add('active');
        
        // 更新狀態
        if (type === 'detail') {
          state.detailSortOrder = order;
        } else {
          state.shippingSortOrder = order;
        }
        
        updatePreview();
        saveSettings();
      });
    });
    
    // 物流單反序開關
    const reverseShippingCheckbox = document.getElementById('bv-reverse-shipping');
    if (reverseShippingCheckbox) {
      reverseShippingCheckbox.addEventListener('change', function() {
        state.reverseShipping = this.checked;
        updatePreview();
        saveSettings();
      });
    }
  }
  
  // ========================================
  // 9. 格式處理區段
  // ========================================
  
  function setupFormatEventListeners() {
    // 格式選擇
    document.querySelectorAll('input[name="label-format"]').forEach(radio => {
      radio.addEventListener('change', function() {
        state.labelFormat = this.value;
        
        // 更新 body class
        document.body.classList.remove('format-10x15', 'format-10x10');
        document.body.classList.add(`format-${state.labelFormat}`);
        
        // 更新選中狀態
        document.querySelectorAll('.bv-format-option').forEach(option => {
          option.classList.remove('selected');
        });
        this.closest('.bv-format-option').classList.add('selected');
        
        // 更新副標題
        const subtitle = document.querySelector('.bv-panel-subtitle');
        if (subtitle) {
          subtitle.textContent = `${CONFIG.LABEL_FORMATS[state.labelFormat].name} 標籤`;
        }
        
        // 更新頁面樣式
        updatePageStyles();
        
        saveSettings();
        updatePreview();
      });
    });
  }
  
  // ========================================
  // 10. 工具函數區段
  // ========================================
  
  // 初始化 Lazy Load
  function initLazyLoad() {
    if ('IntersectionObserver' in window) {
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
        rootMargin: '50px 0px',
        threshold: 0.01
      });
    }
  }
  
  // 顯示通知
  function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.bv-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `bv-notification ${type}`;
    
    let icon = '';
    switch(type) {
      case 'success': icon = 'check_circle'; break;
      case 'warning': icon = 'warning'; break;
      case 'error': icon = 'error'; break;
      default: icon = 'info';
    }
    
    notification.innerHTML = `
      <span class="material-icons">${icon}</span>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideUp 0.3s ease forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // 其他原有的函數保持不變...
  // (包括所有轉換、列印、資料處理等核心功能)
  
  // ========================================
  // 11. 資料儲存與載入區段
  // ========================================
  
  function saveSettings() {
    const settings = getCurrentSettings();
    
    chrome.storage.local.set({
      bvHighlightQuantity: settings.highlightQuantity,
      bvHideExtraInfo: settings.hideExtraInfo,
      bvHideTableHeader: settings.hideTableHeader,
      bvLabelFontSize: settings.fontSize,
      bvLabelFormat: state.labelFormat,
      bvLogoDataUrl: settings.logoDataUrl,
      bvLogoAspectRatio: settings.logoAspectRatio,
      bvLogoSize: settings.logoSize,
      bvLogoX: settings.logoX,
      bvLogoY: settings.logoY,
      bvLogoOpacity: settings.logoOpacity,
      bvPrintMode: settings.printMode,
      bvDetailSortOrder: settings.detailSortOrder,
      bvShippingSortOrder: settings.shippingSortOrder,
      bvReverseShipping: settings.reverseShipping,
      bvMatchMode: settings.matchMode,
      bvIsExtensionEnabled: settings.isExtensionEnabled,
      bvUIMode: state.uiMode  // 新增：儲存 UI 模式
    });
  }
  
  function loadSettings() {
    chrome.storage.local.get([
      'bvHighlightQuantity',
      'bvHideExtraInfo',
      'bvHideTableHeader',
      'bvLabelFontSize',
      'bvLabelFormat',
      'bvPanelMinimized',
      'bvCollapsedSections',
      'bvLogoDataUrl',
      'bvLogoAspectRatio',
      'bvLogoSize',
      'bvLogoX',
      'bvLogoY',
      'bvLogoOpacity',
      'bvPrintMode',
      'bvDetailSortOrder',
      'bvShippingSortOrder',
      'bvReverseShipping',
      'bvMatchMode',
      'bvIsExtensionEnabled',
      'lastSelectedPreset',
      'bvUIMode'  // 新增：載入 UI 模式
    ], (result) => {
      // 載入 UI 模式
      if (result.bvUIMode !== undefined) {
        state.uiMode = result.bvUIMode;
      }
      
      // 其他設定載入保持不變...
      if (result.bvHighlightQuantity !== undefined) {
        state.highlightQuantity = result.bvHighlightQuantity;
        const checkbox = document.getElementById('bv-highlight-qty');
        if (checkbox) checkbox.checked = state.highlightQuantity;
      }
      
      if (result.bvLabelFormat) {
        state.labelFormat = result.bvLabelFormat;
        
        // 如果已經轉換，更新頁面樣式
        if (state.isConverted) {
          document.body.classList.remove('format-10x15', 'format-10x10');
          document.body.classList.add(`format-${state.labelFormat}`);
          updatePageStyles();
        }
      }
      if (result.bvHideExtraInfo !== undefined) {
        state.hideExtraInfo = result.bvHideExtraInfo;
        const checkbox = document.getElementById('bv-hide-extra-info');
        if (checkbox) checkbox.checked = state.hideExtraInfo;
      }
      
      if (result.bvHideTableHeader !== undefined) {
        state.hideTableHeader = result.bvHideTableHeader;
        const checkbox = document.getElementById('bv-hide-table-header');
        if (checkbox) checkbox.checked = state.hideTableHeader;
      }
      
      if (result.bvLabelFontSize !== undefined) {
        state.fontSize = result.bvLabelFontSize;
        const slider = document.getElementById('bv-font-size');
        if (slider) {
          slider.value = state.fontSize;
          document.getElementById('bv-font-size-value').textContent = parseFloat(state.fontSize).toFixed(1);
          updateRangeProgress(slider);
        }
      }
      
      if (result.bvPanelMinimized !== undefined) {
        state.isPanelMinimized = result.bvPanelMinimized;
        if (state.isPanelMinimized) {
          const panel = document.getElementById('bv-label-control-panel');
          const minButton = document.getElementById('bv-minimized-button');
          if (panel) panel.classList.add('minimized');
          if (minButton) minButton.style.display = 'flex';
        }
      }
      
      if (result.bvCollapsedSections) {
        state.collapsedSections = result.bvCollapsedSections;
        setTimeout(restoreCollapsedStates, 100);
      }
      
      if (result.bvLogoDataUrl) {
        state.logoDataUrl = result.bvLogoDataUrl;
        state.logoAspectRatio = result.bvLogoAspectRatio || 1;
        
        const logoPreview = document.getElementById('logo-preview');
        const uploadPrompt = document.getElementById('upload-prompt');
        const logoUploadArea = document.getElementById('logo-upload-area');
        const logoControls = document.getElementById('logo-controls');
        
        if (logoPreview && state.logoDataUrl) {
          logoPreview.src = state.logoDataUrl;
          logoPreview.style.display = 'block';
          if (uploadPrompt) uploadPrompt.style.display = 'none';
          if (logoUploadArea) logoUploadArea.classList.add('has-logo');
          if (logoControls) logoControls.classList.add('active');
        }
      }
      
      const sliderSettings = {
        'logo-size-slider': result.bvLogoSize || '30',
        'logo-x-slider': result.bvLogoX || '50',
        'logo-y-slider': result.bvLogoY || '50',
        'logo-opacity-slider': result.bvLogoOpacity || '20'
      };
      
      Object.entries(sliderSettings).forEach(([id, value]) => {
        const slider = document.getElementById(id);
        if (slider) {
          slider.value = value;
          const labelId = id.replace('-slider', '');
          const label = document.getElementById(labelId);
          if (label) label.textContent = value + '%';
          updateRangeProgress(slider);
        }
      });
      
      // 載入列印模式設定
      if (result.bvPrintMode !== undefined) {
        state.printMode = result.bvPrintMode;
        const radio = document.querySelector(`input[name="print-mode"][value="${state.printMode}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }
      
      if (result.bvDetailSortOrder !== undefined) {
        state.detailSortOrder = result.bvDetailSortOrder;
      }
      
      if (result.bvShippingSortOrder !== undefined) {
        state.shippingSortOrder = result.bvShippingSortOrder;
      }
      
      if (result.bvReverseShipping !== undefined) {
        state.reverseShipping = result.bvReverseShipping;
        const checkbox = document.getElementById('bv-reverse-shipping');
        if (checkbox) checkbox.checked = state.reverseShipping;
      }
      
      if (result.bvMatchMode !== undefined) {
        state.matchMode = result.bvMatchMode;
        const radio = document.querySelector(`input[name="match-mode"][value="${state.matchMode}"]`);
        if (radio) radio.checked = true;
      }
      
      if (result.bvIsExtensionEnabled !== undefined) {
        state.isExtensionEnabled = result.bvIsExtensionEnabled;
      }
      
      // 如果有上次選擇的預設檔，自動載入
      if (result.lastSelectedPreset) {
        chrome.storage.local.get([`bvPreset_${result.lastSelectedPreset}`], (presetResult) => {
          const settings = presetResult[`bvPreset_${result.lastSelectedPreset}`];
          if (settings) {
            applyPresetSettings(settings);
          }
        });
      }
      
      if (state.isConverted) {
        updateLabelStyles();
        updateLogos();
      }
      
      if (state.highlightQuantity) {
        applyQuantityHighlight();
      }
    });
  }
  
  // ========================================
  // 12. 初始化啟動
  // ========================================
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectCurrentPage);
  } else {
    detectCurrentPage();
  }
  
  // 檢查是否啟用
  chrome.storage.local.get(['bvIsExtensionEnabled'], (result) => {
    if (result.bvIsExtensionEnabled === false) {
      state.isExtensionEnabled = false;
      const panel = document.getElementById('bv-label-control-panel');
      if (panel) panel.remove();
      const minButton = document.getElementById('bv-minimized-button');
      if (minButton) minButton.remove();
    }
  });
})();
