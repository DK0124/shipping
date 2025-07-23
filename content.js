// BV SHOP 出貨助手 (完整整合版 v6.0)
(function() {
  'use strict';
  
  // 修正 Material Icons 載入
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
    }
  };
  
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
    shippingDataBatches: [],  // 儲存多批次的物流單資料
    matchingResults: [],
    matchMode: CONFIG.MATCH_MODES.INDEX,
    
    // 列印模式設定
    printMode: CONFIG.PRINT_MODES.DETAIL_ONLY,
    detailSortOrder: CONFIG.SORT_ORDERS.ASC,
    shippingSortOrder: CONFIG.SORT_ORDERS.ASC,
    reverseShipping: false,  // 物流單反序
    isExtensionEnabled: true,
    
    // 預設字體大小
    fontSize: '11',  // 預設11px
    
    // 7-11 四格處理
    sevenBatchCache: new Map(),
    
    // 新增自動檢查 interval
    autoCheckInterval: null
  };

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
  document.head.appendChild(fontLink);
    
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
  
  function getPanelStyles() {
    return `
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
    
    /* 修改數量標示樣式 - 純黑色星號 */
    .bv-qty-star {
      font-weight: 700;
      color: inherit;
      position: relative;
      white-space: nowrap;
    }
    
    .bv-qty-star::before {
      content: "★";
      color: #000000;
      font-size: 0.8em;
      margin-right: 2px;
      vertical-align: baseline;
    }
    
    @media print {
      .bv-qty-star {
        font-weight: 700 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        white-space: nowrap !important;
      }
      
      .bv-qty-star::before {
        content: "★" !important;
        color: #000000 !important;
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
      
      /* 預覽始終顯示 10×15 尺寸 */
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
        padding: 3mm !important;
        background: #f5f5f5 !important;
      }
      
      .bv-shipping-content {
        width: calc(100% - 6mm);
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
      size: auto;
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
      
      /* 列印時自動適應紙張尺寸 */
      body.bv-converted .bv-label-page {
        width: 100% !important;
        max-width: 100mm !important;
        height: auto !important;
        max-height: 150mm !important;
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
        width: auto !important;
        max-width: 90mm !important;
        height: auto !important;
      }
      
      body.bv-converted .bv-shipping-page .bv-page-content {
        width: 100% !important;
        max-width: 100mm !important;
        height: auto !important;
        max-height: 150mm !important;
      }
      
      body.bv-converted > *:not(.bv-page-container) {
        display: none !important;
      }
    }
    
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
    
    .bv-integration-status {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(248, 250, 252, 0.8);
      border-radius: 8px;
      margin-bottom: 16px;
    }
    
    .bv-integration-status .material-icons {
      font-size: 32px;
    }
    
    .bv-integration-status.success {
      background: rgba(16, 185, 129, 0.08);
    }
    
    .bv-integration-status.success .material-icons {
      color: #10b981;
    }
    
    .bv-integration-status.warning {
      background: rgba(255, 152, 0, 0.08);
    }
    
    .bv-integration-status.warning .material-icons {
      color: #ff9800;
    }
    
    .bv-status-info h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #000;
    }
    
    .bv-status-info p {
      margin: 0;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-pdf-upload-area {
      border: 2px dashed #f44336;
      border-color: rgba(244, 67, 54, 0.3);
      background: rgba(255, 245, 245, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
      padding: 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .bv-pdf-upload-area:hover {
      border-color: #f44336;
      background: rgba(255, 235, 235, 0.5);
    }
    
    .bv-pdf-upload-area.has-file {
      border-style: solid;
      border-color: #4caf50;
      background: rgba(241, 248, 233, 0.5);
      min-height: auto;
      padding: 12px 16px;
    }
    
    #bv-pdf-upload-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    #bv-pdf-upload-prompt .material-icons {
      font-size: 36px;
      color: #f44336;
    }
    
    #bv-pdf-upload-prompt .bv-upload-hint {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
      font-weight: 500;
    }
    
    .bv-pdf-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #2e7d32;
      width: 100%;
    }
    
    .bv-pdf-info .material-icons {
      font-size: 28px;
      flex-shrink: 0;
    }
    
    .bv-pdf-pages-info {
      flex: 1;
      min-width: 0;
    }
    
    .bv-pdf-pages-info h4 {
      margin: 0;
      font-size: 13px;
      color: #2e7d32;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .bv-pdf-pages-info p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #558b2f;
    }
    
    #bv-clear-shipping {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      height: 36px;
      background: rgba(255, 255, 255, 0.8);
      color: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    
    #bv-clear-shipping .material-icons {
      font-size: 18px;
    }
    
    #bv-clear-shipping:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }
    
    .bv-conversion-progress {
      margin-top: 16px;
      padding: 16px;
      background: rgba(232, 245, 233, 0.5);
      border-radius: 8px;
      display: none;
    }
    
    .bv-conversion-progress.active {
      display: block;
    }
    
    .bv-conversion-progress h5 {
      margin: 0 0 8px 0;
      color: #2e7d32;
      font-size: 14px;
    }
    
    .bv-conversion-progress-bar {
      height: 6px;
      background: #c8e6c9;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .bv-conversion-progress-fill {
      height: 100%;
      background: #4caf50;
      width: 0;
      transition: width 0.3s ease;
    }
    
    .bv-conversion-status {
      font-size: 12px;
      color: #558b2f;
      text-align: center;
    }
    
    .bv-shipping-page {
      background: #f5f5f5 !important;
    }
    
    .bv-shipping-content {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background: white;
      margin: 0;
      box-sizing: border-box;
    }
    
    .bv-shipping-wrapper-inner {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .bv-order-label {
      position: absolute;
      top: 15px;        /* 調整垂直位置 - 往下移一點 */
      left: 15px;       /* 調整水平位置 - 往右移一點 */
      background: rgba(255, 255, 255, 0.95);
      padding: 8px 16px;    /* 增加內距，讓字不會貼邊 */
      border: 2px solid #333;    /* 加粗邊框 */
      border-radius: 4px;
      font-size: 14px;      /* 稍微加大字體 */
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      white-space: nowrap;
      line-height: 1.2;     /* 增加行高，讓字體更舒適 */
    }
        
    .bv-print-mode-selector {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .bv-mode-option {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-mode-option:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(81, 138, 255, 0.2);
    }
    
    .bv-mode-option.selected {
      background: rgba(81, 138, 255, 0.08);
      border-color: #518aff;
    }
    
    .bv-mode-option input[type="radio"] {
      margin-right: 12px;
    }
    
    .bv-mode-info {
      flex: 1;
    }
    
    .bv-mode-title {
      font-size: 14px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2px;
    }
    
    .bv-mode-desc {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-sort-options {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }
    
    .bv-sort-group {
      flex: 1;
    }
    
    .bv-sort-label {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
      margin-bottom: 4px;
    }
    
    .bv-sort-buttons {
      display: flex;
      gap: 4px;
    }
    
    .bv-sort-button {
      flex: 1;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-sort-button:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
    }
    
    .bv-sort-button.active {
      background: rgba(81, 138, 255, 0.08);
      border-color: #518aff;
      color: #518aff;
    }
    
    /* 超商物流單特殊處理 */
    .bv-store-shipping-content {
      transform: scale(0.9);
      transform-origin: center center;
    }
    
    .bv-store-shipping-content .div_frame,
    .bv-store-shipping-content .print-area,
    .bv-store-shipping-content .print_area,
    .bv-store-shipping-content .printarea {
      width: 100% !important;
      height: auto !important;
      max-width: none !important;
      margin: 0 auto !important;
    }
    
    /* 保護 QR Code */
    .bv-store-shipping-content img[src*="qr"],
    .bv-store-shipping-content img[src*="QR"],
    .bv-store-shipping-content img[src*="barcode"],
    .bv-store-shipping-content .qrcode,
    .bv-store-shipping-content .QRCode {
      image-rendering: pixelated !important;
      image-rendering: -moz-crisp-edges !important;
      image-rendering: crisp-edges !important;
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
    }
    
    /* 商品圖片欄位 - 加強版 */
    .bv-product-image-col {
      width: 8mm !important;
      padding: 2px !important;
      vertical-align: top !important;
    }
    
    .bv-product-image-col img,
    .bv-product-img {
      display: block !important;
      visibility: visible !important;
      width: 7mm !important;
      height: 7mm !important;
      object-fit: cover !important;
      border-radius: 2px !important;
      max-width: 7mm !important;
      min-width: 7mm !important;
      max-height: 7mm !important;
      min-height: 7mm !important;
    }
    
    /* 確保 10×15 模式下圖片可見 */
    .bv-label-page .bv-product-image-col img,
    .bv-label-page .bv-product-img {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    @media print {
      .bv-product-image-col img,
      .bv-product-img {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        opacity: 1 !important;
      }
    }

    /* 預設管理優化 */
    .bv-preset-controls {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      width: 100%;
    }
    
    .bv-preset-buttons {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    
    .bv-preset-save-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      margin-top: 12px;
      align-items: center;
      width: 100%;
    }
    
    /* 簡化的設定檔管理 */
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
    
    /* 配對結果顯示 */
    .bv-matching-results {
      margin-top: 16px;
      padding: 12px;
      background: rgba(240, 248, 255, 0.5);
      border: 1px solid rgba(81, 138, 255, 0.2);
      border-radius: 8px;
    }
    
    .bv-matching-results-title {
      font-size: 13px;
      font-weight: 600;
      color: #518aff;
      margin-bottom: 8px;
    }
    
    .bv-matching-result-item {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.7);
      padding: 4px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    
    .bv-matching-result-item:last-child {
      border-bottom: none;
    }
    
    /* 配對模式選擇 */
    .bv-match-mode-selector {
      margin-top: 12px;
      padding: 12px;
      background: rgba(248, 250, 252, 0.5);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
    }
    
    .bv-match-mode-title {
      font-size: 13px;
      font-weight: 500;
      color: #000;
      margin-bottom: 8px;
    }
    
    .bv-match-mode-options {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .bv-match-mode-option {
      display: flex;
      align-items: center;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.7);
    }
    
    .bv-match-mode-option input[type="radio"] {
      margin-right: 8px;
    }

    .bv-reload-shipping-btn {
      margin-top: 12px;
      padding: 8px 16px;
      background: rgba(81, 138, 255, 0.08);
      color: #518aff;
      border: 1px solid rgba(81, 138, 255, 0.2);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    
    .bv-reload-shipping-btn:hover {
      background: rgba(81, 138, 255, 0.12);
      transform: translateY(-1px);
    }
    
    .bv-reload-shipping-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .bv-reload-shipping-btn .material-icons {
      font-size: 18px;
    }
    
    /* 確保商品圖片顯示 */
    .bv-product-img {
      display: block !important;
      visibility: visible !important;
      width: 7mm !important;
      height: 7mm !important;
      object-fit: cover !important;
      border-radius: 2px !important;
    }
    
    @media print {
      .bv-label-page.bv-shipping-page {
        padding: 3mm !important;
      }
      
      .bv-product-img {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }    
    `;
    
    document.head.appendChild(labelStyles);
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
                  <span class="bv-setting-desc">標示數量 ≥ 2（▲）</span>
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
                
                <div class="bv-pdf-upload-area" id="bv-pdf-upload-area" style="margin-top: 16px;">
                  <input type="file" id="bv-pdf-input" accept="application/pdf" style="display:none;" multiple>
                  <div id="bv-pdf-upload-prompt">
                    <span class="material-icons">picture_as_pdf</span>
                    <div class="bv-upload-hint">點擊上傳宅配物流單 PDF</div>
                  </div>
                  <div id="bv-pdf-info" class="bv-pdf-info" style="display:none;">
                    <span class="material-icons">check_circle</span>
                    <div class="bv-pdf-pages-info">
                      <h4 id="bv-pdf-filename">檔案名稱</h4>
                      <p id="bv-pdf-pages">共 0 頁</p>
                    </div>
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
                        <span class="bv-setting-label">數量標示</span>
                        <span class="bv-setting-desc">標示數量 ≥ 2（▲）</span>
                      </div>
                    </div>
                    <label class="bv-glass-switch">
                      <input type="checkbox" id="bv-highlight-qty">
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
                      <input type="checkbox" id="bv-hide-extra-info" checked>
                      <span class="bv-switch-slider"></span>
                    </label>
                  </div>
                  
                  <div class="bv-setting-item">
                    <div class="bv-setting-info">
                      <span class="material-icons">view_headline</span>
                      <div class="bv-setting-text">
                        <span class="bv-setting-label">隱藏標題</span>
                        <span class="bv-setting-desc">隱藏表格標題列</span>
                      </div>
                    </div>
                    <label class="bv-glass-switch">
                      <input type="checkbox" id="bv-hide-table-header">
                      <span class="bv-switch-slider"></span>
                    </label>
                  </div>
                </div>
                
                <!-- 底圖設定移到這裡 -->
                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(0, 0, 0, 0.06);">
                  <h5 style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: rgba(0, 0, 0, 0.7);">底圖設定</h5>
                  
                  <div class="bv-logo-upload-area" id="logo-upload-area">
                    <input type="file" id="logo-input" accept="image/png,image/jpeg,image/jpg" style="display:none;">
                    <img id="logo-preview" class="bv-logo-preview" style="display:none;">
                    <div id="upload-prompt">
                      <span class="material-icons" style="font-size:40px; color: rgba(0, 0, 0, 0.4);">add_photo_alternate</span>
                      <div class="bv-upload-hint">點擊上傳底圖（支援 PNG/JPG）</div>
                    </div>
                  </div>
                  
                  <div class="bv-logo-controls" id="logo-controls">
                    <div class="bv-slider-group">
                      <div class="bv-slider-item">
                        <div class="bv-slider-header">
                          <span>底圖大小</span>
                          <span class="bv-value-label" id="logo-size">30%</span>
                        </div>
                        <input type="range" id="logo-size-slider" min="10" max="100" value="30" class="bv-glass-slider">
                      </div>
                      
                      <div class="bv-slider-item">
                        <div class="bv-slider-header">
                          <span>水平位置</span>
                          <span class="bv-value-label" id="logo-x">50%</span>
                        </div>
                        <input type="range" id="logo-x-slider" min="0" max="100" value="50" class="bv-glass-slider">
                      </div>
                      
                      <div class="bv-slider-item">
                        <div class="bv-slider-header">
                          <span>垂直位置</span>
                          <span class="bv-value-label" id="logo-y">50%</span>
                        </div>
                        <input type="range" id="logo-y-slider" min="0" max="100" value="50" class="bv-glass-slider">
                      </div>
                      
                      <div class="bv-slider-item">
                        <div class="bv-slider-header">
                          <span>淡化程度</span>
                          <span class="bv-value-label" id="logo-opacity">20%</span>
                        </div>
                        <input type="range" id="logo-opacity-slider" min="0" max="100" value="20" class="bv-glass-slider">
                      </div>
                    </div>
                    
                    <button class="bv-remove-logo-btn" id="remove-logo-btn">
                      <span class="material-icons">delete</span>
                      移除底圖
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="bv-settings-card" data-section="print-mode">
              <h4 class="bv-card-title">
                <span class="material-icons">print</span>
                列印模式
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-print-mode-selector">
                  <label class="bv-mode-option ${state.printMode === 'detail_only' ? 'selected' : ''}">
                    <input type="radio" name="print-mode" value="detail_only" ${state.printMode === 'detail_only' ? 'checked' : ''}>
                    <div class="bv-mode-info">
                      <div class="bv-mode-title">出貨明細</div>
                      <div class="bv-mode-desc">只列印出貨明細資料</div>
                    </div>
                  </label>
                  
                  <label class="bv-mode-option ${state.printMode === 'shipping_only' ? 'selected' : ''}">
                    <input type="radio" name="print-mode" value="shipping_only" ${state.printMode === 'shipping_only' ? 'checked' : ''}>
                    <div class="bv-mode-info">
                      <div class="bv-mode-title">物流單</div>
                      <div class="bv-mode-desc">只列印物流單資料</div>
                    </div>
                  </label>
                  
                  <label class="bv-mode-option ${state.printMode === 'manual_match' ? 'selected' : ''}">
                    <input type="radio" name="print-mode" value="manual_match" ${state.printMode === 'manual_match' ? 'checked' : ''}>
                    <div class="bv-mode-info">
                      <div class="bv-mode-title">出貨明細-物流單</div>
                      <div class="bv-mode-desc">依索引順序交錯列印</div>
                    </div>
                  </label>
                </div>
                
                <div class="bv-match-mode-selector" id="bv-match-mode-selector" style="display:none;">
                  <div class="bv-match-mode-title">配對方式</div>
                  <div class="bv-match-mode-options">
                    <label class="bv-match-mode-option">
                      <input type="radio" name="match-mode" value="index" ${state.matchMode === 'index' ? 'checked' : ''}>
                      索引配對（依順序）
                    </label>
                    <label class="bv-match-mode-option">
                      <input type="radio" name="match-mode" value="logistics" ${state.matchMode === 'logistics' ? 'checked' : ''}>
                      物流編號配對
                    </label>
                  </div>
                </div>
                
                <div class="bv-sort-options" id="bv-sort-options" style="display:none;">
                  <div class="bv-sort-group" id="bv-detail-sort-group">
                    <div class="bv-sort-label">出貨明細排序</div>
                    <div class="bv-sort-buttons">
                      <button class="bv-sort-button active" data-type="detail" data-order="asc">新到舊</button>
                      <button class="bv-sort-button" data-type="detail" data-order="desc">舊到新</button>
                    </div>
                  </div>
                  
                  <div class="bv-sort-group" id="bv-shipping-sort" style="display:none;">
                    <div class="bv-sort-label">物流單排序</div>
                    <div class="bv-sort-buttons">
                      <button class="bv-sort-button active" data-type="shipping" data-order="asc">新到舊</button>
                      <button class="bv-sort-button" data-type="shipping" data-order="desc">舊到新</button>
                    </div>
                  </div>
                </div>
                
                <div class="bv-reverse-shipping-option" id="bv-reverse-shipping-option" style="display:none;">
                  <div class="bv-setting-item" style="padding: 0;">
                    <div class="bv-setting-info">
                      <span class="material-icons">swap_vert</span>
                      <div class="bv-setting-text">
                        <span class="bv-setting-label">物流單反序</span>
                      </div>
                    </div>
                    <label class="bv-glass-switch">
                      <input type="checkbox" id="bv-reverse-shipping">
                      <span class="bv-switch-slider"></span>
                    </label>
                  </div>
                  <div class="bv-reverse-shipping-note">用於物流單順序與明細相反時</div>
                </div>
                
                <div class="bv-setting-item" id="bv-order-label-setting" style="margin-top: 12px; display: none;">
                  <div class="bv-setting-info">
                    <span class="material-icons">label</span>
                    <div class="bv-setting-text">
                      <span class="bv-setting-label">物流單上顯示訂單編號</span>
                    </div>
                  </div>
                  <label class="bv-glass-switch disabled" id="bv-order-label-switch">
                    <input type="checkbox" id="bv-show-order-label" disabled>
                    <span class="bv-switch-slider"></span>
                  </label>
                </div>
                
                <div class="bv-matching-results" id="bv-matching-results" style="display:none;">
                  <!-- 配對結果會動態插入這裡 -->
                </div>
              </div>
            </div>
            
            <div class="bv-settings-card" data-section="presets">
              <h4 class="bv-card-title">
                <span class="material-icons">bookmark</span>
                設定檔管理
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-preset-simple-list" id="bv-preset-list">
                  <!-- 預設列表會動態插入這裡 -->
                </div>
                
                <div class="bv-new-preset-input" style="display: none;" id="bv-new-preset-row">
                  <div style="display: flex; gap: 8px;">
                    <input type="text" id="bv-new-preset-name" class="bv-glass-input" placeholder="輸入設定檔名稱...">
                    <button class="bv-glass-button bv-primary" id="bv-confirm-save">
                      <span class="material-icons">check</span>
                    </button>
                    <button class="bv-glass-button" id="bv-cancel-save">
                      <span class="material-icons">close</span>
                    </button>
                  </div>
                </div>
                
                <button class="bv-glass-button" id="bv-add-preset" style="width: 100%; margin-top: 12px;">
                  <span class="material-icons">add</span>
                  新增設定檔
                </button>
              </div>
            </div>
          </div>
          
          <div class="bv-panel-footer">
            <button class="bv-glass-action-button" id="bv-apply-print">
              <span class="material-icons">print</span>
              <span>套用並列印</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  function getShippingPanelContent() {
    const isDelivery = state.currentProvider === 'DELIVERY';
    const providerName = isDelivery ? 
      CONFIG.PROVIDERS.DELIVERY.subTypes[state.deliverySubType] || '宅配' :
      CONFIG.PROVIDERS[state.currentProvider]?.name || '物流單';
    
    return `
      <div class="bv-glass-panel">
        <div class="bv-panel-header">
          <div class="bv-header-content">
            <div class="bv-icon-wrapper bv-shipping-mode">
              <span class="material-icons">local_shipping</span>
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">${providerName}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="bv-glass-button bv-minimize-btn" id="bv-minimize-btn">
              <span class="material-icons">remove</span>
            </button>
          </div>
        </div>
        
        <div class="bv-panel-content-wrapper">
          <div class="bv-panel-body">
            ${isDelivery ? getDeliveryContent() : getGeneralShippingContent()}
          </div>
        </div>
      </div>
    `;
  }
  
  function getDeliveryContent() {
    const deliveryName = CONFIG.PROVIDERS.DELIVERY.subTypes[state.deliverySubType] || '宅配';
    
    return `
      <div class="bv-shipping-status">
        <h4 style="margin: 0 0 16px 0; color: #ff9800;">${deliveryName}物流單</h4>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          偵測到${deliveryName}網站<br>
          請使用瀏覽器的列印功能<br>
          選擇「另存為 PDF」儲存檔案<br>
          再到出貨明細頁面上傳使用
        </p>
      </div>
      
      <button class="bv-primary-button" id="bv-delivery-print" style="width: 100%;">
        <div class="bv-button-icon">
          <span class="material-icons">print</span>
        </div>
        <div class="bv-button-content">
          <span class="bv-button-title">開啟列印對話框</span>
          <span class="bv-button-subtitle">選擇另存為 PDF</span>
        </div>
      </button>
    `;
  }
  
  function getGeneralShippingContent() {
    return `
      <div class="bv-shipping-status">
        <div class="bv-status-count" id="bv-shipping-count">0</div>
        <div class="bv-status-text">張物流單已抓取</div>
      </div>
      
      <button class="bv-primary-button" id="bv-fetch-save-shipping" style="width: 100%;">
        <div class="bv-button-icon">
          <span class="material-icons">save</span>
        </div>
        <div class="bv-button-content">
          <span class="bv-button-title">抓取並儲存</span>
          <span class="bv-button-subtitle">從目前頁面擷取並儲存</span>
        </div>
      </button>
      
      <div class="bv-batch-list" id="bv-shipping-batch-list" style="margin-top: 16px; display: none;">
        <!-- 批次列表會動態插入這裡 -->
      </div>
    `;
  }
  
  function initShippingMode() {
    if (state.currentProvider === 'DELIVERY') {
      const deliveryPrintBtn = document.getElementById('bv-delivery-print');
      if (deliveryPrintBtn) {
        deliveryPrintBtn.addEventListener('click', () => {
          window.print();
        });
      }
    } else {
      loadShippingData();
    }
  }
  
  function setupEventListeners() {
    const convertBtn = document.getElementById('bv-convert-btn');
    const revertBtn = document.getElementById('bv-revert-btn');
    const minimizeBtn = document.getElementById('bv-minimize-btn');
    const minimizedButton = document.getElementById('bv-minimized-button');
    const highlightQty = document.getElementById('bv-highlight-qty');
    const applyPrint = document.getElementById('bv-apply-print');
    
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
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      setupShippingEventListeners();
    }
    
    if (state.isConverted) {
      setupLabelModeEventListeners();
    }
    
    setupCollapsibleCards();
  }
  
  function updatePreview() {
    if (!state.isConverted) return;
    
    // 使用防抖來避免頻繁更新
    clearTimeout(state.previewTimeout);
    state.previewTimeout = setTimeout(() => {
      handlePagination();
      
      // 確保在分頁處理完成後再套用數量標示
      setTimeout(() => {
        if (state.highlightQuantity) {
          applyQuantityHighlight();
        }
      }, 100);
    }, 100);
  }
  
  function updatePrintModeUI() {
    const sortOptions = document.getElementById('bv-sort-options');
    const detailSortGroup = document.getElementById('bv-detail-sort-group');
    const shippingSort = document.getElementById('bv-shipping-sort');
    const orderLabelSetting = document.getElementById('bv-order-label-setting');
    const orderLabelSwitch = document.getElementById('bv-order-label-switch');
    const orderLabelCheckbox = document.getElementById('bv-show-order-label');
    const reverseShippingOption = document.getElementById('bv-reverse-shipping-option');
    const matchModeSelector = document.getElementById('bv-match-mode-selector');
    
    switch(state.printMode) {
      case CONFIG.PRINT_MODES.DETAIL_ONLY:
        sortOptions.style.display = 'block';
        detailSortGroup.style.display = 'block';
        shippingSort.style.display = 'none';
        reverseShippingOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'flex';
          orderLabelSwitch.classList.add('disabled');
          orderLabelCheckbox.checked = false;
          orderLabelCheckbox.disabled = true;
        }
        break;
        
      case CONFIG.PRINT_MODES.SHIPPING_ONLY:
        sortOptions.style.display = 'block';
        detailSortGroup.style.display = 'none';
        shippingSort.style.display = 'block';
        reverseShippingOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'flex';
          orderLabelSwitch.classList.add('disabled');
          orderLabelCheckbox.checked = false;
          orderLabelCheckbox.disabled = true;
        }
        break;
        
      case CONFIG.PRINT_MODES.MANUAL_MATCH:
        sortOptions.style.display = 'block';
        detailSortGroup.style.display = 'block';
        shippingSort.style.display = 'none';
        reverseShippingOption.style.display = 'block';
        if (matchModeSelector) matchModeSelector.style.display = 'block';
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'flex';
          orderLabelSwitch.classList.remove('disabled');
          orderLabelCheckbox.disabled = false;
        }
        break;
        
      default:
        sortOptions.style.display = 'none';
        reverseShippingOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) orderLabelSetting.style.display = 'none';
    }
  }
    
  function preparePrintWithMode() {
    // 根據列印模式準備頁面
    switch(state.printMode) {
      case CONFIG.PRINT_MODES.DETAIL_ONLY:
        prepareDetailOnlyPrint();
        break;
        
      case CONFIG.PRINT_MODES.SHIPPING_ONLY:
        prepareShippingOnlyPrint();
        break;
        
      case CONFIG.PRINT_MODES.MANUAL_MATCH:
        prepareManualMatchPrint();
        break;
    }
    
    // 確保數量標示在列印前套用
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    }
    
    preparePrintStyles();
    
    setTimeout(() => {
      window.print();
      
      // 列印後恢復原始狀態
      setTimeout(() => {
        updatePreview();
      }, 100);
    }, 100);
  }
  
  function prepareDetailOnlyPrint() {
    // 隱藏所有物流單頁面
    document.querySelectorAll('.bv-shipping-page').forEach(page => {
      page.closest('.bv-page-container').style.display = 'none';
    });
    
    // 根據排序重新排列明細頁面
    sortDetailPages();
  }
  
  function prepareShippingOnlyPrint() {
    // 隱藏所有明細頁面
    document.querySelectorAll('.bv-label-page:not(.bv-shipping-page)').forEach(page => {
      page.closest('.bv-page-container').style.display = 'none';
    });
    
    // 根據排序重新排列物流單頁面
    sortShippingPages();
  }
  
  function prepareManualMatchPrint() {
    // 手動配對：使用選定的排序
    sortDetailPages();
    
    // 如果啟用物流單反序，則反轉物流單
    if (state.reverseShipping) {
      reverseShippingPages();
    }
  }
  
  function sortDetailPages() {
    const containers = Array.from(document.querySelectorAll('.bv-page-container'))
      .filter(c => c.querySelector('.bv-label-page:not(.bv-shipping-page)'));
    
    if (state.detailSortOrder === CONFIG.SORT_ORDERS.DESC) {
      containers.reverse();
    }
    
    const parent = containers[0]?.parentNode;
    if (parent) {
      containers.forEach(container => {
        parent.appendChild(container);
      });
    }
  }
  
  function sortShippingPages() {
    const containers = Array.from(document.querySelectorAll('.bv-page-container'))
      .filter(c => c.querySelector('.bv-shipping-page'));
    
    if (state.shippingSortOrder === CONFIG.SORT_ORDERS.DESC) {
      containers.reverse();
    }
    
    const parent = containers[0]?.parentNode;
    if (parent) {
      containers.forEach(container => {
        parent.appendChild(container);
      });
    }
  }
  
  function reverseShippingPages() {
    // 收集所有物流單資料並反轉
    const reversedShippingData = [...state.shippingData].reverse();
    const reversedPdfData = [...state.pdfShippingData].reverse();
    
    // 暫時儲存反轉後的資料
    state.tempShippingData = reversedShippingData;
    state.tempPdfShippingData = reversedPdfData;
    
    // 在 handlePagination 中使用反轉後的資料
    state.useReversedShipping = true;
  }
  
  function setupShippingEventListeners() {
    const fetchSaveBtn = document.getElementById('bv-fetch-save-shipping');
    
    if (fetchSaveBtn) {
      fetchSaveBtn.addEventListener('click', fetchAndSaveShippingData);
    }
  }
  
  function fetchAndSaveShippingData() {
    const provider = CONFIG.PROVIDERS[state.currentProvider];
    if (!provider) return;
    
    let elements = document.querySelectorAll(provider.selector);
    if (elements.length === 0) {
      showNotification('未找到物流單', 'warning');
      return;
    }
    
    // 7-11 特殊處理：只選擇單個 frame 而非整個 table
    if (state.currentProvider === 'SEVEN') {
      const frames = document.querySelectorAll('.div_frame');
      if (frames.length > 0) {
        elements = frames; // 使用所有的 frame
      }
    }
    
    // 清除該提供商的舊批次資料
    state.shippingDataBatches = state.shippingDataBatches.filter(batch => 
      batch.provider !== state.currentProvider
    );
    
    const newBatch = {
      id: Date.now(),
      type: 'screenshot',
      provider: state.currentProvider,
      name: `${provider.name} - ${new Date().toLocaleTimeString()}`,
      data: [],
      timestamp: new Date().toISOString()
    };
    
    const processedOrders = new Set();
    let processedCount = 0;
    let totalToProcess = 0;
    
    // 計算需要處理的元素數量
    elements.forEach((element) => {
      const data = extractShippingData(element);
      if (data && data.orderNo && !processedOrders.has(data.orderNo)) {
        totalToProcess++;
      }
    });
    
    // 處理每個物流單元素
    elements.forEach((element, index) => {
      const data = extractShippingData(element);
      if (!data || !data.orderNo || processedOrders.has(data.orderNo)) return;
      
      processedOrders.add(data.orderNo);
      
      // 使用 html2canvas 截圖（只截圖單個元素）
      html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 3, // 提高解析度
        logging: false,
        useCORS: true,
        allowTaint: true
      }).then(canvas => {
        // 轉換為高品質 JPG
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        
        newBatch.data.push({
          ...data,
          imageData: imageData,
          index: newBatch.data.length,
          width: canvas.width,
          height: canvas.height
        });
        
        processedCount++;
        checkComplete();
      }).catch(err => {
        console.error('截圖失敗:', err);
        processedCount++;
        checkComplete();
      });
    });
    
    function checkComplete() {
      if (processedCount === totalToProcess) {
        if (newBatch.data.length > 0) {
          state.shippingDataBatches.push(newBatch);
          mergeAllBatchData();
          updateBatchList();
          updateShippingCount();
          
          // 立即儲存
          chrome.storage.local.set({
            shippingDataBatches: state.shippingDataBatches,
            shippingData: state.shippingData,
            pdfShippingData: state.pdfShippingData,
            shippingProvider: state.currentProvider,
            shippingTimestamp: new Date().toISOString()
          }, () => {
            showNotification(`成功抓取並儲存 ${newBatch.data.length} 張物流單`);
          });
        }
      }
    }
  }
  
  function setupLabelModeEventListeners() {
    const hideExtraInfoCheckbox = document.getElementById('bv-hide-extra-info');
    if (hideExtraInfoCheckbox) {
      hideExtraInfoCheckbox.addEventListener('change', function(e) {
        state.hideExtraInfo = e.target.checked;
        saveSettings();
        updatePreview();
      });
    }
    
    const hideTableHeaderCheckbox = document.getElementById('bv-hide-table-header');
    if (hideTableHeaderCheckbox) {
      hideTableHeaderCheckbox.addEventListener('change', function(e) {
        state.hideTableHeader = e.target.checked;
        saveSettings();
        updateLabelStyles();
        updatePreview();
      });
    }
    
    // 監聽商品圖片開關
    const showProductImageCheckbox = document.querySelector('.ignore-print #showProductImage');
    if (showProductImageCheckbox) {
      // 移除舊的監聽器（如果有的話）
      const newCheckbox = showProductImageCheckbox.cloneNode(true);
      showProductImageCheckbox.parentNode.replaceChild(newCheckbox, showProductImageCheckbox);
      
      // 添加新的監聽器
      newCheckbox.addEventListener('change', function() {
        // 立即更新預覽
        updatePreview();
      });
    }
    
    const fontSizeSlider = document.getElementById('bv-font-size');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', function() {
        document.getElementById('bv-font-size-value').textContent = parseFloat(this.value).toFixed(1);
        updateRangeProgress(this);
        
        const originalFontSize = document.querySelector('.ignore-print #fontSize');
        if (originalFontSize) {
          const closestSize = Math.round(parseFloat(this.value));
          originalFontSize.value = closestSize + 'px';
          if (typeof $ !== 'undefined') {
            $(originalFontSize).trigger('change');
          }
        }
        
        saveSettings();
        updateLabelStyles();
        updatePreview();
      });
    }
    
    const clearShippingBtn = document.getElementById('bv-clear-shipping');
    if (clearShippingBtn) {
      clearShippingBtn.addEventListener('click', function() {
        chrome.storage.local.remove(['shippingDataBatches', 'shippingData', 'pdfShippingData', 'shippingProvider', 'shippingTimestamp'], () => {
          state.shippingData = [];
          state.pdfShippingData = [];
          state.shippingDataBatches = [];
          checkShippingDataStatus();
          updateBatchList();
          showNotification('已清除物流單資料');
          
          // 重置 PDF 上傳區域到初始狀態
          resetPdfUploadArea();
          
          // 自動重新整理預覽
          updatePreview();
        });
      });
    }
    
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    const pdfInput = document.getElementById('bv-pdf-input');
    
    if (pdfUploadArea && pdfInput) {
      pdfUploadArea.addEventListener('click', function() {
        pdfInput.click();
      });
      
      pdfInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          handleMultiplePdfUpload(files);
        }
      });
    }
    
    const showOrderLabelCheckbox = document.getElementById('bv-show-order-label');
    if (showOrderLabelCheckbox) {
      showOrderLabelCheckbox.addEventListener('change', function() {
        saveSettings();
        updatePreview();
      });
    }
    
    hideOriginalControls();
    
    document.querySelectorAll('input[type="range"]').forEach(updateRangeProgress);
    
    initPresetSystem();
    initLogoUpload();
    observeOriginalControls();
    
    // 初始化列印模式 UI
    updatePrintModeUI();

  // 每 5 秒自動檢查一次是否有新的物流單資料
    if (state.autoCheckInterval) {
      clearInterval(state.autoCheckInterval);
    }
    
    state.autoCheckInterval = setInterval(() => {
      // 只在沒有資料時自動檢查
      if (state.shippingData.length === 0 && state.pdfShippingData.length === 0) {
        chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'pdfShippingData'], (result) => {
          if (result.shippingDataBatches || result.shippingData || result.pdfShippingData) {
            checkShippingDataStatus();
            updatePreview();
          }
        });
      }
    }, 5000);
  }
  
  function resetPdfUploadArea() {
    const uploadPrompt = document.getElementById('bv-pdf-upload-prompt');
    const pdfInfo = document.getElementById('bv-pdf-info');
    const pdfInput = document.getElementById('bv-pdf-input');
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    
    if (uploadPrompt) uploadPrompt.style.display = 'flex';
    if (pdfInfo) pdfInfo.style.display = 'none';
    if (pdfInput) pdfInput.value = '';
    if (pdfUploadArea) pdfUploadArea.classList.remove('has-file');
  }
    
  async function handleMultiplePdfUpload(files) {
    const uploadPrompt = document.getElementById('bv-pdf-upload-prompt');
    const pdfInfo = document.getElementById('bv-pdf-info');
    const filenameEl = document.getElementById('bv-pdf-filename');
    const pagesEl = document.getElementById('bv-pdf-pages');
    const progressEl = document.getElementById('bv-conversion-progress');
    const progressFill = document.getElementById('bv-conversion-progress-fill');
    const statusEl = document.getElementById('bv-conversion-status');
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    const pdfInput = document.getElementById('bv-pdf-input');
    
    // 顯示檔案資訊
    if (uploadPrompt) uploadPrompt.style.display = 'none';
    if (pdfInfo) {
      pdfInfo.style.display = 'flex';
      filenameEl.textContent = files.length > 1 ? `${files.length} 個檔案` : files[0].name;
    }
    if (pdfUploadArea) pdfUploadArea.classList.add('has-file');
    if (progressEl) progressEl.classList.add('active');
    
    try {
      let totalPages = 0;
      const newBatch = {
        id: Date.now(),
        type: 'pdf',
        provider: 'DELIVERY',
        subType: state.deliverySubType || 'UNKNOWN',
        name: files.length > 1 ? `PDF 批次 (${files.length} 個檔案)` : files[0].name,
        data: [],
        timestamp: new Date().toISOString()
      };
      
      // 處理 PDF 檔案...（原有的 PDF 處理邏輯）
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        
        statusEl.textContent = `處理檔案 ${fileIndex + 1}/${files.length}...`;
        progressFill.style.width = `${(fileIndex / files.length * 100)}%`;
        
        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        
        if (typeof pdfjsLib !== 'undefined') {
          if (chrome && chrome.runtime && chrome.runtime.getURL) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
          } else {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            pdfjsLib.GlobalWorkerOptions.isEvalSupported = false;
          }
        } else {
          console.error('PDF.js 尚未載入');
          throw new Error('PDF.js library not loaded');
        }
        
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const numPages = pdf.numPages;
        totalPages += numPages;
        
        for (let i = 1; i <= numPages; i++) {
          statusEl.textContent = `檔案 ${fileIndex + 1}/${files.length} - 第 ${i}/${numPages} 頁...`;
          const progress = (fileIndex / files.length + (i / numPages) / files.length) * 100;
          progressFill.style.width = `${progress}%`;
          
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
          
          // 嘗試提取文字以匹配訂單
          const textContent = await page.getTextContent();
          const text = textContent.items.map(item => item.str).join(' ');
          const shippingNo = extractShippingNumberFromText(text);
          
          newBatch.data.push({
            provider: 'DELIVERY',
            subType: state.deliverySubType || 'UNKNOWN',
            orderNo: shippingNo || `PDF_${totalPages}`,
            pageNumber: i,
            fileIndex: fileIndex,
            fileName: file.name,
            imageData: imageData,
            width: viewport.width,
            height: viewport.height,
            timestamp: new Date().toISOString(),
            extractedText: text
          });
        }
      }
      
      if (pagesEl) pagesEl.textContent = `共 ${totalPages} 頁`;
      
      progressFill.style.width = '100%';
      statusEl.textContent = '轉換完成！';
      
      // 加入批次列表
      state.shippingDataBatches.push(newBatch);
      
      // 合併所有批次資料
      mergeAllBatchData();
      
      // 儲存資料
      chrome.storage.local.set({
        shippingDataBatches: state.shippingDataBatches,
        pdfShippingData: state.pdfShippingData,
        shippingProvider: 'DELIVERY',
        shippingSubType: state.deliverySubType,
        shippingTimestamp: new Date().toISOString()
      }, () => {
        showNotification(`成功轉換 ${totalPages} 頁 PDF`);
        checkShippingDataStatus();
        updateBatchList();
        updatePreview();
        
        // 1秒後恢復上傳區域
        setTimeout(() => {
          progressEl.classList.remove('active');
          progressFill.style.width = '0%';
          
          // 重置上傳區域
          if (uploadPrompt) uploadPrompt.style.display = 'flex';
          if (pdfInfo) pdfInfo.style.display = 'none';
          if (pdfUploadArea) pdfUploadArea.classList.remove('has-file');
          if (pdfInput) pdfInput.value = ''; // 清空輸入，允許重新選擇相同檔案
        }, 1000);
      });
      
    } catch (error) {
      console.error('PDF 處理錯誤:', error);
      showNotification('PDF 處理失敗: ' + error.message, 'error');
      progressEl.classList.remove('active');
      
      resetPdfUploadArea();
    }
  }
  
  // 從文字中提取物流編號
  function extractShippingNumberFromText(text) {
    // 各物流商的編號模式
    const patterns = {
      // 一般物流單號格式
      general: [
        /物流編號[：:]\s*([A-Z0-9-]+)/i,
        /配送單號[：:]\s*([A-Z0-9-]+)/i,
        /託運單號[：:]\s*([A-Z0-9-]+)/i,
        /運單號碼[：:]\s*([A-Z0-9-]+)/i,
        /追蹤號碼[：:]\s*([A-Z0-9-]+)/i,
        /Tracking\s*No[：:]\s*([A-Z0-9-]+)/i,
        /貨運單號[：:]\s*([A-Z0-9-]+)/i
      ]
    };
    
    // 嘗試所有模式
    for (const patternList of Object.values(patterns)) {
      for (const pattern of patternList) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
    
    return null;
  }
  
  function loadShippingData() {
    chrome.storage.local.get(['shippingDataBatches', 'shippingData'], (result) => {
      if (result.shippingDataBatches) {
        state.shippingDataBatches = result.shippingDataBatches;
        mergeAllBatchData();
        updateBatchList();
        updateShippingCount();
      } else if (result.shippingData) {
        // 相容舊版資料
        state.shippingData = result.shippingData;
        updateShippingCount();
      }
    });
  }
  
  function mergeAllBatchData() {
    // 合併所有批次的資料
    state.shippingData = [];
    state.pdfShippingData = [];
    
    state.shippingDataBatches.forEach(batch => {
      if (batch.type === 'pdf') {
        state.pdfShippingData.push(...batch.data);
      } else if (batch.type === 'screenshot') {
        // 截圖類型也加入 pdfShippingData，因為處理方式相同
        state.pdfShippingData.push(...batch.data);
      } else {
        state.shippingData.push(...batch.data);
      }
    });
  }
  
  function updateBatchList() {
    const batchListEl = document.getElementById('bv-batch-list');
    const shippingBatchListEl = document.getElementById('bv-shipping-batch-list');
    
    if (batchListEl && state.shippingDataBatches.length > 0) {
      batchListEl.style.display = 'block';
      batchListEl.innerHTML = state.shippingDataBatches.map((batch, index) => `
        <div class="bv-batch-item" data-batch-id="${batch.id}">
          <div class="bv-batch-item-info">
            <div class="bv-batch-item-name">${batch.name}</div>
            <div class="bv-batch-item-count">${batch.data.length} 張</div>
          </div>
          <div class="bv-batch-actions">
            <div class="bv-batch-order">
              <button class="bv-batch-order-btn" data-action="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
                <span class="material-icons">arrow_upward</span>
              </button>
              <button class="bv-batch-order-btn" data-action="down" data-index="${index}" ${index === state.shippingDataBatches.length - 1 ? 'disabled' : ''}>
                <span class="material-icons">arrow_downward</span>
              </button>
            </div>
            <button class="bv-preset-action-btn delete" data-batch-id="${batch.id}">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      `).join('');
      
      // 綁定事件
      batchListEl.querySelectorAll('.bv-batch-order-btn').forEach(btn => {
        btn.addEventListener('click', handleBatchAction);
      });
      
      batchListEl.querySelectorAll('.bv-preset-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const batchId = parseInt(this.dataset.batchId);
          
          if (confirm('確定要刪除這批物流單嗎？')) {
            state.shippingDataBatches = state.shippingDataBatches.filter(b => b.id !== batchId);
            mergeAllBatchData();
            updateBatchList();
            saveShippingData();
            checkShippingDataStatus();
            updatePreview();
          }
        });
      });
    } else if (batchListEl) {
      batchListEl.style.display = 'none';
    }
    
    // 更新物流單頁面的批次列表
    if (shippingBatchListEl) {
      if (state.shippingDataBatches.length > 0) {
        shippingBatchListEl.style.display = 'block';
        // 確保 batchListEl 存在且有內容才複製
        if (batchListEl && batchListEl.innerHTML) {
          shippingBatchListEl.innerHTML = batchListEl.innerHTML;
          
          shippingBatchListEl.querySelectorAll('.bv-batch-order-btn').forEach(btn => {
            btn.addEventListener('click', handleBatchAction);
          });
          
          shippingBatchListEl.querySelectorAll('.bv-preset-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              const batchId = parseInt(this.dataset.batchId);
              
              if (confirm('確定要刪除這批物流單嗎？')) {
                state.shippingDataBatches = state.shippingDataBatches.filter(b => b.id !== batchId);
                mergeAllBatchData();
                updateBatchList();
                saveShippingData();
                updateShippingCount();
              }
            });
          });
        }
      } else {
        shippingBatchListEl.style.display = 'none';
      }
    }
  }
  
  function saveShippingData() {
    chrome.storage.local.set({
      shippingDataBatches: state.shippingDataBatches,
      pdfShippingData: state.pdfShippingData,
      shippingData: state.shippingData
    }, () => {
      showNotification('已儲存物流單資料');
    });
  }
  
  function handleBatchAction(e) {
    const action = e.currentTarget.dataset.action;
    const index = parseInt(e.currentTarget.dataset.index);
    
    switch(action) {
      case 'up':
        if (index > 0) {
          [state.shippingDataBatches[index], state.shippingDataBatches[index - 1]] = 
          [state.shippingDataBatches[index - 1], state.shippingDataBatches[index]];
        }
        break;
        
      case 'down':
        if (index < state.shippingDataBatches.length - 1) {
          [state.shippingDataBatches[index], state.shippingDataBatches[index + 1]] = 
          [state.shippingDataBatches[index + 1], state.shippingDataBatches[index]];
        }
        break;
    }
    
    // 更新資料
    mergeAllBatchData();
    updateBatchList();
    updateShippingCount();
    
    // 儲存更新
    chrome.storage.local.set({
      shippingDataBatches: state.shippingDataBatches,
      pdfShippingData: state.pdfShippingData,
      shippingData: state.shippingData
    }, () => {
      updatePreview();
    });
  }
  
  function updateShippingCount() {
    const countEl = document.getElementById('bv-shipping-count');
    if (countEl) {
      const totalCount = state.shippingData.length + state.pdfShippingData.length;
      countEl.textContent = totalCount;
    }
  }
  
  function extractShippingData(element, provider = null) {
    const data = {
      provider: state.currentProvider,
      orderNo: '',
      storeId: '',
      storeName: '',
      recipientName: '',
      recipientPhone: '',
      barcode: '',
      logisticsNo: '',  // 新增專門的物流編號欄位
      html: '',
      timestamp: new Date().toISOString(),
      isBatchPrint: false
    };
    
    // 檢查是否為 7-11 批次列印格式
    if (state.currentProvider === 'SEVEN') {
      const frame = element.querySelector('.div_frame') || element;
      if (frame.classList.contains('div_frame')) {
        data.isBatchPrint = true;
        element = frame.closest('td > div') || frame.parentElement || element;
      }
    }
    
    const clonedElement = element.cloneNode(true);
    removeScripts(clonedElement);
    data.html = clonedElement.outerHTML;
    
    const text = element.textContent || '';
    
    // 7-11 特殊處理：提取交貨便服務代碼
    if (state.currentProvider === 'SEVEN') {
      // 交貨便服務代碼的可能模式
      const serviceCodePatterns = [
        /交貨便服務代碼[：:]\s*([A-Z0-9-]+)/i,
        /服務代碼[：:]\s*([A-Z0-9-]+)/i,
        /Service\s*Code[：:]\s*([A-Z0-9-]+)/i
      ];
      
      for (const pattern of serviceCodePatterns) {
        const match = text.match(pattern);
        if (match) {
          data.orderNo = match[1].trim();  // 使用 orderNo 欄位存放服務代碼
          data.logisticsNo = match[1].trim();  // 同時存入 logisticsNo
          break;
        }
      }
      
      // 提取其他 7-11 相關資訊
      const storePattern = /門市名稱[：:]\s*([^,\n]+)/i;
      const storeMatch = text.match(storePattern);
      if (storeMatch) data.storeName = storeMatch[1].trim();
      
      const storeIdPattern = /門市店號[：:]\s*(\d+)/i;
      const storeIdMatch = text.match(storeIdPattern);
      if (storeIdMatch) data.storeId = storeIdMatch[1].trim();
      
    } else {
      // 其他物流商的一般處理
      const currentPatterns = CONFIG.PROVIDERS[state.currentProvider]?.patterns;
      
      if (currentPatterns) {
        for (const [key, patternList] of Object.entries(currentPatterns)) {
          for (const pattern of patternList) {
            const match = text.match(pattern);
            if (match) {
              switch(key) {
                case 'order': data.orderNo = match[1].trim(); break;
                case 'store': data.storeName = match[1].trim(); break;
                case 'storeId': data.storeId = match[1].trim(); break;
                case 'recipient': data.recipientName = match[1].trim(); break;
                case 'phone': data.recipientPhone = match[1].trim(); break;
                case 'barcode': data.barcode = match[1].trim(); break;
              }
              break;
            }
          }
        }
      }
    }
    
    // 只要有服務代碼就算有效（針對 7-11）
    return (data.orderNo || data.logisticsNo) ? data : null;
  }
  
  function removeScripts(element) {
    const scripts = element.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    const onclickElements = element.querySelectorAll('[onclick]');
    onclickElements.forEach(el => el.removeAttribute('onclick'));
  }
  
  function checkShippingDataStatus() {
    chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'shippingProvider', 'pdfShippingData', 'shippingSubType'], (result) => {
      const statusEl = document.getElementById('bv-integration-status');
      
      if (!statusEl) return;
      
      // 載入批次資料
      if (result.shippingDataBatches) {
        state.shippingDataBatches = result.shippingDataBatches;
        mergeAllBatchData();
        updateBatchList();
      } else if (result.shippingData || result.pdfShippingData) {
        // 相容舊版資料
        state.shippingData = result.shippingData || [];
        state.pdfShippingData = result.pdfShippingData || [];
      }
      
      const hasShippingData = state.shippingData.length > 0;
      const hasPdfData = state.pdfShippingData.length > 0;
      
      if (hasShippingData || hasPdfData) {
        const totalCount = state.shippingData.length + state.pdfShippingData.length;
        let providerName = '未知';
        
        if (result.shippingProvider) {
          if (result.shippingProvider === 'DELIVERY' && result.shippingSubType) {
            providerName = CONFIG.PROVIDERS.DELIVERY.subTypes[result.shippingSubType] || '宅配';
          } else {
            providerName = CONFIG.PROVIDERS[result.shippingProvider]?.name || '未知';
          }
        } else if (hasPdfData) {
          providerName = '宅配';
        }
        
        statusEl.className = 'bv-integration-status success';
        statusEl.innerHTML = `
          <span class="material-icons">check_circle</span>
          <div class="bv-status-info">
            <h4>已載入 ${totalCount} 張物流單</h4>
            <p>${providerName} - 可整合列印</p>
          </div>
        `;
      } else {
        statusEl.className = 'bv-integration-status warning';
        statusEl.innerHTML = `
          <span class="material-icons">warning</span>
          <div class="bv-status-info">
            <h4>尚無物流單資料</h4>
            <p>請至物流單頁面抓取或上傳 PDF</p>
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
        const wasCollapsed = card.classList.contains('collapsed');
        
        // 收摺所有其他卡片
        document.querySelectorAll('.bv-settings-card').forEach(otherCard => {
          if (otherCard !== card) {
            otherCard.classList.add('collapsed');
            const otherSectionId = otherCard.getAttribute('data-section');
            state.collapsedSections[otherSectionId] = true;
          }
        });
        
        // 切換當前卡片
        if (wasCollapsed) {
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
    // 監聽所有原始控制項的變更
    const checkboxes = document.querySelectorAll('.ignore-print input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      // 為每個 checkbox 添加變更監聽
      checkbox.addEventListener('change', () => {
        if (state.isConverted) {
          // 如果是商品圖片開關，立即更新
          if (checkbox.id === 'showProductImage') {
            updatePreview();
          } else {
            saveSettings();
            updatePreview();
          }
        }
      });
    });
    
    // 特別處理字體大小選擇器
    const fontSizeSelect = document.querySelector('.ignore-print #fontSize');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', () => {
        if (state.isConverted) {
          // 同步更新滑桿
          const fontSizeSlider = document.getElementById('bv-font-size');
          if (fontSizeSlider) {
            const sizeValue = parseInt(fontSizeSelect.value);
            fontSizeSlider.value = sizeValue;
            document.getElementById('bv-font-size-value').textContent = sizeValue.toFixed(1);
            updateRangeProgress(fontSizeSlider);
          }
          saveSettings();
          updateLabelStyles();
          updatePreview();
        }
      });
    }
  }
  
  function convertToLabelFormat() {
    if (state.isConverted) return;
    
    // 移除包含 baseImage 的訂單內容（通常是空白頁）
    document.querySelectorAll('.order-content:has(.baseImage)').forEach(e => e.remove());
    
    const contents = document.querySelectorAll('.order-content');
    if (!contents.length) {
      showNotification('沒有找到可轉換的訂單內容', 'warning');
      return;
    }
    
    // 儲存原始 body 樣式
    state.originalBodyStyle = {
      width: document.body.style.width,
      maxWidth: document.body.style.maxWidth,
      minWidth: document.body.style.minWidth,
      margin: document.body.style.margin,
      padding: document.body.style.padding
    };
    
    // 設定 body 樣式
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.minWidth = 'auto';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    document.body.classList.add('bv-converted');
    
    // 觸發原始頁面更新
    triggerOriginalPageUpdate();
    
    // 更新標籤樣式
    updateLabelStyles();
    
    // 處理分頁
    setTimeout(() => {
      handlePagination();
      
      // 確保數量標示在轉換後正確顯示
      setTimeout(() => {
        if (state.highlightQuantity) {
          applyQuantityHighlight();
        }
      }, 200);
    }, 100);
    
    state.isConverted = true;
    
    // 更新控制面板內容
    updatePanelContent();
    
    // 確保監聽原始控制項
    observeOriginalControls();
    
    showNotification('已成功轉換為10×15cm標籤格式');
  }
  
  function handlePagination() {
    // 清除現有快取
    state.previewCache.clear();
    
    document.querySelectorAll('.bv-page-container').forEach(container => container.remove());
    document.querySelectorAll('.bv-label-page').forEach(page => page.remove());
    
    // 固定使用 10×15 尺寸參數
    const paddingMm = 5;
    const paddingPx = paddingMm * 3.78;
    const pageHeight = 566;
    const contentHeight = pageHeight - (paddingPx * 2);
    
    const orderContents = document.querySelectorAll('.order-content');
    const showOrderLabel = document.getElementById('bv-show-order-label')?.checked ?? false;
    
    // 收集所有訂單資料
    state.detailPages = [];
    state.shippingPages = [];
    state.matchingResults = [];
    
    // 準備物流單資料（考慮反序）
    let shippingDataToUse = state.shippingData;
    let pdfDataToUse = state.pdfShippingData;
    
    if (state.reverseShipping && state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
      // 反轉物流單資料
      shippingDataToUse = [...state.shippingData].reverse();
      pdfDataToUse = [...state.pdfShippingData].reverse();
    }
    
    // 根據列印模式處理
    if (state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY) {
      // 純印物流單模式
      createShippingOnlyPages(shippingDataToUse, pdfDataToUse);
    } else {
      // 其他模式：處理出貨明細
      orderContents.forEach((orderContent, orderIndex) => {
        orderContent.classList.add('bv-original');
        
        // 提取訂單和物流資訊
        const orderInfo = extractOrderInfo(orderContent);
        const orderData = {
          orderNo: orderInfo.orderNo,
          logisticsNo: orderInfo.logisticsNo,
          index: orderIndex,
          element: orderContent,
          pages: []
        };
  
        // 先創建 pageContainer
        const pageContainer = document.createElement('div');
        pageContainer.className = 'bv-page-container';
        pageContainer.setAttribute('data-order-index', orderIndex);
        pageContainer.setAttribute('data-order-no', orderInfo.orderNo || '');
        orderContent.parentNode.insertBefore(pageContainer, orderContent.nextSibling);
        
        // 處理明細分頁
        if (state.printMode !== CONFIG.PRINT_MODES.SHIPPING_ONLY) {
          const orderContentClone = orderContent.cloneNode(true);
          
          // 先處理商品圖片（在精簡模式之前）
          processProductImages(orderContentClone);
          
          // 再處理精簡模式
          if (state.hideExtraInfo) {
            processExtraInfoHiding(orderContentClone);
          }
          
          const elements = Array.from(orderContentClone.children);
          let currentPage = null;
          let currentPageContent = null;
          let currentHeight = 0;
          
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
              currentPage.setAttribute('data-order-no', orderInfo.orderNo || '');
              
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
          const matchType = state.matchMode || 'index';
          let shippingData = null;
          
          // 使用可能已反序的資料
          const allShippingData = [...shippingDataToUse, ...pdfDataToUse];
          
          if (matchType === 'logistics' && orderInfo.logisticsNo) {
            shippingData = findMatchingShippingDataByLogisticsNo(orderInfo.logisticsNo, allShippingData);
          } else {
            // 索引配對
            if (allShippingData[orderIndex]) {
              shippingData = {
                type: allShippingData[orderIndex].imageData ? 'pdf' : 'html',
                data: allShippingData[orderIndex]
              };
            }
          }
          
          if (shippingData) {
            // 處理 7-11 四格的情況
            if (shippingData.data.sectionIndex !== undefined) {
              createSevenElevenBatchPages(shippingData, orderInfo.orderNo, showOrderLabel, orderIndex, pageContainer);
            } else {
              const shippingPage = createShippingPage(shippingData, orderInfo.orderNo, showOrderLabel, orderIndex);
              if (shippingPage) {
                pageContainer.appendChild(shippingPage);
                
                state.shippingPages.push({
                  orderNo: orderInfo.orderNo,
                  index: orderIndex,
                  page: shippingPage
                });
              }
            }
            
            // 記錄配對狀態
            state.matchingResults.push({
              orderNo: orderInfo.orderNo,
              logisticsNo: orderInfo.logisticsNo,
              orderIndex: orderIndex,
              matchType: matchType,
              shippingOrderNo: shippingData.data.orderNo || shippingData.data.barcode,
              matched: true
            });
          } else {
            // 記錄未配對狀態
            state.matchingResults.push({
              orderNo: orderInfo.orderNo,
              logisticsNo: orderInfo.logisticsNo,
              orderIndex: orderIndex,
              matchType: matchType,
              matched: false
            });
          }
        }
      });
    }
    
    updateLogos();
    applySortOrder();
    
    // 顯示配對結果
    if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH && state.matchingResults) {
      showMatchingResults();
    }
  }
  
  // 修改數量標示處理函數
  function applyQuantityHighlight() {
    const containers = state.isConverted ? 
      document.querySelectorAll('.bv-label-page') : 
      document.querySelectorAll('.order-content');
    
    containers.forEach(container => {
      container.querySelectorAll('.list-item').forEach(item => {
        let qtyCell = null;
        const cells = item.querySelectorAll('td');
        
        // 從右往左數第二個開始尋找純數字的欄位（排除最右邊的價格欄位）
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
            // 確保不會換行
            qtyCell.style.whiteSpace = 'nowrap';
            qtyCell.innerHTML = `<span class="bv-qty-star">${qty}</span>`;
          }
        }
      });
    });
  }
  
  function createSevenElevenBatchPages(shippingInfo, orderNo, showOrderLabel, orderIndex, pageContainer) {
    if (!shippingInfo.data.batchHtml) return;
    
    const batchKey = `${orderIndex}_${shippingInfo.data.sectionIndex}`;
    
    // 檢查是否已經處理過這個批次
    if (state.sevenBatchCache.has(batchKey)) {
      return;
    }
    
    // 標記整個批次已處理
    for (let i = 0; i < 4; i++) {
      state.sevenBatchCache.set(`${orderIndex}_${i}`, true);
    }
    
    // 創建包含四格的物流單頁面
    const page = document.createElement('div');
    page.className = 'bv-label-page bv-shipping-page';
    page.style.padding = '0';
    page.setAttribute('data-page-type', 'shipping');
    page.setAttribute('data-order-index', orderIndex);
    page.setAttribute('data-order-no', orderNo || '');
    
    const content = document.createElement('div');
    content.className = 'bv-shipping-content';
    content.innerHTML = shippingInfo.data.batchHtml;
    
    // 處理訂單編號標籤（只在第一格顯示）
    if (showOrderLabel && orderNo && shippingInfo.data.sectionIndex === 0) {
      const label = document.createElement('div');
      label.className = 'bv-order-label';
      label.textContent = `訂單：${orderNo}`;
      content.appendChild(label);
    }
    
    page.appendChild(content);
    pageContainer.appendChild(page);
    
    state.shippingPages.push({
      orderNo: orderNo,
      index: orderIndex,
      page: page,
      isBatch: true
    });
  }
  
  function extractOrderInfo(orderContent) {
    const patterns = {
      orderNo: [
        /訂單編號[：:]\s*([A-Z0-9]+)/i,
        /訂單號碼[：:]\s*([A-Z0-9]+)/i,
        /Order\s*No[：:]\s*([A-Z0-9]+)/i,
        /訂單\s*([A-Z0-9]+)/i
      ],
      logisticsNo: [
        /物流編號[：:]\s*([A-Z0-9-]+)/i,
        /物流單號[：:]\s*([A-Z0-9-]+)/i,
        /交貨便服務代碼[：:]\s*([A-Z0-9-]+)/i,
        /服務代碼[：:]\s*([A-Z0-9-]+)/i,
        /配送編號[：:]\s*([A-Z0-9-]+)/i
      ]
    };
    
    const text = orderContent.textContent || '';
    const result = {
      orderNo: null,
      logisticsNo: null
    };
    
    // 提取訂單編號
    for (const pattern of patterns.orderNo) {
      const match = text.match(pattern);
      if (match) {
        result.orderNo = match[1].trim();
        break;
      }
    }
    
    // 提取物流編號
    for (const pattern of patterns.logisticsNo) {
      const match = text.match(pattern);
      if (match) {
        result.logisticsNo = match[1].trim();
        break;
      }
    }
    
    return result;
  }
  
  function findMatchingShippingDataByIndex(index) {
    const allShippingData = [...state.shippingData, ...state.pdfShippingData];
    
    if (allShippingData[index]) {
      return {
        type: allShippingData[index].imageData ? 'pdf' : 'html',
        data: allShippingData[index]
      };
    }
    
    return null;
  }
  
  function findMatchingShippingDataByOrderNo(orderNo) {
    if (!orderNo) return null;
    
    const allShippingData = [...state.shippingData, ...state.pdfShippingData];
    
    const match = allShippingData.find(data => {
      return data.orderNo === orderNo;
    });
    
    if (match) {
      return {
        type: match.imageData ? 'pdf' : 'html',
        data: match
      };
    }
    
    return null;
  }
  
  function findMatchingShippingDataByLogisticsNo(logisticsNo, shippingDataArray) {
    if (!logisticsNo) return null;
    
    // 使用傳入的資料陣列，如果沒有則使用預設
    const allShippingData = shippingDataArray || [...state.shippingData, ...state.pdfShippingData];
    
    // 清理物流編號格式（保留連字號）
    const cleanLogisticsNo = logisticsNo.trim().toUpperCase();
    
    // 尋找交貨便服務代碼相符的資料
    const match = allShippingData.find(data => {
      // 檢查各種可能的欄位
      const candidates = [
        data.orderNo,      // 7-11 的服務代碼存在這裡
        data.logisticsNo,  // 也可能存在專門的物流編號欄位
        data.barcode,
        data.storeId
      ];
      
      for (const candidate of candidates) {
        if (candidate) {
          const cleanCandidate = candidate.trim().toUpperCase();
          if (cleanCandidate === cleanLogisticsNo) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (match) {
      return {
        type: match.imageData ? 'pdf' : 'html',
        data: match
      };
    }
    
    return null;
  }
  
  function showMatchingResults() {
    const resultsEl = document.getElementById('bv-matching-results');
    if (!resultsEl) return;
    
    const matchedCount = state.matchingResults.filter(r => r.matched).length;
    const totalCount = state.matchingResults.length;
    
    if (totalCount === 0) {
      resultsEl.style.display = 'none';
      return;
    }
    
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
      <div class="bv-matching-results-title">
        配對結果：${matchedCount}/${totalCount} 筆成功
      </div>
      ${state.matchingResults.map(result => `
        <div class="bv-matching-result-item">
          ${result.matched ? '✓' : '✗'} 
          訂單 ${result.orderNo || '無編號'} 
          ${result.matched ? 
            `→ 物流單 ${result.shippingOrderNo}` : 
            `(${result.matchType === 'logistics' ? '物流編號' : result.matchType === 'order' ? '訂單編號' : '索引'}配對失敗)`
          }
        </div>
      `).join('')}
    `;
  }
  
  function createShippingOnlyPages(shippingDataToUse, pdfDataToUse) {
    // 使用傳入的資料（可能已反序）
    const allShippingData = [...(shippingDataToUse || state.shippingData), ...(pdfDataToUse || state.pdfShippingData)];
    const showOrderLabel = false;
    
    allShippingData.forEach((data, index) => {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'bv-page-container';
      pageContainer.setAttribute('data-shipping-index', index);
      
      const shippingInfo = {
        type: data.imageData ? 'pdf' : 'html',
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
  
  function createShippingPage(shippingInfo, orderNo, showOrderLabel, orderIndex) {
    const page = document.createElement('div');
    page.className = 'bv-label-page bv-shipping-page';
    page.style.padding = '0';
    page.setAttribute('data-page-type', 'shipping');
    page.setAttribute('data-order-index', orderIndex);
    page.setAttribute('data-order-no', orderNo || '');
    
    const content = document.createElement('div');
    content.className = 'bv-shipping-content';
    
    // 如果是超商物流單，需要特殊處理
    const isStore = shippingInfo.data.provider && 
                   CONFIG.PROVIDERS[shippingInfo.data.provider]?.type === 'store';
    
    // 使用截圖或 PDF 圖片
    if (shippingInfo.type === 'pdf' || shippingInfo.data.imageData) {
      const img = document.createElement('img');
      img.src = shippingInfo.data.imageData;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
      `;
      content.appendChild(img);
    } else if (shippingInfo.data.html) {
      // 舊版 HTML 顯示（相容性）
      const wrapper = document.createElement('div');
      wrapper.className = isStore ? 'bv-store-shipping-content' : 'bv-shipping-wrapper-inner';
      wrapper.innerHTML = shippingInfo.data.html;
      
      if (!isStore) {
        const scale = 0.85;
        wrapper.style.cssText = `
          transform: scale(${scale});
          transform-origin: center center;
          width: ${100 / scale}%;
          height: ${100 / scale}%;
        `;
      }
      
      content.appendChild(wrapper);
    }
    
    // 處理訂單編號標籤
    if (showOrderLabel && orderNo) {
      const label = document.createElement('div');
      label.className = 'bv-order-label';
      label.textContent = `訂單：${orderNo}`;
      content.appendChild(label);
    }
    
    page.appendChild(content);
    
    return page;
  }
  
  function processExtraInfoHiding(container) {
    const orderInfo = container.querySelector('.order-info');
    if (!orderInfo) return;
    
    const allParagraphs = orderInfo.querySelectorAll('p');
    
    // 精簡模式只保留這五個選項
    const keepPatterns = [
      /訂單編號/,
      /物流編號/,
      /送貨方式/,
      /收件人(?!地址|電話)/,
    ];
    
    allParagraphs.forEach(p => {
      const text = p.textContent.trim();
      let shouldKeep = false;
      
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
  
  function processProductImages(container) {
    // 每次都重新檢查是否顯示商品圖片
    const showProductImage = document.querySelector('.ignore-print #showProductImage')?.checked;
    
    // 找到商品表格
    const productTable = container.querySelector('.list');
    if (!productTable) return;
    
    // 先清除所有現有的商品圖片欄位
    container.querySelectorAll('.bv-product-image-col').forEach(col => col.remove());
    container.querySelectorAll('.bv-product-img').forEach(img => img.remove());
    
    // 如果不顯示商品圖片，直接返回
    if (!showProductImage) return;
    
    // 處理標題列
    const headerRow = productTable.querySelector('.list-title');
    if (headerRow && !state.hideTableHeader) {
      // 新增空白商品圖標題
      const imageHeader = document.createElement('th');
      imageHeader.className = 'bv-product-image-col';
      imageHeader.textContent = '';
      imageHeader.style.width = '8mm';
      headerRow.insertBefore(imageHeader, headerRow.firstChild);
    }
    
    // 處理每個商品列
    const productRows = productTable.querySelectorAll('.list-item');
    productRows.forEach(row => {
      const nameCell = row.querySelector('.list-item-name');
      if (!nameCell) return;
      
      // 創建圖片欄位
      const imageCell = document.createElement('td');
      imageCell.className = 'bv-product-image-col';
      imageCell.style.width = '8mm';
      imageCell.style.padding = '2px';
      imageCell.style.verticalAlign = 'top';
      
      // 尋找圖片（可能在不同位置）
      let img = nameCell.querySelector('.orderProductImage');
      if (!img) {
        img = nameCell.querySelector('img');
      }
      
      if (img) {
        // 取得原始圖片資訊
        const originalSrc = img.src || img.dataset.src;
        
        // 創建新圖片
        const newImg = document.createElement('img');
        newImg.className = 'bv-product-img';
        newImg.src = originalSrc;
        
        // 設定圖片樣式
        newImg.style.cssText = `
          display: block !important;
          visibility: visible !important;
          width: 7mm !important;
          height: 7mm !important;
          object-fit: cover !important;
          border-radius: 2px !important;
        `;
        
        // 移除原始圖片
        img.remove();
        
        // 將新圖片放入新欄位
        imageCell.appendChild(newImg);
      }
      
      row.insertBefore(imageCell, row.firstChild);
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
    } else if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH && state.reverseShipping) {
      // 在手動配對模式下，如果啟用物流單反序
      reverseShippingPages();
    }
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
        border-bottom: 1px solid #000 !important;
      }

      .bv-converted .list-item:last-child,
      .bv-label-page .list-item:last-child {
        border-bottom: none !important;
      }
      
      .bv-converted .list-item td,
      .bv-label-page .list-item td {
        padding: 4px 4px !important;
        font-size: ${fontSize}px !important;
        line-height: 1.3 !important;
        vertical-align: top !important;
      }
      
      .bv-converted .list-item-name,
      .bv-label-page .list-item-name {
        font-weight: 500 !important;
      }
      
      .bv-converted .orderProductImage,
      .bv-label-page .orderProductImage {
        display: none !important;
      }
      
      .bv-converted .subtotal-row td,
      .bv-label-page .subtotal-row td {
        padding: 4px 4px !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        border-top: 0.5mm solid #000 !important;
        font-weight: 500 !important;
      }
      
      .bv-converted .order-extra,
      .bv-label-page .order-extra {
        margin: 0 !important;
      }
      
      .bv-converted .order-extra p,
      .bv-label-page .order-extra p {
        margin: 0 0 4px 0 !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        line-height: 1.4 !important;
      }
      
      .label-background-logo {
        position: absolute !important;
        left: ${logoX}% !important;
        top: ${logoY}% !important;
        width: ${logoWidthMM}mm !important;
        height: ${logoHeightMM}mm !important;
        transform: translate(-50%, -50%) !important;
        opacity: ${logoOpacity / 100} !important;
        z-index: 1 !important;
        pointer-events: none !important;
        object-fit: contain !important;
      }
      
      @media print {
        .label-background-logo {
          opacity: ${logoOpacity / 100} !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    
    document.head.appendChild(labelStyles);
  }
  
  function updateLogos() {
    document.querySelectorAll('.label-background-logo').forEach(logo => logo.remove());
    
    if (!state.logoDataUrl) return;
    
    document.querySelectorAll('.bv-label-page').forEach(page => {
      if (page.classList.contains('bv-shipping-page')) return;
      
      const logo = document.createElement('img');
      logo.className = 'label-background-logo';
      logo.src = state.logoDataUrl;
      page.appendChild(logo);
    });
  }
  
  function revertToOriginal() {
    // 清除自動檢查
    if (state.autoCheckInterval) {
      clearInterval(state.autoCheckInterval);
      state.autoCheckInterval = null;
    }
    
    // 移除 storage 監聽器
    if (state.storageListener) {
      chrome.storage.onChanged.removeListener(state.storageListener);
      state.storageListener = null;
    }
    
    // 移除轉換相關元素
    document.querySelectorAll('.bv-page-container').forEach(el => el.remove());
    document.querySelectorAll('.bv-label-page').forEach(el => el.remove());
    
    // 移除 lazy load observer
    if (state.lazyLoadObserver) {
      state.lazyLoadObserver.disconnect();
    }
    
    // 恢復原始樣式
    if (state.originalBodyStyle) {
      Object.keys(state.originalBodyStyle).forEach(key => {
        document.body.style[key] = state.originalBodyStyle[key];
      });
    }
    
    document.body.classList.remove('bv-converted');
    
    const labelStyle = document.getElementById('bv-label-styles');
    if (labelStyle) labelStyle.remove();
    
    // 恢復原始內容
    document.querySelectorAll('.order-content.bv-original').forEach(content => {
      content.classList.remove('bv-original');
      content.style.display = '';
    });
    
    state.isConverted = false;
    
    updatePanelContent();
    
    showNotification('已恢復為 A4 列印格式');
  }
  
  function updatePanelContent() {
    const panel = document.getElementById('bv-label-control-panel');
    if (panel) {
      panel.innerHTML = getPanelContent();
      setupEventListeners();
      loadSettings();
      
      if (state.isConverted) {
        checkShippingDataStatus();
      }
    }
  }
  
  function saveSettings() {
    const settings = getCurrentSettings();
    
    chrome.storage.local.set({
      bvHighlightQuantity: settings.highlightQuantity,
      bvHideExtraInfo: settings.hideExtraInfo,
      bvHideTableHeader: settings.hideTableHeader,
      bvLabelFontSize: settings.fontSize,
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
      bvIsExtensionEnabled: settings.isExtensionEnabled
    });
  }
  
  function getCurrentSettings() {
    return {
      highlightQuantity: state.highlightQuantity,
      hideExtraInfo: state.hideExtraInfo,
      hideTableHeader: state.hideTableHeader,
      fontSize: document.getElementById('bv-font-size')?.value || state.fontSize,
      logoDataUrl: state.logoDataUrl,
      logoAspectRatio: state.logoAspectRatio,
      logoSize: document.getElementById('logo-size-slider')?.value || '30',
      logoX: document.getElementById('logo-x-slider')?.value || '50',
      logoY: document.getElementById('logo-y-slider')?.value || '50',
      logoOpacity: document.getElementById('logo-opacity-slider')?.value || '20',
      printMode: state.printMode,
      detailSortOrder: state.detailSortOrder,
      shippingSortOrder: state.shippingSortOrder,
      reverseShipping: state.reverseShipping,
      matchMode: state.matchMode,
      isExtensionEnabled: state.isExtensionEnabled
    };
  }
  
  function applyPresetSettings(settings) {
    // 套用設定到狀態
    state.highlightQuantity = settings.highlightQuantity || false;
    state.hideExtraInfo = settings.hideExtraInfo !== false;
    state.hideTableHeader = settings.hideTableHeader || false;
    state.fontSize = settings.fontSize || '11';
    state.logoDataUrl = settings.logoDataUrl || null;
    state.logoAspectRatio = settings.logoAspectRatio || 1;
    state.printMode = settings.printMode || CONFIG.PRINT_MODES.DETAIL_ONLY;
    state.detailSortOrder = settings.detailSortOrder || CONFIG.SORT_ORDERS.ASC;
    state.shippingSortOrder = settings.shippingSortOrder || CONFIG.SORT_ORDERS.ASC;
    state.reverseShipping = settings.reverseShipping || false;
    state.matchMode = settings.matchMode || CONFIG.MATCH_MODES.INDEX;
    
    // 更新 UI 元素
    const highlightQtyCheckbox = document.getElementById('bv-highlight-qty');
    if (highlightQtyCheckbox) highlightQtyCheckbox.checked = state.highlightQuantity;
    
    const hideExtraInfoCheckbox = document.getElementById('bv-hide-extra-info');
    if (hideExtraInfoCheckbox) hideExtraInfoCheckbox.checked = state.hideExtraInfo;
    
    const hideTableHeaderCheckbox = document.getElementById('bv-hide-table-header');
    if (hideTableHeaderCheckbox) hideTableHeaderCheckbox.checked = state.hideTableHeader;
    
    const fontSizeSlider = document.getElementById('bv-font-size');
    if (fontSizeSlider) {
      fontSizeSlider.value = state.fontSize;
      document.getElementById('bv-font-size-value').textContent = parseFloat(state.fontSize).toFixed(1);
      updateRangeProgress(fontSizeSlider);
    }
    
    // 更新列印模式
    const printModeRadio = document.querySelector(`input[name="print-mode"][value="${state.printMode}"]`);
    if (printModeRadio) {
      printModeRadio.checked = true;
      printModeRadio.dispatchEvent(new Event('change'));
    }
    
    // 更新配對模式
    const matchModeRadio = document.querySelector(`input[name="match-mode"][value="${state.matchMode}"]`);
    if (matchModeRadio) {
      matchModeRadio.checked = true;
    }
    
    // 更新排序按鈕
    document.querySelectorAll('.bv-sort-button').forEach(btn => {
      const type = btn.dataset.type;
      const order = btn.dataset.order;
      
      if (type === 'detail' && order === state.detailSortOrder) {
        btn.classList.add('active');
      } else if (type === 'shipping' && order === state.shippingSortOrder) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 更新物流單反序
    const reverseShippingCheckbox = document.getElementById('bv-reverse-shipping');
    if (reverseShippingCheckbox) reverseShippingCheckbox.checked = state.reverseShipping;
    
    // 更新底圖設定
    if (settings.logoDataUrl) {
      const logoPreview = document.getElementById('logo-preview');
      const uploadPrompt = document.getElementById('upload-prompt');
      const logoUploadArea = document.getElementById('logo-upload-area');
      const logoControls = document.getElementById('logo-controls');
      
      if (logoPreview) {
        logoPreview.src = settings.logoDataUrl;
        logoPreview.style.display = 'block';
      }
      if (uploadPrompt) uploadPrompt.style.display = 'none';
      if (logoUploadArea) logoUploadArea.classList.add('has-logo');
      if (logoControls) logoControls.classList.add('active');
    }
    
    const sliders = {
      'logo-size-slider': settings.logoSize || '30',
      'logo-x-slider': settings.logoX || '50',
      'logo-y-slider': settings.logoY || '50',
      'logo-opacity-slider': settings.logoOpacity || '20'
    };
    
    Object.entries(sliders).forEach(([id, value]) => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.value = value;
        document.getElementById(id.replace('-slider', '')).textContent = value + '%';
        updateRangeProgress(slider);
      }
    });
    
    // 更新標籤樣式
    if (state.isConverted) {
      updateLabelStyles();
    }
  }
  
  function loadSettings() {
    chrome.storage.local.get([
      'bvHighlightQuantity',
      'bvHideExtraInfo',
      'bvHideTableHeader',
      'bvLabelFontSize',
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
      'lastSelectedPreset'
    ], (result) => {
      if (result.bvHighlightQuantity !== undefined) {
        state.highlightQuantity = result.bvHighlightQuantity;
        const checkbox = document.getElementById('bv-highlight-qty');
        if (checkbox) checkbox.checked = state.highlightQuantity;
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
  
  function hideOriginalControls() {
    const controls = document.querySelector('.ignore-print');
    if (!controls) return;
    
    // 美化樣式
    const style = document.createElement('style');
    style.id = 'bv-original-controls-style';
    style.textContent = `
      .ignore-print {
        background: rgba(248, 250, 252, 0.95) !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        border-radius: 12px !important;
        padding: 20px !important;
        margin: 20px auto !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
        max-width: 800px !important;
      }
      
      .ignore-print h4 {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #000 !important;
        margin-bottom: 16px !important;
      }
      
      .ignore-print .form-check {
        margin-bottom: 12px !important;
      }
      
      .ignore-print .form-check-label {
        font-size: 14px !important;
        color: rgba(0, 0, 0, 0.7) !important;
        cursor: pointer !important;
      }
      
      .ignore-print .form-check-input {
        cursor: pointer !important;
      }
      
      .ignore-print select {
        background: white !important;
        border: 1px solid rgba(0, 0, 0, 0.1) !important;
        border-radius: 6px !important;
        padding: 4px 8px !important;
        font-size: 14px !important;
      }
      
      /* 10×15 模式下隱藏特定元素 */
      body.bv-converted .ignore-print button[onclick="printPage()"],
      body.bv-converted .ignore-print #baseImageOpacityLabel,
      body.bv-converted .ignore-print label:has(#fontSize) {
        display: none !important;
      }
      
      @media print {
        .ignore-print {
          display: none !important;
        }
      }
    `;
    
    // 移除舊樣式並新增新樣式
    const oldStyle = document.getElementById('bv-original-controls-style');
    if (oldStyle) oldStyle.remove();
    document.head.appendChild(style);
  }
  
  function toggleQuantityHighlight() {
    const checkbox = document.getElementById('bv-highlight-qty');
    if (!checkbox) return;
    
    state.highlightQuantity = checkbox.checked;
    saveSettings();
    
    if (state.highlightQuantity) {
      console.log('啟用數量標示');
      applyQuantityHighlight();
    } else {
      console.log('停用數量標示');
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
        
        // 從右往左數第二個開始尋找純數字的欄位（排除最右邊的價格欄位）
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
      const qty = star.getAttribute('data-qty') || star.textContent;
      parent.textContent = qty;
    });
  }
  
  function updateRangeProgress(range) {
    const value = (range.value - range.min) / (range.max - range.min) * 100;
    range.style.setProperty('--value', value + '%');
  }
  
  function preparePrintStyles() {
    const hiddenElements = [
      '#bv-label-control-panel',
      '.bv-minimized-button',
      '.bv-notification',
      '.ignore-print'
    ];
    
    let printStyle = document.getElementById('bv-print-style');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'bv-print-style';
      document.head.appendChild(printStyle);
    }
    
    printStyle.textContent = `
      @media print {
        ${hiddenElements.join(', ')} {
          display: none !important;
        }
        
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .bv-page-container {
          display: block !important;
        }
      }
    `;
  }
  
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
