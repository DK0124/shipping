// BV SHOP 出貨助手 (完整整合版 v5.2 - 整合7-11抓取邏輯)
(function() {
  'use strict';
  
  // 修正 Material Icons 載入 - 只在出貨明細頁面載入
  function loadMaterialIcons() {
    if (state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT) {
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
    }
  }
  
  const CONFIG = {
    PAGE_TYPES: {
      ORDER_PRINT: 'order_print',
      SHIPPING: 'shipping'
    },
    PROVIDERS: {
      // 超商取貨 - 更新 7-11 的偵測邏輯
      SEVEN: { 
        name: '7-11', 
        domains: ['myship.7-11.com.tw', 'epayment.7-11.com.tw', 'eship.7-11.com.tw'], 
        selector: '.div_frame, table',  // 支援批次列印格式
        type: 'store',
        patterns: {
          order: [/寄件訂單編號[：:]\s*([A-Z0-9]+)/i, /訂單編號[：:]\s*([A-Z0-9]+)/i, /OrderNo[：:]\s*([A-Z0-9]+)/i],
          store: [/取件\s*\n?\s*門市[：:]\s*([^,\n]+)/i, /門市名稱[：:]\s*([^,\n]+)/i, /取件門市[：:]\s*([^,\n]+)/i],
          storeId: [/統一編號[：:]\s*(\d+)/i, /門市店號[：:]\s*(\d+)/i],
          recipient: [/取件人[：:]\s*([^\n]+)/i, /收件人[：:]\s*([^\n]+)/i],
          phone: [/取件人電話[：:]\s*([\d-]+)/i, /電話[：:]\s*([\d-]+)/i],
          barcode: [/物流條碼[：:]\s*([A-Z0-9]+)/i]
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
    
    // 列印模式設定
    printMode: CONFIG.PRINT_MODES.DETAIL_ONLY,
    detailSortOrder: CONFIG.SORT_ORDERS.ASC,
    shippingSortOrder: CONFIG.SORT_ORDERS.ASC,
    reverseShipping: false,  // 物流單反序
    isExtensionEnabled: true,
    
    // 預設字體大小
    fontSize: '11',  // 預設11px
    
    // 除錯模式
    debugMode: false
  };

    // 修改字體載入 - 只在非物流單頁面載入
      function loadGoogleFonts() {
        // 先偵測頁面類型
        detectPageTypeFirst();
        
        // 只在出貨明細頁面載入 Google Fonts
        if (state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT) {
          const fontLink = document.createElement('link');
          fontLink.rel = 'stylesheet';
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
          document.head.appendChild(fontLink);
        }
      }
      
      // 新增：先偵測頁面類型
      function detectPageTypeFirst() {
        const hostname = window.location.hostname;
        
        // 檢查是否為物流單頁面
        for (const [key, provider] of Object.entries(CONFIG.PROVIDERS)) {
          if (provider.domains.some(domain => hostname.includes(domain))) {
            state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
            state.currentProvider = key;
            
            if (key === 'DELIVERY') {
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
            }
            return;
          }
        }
        
        // 檢查是否為出貨明細頁面
        if (hostname.includes('bvshop')) {
          state.currentPageType = CONFIG.PAGE_TYPES.ORDER_PRINT;
        }
      }
  
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
      loadMaterialIcons();
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
        loadMaterialIcons();
        createControlPanel();
        return;
      }
      
      setTimeout(() => {
        const hasOrderContent = document.querySelector('.order-content') || 
                              document.querySelector('[class*="order"]') ||
                              document.body.textContent.includes('訂單編號');
        
        if (hasOrderContent) {
          state.currentPageType = CONFIG.PAGE_TYPES.ORDER_PRINT;
          console.log('✓ 透過內容偵測到出貨明細頁面');
          loadMaterialIcons();
          createControlPanel();
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
    
    // 最小化按鈕 - 只在出貨明細頁面顯示 icon
    const minimizedButton = document.createElement('button');
    minimizedButton.className = 'bv-minimized-button';
    minimizedButton.id = 'bv-minimized-button';
    minimizedButton.innerHTML = state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
      '<span class="material-icons">apps</span>' : 
      '<span class="bv-text-icon">展開</span>';
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
    const fontFamily = state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT 
      ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Noto Sans TC', sans-serif"
      : "-apple-system, BlinkMacSystemFont, 'Microsoft JhengHei', 'Arial', sans-serif";
    
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
      font-family: ${fontFamily};
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
    
    .bv-text-icon {
      font-size: 14px;
      font-weight: 600;
      display: inline-block;
      line-height: 1;
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
    
    .bv-icon-text {
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      display: inline-block;
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
    
    .bv-button-icon-text {
      font-size: 16px;
      font-weight: 700;
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
    
    .bv-notification.info {
      color: #518aff;
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
    }
    
    .bv-qty-star::before {
      content: "▲";
      color: #000;
      font-weight: normal;
      margin-right: 1px;
    }
    
    @media print {
      .bv-qty-star {
        font-weight: 700 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .bv-qty-star::before {
        content: "▲" !important;
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
      content: "change_history";
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
      
      .bv-page-content {
        width: 100%;
        height: 100%;
        position: relative;
        display: block;
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
      
      body.bv-converted .bv-label-page:last-child {
        page-break-after: auto !important;
      }
      
      body.bv-converted .bv-page-content {
        position: relative !important;
        page-break-inside: avoid !important;
        width: 90mm !important;
        height: 140mm !important;
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
      top: 5mm;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 4px 12px;
      border: 1px solid #333;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      white-space: nowrap;
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
    
    /* 商品圖欄位 */
    .bv-product-image-col {
      width: 8mm !important;
      padding: 2px !important;
      vertical-align: top !important;
    }
    
    .bv-product-image-col img {
      width: 7mm !important;
      height: 7mm !important;
      object-fit: cover !important;
      border-radius: 2px;
      display: block;
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
    
    /* 修正新增設定檔輸入區塊 */
    .bv-new-preset-input {
      width: 100%;
      margin-top: 12px;
    }
    
    .bv-new-preset-input > div {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .bv-new-preset-input .bv-glass-input {
      flex: 1;
      min-width: 0; /* 防止溢出 */
    }
    
    .bv-new-preset-input .bv-glass-button {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
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
    
    /* 隱藏多餘的 order-info 欄位 */
    .bv-converted .order-info .row.d-none,
    .bv-label-page .order-info .row.d-none {
      display: none !important;
    }
    
    /* 7-11 物流單截圖樣式 */
    .bv-711-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 2mm;
      width: 100%;
      height: 100%;
    }
    
    .bv-711-section {
      background: white;
      border: 1px solid #ddd;
      overflow: hidden;
      position: relative;
    }
    
    .bv-711-section img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    /* 精簡模式下的訂單資訊樣式 */
    .bv-converted .order-info.bv-simplified,
    .bv-label-page .order-info.bv-simplified {
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      margin-bottom: 6px !important;
    }
    
    .bv-converted .order-info.bv-simplified p,
    .bv-label-page .order-info.bv-simplified p {
      margin: 0 !important;
      font-size: ${parseFloat(state.fontSize) - 1}px !important;
      line-height: 1.4 !important;
    }
    
    /* 備註透明背景 */
    .bv-converted .orderRemark,
    .bv-converted .orderManageRemark,
    .bv-converted .orderPrintRemark,
    .bv-label-page .orderRemark,
    .bv-label-page .orderManageRemark,
    .bv-label-page .orderPrintRemark {
      background-color: transparent !important;
    }
    `;
  }
  
  function getPanelContent() {
    const collapseIcon = state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
      '<span class="bv-collapse-icon"><span class="material-icons">expand_more</span></span>' :
      '<span class="bv-collapse-icon"><span class="bv-icon-text">▼</span></span>';
    
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
    const quantityIcon = state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
      '<span class="material-icons">change_history</span>' : 
      '<span class="bv-icon-text">▲</span>';
    
    return `
      <div class="bv-glass-panel">
        <div class="bv-panel-header">
          <div class="bv-header-content">
            <div class="bv-icon-wrapper">
              ${state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
                '<span class="material-icons">print</span>' : 
                '<span class="bv-icon-text">列印</span>'}
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">A4 格式</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="bv-glass-button bv-minimize-btn" id="bv-minimize-btn">
              ${state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
                '<span class="material-icons">remove</span>' : 
                '<span class="bv-icon-text">－</span>'}
            </button>
          </div>
        </div>
        
        <div class="bv-panel-body">
          <div class="bv-primary-section">
            <button class="bv-primary-button" id="bv-convert-btn">
              <div class="bv-button-icon">
                ${state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
                  '<span class="material-icons">transform</span>' : 
                  '<span class="bv-button-icon-text">轉</span>'}
              </div>
              <div class="bv-button-content">
                <span class="bv-button-title">轉換成 10×15cm</span>
                <span class="bv-button-subtitle">每頁一張標籤格式</span>
              </div>
            </button>
          </div>
          
          <div class="bv-settings-card">
            <h4 class="bv-card-title">
              ${state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT ? 
                '<span class="material-icons">settings</span>' : 
                '<span class="bv-icon-text">⚙</span>'}
              快速設定
            </h4>
            
            <div class="bv-setting-item">
              <div class="bv-setting-info">
                ${quantityIcon}
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
                      <span class="material-icons">change_history</span>
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
                      <div class="bv-mode-desc">依設定順序列印</div>
                    </div>
                  </label>
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
                        <span class="bv-setting-desc">將物流單順序反轉</span>
                      </div>
                    </div>
                    <label class="bv-glass-switch">
                      <input type="checkbox" id="bv-reverse-shipping">
                      <span class="bv-switch-slider"></span>
                    </label>
                  </div>
                  <div class="bv-reverse-shipping-note">請確認是否有配對</div>
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
                  <div>
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
              <span class="bv-icon-text">貨</span>
            </div>
            <div class="bv-title-group">
              <h3 class="bv-panel-title">BV SHOP 出貨助手</h3>
              <span class="bv-panel-subtitle">${providerName}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="bv-glass-button bv-minimize-btn" id="bv-minimize-btn">
              <span class="bv-icon-text">－</span>
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
          <span class="bv-icon-text">印</span>
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
      
      <button class="bv-primary-button" id="bv-fetch-shipping" style="width: 100%; margin-bottom: 12px;">
        <div class="bv-button-icon">
          <span class="bv-icon-text">抓</span>
        </div>
        <div class="bv-button-content">
          <span class="bv-button-title">抓取物流單</span>
          <span class="bv-button-subtitle">從目前頁面擷取</span>
        </div>
      </button>
      
      <button class="bv-secondary-button" id="bv-save-shipping" style="width: 100%;">
        <div class="bv-button-icon">
          <span class="bv-icon-text">存</span>
        </div>
        <div class="bv-button-content">
          <span class="bv-button-title">儲存資料</span>
          <span class="bv-button-subtitle">供明細頁使用</span>
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
  
  // 處理超商物流單截圖 - 整合 7-11 抓取邏輯
  async function captureStoreShipping(element, provider) {
    // 7-11 批次列印特殊處理
    if (provider === 'SEVEN' && element.classList.contains('div_frame')) {
      // 找到正確的截圖容器
      const container = element.closest('td > div') || element.parentElement || element;
      
      return html2canvas(container, {
        scale: 3,  // 提升到 3 倍解析度
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: container.offsetWidth,
        height: container.offsetHeight,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight
      }).then(canvas => {
        return [{
          imageData: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height
        }];
      });
    }
    
    // 7-11 A4 四格格式
    if (provider === 'SEVEN' && is711A4Format(element)) {
      return capture711Sections(element);
    }
    
    // 其他超商：直接截圖
    return html2canvas(element, {
      scale: 3,  // 統一提升解析度
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    }).then(canvas => {
      return [{
        imageData: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      }];
    });
  }
  
  // 檢查是否為 7-11 A4 格式
  function is711A4Format(element) {
    // 檢查是否有四個區塊的特徵
    const tables = element.querySelectorAll('table');
    return tables.length >= 4;
  }
  
  // 截取 7-11 四格
  async function capture711Sections(element) {
    const sections = [];
    const tables = element.querySelectorAll('table');
    
    // 按照上左、上右、下左、下右的順序處理
    const order = [0, 1, 2, 3]; // 假設表格已按正確順序排列
    
    for (const index of order) {
      if (tables[index]) {
        const canvas = await html2canvas(tables[index], {
          scale: 3,  // 高解析度
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });
        
        sections.push({
          imageData: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
          section: index + 1 // 1-4 代表四個區塊
        });
      }
    }
    
    return sections;
  }
  
  // 整合後的資料提取函數
  async function extractShippingData(element, provider) {
    const data = {
      provider: state.currentProvider,
      orderNo: '',
      storeId: '',
      storeName: '',
      recipientName: '',
      recipientPhone: '',
      barcode: '',  // 新增條碼欄位
      html: '',
      timestamp: new Date().toISOString(),
      isBatchPrint: false  // 新增批次列印標記
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
    
    // 使用提供者特定的模式
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
    
    return data.orderNo ? data : null;
  }
  
  // 改進的抓取函數
  async function fetchShippingData() {
    const provider = CONFIG.PROVIDERS[state.currentProvider];
    if (!provider) return;
    
    let elements = [];
    
    // 針對 7-11 的特殊處理
    if (state.currentProvider === 'SEVEN') {
      // 優先尋找 div_frame（批次列印格式）
      const frames = document.querySelectorAll('.div_frame');
      if (frames.length > 0) {
        console.log(`找到 ${frames.length} 個 7-11 批次列印物流單`);
        elements = Array.from(frames);
      } else {
        // 退回到一般選擇器
        elements = document.querySelectorAll(provider.selector);
      }
    } else {
      elements = document.querySelectorAll(provider.selector);
    }
    
    if (elements.length === 0) {
      showNotification('未找到物流單', 'warning');
      return;
    }
    
    const newBatch = {
      id: Date.now(),
      type: 'html',
      provider: state.currentProvider,
      name: `${provider.name} - ${new Date().toLocaleTimeString()}`,
      data: [],
      timestamp: new Date().toISOString()
    };
    
    const processedOrders = new Set();
    
    // 檢查是否需要載入 html2canvas
    if (provider.type === 'store' && typeof html2canvas === 'undefined') {
      await loadHtml2Canvas();
    }
    
    // 顯示進度
    showNotification(`正在抓取 ${elements.length} 張物流單...`, 'info');
    
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const data = await extractShippingData(element, provider);
      
      if (data && data.orderNo && !processedOrders.has(data.orderNo)) {
        processedOrders.add(data.orderNo);
        
        // 如果是超商，進行截圖
        if (provider.type === 'store') {
          try {
            const screenshots = await captureStoreShipping(element, state.currentProvider);
            screenshots.forEach((screenshot, screenshotIndex) => {
              newBatch.data.push({
                ...data,
                ...screenshot,
                index: newBatch.data.length,
                sectionIndex: screenshotIndex
              });
            });
          } catch (err) {
            console.error(`截圖失敗 ${data.orderNo}:`, err);
          }
        } else {
          newBatch.data.push({
            ...data,
            index: newBatch.data.length
          });
        }
      }
    }
    
    if (newBatch.data.length > 0) {
      state.shippingDataBatches.push(newBatch);
      mergeAllBatchData();
      updateBatchList();
      updateShippingCount();
      showNotification(`成功抓取 ${newBatch.data.length} 張物流單`);
    } else {
      showNotification('未抓取到有效的物流單', 'warning');
    }
  }
  
  // 動態載入 html2canvas
  async function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (typeof html2canvas !== 'undefined') {
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
  
  function removeScripts(element) {
    const scripts = element.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    const onclickElements = element.querySelectorAll('[onclick]');
    onclickElements.forEach(el => el.removeAttribute('onclick'));
  }
  
  function saveShippingData() {
    if (state.shippingDataBatches.length === 0) {
      showNotification('沒有資料可儲存', 'warning');
      return;
    }
    
    chrome.storage.local.set({
      shippingDataBatches: state.shippingDataBatches,
      shippingData: state.shippingData,
      pdfShippingData: state.pdfShippingData,
      shippingProvider: state.currentProvider,
      shippingTimestamp: new Date().toISOString()
    }, () => {
      const totalCount = state.shippingData.length + state.pdfShippingData.length;
      showNotification(`已儲存 ${totalCount} 張物流單`);
    });
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
            <p>${providerName} - 可與明細整合列印</p>
          </div>
        `;
      } else {
        statusEl.className = 'bv-integration-status warning';
        statusEl.innerHTML = `
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
        
        // 先創建 pageContainer
        const pageContainer = document.createElement('div');
        pageContainer.className = 'bv-page-container';
        pageContainer.setAttribute('data-order-index', orderIndex);
        pageContainer.setAttribute('data-order-no', orderNo || '');
        orderContent.parentNode.insertBefore(pageContainer, orderContent.nextSibling);
        
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
            createShippingPages(shippingData, orderNo, showOrderLabel, orderIndex, pageContainer);
          }
        }
      });
    }
    
    updateLogos();
    applySortOrder();
  }
  
  function createShippingPages(shippingInfo, orderNo, showOrderLabel, orderIndex, pageContainer) {
    // 處理 7-11 四格的情況
    if (shippingInfo.data.sectionIndex !== undefined) {
      // 找出同一訂單的所有區塊
      const allSections = state.shippingData.filter(d => d.orderNo === orderNo);
      
      if (allSections.length === 4) {
        // 創建一個 A4 格式的頁面，包含四格
        const page = document.createElement('div');
        page.className = 'bv-label-page bv-shipping-page';
        page.style.padding = '5mm';
        page.setAttribute('data-page-type', 'shipping');
        page.setAttribute('data-order-index', orderIndex);
        page.setAttribute('data-order-no', orderNo || '');
        
        const content = document.createElement('div');
        content.className = 'bv-shipping-content';
        
        const grid = document.createElement('div');
        grid.className = 'bv-711-grid';
        
        // 按照順序添加四個區塊
        allSections.sort((a, b) => a.sectionIndex - b.sectionIndex);
        allSections.forEach(section => {
          const sectionDiv = document.createElement('div');
          sectionDiv.className = 'bv-711-section';
          
          const img = document.createElement('img');
          img.src = section.imageData;
          sectionDiv.appendChild(img);
          
          grid.appendChild(sectionDiv);
        });
        
        content.appendChild(grid);
        
        if (showOrderLabel && orderNo) {
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
          page: page
        });
      }
    } else {
      // 一般物流單處理
      const page = createShippingPage(shippingInfo, orderNo, showOrderLabel, orderIndex);
      if (page && pageContainer) {
        pageContainer.appendChild(page);
        state.shippingPages.push({
          orderNo: orderNo,
          index: orderIndex,
          page: page
        });
      }
    }
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
      // 新增空白商品圖標題
      const imageHeader = document.createElement('th');
      imageHeader.className = 'bv-product-image-col';
      imageHeader.textContent = ''; // 空白標題
      headerRow.insertBefore(imageHeader, headerRow.firstChild);
    }
    
    // 處理每個商品列
    const productRows = productTable.querySelectorAll('.list-item');
    productRows.forEach(row => {
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
  
  function createShippingOnlyPages() {
    // 創建純物流單頁面
    const allShippingData = [...state.shippingData, ...state.pdfShippingData];
    const showOrderLabel = false; // 純印物流單時不顯示訂單編號
    
    // 按訂單分組處理 7-11 四格
    const orderGroups = {};
    allShippingData.forEach(data => {
      if (!orderGroups[data.orderNo]) {
        orderGroups[data.orderNo] = [];
      }
      orderGroups[data.orderNo].push(data);
    });
    
    Object.entries(orderGroups).forEach(([orderNo, dataList], index) => {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'bv-page-container';
      pageContainer.setAttribute('data-shipping-index', index);
      
      if (dataList.length === 4 && dataList[0].provider === 'SEVEN') {
        // 7-11 四格處理
        createShippingPages({
          type: 'html',
          data: dataList[0]
        }, orderNo, showOrderLabel, index, pageContainer);
      } else {
        // 一般物流單
        dataList.forEach(data => {
          const shippingInfo = {
            type: data.imageData ? 'pdf' : 'html',
            data: data
          };
          
          const shippingPage = createShippingPage(shippingInfo, orderNo, showOrderLabel, index);
          
          if (shippingPage) {
            pageContainer.appendChild(shippingPage);
            
            state.shippingPages.push({
              orderNo: orderNo,
              index: index,
              page: shippingPage
            });
          }
        });
      }
      
      document.body.appendChild(pageContainer);
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
        type: allShippingData[index].imageData ? 'pdf' : 'html',
        data: allShippingData[index]
      };
    }
    
    return null;
  }
  
  function createShippingPage(shippingInfo, orderNo, showOrderLabel, orderIndex) {
    const page = document.createElement('div');
    page.className = 'bv-label-page bv-shipping-page';
    page.style.padding = '5mm';
    page.setAttribute('data-page-type', 'shipping');
    page.setAttribute('data-order-index', orderIndex);
    page.setAttribute('data-order-no', orderNo || '');
    
    const content = document.createElement('div');
    content.className = 'bv-shipping-content';
    
    // 如果是超商物流單，需要特殊處理
    const isStore = shippingInfo.data.provider && 
                   CONFIG.PROVIDERS[shippingInfo.data.provider]?.type === 'store';
    
    if (shippingInfo.type === 'pdf' || shippingInfo.data.imageData) {
      const img = document.createElement('img');
      img.src = shippingInfo.data.imageData;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
      `;
      content.appendChild(img);
    } else {
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
  
  // 修正精簡模式處理函數
  function processExtraInfoHiding(container) {
    const orderInfo = container.querySelector('.order-info');
    if (!orderInfo) return;
    
    // 創建新的精簡版容器
    const simplifiedInfo = document.createElement('div');
    simplifiedInfo.className = 'order-info bv-simplified';
    
    // 定義要保留的資訊及其對應的模式
    const keepInfo = {
      '訂單編號': /訂單編號[：:]\s*(.+)/,
      '物流編號': /物流編號[：:]\s*(.+)/,
      '送貨方式': /送貨方式[：:]\s*(.+)/,
      '收件人': /收件人(?!地址|電話)[：:]\s*(.+)/
    };
    
    // 從原始內容中提取資訊
    const fullText = orderInfo.textContent;
    
    Object.entries(keepInfo).forEach(([label, pattern]) => {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        const p = document.createElement('p');
        p.textContent = `${label}：${match[1].trim()}`;
        simplifiedInfo.appendChild(p);
      }
    });
    
    // 替換原有的 order-info
    orderInfo.parentNode.replaceChild(simplifiedInfo, orderInfo);
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
    
    // 根據頁面類型使用不同的字體
    const fontFamily = state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT
      ? "'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif"
      : "'Microsoft JhengHei', Arial, sans-serif";
    
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
        font-family: ${fontFamily} !important;
        font-size: ${fontSize}px !important;
      }
      
      .bv-label-page * {
        font-family: ${fontFamily} !important;
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
      
      /* 精簡模式樣式 */
      .bv-converted .order-info.bv-simplified,
      .bv-label-page .order-info.bv-simplified {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        margin-bottom: 6px !important;
      }
      
      .bv-converted .order-info.bv-simplified p,
      .bv-label-page .order-info.bv-simplified p {
        margin: 0 !important;
        font-size: ${parseFloat(fontSize) - 1}px !important;
        line-height: 1.4 !important;
      }
      
      .bv-converted .order-info:not(.bv-simplified),
      .bv-label-page .order-info:not(.bv-simplified) {
        margin: 0 0 6px 0 !important;
      }
      
      .bv-converted .order-info:not(.bv-simplified) .row,
      .bv-label-page .order-info:not(.bv-simplified) .row {
        display: flex !important;
        margin: 0 0 3px 0 !important;
      }
      
      .bv-converted .order-info:not(.bv-simplified) .col-6,
      .bv-label-page .order-info:not(.bv-simplified) .col-6 {
        flex: 1 !important;
        padding: 0 1mm !important;
      }
      
      .bv-converted .order-info:not(.bv-simplified) .col-6:first-child,
      .bv-label-page .order-info:not(.bv-simplified) .col-6:first-child {
        padding-left: 0 !important;
      }
      
      .bv-converted .order-info:not(.bv-simplified) .col-6:last-child,
      .bv-label-page .order-info:not(.bv-simplified) .col-6:last-child {
        padding-right: 0 !important;
      }
      
      .bv-converted .order-info:not(.bv-simplified) p,
      .bv-label-page .order-info:not(.bv-simplified) p {
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
      
      /* 備註透明背景 */
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
        background-color: transparent !important;
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
  
  // 初始化順序調整
  loadGoogleFonts();  // 條件性載入字體
  initLazyLoad();
  detectCurrentPage();
  
})();
  
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
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.ORDER_PRINT) {
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = type === 'success' ? 'check_circle' : 
                        type === 'warning' ? 'warning' : 
                        type === 'error' ? 'error' : 
                        type === 'info' ? 'info' : 'check_circle';
      notification.appendChild(icon);
    } else {
      // 物流單頁面使用文字圖標
      const textIcon = document.createElement('span');
      textIcon.className = 'bv-text-icon';
      textIcon.style.marginRight = '8px';
      textIcon.textContent = type === 'success' ? '✓' : 
                            type === 'warning' ? '⚠' : 
                            type === 'error' ? '✗' : 
                            type === 'info' ? 'ℹ' : '✓';
      notification.appendChild(textIcon);
    }
    
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
  
  // PDF 相關函數
  async function handleMultiplePdfUpload(files) {
    const uploadPrompt = document.getElementById('bv-pdf-upload-prompt');
    const pdfInfo = document.getElementById('bv-pdf-info');
    const filenameEl = document.getElementById('bv-pdf-filename');
    const pagesEl = document.getElementById('bv-pdf-pages');
    const progressEl = document.getElementById('bv-conversion-progress');
    const progressFill = document.getElementById('bv-conversion-progress-fill');
    const statusEl = document.getElementById('bv-conversion-status');
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    
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
      
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        
        statusEl.textContent = `處理檔案 ${fileIndex + 1}/${files.length}...`;
        progressFill.style.width = `${(fileIndex / files.length * 100)}%`;
        
        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        
        if (typeof pdfjsLib !== 'undefined') {
          if (chrome && chrome.runtime && chrome.runtime.getURL) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
          }
          
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
            
            const imageData = canvas.toDataURL('image/png');
            
            newBatch.data.push({
              provider: 'DELIVERY',
              subType: state.deliverySubType || 'UNKNOWN',
              orderNo: `PDF-${Date.now()}-${i}`,
              imageData: imageData,
              width: canvas.width,
              height: canvas.height,
              timestamp: new Date().toISOString(),
              index: totalPages++,
              fileName: file.name,
              pageNumber: i
            });
            
            statusEl.textContent = `轉換第 ${i}/${pdf.numPages} 頁...`;
            const progress = ((fileIndex + i/pdf.numPages) / files.length * 100);
            progressFill.style.width = `${progress}%`;
          }
        }
      }
      
      if (newBatch.data.length > 0) {
        state.shippingDataBatches.push(newBatch);
        mergeAllBatchData();
        updateBatchList();
        
        if (pagesEl) pagesEl.textContent = `共 ${totalPages} 頁`;
        
        chrome.storage.local.set({
          shippingDataBatches: state.shippingDataBatches,
          pdfShippingData: state.pdfShippingData,
          shippingSubType: state.deliverySubType,
          shippingTimestamp: new Date().toISOString()
        }, () => {
          checkShippingDataStatus();
          showNotification(`成功載入 ${totalPages} 頁物流單`);
        });
      }
      
    } catch (error) {
      console.error('PDF 處理錯誤:', error);
      showNotification('PDF 處理失敗', 'error');
    } finally {
      if (progressEl) {
        setTimeout(() => {
          progressEl.classList.remove('active');
          progressFill.style.width = '0';
        }, 1000);
      }
    }
  }
  
  function mergeAllBatchData() {
    // 合併所有批次的資料到主陣列
    state.shippingData = [];
    state.pdfShippingData = [];
    
    state.shippingDataBatches.forEach(batch => {
      if (batch.type === 'pdf') {
        state.pdfShippingData.push(...batch.data);
      } else {
        state.shippingData.push(...batch.data);
      }
    });
  }
  
  function updateBatchList() {
    const batchListEl = document.getElementById('bv-batch-list');
    const shippingBatchListEl = document.getElementById('bv-shipping-batch-list');
    
    if (batchListEl && state.isConverted) {
      if (state.shippingDataBatches.length > 0) {
        batchListEl.style.display = 'block';
        batchListEl.innerHTML = state.shippingDataBatches.map((batch, index) => `
          <div class="bv-batch-item" data-batch-id="${batch.id}">
            <div class="bv-batch-item-info">
              <div class="bv-batch-item-name">${batch.name}</div>
              <div class="bv-batch-item-count">${batch.data.length} 張</div>
            </div>
            <div class="bv-batch-actions">
              <div class="bv-batch-order">
                <button class="bv-batch-order-btn" data-action="up" data-batch-id="${batch.id}" ${index === 0 ? 'disabled' : ''}>
                  <span class="material-icons">arrow_upward</span>
                </button>
                <button class="bv-batch-order-btn" data-action="down" data-batch-id="${batch.id}" ${index === state.shippingDataBatches.length - 1 ? 'disabled' : ''}>
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
          btn.addEventListener('click', function() {
            const batchId = parseInt(this.dataset.batchId);
            const action = this.dataset.action;
            moveBatch(batchId, action);
          });
        });
        
        batchListEl.querySelectorAll('.delete').forEach(btn => {
          btn.addEventListener('click', function() {
            const batchId = parseInt(this.dataset.batchId);
            deleteBatch(batchId);
          });
        });
      } else {
        batchListEl.style.display = 'none';
      }
    }
    
    if (shippingBatchListEl && state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      if (state.shippingDataBatches.length > 0) {
        shippingBatchListEl.style.display = 'block';
        shippingBatchListEl.innerHTML = state.shippingDataBatches.map((batch, index) => `
          <div class="bv-batch-item" data-batch-id="${batch.id}">
            <div class="bv-batch-item-info">
              <div class="bv-batch-item-name">${batch.name}</div>
              <div class="bv-batch-item-count">${batch.data.length} 張</div>
            </div>
          </div>
        `).join('');
      } else {
        shippingBatchListEl.style.display = 'none';
      }
    }
  }
  
  function moveBatch(batchId, direction) {
    const currentIndex = state.shippingDataBatches.findIndex(b => b.id === batchId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < state.shippingDataBatches.length) {
      const temp = state.shippingDataBatches[currentIndex];
      state.shippingDataBatches[currentIndex] = state.shippingDataBatches[newIndex];
      state.shippingDataBatches[newIndex] = temp;
      
      mergeAllBatchData();
      updateBatchList();
      saveShippingDataToStorage();
      
      if (state.isConverted) {
        updatePreview();
      }
    }
  }
  
  function deleteBatch(batchId) {
    if (confirm('確定要刪除這批物流單嗎？')) {
      state.shippingDataBatches = state.shippingDataBatches.filter(b => b.id !== batchId);
      mergeAllBatchData();
      updateBatchList();
      saveShippingDataToStorage();
      checkShippingDataStatus();
      
      if (state.isConverted) {
        updatePreview();
      }
      
      showNotification('已刪除批次');
    }
  }
  
  function saveShippingDataToStorage() {
    chrome.storage.local.set({
      shippingDataBatches: state.shippingDataBatches,
      shippingData: state.shippingData,
      pdfShippingData: state.pdfShippingData,
      shippingProvider: state.currentProvider,
      shippingTimestamp: new Date().toISOString()
    });
  }
  
  function updateShippingCount() {
    const countEl = document.getElementById('bv-shipping-count');
    if (countEl) {
      const totalCount = state.shippingData.length + state.pdfShippingData.length;
      countEl.textContent = totalCount;
    }
  }
  
  function loadShippingData() {
    chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'pdfShippingData'], (result) => {
      if (result.shippingDataBatches) {
        state.shippingDataBatches = result.shippingDataBatches;
        mergeAllBatchData();
      } else if (result.shippingData || result.pdfShippingData) {
        // 相容舊版資料
        state.shippingData = result.shippingData || [];
        state.pdfShippingData = result.pdfShippingData || [];
      }
      
      updateShippingCount();
      updateBatchList();
    });
  }
  
  function clearShippingData() {
    if (confirm('確定要清除所有物流單資料嗎？')) {
      state.shippingDataBatches = [];
      state.shippingData = [];
      state.pdfShippingData = [];
      
      chrome.storage.local.remove([
        'shippingDataBatches',
        'shippingData', 
        'pdfShippingData', 
        'shippingProvider',
        'shippingSubType',
        'shippingTimestamp'
      ], () => {
        updateBatchList();
        checkShippingDataStatus();
        
        // 清除 PDF 上傳顯示
        const uploadPrompt = document.getElementById('bv-pdf-upload-prompt');
        const pdfInfo = document.getElementById('bv-pdf-info');
        const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
        const pdfInput = document.getElementById('bv-pdf-input');
        
        if (uploadPrompt) uploadPrompt.style.display = 'flex';
        if (pdfInfo) pdfInfo.style.display = 'none';
        if (pdfUploadArea) pdfUploadArea.classList.remove('has-file');
        if (pdfInput) pdfInput.value = '';
        
        if (state.isConverted) {
          updatePreview();
        }
        
        showNotification('已清除物流單資料');
      });
    }
  }
  
  function sortDetailPages() {
    const containers = Array.from(document.querySelectorAll('.bv-page-container'));
    
    containers.forEach(container => {
      // 只處理有明細頁的容器
      if (container.querySelector('.bv-label-page[data-page-type="detail"]')) {
        const orderIndex = parseInt(container.getAttribute('data-order-index'));
        container.style.order = state.detailSortOrder === CONFIG.SORT_ORDERS.DESC ? 
          -orderIndex : orderIndex;
      }
    });
  }
  
  function sortShippingPages() {
    const containers = Array.from(document.querySelectorAll('.bv-page-container'));
    
    containers.forEach(container => {
      const shippingIndex = parseInt(container.getAttribute('data-shipping-index'));
      container.style.order = state.shippingSortOrder === CONFIG.SORT_ORDERS.DESC ? 
        -shippingIndex : shippingIndex;
    });
  }
  
  function reverseShippingPages() {
    // 在手動配對模式下反轉物流單順序
    const containers = Array.from(document.querySelectorAll('.bv-page-container'));
    const totalOrders = containers.length;
    
    containers.forEach((container, index) => {
      const shippingPages = container.querySelectorAll('.bv-label-page[data-page-type="shipping"]');
      
      shippingPages.forEach(page => {
        // 更新物流單的 order 索引為反序
        const reverseIndex = totalOrders - 1 - index;
        page.setAttribute('data-order-index', reverseIndex);
      });
    });
  }
  
  function updatePreview() {
    if (!state.isConverted) return;
    
    state.previewCache.clear();
    handlePagination();
    updateLabelStyles();
    
    if (state.highlightQuantity) {
      setTimeout(() => {
        applyQuantityHighlight();
      }, 100);
    }
  }
  
  function updatePrintModeUI() {
    const sortOptions = document.getElementById('bv-sort-options');
    const detailSortGroup = document.getElementById('bv-detail-sort-group');
    const shippingSort = document.getElementById('bv-shipping-sort');
    const reverseOption = document.getElementById('bv-reverse-shipping-option');
    const orderLabelSetting = document.getElementById('bv-order-label-setting');
    const orderLabelSwitch = document.getElementById('bv-order-label-switch');
    
    // 更新選中狀態
    document.querySelectorAll('.bv-mode-option').forEach(option => {
      const radio = option.querySelector('input[type="radio"]');
      if (radio.checked) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
    
    // 根據模式顯示/隱藏控件
    if (state.printMode === CONFIG.PRINT_MODES.DETAIL_ONLY) {
      if (sortOptions) sortOptions.style.display = 'flex';
      if (detailSortGroup) detailSortGroup.style.display = 'block';
      if (shippingSort) shippingSort.style.display = 'none';
      if (reverseOption) reverseOption.style.display = 'none';
      if (orderLabelSetting) orderLabelSetting.style.display = 'none';
    } else if (state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY) {
      if (sortOptions) sortOptions.style.display = 'flex';
      if (detailSortGroup) detailSortGroup.style.display = 'none';
      if (shippingSort) shippingSort.style.display = 'block';
      if (reverseOption) reverseOption.style.display = 'none';
      if (orderLabelSetting) orderLabelSetting.style.display = 'none';
    } else if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
      if (sortOptions) sortOptions.style.display = 'flex';
      if (detailSortGroup) detailSortGroup.style.display = 'block';
      if (shippingSort) shippingSort.style.display = 'none';
      if (reverseOption) reverseOption.style.display = 'block';
      if (orderLabelSetting) orderLabelSetting.style.display = 'block';
      
      // 檢查是否有物流單資料
      const hasShippingData = state.shippingData.length > 0 || state.pdfShippingData.length > 0;
      if (orderLabelSwitch) {
        if (hasShippingData) {
          orderLabelSwitch.classList.remove('disabled');
          const checkbox = orderLabelSwitch.querySelector('input');
          if (checkbox) checkbox.disabled = false;
        } else {
          orderLabelSwitch.classList.add('disabled');
          const checkbox = orderLabelSwitch.querySelector('input');
          if (checkbox) {
            checkbox.disabled = true;
            checkbox.checked = false;
          }
        }
      }
    }
  }
  
  function setupEventListeners() {
    // 轉換按鈕
    const convertBtn = document.getElementById('bv-convert-btn');
    if (convertBtn) {
      convertBtn.addEventListener('click', convertToLabelFormat);
    }
    
    // 還原按鈕
    const revertBtn = document.getElementById('bv-revert-btn');
    if (revertBtn) {
      revertBtn.addEventListener('click', revertToOriginal);
    }
    
    // 最小化按鈕
    const minimizeBtn = document.getElementById('bv-minimize-btn');
    const minimizedBtn = document.getElementById('bv-minimized-button');
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        const panel = document.getElementById('bv-label-control-panel');
        if (panel) {
          panel.classList.add('minimized');
          state.isPanelMinimized = true;
          chrome.storage.local.set({ bvPanelMinimized: true });
          
          if (minimizedBtn) {
            minimizedBtn.style.display = 'flex';
          }
        }
      });
    }
    
    if (minimizedBtn) {
      minimizedBtn.addEventListener('click', () => {
        const panel = document.getElementById('bv-label-control-panel');
        if (panel) {
          panel.classList.remove('minimized');
          state.isPanelMinimized = false;
          chrome.storage.local.set({ bvPanelMinimized: false });
          minimizedBtn.style.display = 'none';
        }
      });
    }
    
    // 數量標示
    const highlightQtyCheckbox = document.getElementById('bv-highlight-qty');
    if (highlightQtyCheckbox) {
      highlightQtyCheckbox.addEventListener('change', (e) => {
        state.highlightQuantity = e.target.checked;
        saveSettings();
        if (state.isConverted) {
          updatePreview();
        } else {
          toggleQuantityHighlight(e);
        }
      });
    }
    
    // 精簡模式
    const hideExtraCheckbox = document.getElementById('bv-hide-extra-info');
    if (hideExtraCheckbox) {
      hideExtraCheckbox.addEventListener('change', (e) => {
        state.hideExtraInfo = e.target.checked;
        saveSettings();
        updatePreview();
      });
    }
    
    // 隱藏標題
    const hideHeaderCheckbox = document.getElementById('bv-hide-table-header');
    if (hideHeaderCheckbox) {
      hideHeaderCheckbox.addEventListener('change', (e) => {
        state.hideTableHeader = e.target.checked;
        saveSettings();
        updatePreview();
      });
    }
    
    // 文字大小滑桿
    const fontSizeSlider = document.getElementById('bv-font-size');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', function() {
        document.getElementById('bv-font-size-value').textContent = parseFloat(this.value).toFixed(1);
        updateRangeProgress(this);
        saveSettings();
        updateLabelStyles();
      });
    }
    
    // 套用並列印按鈕
    const applyPrintBtn = document.getElementById('bv-apply-print');
    if (applyPrintBtn) {
      applyPrintBtn.addEventListener('click', () => {
        preparePrintStyles();
        setTimeout(() => {
          window.print();
        }, 500);
      });
    }
    
    // 物流單相關
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      const fetchBtn = document.getElementById('bv-fetch-shipping');
      const saveBtn = document.getElementById('bv-save-shipping');
      
      if (fetchBtn) {
        fetchBtn.addEventListener('click', fetchShippingData);
      }
      
      if (saveBtn) {
        saveBtn.addEventListener('click', saveShippingData);
      }
    }
    
    // PDF 上傳
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    const pdfInput = document.getElementById('bv-pdf-input');
    
    if (pdfUploadArea && pdfInput) {
      pdfUploadArea.addEventListener('click', () => {
        pdfInput.click();
      });
      
      pdfInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          // 檢查是否已載入 PDF.js
          if (typeof pdfjsLib === 'undefined') {
            await loadPdfJs();
          }
          await handleMultiplePdfUpload(files);
        }
      });
    }
    
    // 清除物流單按鈕
    const clearShippingBtn = document.getElementById('bv-clear-shipping');
    if (clearShippingBtn) {
      clearShippingBtn.addEventListener('click', clearShippingData);
    }
    
    // 列印模式選擇
    const printModeRadios = document.querySelectorAll('input[name="print-mode"]');
    printModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.printMode = e.target.value;
        updatePrintModeUI();
        saveSettings();
        updatePreview();
      });
    });
    
    // 排序按鈕
    const sortButtons = document.querySelectorAll('.bv-sort-button');
    sortButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        const type = this.dataset.type;
        const order = this.dataset.order;
        
        // 更新狀態
        if (type === 'detail') {
          state.detailSortOrder = order;
          document.querySelectorAll('.bv-sort-button[data-type="detail"]').forEach(b => {
            b.classList.remove('active');
          });
        } else {
          state.shippingSortOrder = order;
          document.querySelectorAll('.bv-sort-button[data-type="shipping"]').forEach(b => {
            b.classList.remove('active');
          });
        }
        
        this.classList.add('active');
        saveSettings();
        updatePreview();
      });
    });
    
    // 物流單反序
    const reverseShippingCheckbox = document.getElementById('bv-reverse-shipping');
    if (reverseShippingCheckbox) {
      reverseShippingCheckbox.addEventListener('change', (e) => {
        state.reverseShipping = e.target.checked;
        saveSettings();
        updatePreview();
      });
    }
    
    // 物流單顯示訂單編號
    const showOrderLabelCheckbox = document.getElementById('bv-show-order-label');
    if (showOrderLabelCheckbox) {
      showOrderLabelCheckbox.addEventListener('change', (e) => {
        saveSettings();
        updatePreview();
      });
    }
    
    // 設定收合功能
    setupCollapsibleCards();
    
    // 設定檔系統
    if (state.isConverted) {
      initPresetSystem();
      initLogoUpload();
    }
    
    // 原始控制項監聽
    observeOriginalControls();
  }
  
  // 載入 PDF.js
  async function loadPdfJs() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('pdf.min.js');
      script.onload = () => {
        console.log('PDF.js 載入成功');
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // 初始化
  detectCurrentPage();
  
})();
