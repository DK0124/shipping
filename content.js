// BV SHOP 出貨助手 (完整整合版 v6.0 - 重構版)
(function() {
  'use strict';
  
  // ============================================
  // 1. 常數配置 (CONFIG)
  // ============================================
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

    // 標籤格式
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
    }
  };

  // ============================================
  // 2. 狀態物件 (state)
  // ============================================
  let state = {
    isConverted: false,
    highlightQuantity: false,
    hideExtraInfo: true,
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
    previewTimeout: null,
    storageListener: null,
    tempShippingData: null,
    tempPdfShippingData: null,
    useReversedShipping: false,
    deliverySubType: null
  };

  // ============================================
  // 3. 初始化函數
  // ============================================
  
  // 3.1 載入字體和圖標
  function initResources() {
    // Material Icons
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
    
    // Noto Sans TC 字體
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
    document.head.appendChild(fontLink);
  }

  // 3.2 初始化 Lazy Load
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

  // ============================================
  // 4. 頁面類型檢測
  // ============================================
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

  // 4.6 安全的元素操作函數
  function safeSetStyle(element, property, value) {
    if (element && element.style) {
      try {
        element.style[property] = value;
      } catch (e) {
        console.error('Error setting style:', e);
      }
    }
  }
  
  function safeHideElement(element) {
    safeSetStyle(element, 'display', 'none');
  }
  
  function safeShowElement(element) {
    safeSetStyle(element, 'display', '');
  }

  // 4.4 初始化拖曳功能
  function initDragFunction() {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    const panel = document.getElementById('bv-label-control-panel');
    if (!panel) return;
    
    // 只有標題區域可以拖曳
    const header = panel.querySelector('.bv-panel-header');
    if (!header) return;
    
    header.style.cursor = 'move';
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      if (e.target.closest('button')) return; // 如果點擊的是按鈕，不開始拖曳
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        panel.style.transition = 'none';
      }
    }
    
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        // 限制拖曳範圍在視窗內
        const rect = panel.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        currentX = Math.min(Math.max(0, currentX), maxX);
        currentY = Math.min(Math.max(0, currentY), maxY);
        
        panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    }
    
    function dragEnd(e) {
      initialX = currentX;
      initialY = currentY;
      
      isDragging = false;
      panel.style.transition = '';
      
      // 儲存位置
      chrome.storage.local.set({
        bvPanelPosition: { x: currentX, y: currentY }
      });
    }
    
    // 載入儲存的位置
    chrome.storage.local.get(['bvPanelPosition'], (result) => {
      if (result.bvPanelPosition) {
        xOffset = result.bvPanelPosition.x || 0;
        yOffset = result.bvPanelPosition.y || 0;
        panel.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    });
  }
  
  // 4.5 初始化物流單模式
  function initShippingMode() {
    // 監聽 storage 變化，用於在物流單頁面即時更新狀態
    state.storageListener = (changes, namespace) => {
      if (namespace !== 'local') return;
      
      // 監聽物流單資料變化
      if (changes.shippingDataBatches || changes.shippingData || changes.pdfShippingData) {
        // 重新載入批次資料
        chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'pdfShippingData'], (result) => {
          if (result.shippingDataBatches) {
            state.shippingDataBatches = result.shippingDataBatches;
            mergeAllBatchData();
          } else {
            state.shippingData = result.shippingData || [];
            state.pdfShippingData = result.pdfShippingData || [];
          }
          
          updateShippingCount();
          updateBatchList();
          
          // 如果在明細頁面，檢查物流單狀態
          if (state.currentPageType === CONFIG.PAGE_TYPES.DETAIL && state.isConverted) {
            checkShippingDataStatus();
            updatePreview();
          }
        });
      }
    };
    
    chrome.storage.onChanged.addListener(state.storageListener);
    
    // 初始載入物流單資料
    chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'pdfShippingData'], (result) => {
      if (result.shippingDataBatches) {
        state.shippingDataBatches = result.shippingDataBatches;
        mergeAllBatchData();
      } else {
        state.shippingData = result.shippingData || [];
        state.pdfShippingData = result.pdfShippingData || [];
      }
      
      if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
        updateShippingCount();
        updateBatchList();
      }
    });
  }

  // ============================================
  // 5. 控制面板創建與管理
  // ============================================
  
  // 5.1 創建控制面板
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

  // 5.2 取得面板樣式
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
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.95);
      padding: 6px 12px;
      border: 1px solid #333;
      border-radius: 4px;
      font-size: 12px;
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
    
    /* 確保原始 orderProductImage 在原位置隱藏 */
    .bv-converted .list-item-name .orderProductImage,
    .bv-label-page .list-item-name .orderProductImage,
    .bv-converted .list-item-name img:not(.bv-product-img),
    .bv-label-page .list-item-name img:not(.bv-product-img) {
      display: none !important;
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
  }

  // 5.3 取得面板內容
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

  // 5.4 A4 模式面板內容
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

  // 5.5 標籤模式面板內容
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
              <span class="bv-panel-subtitle">${CONFIG.LABEL_FORMATS[state.labelFormat].name} 標籤</span>
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
            <!-- 格式選擇卡片 -->
            <div class="bv-settings-card" data-section="format">
              <h4 class="bv-card-title">
                <span class="material-icons">aspect_ratio</span>
                標籤格式
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-format-selector">
                  <label class="bv-format-option ${state.labelFormat === '10x15' ? 'selected' : ''}">
                    <input type="radio" name="label-format" value="10x15" ${state.labelFormat === '10x15' ? 'checked' : ''}>
                    <div class="bv-format-info">
                      <div class="bv-format-title">10×15cm</div>
                      <div class="bv-format-desc">標準貼紙格式</div>
                    </div>
                  </label>
                  
                  <label class="bv-format-option ${state.labelFormat === '10x10' ? 'selected' : ''}">
                    <input type="radio" name="label-format" value="10x10" ${state.labelFormat === '10x10' ? 'checked' : ''}>
                    <div class="bv-format-info">
                      <div class="bv-format-title">10×10cm</div>
                      <div class="bv-format-desc">正方形貼紙格式</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            <!-- 物流整合卡片 -->
            <div class="bv-settings-card" data-section="integration">
              <h4 class="bv-card-title">
                <span class="material-icons">integration_instructions</span>
                物流單整合
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-integration-status" id="bv-integration-status">
                  <span class="material-icons">warning</span>
                  <div class="bv-status-info">
                    <h4>尚無物流單資料</h4>
                    <p>請至物流單頁面抓取或上傳 PDF</p>
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
                
                <button class="bv-glass-button" id="bv-clear-shipping" style="margin-top: 12px; width: 100%; display: none;">
                  <span class="material-icons">clear</span>
                  清除物流單資料
                </button>
              </div>
            </div>
            
            <!-- 出貨明細設定卡片 -->
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
                
                <!-- 底圖設定 -->
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
            
            <!-- 列印模式卡片 -->
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
            
            <!-- 設定檔管理卡片 -->
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

  // 5.6 物流單頁面面板內容
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

  // 5.7 宅配頁面內容
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

  // 5.8 一般物流單頁面內容
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

  // ============================================
  // 6. 事件監聽
  // ============================================
  
  // 6.1 設置事件監聽器
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

  // 6.2 物流單頁面事件監聽
  function setupShippingEventListeners() {
    const fetchSaveBtn = document.getElementById('bv-fetch-save-shipping');
    
    if (fetchSaveBtn) {
      fetchSaveBtn.addEventListener('click', fetchAndSaveShippingData);
    }
    
    // 宅配頁面的列印按鈕
    const deliveryPrintBtn = document.getElementById('bv-delivery-print');
    if (deliveryPrintBtn) {
      deliveryPrintBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  // 6.3 標籤模式事件監聽
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

  // 6.4 設置可收縮卡片
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

  // ============================================
  // 7. 核心功能（轉換標籤格式、物流單處理、列印等）
  // ============================================
  
  // 7.1 轉換為標籤格式
  function convertToLabelFormat() {
    if (state.isConverted) return;
    
    // 移除包含 baseImage 的訂單內容（通常是空白頁）
    document.querySelectorAll('.order-content:has(.baseImage)').forEach(e => e.remove());

    // 設定 body 格式 class
    document.body.classList.add(`format-${state.labelFormat}`);

    // 初始化頁面樣式
    updatePageStyles();
    
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
    document.body.classList.add(`format-${state.labelFormat}`);
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

  // 7.2 處理分頁（修復版）
  function handlePagination() {
    // 清除現有快取
    state.previewCache.clear();
    
    document.querySelectorAll('.bv-page-container').forEach(container => container.remove());
    document.querySelectorAll('.bv-label-page').forEach(page => page.remove());
    
    // 根據選擇的格式獲取尺寸
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
    const paddingPx = format.padding * 3.78;
    const pageHeight = format.heightPx;
    const pageWidth = format.widthPx;
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
          
          // 重要：先處理精簡模式（移除不需要的資訊）
          if (state.hideExtraInfo) {
            processExtraInfoHiding(orderContentClone);
          }
          
          // 然後處理商品圖片
          const showProductImage = document.querySelector('.ignore-print #showProductImage');
          if (showProductImage && showProductImage.checked) {
            processProductImages(orderContentClone);
          }
          
          // 處理數量標示
          if (state.highlightQuantity) {
            applyQuantityHighlightToElement(orderContentClone);
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
              width: ${pageWidth - paddingPx * 2}px;
            `;
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            
            const elementHeight = wrapper.offsetHeight;
            document.body.removeChild(wrapper);
            
            if (elementHeight === 0) return;
            
            if (!currentPage || (currentHeight + elementHeight > contentHeight && currentHeight > 0)) {
              // 創建新頁面時使用正確的格式
              currentPage = document.createElement('div');
              currentPage.className = `bv-label-page format-${state.labelFormat}`;
              currentPage.style.padding = `${format.padding}mm`;
              currentPage.style.width = `${pageWidth}px`;
              currentPage.style.height = `${pageHeight}px`;
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

  // 新增：對單個元素套用數量標示
  function applyQuantityHighlightToElement(element) {
    const qtyElements = element.querySelectorAll('.list-item-qty');
    
    qtyElements.forEach(qtyEl => {
      const text = qtyEl.textContent.trim();
      const qtyMatch = text.match(/\d+/);
      
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[0]);
        
        if (qty >= 2) {
          qtyEl.classList.add('bv-qty-highlight');
          
          // 檢查是否已有指示器
          if (!qtyEl.querySelector('.bv-qty-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'bv-qty-indicator';
            indicator.textContent = '▲';
            qtyEl.insertBefore(indicator, qtyEl.firstChild);
          }
        }
      }
    });
  }

  // 7.3 創建純物流單頁面
  function createShippingOnlyPages(shippingDataToUse, pdfDataToUse) {
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
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

  // 7.4 創建物流單頁面
  function createShippingPage(shippingInfo, orderNo, showOrderLabel, orderIndex) {
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
    
    const page = document.createElement('div');
    page.className = `bv-label-page bv-shipping-page format-${state.labelFormat}`;
    page.style.padding = '0';
    page.style.width = `${format.widthPx}px`;
    page.style.height = `${format.heightPx}px`;
    page.setAttribute('data-page-type', 'shipping');
    page.setAttribute('data-order-index', orderIndex);
    page.setAttribute('data-order-no', orderNo || '');
    
    const content = document.createElement('div');
    content.className = 'bv-shipping-content';
    
    // 根據格式調整內容縮放
    if (state.labelFormat === '10x10') {
      content.style.cssText = `
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        background: white;
        margin: 0;
        box-sizing: border-box;
        transform: scale(1);
        transform-origin: center center;
      `;
    }
    
    // 如果是超商物流單，需要特殊處理
    const isStore = shippingInfo.data.provider && 
                   CONFIG.PROVIDERS[shippingInfo.data.provider]?.type === 'store';
    
    // 使用截圖或 PDF 圖片
    if (shippingInfo.type === 'pdf' || shippingInfo.data.imageData) {
      const img = document.createElement('img');
      img.src = shippingInfo.data.imageData;
      
      // 根據格式調整圖片樣式
      if (state.labelFormat === '10x10') {
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: contain;
          max-width: 100%;
          max-height: 100%;
        `;
      } else {
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: contain;
        `;
      }
      
      content.appendChild(img);
    } else if (shippingInfo.data.html) {
      // 舊版 HTML 顯示（相容性）
      const wrapper = document.createElement('div');
      wrapper.className = isStore ? 'bv-store-shipping-content' : 'bv-shipping-wrapper-inner';
      wrapper.innerHTML = shippingInfo.data.html;
      
      if (!isStore) {
        const scale = state.labelFormat === '10x10' ? 0.6 : 0.85;
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
      
      // 10×10 格式下調整標籤大小
      if (state.labelFormat === '10x10') {
        label.style.cssText = `
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(255, 255, 255, 0.95);
          padding: 4px 8px;
          border: 1px solid #333;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          z-index: 1000;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          white-space: nowrap;
        `;
      }
      
      content.appendChild(label);
    }
    
    page.appendChild(content);
    
    return page;
  }

  // 7.5 創建 7-11 批次頁面
  function createSevenElevenBatchPages(shippingInfo, orderNo, showOrderLabel, orderIndex, pageContainer) {
    if (!shippingInfo.data.batchHtml) return;
    
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
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
    page.className = `bv-label-page bv-shipping-page format-${state.labelFormat}`;
    page.style.padding = '0';
    page.style.width = `${format.widthPx}px`;
    page.style.height = `${format.heightPx}px`;
    page.setAttribute('data-page-type', 'shipping');
    page.setAttribute('data-order-index', orderIndex);
    page.setAttribute('data-order-no', orderNo || '');
    
    const content = document.createElement('div');
    content.className = 'bv-shipping-content';
    
    // 10×10 格式下需要更多縮放
    if (state.labelFormat === '10x10') {
      content.style.cssText = `
        transform: scale(1);
        transform-origin: center center;
        width: 150%;
        height: 150%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.67);
      `;
    }
    
    content.innerHTML = shippingInfo.data.batchHtml;
    
    // 處理訂單編號標籤（只在第一格顯示）
    if (showOrderLabel && orderNo && shippingInfo.data.sectionIndex === 0) {
      const label = document.createElement('div');
      label.className = 'bv-order-label';
      label.textContent = `訂單：${orderNo}`;
      
      if (state.labelFormat === '10x10') {
        label.style.fontSize = '10px';
        label.style.padding = '4px 8px';
      }
      
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

  // 7.6 抓取並儲存物流單資料
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

  // 7.7 處理多個 PDF 上傳
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
      
      // 處理 PDF 檔案
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

  // 7.8 準備列印（根據模式）
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

  // 7.9 準備僅明細列印
  function prepareDetailOnlyPrint() {
    // 隱藏所有物流單頁面
    document.querySelectorAll('.bv-shipping-page').forEach(page => {
      page.closest('.bv-page-container').style.display = 'none';
    });
    
    // 根據排序重新排列明細頁面
    sortDetailPages();
  }

  // 7.10 準備僅物流單列印
  function prepareShippingOnlyPrint() {
    // 隱藏所有明細頁面
    document.querySelectorAll('.bv-label-page:not(.bv-shipping-page)').forEach(page => {
      page.closest('.bv-page-container').style.display = 'none';
    });
    
    // 根據排序重新排列物流單頁面
    sortShippingPages();
  }

  // 7.11 準備手動配對列印
  function prepareManualMatchPrint() {
    // 手動配對：使用選定的排序
    sortDetailPages();
    
    // 如果啟用物流單反序，則反轉物流單
    if (state.reverseShipping) {
      reverseShippingPages();
    }
  }

  // 7.12 恢復到原始格式
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

  // ============================================
  // 8. 工具函數（提取物流資訊、儲存設定等）
  // ============================================
  
  // 8.1 提取訂單資訊
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

  // 8.2 提取物流單資料
  function extractShippingData(element, provider = null) {
    const data = {
      provider: state.currentProvider,
      orderNo: '',
      storeId: '',
      storeName: '',
      recipientName: '',
      recipientPhone: '',
      barcode: '',
      logisticsNo: '',
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
          data.orderNo = match[1].trim();
          data.logisticsNo = match[1].trim();
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

  // 8.3 從文字中提取物流編號
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

  // 8.4 尋找配對的物流單資料（按物流編號）
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

  // 8.5 合併所有批次資料
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

  // 8.6 更新批次列表
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
      
      // 顯示清除按鈕
      const clearBtn = document.getElementById('bv-clear-shipping');
      if (clearBtn) clearBtn.style.display = 'block';
    } else if (batchListEl) {
      batchListEl.style.display = 'none';
      const clearBtn = document.getElementById('bv-clear-shipping');
      if (clearBtn) clearBtn.style.display = 'none';
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

  // 8.7 處理批次操作
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

  // 8.8 儲存設定
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
      bvIsExtensionEnabled: settings.isExtensionEnabled
    });
  }

  // 8.9 取得當前設定
  function getCurrentSettings() {
    return {
      highlightQuantity: state.highlightQuantity,
      hideExtraInfo: state.hideExtraInfo,
      hideTableHeader: state.hideTableHeader,
      fontSize: document.getElementById('bv-font-size')?.value || state.fontSize,
      labelFormat: state.labelFormat,
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

  // 8.10 載入設定
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
      'lastSelectedPreset'
    ], (result) => {
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

  // 8.11 其他工具函數
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
        if (sortOptions) sortOptions.style.display = 'block';
        if (detailSortGroup) detailSortGroup.style.display = 'block';
        if (shippingSort) shippingSort.style.display = 'none';
        if (reverseShippingOption) reverseShippingOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'none';
        }
        break;
        
      case CONFIG.PRINT_MODES.SHIPPING_ONLY:
        if (sortOptions) sortOptions.style.display = 'block';
        if (detailSortGroup) detailSortGroup.style.display = 'none';
        if (shippingSort) shippingSort.style.display = 'block';
        if (reverseShippingOption) reverseShippingOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'none';
        }
        break;
        
      case CONFIG.PRINT_MODES.MANUAL_MATCH:
        if (sortOptions) sortOptions.style.display = 'block';
        if (detailSortGroup) detailSortGroup.style.display = 'block';
        if (shippingSort) shippingSort.style.display = 'none';
        if (reverseShippingOption) reverseShippingOption.style.display = 'block';
        if (matchModeSelector) matchModeSelector.style.display = 'block';
        
        // 檢查是否有物流單資料來決定是否啟用訂單標籤功能
        const hasShippingData = state.shippingData.length > 0 || state.pdfShippingData.length > 0;
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'block';
          
          if (hasShippingData) {
            if (orderLabelSwitch) orderLabelSwitch.classList.remove('disabled');
            if (orderLabelCheckbox) orderLabelCheckbox.disabled = false;
          } else {
            if (orderLabelSwitch) orderLabelSwitch.classList.add('disabled');
            if (orderLabelCheckbox) {
              orderLabelCheckbox.disabled = true;
              orderLabelCheckbox.checked = false;
            }
          }
        }
        break;
    }
  }

  function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.bv-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `bv-notification ${type}`;
    notification.innerHTML = `
      <span class="material-icons">${type === 'success' ? 'check_circle' : 'warning'}</span>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  function toggleQuantityHighlight(e) {
    state.highlightQuantity = e.target.checked;
    chrome.storage.local.set({ bvHighlightQuantity: state.highlightQuantity });
    
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    } else {
      removeQuantityHighlight();
    }
  }

  function applyQuantityHighlight() {
    const qtyElements = document.querySelectorAll('.list-item-qty');
    
    qtyElements.forEach(element => {
      const text = element.textContent.trim();
      const qtyMatch = text.match(/\d+/);
      
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[0]);
        
        element.classList.remove('bv-qty-highlight');
        const existingIndicator = element.querySelector('.bv-qty-indicator');
        if (existingIndicator) {
          existingIndicator.remove();
        }
        
        if (qty >= 2) {
          element.classList.add('bv-qty-highlight');
          
          const indicator = document.createElement('span');
          indicator.className = 'bv-qty-indicator';
          indicator.textContent = '▲';
          element.insertBefore(indicator, element.firstChild);
        }
      }
    });
  }

  function removeQuantityHighlight() {
    document.querySelectorAll('.bv-qty-highlight').forEach(element => {
      element.classList.remove('bv-qty-highlight');
    });
    
    document.querySelectorAll('.bv-qty-indicator').forEach(indicator => {
      indicator.remove();
    });
  }

  function updateLabelStyles() {
    let labelStyle = document.getElementById('bv-label-styles');
    if (!labelStyle) {
      labelStyle = document.createElement('style');
      labelStyle.id = 'bv-label-styles';
      document.head.appendChild(labelStyle);
    }
    
    const fontSize = document.getElementById('bv-font-size')?.value || state.fontSize || '11';
    const hideTableHeader = state.hideTableHeader ? 'none' : 'table-row';
    
    labelStyle.innerHTML = `
      .bv-label-page {
        font-size: ${fontSize}px !important;
      }
      
      .bv-label-page * {
        font-size: inherit !important;
      }
      
      .bv-label-page .list-title {
        display: ${hideTableHeader} !important;
      }
      
      .bv-label-page .order-total,
      .bv-label-page .order-cost {
        font-size: ${parseFloat(fontSize) + 1}px !important;
        font-weight: bold !important;
      }
      
      /* 固定行高以確保一致性 */
      .bv-label-page .list-item td {
        line-height: 1.3;
        padding: 2px 4px;
      }
      
      /* 確保商品圖片大小一致 */
      .bv-label-page .bv-product-img {
        width: 7mm !important;
        height: 7mm !important;
        object-fit: cover !important;
        display: block !important;
      }
    `;
  }

  function updatePageStyles() {
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
    
    // 更新所有標籤頁面的尺寸
    document.querySelectorAll('.bv-label-page').forEach(page => {
      page.classList.remove('format-10x15', 'format-10x10');
      page.classList.add(`format-${state.labelFormat}`);
      page.style.width = `${format.widthPx}px`;
      page.style.height = `${format.heightPx}px`;
      page.style.padding = `${format.padding}mm`;
    });
    
    // 更新物流單頁面的特殊處理
    document.querySelectorAll('.bv-shipping-page').forEach(page => {
      page.style.padding = '0';
      
      // 調整內容縮放
      const content = page.querySelector('.bv-shipping-content');
      if (content) {
        if (state.labelFormat === '10x10') {
          content.style.transform = 'scale(1)';
          content.style.transformOrigin = 'center center';
        }
      }
    });
  }

  function triggerOriginalPageUpdate() {
    const fontSize = document.querySelector('.ignore-print #fontSize');
    if (fontSize && typeof $ !== 'undefined') {
      $(fontSize).trigger('change');
    }
  }

  function processExtraInfoHiding(orderContent) {
    if (!state.hideExtraInfo || !orderContent) return;
    
    // 在精簡模式下，只保留特定欄位
    const fieldsToKeep = ['訂單編號', '物流編號', '送貨方式', '收件人'];
    
    // 找到商品明細表格之前的所有內容
    const children = Array.from(orderContent.children);
    let itemListIndex = -1;
    
    // 找到商品列表的起始位置
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      
      const hasItemList = child.classList && (
        child.classList.contains('list-title') ||
        child.classList.contains('list-item') ||
        child.classList.contains('order-items') ||
        child.classList.contains('product-list')
      );
      
      if (hasItemList || (child.querySelector && child.querySelector('.list-title, .list-item'))) {
        itemListIndex = i;
        break;
      }
    }
    
    // 處理商品列表之前的元素
    const elementsBeforeList = itemListIndex >= 0 ? children.slice(0, itemListIndex) : children;
    
    elementsBeforeList.forEach(element => {
      if (!element) return;
      
      const elementText = element.textContent || '';
      let shouldKeep = false;
      
      // 檢查是否包含需要保留的欄位
      for (const field of fieldsToKeep) {
        if (elementText.includes(field)) {
          shouldKeep = true;
          break;
        }
      }
      
      if (!shouldKeep) {
        safeHideElement(element);
      } else {
        // 如果元素需要保留，進一步處理其子元素
        processChildElements(element, fieldsToKeep);
      }
    });
    
    // 隱藏特定的區塊
    const selectorsToHide = [
      '.buyer-info',
      '.order-memo', 
      '.order-cost',
      '.order-note',
      '.payment-info',
      '.shipping-memo',
      '.internal-note'
    ];
    
    selectorsToHide.forEach(selector => {
      try {
        const elements = orderContent.querySelectorAll(selector);
        elements.forEach(element => safeHideElement(element));
      } catch (e) {
        console.error('Error with selector:', selector, e);
      }
    });
  }
  
  // 處理子元素
  function processChildElements(parentElement, fieldsToKeep) {
    if (!parentElement || !parentElement.children) return;
    
    const children = Array.from(parentElement.children);
    
    children.forEach(child => {
      if (!child) return;
      
      const childText = child.textContent || '';
      let shouldKeep = false;
      
      // 檢查子元素是否包含需要保留的資訊
      for (const field of fieldsToKeep) {
        if (childText.includes(field)) {
          shouldKeep = true;
          break;
        }
      }
      
      if (!shouldKeep) {
        // 檢查是否為包含值的元素（例如：欄位標籤的下一個兄弟元素）
        const prevSibling = child.previousElementSibling;
        if (prevSibling) {
          const prevText = prevSibling.textContent || '';
          for (const field of fieldsToKeep) {
            if (prevText.includes(field)) {
              shouldKeep = true;
              break;
            }
          }
        }
      }
      
      if (!shouldKeep) {
        safeHideElement(child);
      } else if (child.children && child.children.length > 0) {
        // 遞迴處理子元素
        processChildElements(child, fieldsToKeep);
      }
    });
  }
  
  // 處理子元素
  function processChildElements(parentElement, fieldsToKeep) {
    if (!parentElement || !parentElement.children) return;
    
    const children = Array.from(parentElement.children);
    
    children.forEach(child => {
      if (!child) return;
      
      const childText = child.textContent || '';
      let shouldKeep = false;
      
      // 檢查子元素是否包含需要保留的資訊
      for (const field of fieldsToKeep) {
        if (childText.includes(field)) {
          shouldKeep = true;
          break;
        }
      }
      
      if (!shouldKeep) {
        // 檢查是否為包含值的元素（例如：欄位標籤的下一個兄弟元素）
        const prevSibling = child.previousElementSibling;
        if (prevSibling) {
          const prevText = prevSibling.textContent || '';
          for (const field of fieldsToKeep) {
            if (prevText.includes(field)) {
              shouldKeep = true;
              break;
            }
          }
        }
      }
      
      if (!shouldKeep) {
        safeHideElement(child);
      } else if (child.children && child.children.length > 0) {
        // 遞迴處理子元素
        processChildElements(child, fieldsToKeep);
      }
    });
  }
    
  // 更新設定卡片中的說明文字
  function getLabelModePanelContent(collapseIcon) {
    return `
      <div class="bv-glass-panel">
        <!-- ... 前面的內容保持不變 ... -->
        
        <div class="bv-panel-body">
          <!-- ... 其他卡片保持不變 ... -->
          
          <!-- 出貨明細設定卡片 -->
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
                      <span class="bv-setting-desc">只顯示訂單、物流、送貨方式、收件人</span>
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
              
              <!-- ... 底圖設定保持不變 ... -->
            </div>
          </div>
          
          <!-- ... 其他卡片保持不變 ... -->
        </div>
      </div>
    `;
  }

  function preparePrintStyles() {
    let printStyle = document.getElementById('bv-print-styles');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'bv-print-styles';
      document.head.appendChild(printStyle);
    }
    
    printStyle.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        
        .bv-label-page,
        .bv-label-page * {
          visibility: visible !important;
        }
        
        .bv-label-control-panel,
        .bv-minimized-button,
        .order-content.bv-original,
        .ignore-print {
          display: none !important;
        }
        
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        
        .bv-label-page {
          page-break-after: always !important;
          page-break-inside: avoid !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .bv-page-container {
          display: block !important;
          page-break-inside: avoid !important;
        }
        
        .bv-product-img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        @page {
          size: ${CONFIG.LABEL_FORMATS[state.labelFormat].width}mm ${CONFIG.LABEL_FORMATS[state.labelFormat].height}mm;
          margin: 0;
        }
      }
    `;
  }

  function updateRangeProgress(slider) {
    const min = slider.min;
    const max = slider.max;
    const val = slider.value;
    const percentage = ((val - min) / (max - min)) * 100;
    
    slider.style.setProperty('--progress', `${percentage}%`);
  }

  function restoreCollapsedStates() {
    Object.entries(state.collapsedSections).forEach(([sectionId, isCollapsed]) => {
      if (isCollapsed) {
        const card = document.querySelector(`[data-section="${sectionId}"]`);
        if (card) {
          card.classList.add('collapsed');
        }
      }
    });
  }

  function observeOriginalControls() {
    // 監聽所有 BV SHOP 原有控制項的變化
    const originalFontSize = document.querySelector('.ignore-print #fontSize');
    const originalShowImage = document.querySelector('.ignore-print #showProductImage');
    
    if (originalFontSize) {
      // 同步字體大小變化
      const observer = new MutationObserver(() => {
        const size = originalFontSize.value.replace('px', '');
        const slider = document.getElementById('bv-font-size');
        if (slider && Math.abs(parseFloat(slider.value) - parseFloat(size)) > 0.5) {
          slider.value = size;
          document.getElementById('bv-font-size-value').textContent = parseFloat(size).toFixed(1);
          updateRangeProgress(slider);
          updateLabelStyles();
          saveSettings();
        }
      });
      
      observer.observe(originalFontSize, {
        attributes: true,
        attributeFilter: ['value']
      });
      
      // 雙向同步：當我們的滑桿改變時，也更新原始控制項
      const fontSizeSlider = document.getElementById('bv-font-size');
      if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', function() {
          const closestSize = Math.round(parseFloat(this.value));
          originalFontSize.value = closestSize + 'px';
          if (typeof $ !== 'undefined') {
            $(originalFontSize).trigger('change');
          }
        });
      }
    }
    
    // 監聽所有原始功能的變化並自動更新預覽
    const allControls = document.querySelectorAll('.ignore-print input[type="checkbox"], .ignore-print select, .ignore-print input[type="radio"]');
    allControls.forEach(control => {
      control.addEventListener('change', () => {
        // 延遲更新以確保原始功能先執行
        setTimeout(() => {
          updatePreview();
        }, 100);
      });
    });
    
    // 特別處理商品圖片顯示選項
    if (originalShowImage) {
      const observer = new MutationObserver(() => {
        updatePreview();
      });
      
      observer.observe(originalShowImage, {
        attributes: true,
        attributeFilter: ['checked']
      });
    }
  }

  function checkShippingDataStatus() {
    chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'pdfShippingData', 'shippingProvider', 'shippingTimestamp'], (result) => {
      const integrationStatus = document.getElementById('bv-integration-status');
      const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
      
      if (!integrationStatus) return;
      
      // 載入批次資料
      if (result.shippingDataBatches) {
        state.shippingDataBatches = result.shippingDataBatches;
        mergeAllBatchData();
      } else if (result.shippingData || result.pdfShippingData) {
        // 相容舊版資料格式
        state.shippingData = result.shippingData || [];
        state.pdfShippingData = result.pdfShippingData || [];
      }
      
      const totalCount = state.shippingData.length + state.pdfShippingData.length;
      
      if (totalCount > 0) {
        const providerName = result.shippingProvider ? 
          (CONFIG.PROVIDERS[result.shippingProvider]?.name || '物流單') : 
          '物流單';
        
        let timeAgo = '';
        if (result.shippingTimestamp) {
          const timestamp = new Date(result.shippingTimestamp);
          const now = new Date();
          const diffMinutes = Math.floor((now - timestamp) / 60000);
          
          if (diffMinutes < 60) {
            timeAgo = `${diffMinutes} 分鐘前`;
          } else if (diffMinutes < 1440) {
            timeAgo = `${Math.floor(diffMinutes / 60)} 小時前`;
          } else {
            timeAgo = `${Math.floor(diffMinutes / 1440)} 天前`;
          }
        }
        
        integrationStatus.innerHTML = `
          <span class="material-icons" style="color: #4caf50;">check_circle</span>
          <div class="bv-status-info">
            <h4 style="color: #2e7d32;">已載入 ${totalCount} 張${providerName}</h4>
            <p>${timeAgo ? `於 ${timeAgo} 抓取` : ''}</p>
          </div>
        `;
        
        // 隱藏 PDF 上傳區域
        if (pdfUploadArea) {
          pdfUploadArea.style.display = 'none';
        }
        
        // 顯示批次列表
        updateBatchList();
        
        // 更新列印模式UI
        updatePrintModeUI();
      } else {
        // 顯示 PDF 上傳區域
        if (pdfUploadArea) {
          pdfUploadArea.style.display = 'block';
        }
      }
    });
  }

  function updateShippingCount() {
    const countEl = document.getElementById('bv-shipping-count');
    if (countEl) {
      const totalCount = state.shippingData.length + state.pdfShippingData.length;
      countEl.textContent = totalCount;
    }
  }

  function removeScripts(element) {
    element.querySelectorAll('script').forEach(script => script.remove());
    element.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
    element.querySelectorAll('[onload]').forEach(el => el.removeAttribute('onload'));
    element.querySelectorAll('[onerror]').forEach(el => el.removeAttribute('onerror'));
  }

  function initPresetSystem() {
    const presetList = document.getElementById('bv-preset-list');
    const addPresetBtn = document.getElementById('bv-add-preset');
    const newPresetRow = document.getElementById('bv-new-preset-row');
    const newPresetName = document.getElementById('bv-new-preset-name');
    const confirmSaveBtn = document.getElementById('bv-confirm-save');
    const cancelSaveBtn = document.getElementById('bv-cancel-save');
    
    if (!presetList || !addPresetBtn) return;
    
    // 載入預設列表
    loadPresets();
    
    // 新增預設檔
    addPresetBtn.addEventListener('click', () => {
      newPresetRow.style.display = 'block';
      addPresetBtn.style.display = 'none';
      newPresetName.value = '';
      newPresetName.focus();
    });
    
    // 確認儲存
    confirmSaveBtn.addEventListener('click', saveNewPreset);
    newPresetName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveNewPreset();
    });
    
    // 取消儲存
    cancelSaveBtn.addEventListener('click', () => {
      newPresetRow.style.display = 'none';
      addPresetBtn.style.display = 'block';
    });
    
    function saveNewPreset() {
      const name = newPresetName.value.trim();
      if (!name) {
        showNotification('請輸入設定檔名稱', 'warning');
        return;
      }
      
      const presetKey = `bvPreset_${Date.now()}`;
      const settings = getCurrentSettings();
      
      chrome.storage.local.get(['bvPresetList'], (result) => {
        const presetList = result.bvPresetList || [];
        presetList.push({
          key: presetKey,
          name: name,
          timestamp: new Date().toISOString()
        });
        
        const saveData = {
          bvPresetList: presetList,
          [presetKey]: settings
        };
        
        chrome.storage.local.set(saveData, () => {
          showNotification(`已儲存設定檔「${name}」`);
          loadPresets();
          newPresetRow.style.display = 'none';
          addPresetBtn.style.display = 'block';
        });
      });
    }
  }

  function loadPresets() {
    chrome.storage.local.get(['bvPresetList', 'lastSelectedPreset'], (result) => {
      const presetList = document.getElementById('bv-preset-list');
      if (!presetList) return;
      
      const presets = result.bvPresetList || [];
      const lastSelected = result.lastSelectedPreset;
      
      if (presets.length === 0) {
        presetList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px; font-size: 13px;">尚無設定檔</div>';
        return;
      }
      
      presetList.innerHTML = presets.map(preset => `
        <div class="bv-preset-item ${preset.key === lastSelected ? 'active' : ''}" data-key="${preset.key}">
          <div class="bv-preset-name">${preset.name}</div>
          <div class="bv-preset-actions">
            <button class="bv-preset-action-btn delete" data-key="${preset.key}">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      `).join('');
      
      // 綁定點擊事件
      presetList.querySelectorAll('.bv-preset-name').forEach(el => {
        el.addEventListener('click', function() {
          const key = this.parentElement.dataset.key;
          loadPreset(key);
        });
      });
      
      // 綁定刪除事件
      presetList.querySelectorAll('.bv-preset-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const key = this.dataset.key;
          deletePreset(key);
        });
      });
    });
  }

  function loadPreset(key) {
    chrome.storage.local.get([key], (result) => {
      const settings = result[key];
      if (!settings) {
        showNotification('設定檔不存在', 'warning');
        return;
      }
      
      applyPresetSettings(settings);
      
      // 更新選中狀態
      document.querySelectorAll('.bv-preset-item').forEach(item => {
        item.classList.toggle('active', item.dataset.key === key);
      });
      
      // 記錄最後選擇的預設檔
      chrome.storage.local.set({ lastSelectedPreset: key });
      
      showNotification('已載入設定檔');
    });
  }

  function applyPresetSettings(settings) {
    // 套用各項設定
    if (settings.highlightQuantity !== undefined) {
      state.highlightQuantity = settings.highlightQuantity;
      const checkbox = document.getElementById('bv-highlight-qty');
      if (checkbox) checkbox.checked = settings.highlightQuantity;
    }
    
    if (settings.hideExtraInfo !== undefined) {
      state.hideExtraInfo = settings.hideExtraInfo;
      const checkbox = document.getElementById('bv-hide-extra-info');
      if (checkbox) checkbox.checked = settings.hideExtraInfo;
    }
    
    if (settings.hideTableHeader !== undefined) {
      state.hideTableHeader = settings.hideTableHeader;
      const checkbox = document.getElementById('bv-hide-table-header');
      if (checkbox) checkbox.checked = settings.hideTableHeader;
    }
    
    if (settings.fontSize !== undefined) {
      const slider = document.getElementById('bv-font-size');
      if (slider) {
        slider.value = settings.fontSize;
        document.getElementById('bv-font-size-value').textContent = parseFloat(settings.fontSize).toFixed(1);
        updateRangeProgress(slider);
      }
    }
    
    if (settings.logoSize !== undefined) {
      const slider = document.getElementById('logo-size-slider');
      if (slider) {
        slider.value = settings.logoSize;
        document.getElementById('logo-size').textContent = settings.logoSize + '%';
        updateRangeProgress(slider);
      }
    }
    
    if (settings.logoX !== undefined) {
      const slider = document.getElementById('logo-x-slider');
      if (slider) {
        slider.value = settings.logoX;
        document.getElementById('logo-x').textContent = settings.logoX + '%';
        updateRangeProgress(slider);
      }
    }
    
    if (settings.logoY !== undefined) {
      const slider = document.getElementById('logo-y-slider');
      if (slider) {
        slider.value = settings.logoY;
        document.getElementById('logo-y').textContent = settings.logoY + '%';
        updateRangeProgress(slider);
      }
    }
    
    if (settings.logoOpacity !== undefined) {
      const slider = document.getElementById('logo-opacity-slider');
      if (slider) {
        slider.value = settings.logoOpacity;
        document.getElementById('logo-opacity').textContent = settings.logoOpacity + '%';
        updateRangeProgress(slider);
      }
    }
    
    if (settings.printMode !== undefined) {
      state.printMode = settings.printMode;
      const radio = document.querySelector(`input[name="print-mode"][value="${settings.printMode}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
    }
    
    if (settings.detailSortOrder !== undefined) {
      state.detailSortOrder = settings.detailSortOrder;
      const btn = document.querySelector(`.bv-sort-button[data-type="detail"][data-order="${settings.detailSortOrder}"]`);
      if (btn) btn.click();
    }
    
    if (settings.shippingSortOrder !== undefined) {
      state.shippingSortOrder = settings.shippingSortOrder;
      const btn = document.querySelector(`.bv-sort-button[data-type="shipping"][data-order="${settings.shippingSortOrder}"]`);
      if (btn) btn.click();
    }
    
    if (settings.reverseShipping !== undefined) {
      state.reverseShipping = settings.reverseShipping;
      const checkbox = document.getElementById('bv-reverse-shipping');
      if (checkbox) checkbox.checked = settings.reverseShipping;
    }
    
    if (settings.matchMode !== undefined) {
      state.matchMode = settings.matchMode;
      const radio = document.querySelector(`input[name="match-mode"][value="${settings.matchMode}"]`);
      if (radio) radio.checked = true;
    }
    
    // 更新預覽
    if (state.isConverted) {
      updateLabelStyles();
      updateLogos();
      updatePreview();
    }
    
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    }
    
    saveSettings();
  }

  function deletePreset(key) {
    if (!confirm('確定要刪除這個設定檔嗎？')) return;
    
    chrome.storage.local.get(['bvPresetList'], (result) => {
      const presetList = result.bvPresetList || [];
      const updatedList = presetList.filter(p => p.key !== key);
      
      chrome.storage.local.set({ bvPresetList: updatedList }, () => {
        chrome.storage.local.remove([key], () => {
          showNotification('已刪除設定檔');
          loadPresets();
        });
      });
    });
  }

  function initLogoUpload() {
    const logoUploadArea = document.getElementById('logo-upload-area');
    const logoInput = document.getElementById('logo-input');
    const logoPreview = document.getElementById('logo-preview');
    const uploadPrompt = document.getElementById('upload-prompt');
    const logoControls = document.getElementById('logo-controls');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    
    if (!logoUploadArea || !logoInput) return;
    
    // 點擊上傳區域
    logoUploadArea.addEventListener('click', () => {
      logoInput.click();
    });
    
    // 檔案選擇
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // 檢查檔案大小（限制 2MB）
      if (file.size > 2 * 1024 * 1024) {
        showNotification('檔案大小不能超過 2MB', 'warning');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          state.logoDataUrl = e.target.result;
          state.logoAspectRatio = img.width / img.height;
          
          logoPreview.src = state.logoDataUrl;
          logoPreview.style.display = 'block';
          uploadPrompt.style.display = 'none';
          logoUploadArea.classList.add('has-logo');
          logoControls.classList.add('active');
          
          saveSettings();
          updateLogos();
          
          showNotification('底圖已上傳');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
    
    // 控制項
    const sliders = {
      'logo-size-slider': { label: 'logo-size', suffix: '%', callback: updateLogos },
      'logo-x-slider': { label: 'logo-x', suffix: '%', callback: updateLogos },
      'logo-y-slider': { label: 'logo-y', suffix: '%', callback: updateLogos },
      'logo-opacity-slider': { label: 'logo-opacity', suffix: '%', callback: updateLogos }
    };
    
    Object.entries(sliders).forEach(([id, config]) => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.addEventListener('input', function() {
          document.getElementById(config.label).textContent = this.value + config.suffix;
          updateRangeProgress(this);
          config.callback();
          saveSettings();
        });
      }
    });
    
    // 移除底圖
    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', () => {
        state.logoDataUrl = null;
        state.logoAspectRatio = 1;
        
        logoPreview.style.display = 'none';
        uploadPrompt.style.display = 'flex';
        logoUploadArea.classList.remove('has-logo');
        logoControls.classList.remove('active');
        logoInput.value = '';
        
        saveSettings();
        updateLogos();
        
        showNotification('底圖已移除');
      });
    }
  }

  function updateLogos() {
    // 移除現有的底圖
    document.querySelectorAll('.bv-logo-watermark').forEach(el => el.remove());
    
    if (!state.logoDataUrl || !state.isConverted) return;
    
    const size = document.getElementById('logo-size-slider')?.value || '30';
    const x = document.getElementById('logo-x-slider')?.value || '50';
    const y = document.getElementById('logo-y-slider')?.value || '50';
    const opacity = document.getElementById('logo-opacity-slider')?.value || '20';
    
    // 為每個頁面添加底圖
    document.querySelectorAll('.bv-label-page:not(.bv-shipping-page)').forEach(page => {
      const logo = document.createElement('div');
      logo.className = 'bv-logo-watermark';
      logo.style.cssText = `
        position: absolute;
        width: ${size}%;
        height: ${size}%;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
        background-image: url(${state.logoDataUrl});
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        opacity: ${opacity / 100};
        pointer-events: none;
        z-index: 1;
      `;
      
      // 插入到頁面內容之前
      page.insertBefore(logo, page.firstChild);
    });
  }

  function sortDetailPages() {
    const order = state.detailSortOrder;
    const containers = Array.from(document.querySelectorAll('.bv-page-container[data-order-index]'));
    
    containers.sort((a, b) => {
      const indexA = parseInt(a.getAttribute('data-order-index'));
      const indexB = parseInt(b.getAttribute('data-order-index'));
      return order === 'asc' ? indexA - indexB : indexB - indexA;
    });
    
    containers.forEach(container => {
      document.body.appendChild(container);
    });
  }

  function sortShippingPages() {
    const order = state.shippingSortOrder;
    const containers = Array.from(document.querySelectorAll('.bv-page-container[data-shipping-index]'));
    
    containers.sort((a, b) => {
      const indexA = parseInt(a.getAttribute('data-shipping-index'));
      const indexB = parseInt(b.getAttribute('data-shipping-index'));
      return order === 'asc' ? indexA - indexB : indexB - indexA;
    });
    
    containers.forEach(container => {
      document.body.appendChild(container);
    });
  }

  function reverseShippingPages() {
    // 反轉物流單頁面順序
    const containers = Array.from(document.querySelectorAll('.bv-page-container'));
    
    containers.forEach(container => {
      const shippingPages = Array.from(container.querySelectorAll('.bv-shipping-page'));
      shippingPages.reverse().forEach(page => {
        container.appendChild(page);
      });
    });
  }

  function applySortOrder() {
    // 根據當前列印模式套用排序
    if (state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY) {
      sortShippingPages();
    } else {
      sortDetailPages();
    }
  }

  function showMatchingResults() {
    const resultsEl = document.getElementById('bv-matching-results');
    if (!resultsEl || !state.matchingResults) return;
    
    const matchedCount = state.matchingResults.filter(r => r.matched).length;
    const totalCount = state.matchingResults.length;
    
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
      <div class="bv-matching-results-title">
        配對結果：${matchedCount}/${totalCount} 張成功配對
      </div>
      ${state.matchingResults.filter(r => !r.matched).map(r => `
        <div class="bv-matching-result-item">
          訂單 ${r.orderNo} - 未找到對應物流單
        </div>
      `).join('')}
    `;
  }

  function saveShippingData() {
    chrome.storage.local.set({
      shippingDataBatches: state.shippingDataBatches,
      shippingData: state.shippingData,
      pdfShippingData: state.pdfShippingData,
      shippingProvider: state.currentProvider,
      shippingTimestamp: new Date().toISOString()
    });
  }

  function resetPdfUploadArea() {
    const uploadPrompt = document.getElementById('bv-pdf-upload-prompt');
    const pdfInfo = document.getElementById('bv-pdf-info');
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    const pdfInput = document.getElementById('bv-pdf-input');
    
    if (uploadPrompt) uploadPrompt.style.display = 'flex';
    if (pdfInfo) pdfInfo.style.display = 'none';
    if (pdfUploadArea) pdfUploadArea.classList.remove('has-file');
    if (pdfInput) pdfInput.value = '';
  }

  function processProductImages(orderContent) {
    const showProductImage = document.querySelector('.ignore-print #showProductImage');
    const shouldShowImage = showProductImage ? showProductImage.checked : false;
    
    if (!shouldShowImage) return;
    
    const rows = orderContent.querySelectorAll('.list-item');
    
    rows.forEach(row => {
      const nameCell = row.querySelector('.list-item-name');
      if (!nameCell) return;
      
      const originalImg = nameCell.querySelector('.orderProductImage');
      if (!originalImg) return;
      
      // 隱藏原始圖片
      originalImg.style.display = 'none';
      
      // 檢查是否已經處理過
      if (row.querySelector('.bv-product-image-col')) return;
      
      // 創建新的圖片欄位
      const imgCell = document.createElement('td');
      imgCell.className = 'bv-product-image-col';
      imgCell.style.cssText = `
        width: 8mm !important;
        padding: 2px !important;
        vertical-align: top !important;
      `;
      
      const newImg = document.createElement('img');
      newImg.className = 'bv-product-img';
      newImg.src = originalImg.src;
      newImg.style.cssText = `
        display: block !important;
        width: 7mm !important;
        height: 7mm !important;
        object-fit: cover !important;
        border-radius: 2px !important;
      `;
      
      imgCell.appendChild(newImg);
      
      // 插入到第一個 td 之後
      const firstCell = row.querySelector('td');
      if (firstCell && firstCell.nextSibling) {
        row.insertBefore(imgCell, firstCell.nextSibling);
      }
    });
  }

  function setupLazyLoadForPage(page) {
    if (!state.lazyLoadObserver) {
      state.lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src && !img.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
          }
        });
      }, {
        rootMargin: '50px'
      });
    }
    
    // 觀察頁面中的所有圖片
    page.querySelectorAll('img[data-src]').forEach(img => {
      state.lazyLoadObserver.observe(img);
    });
  }

  // ============================================
  // 9. 初始化
  // ============================================
  // 統一初始化入口
  function initialize() {
    console.log('初始化 BV SHOP 出貨助手');
    initResources();
    initLazyLoad();
    detectCurrentPage();
  }
  
  // 在 DOM 載入完成後自動呼叫 initialize()
  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize(); // 若已載入直接執行
  }

})();
