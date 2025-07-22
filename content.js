// ========================================================================================
// BV SHOP 出貨助手 (完整整合版 v7.0)
// ========================================================================================
// 功能說明：
// 1. 支援一般模式和精靈模式
// 2. 支援 10×15cm 和 10×10cm 標籤格式
// 3. 支援超商取貨單和宅配 PDF 物流單
// 4. 支援多種列印模式和配對方式
// ========================================================================================

(function() {
  'use strict';
  
  // ========================================================================================
  // 第一部分：初始化設定與全域變數
  // ========================================================================================
  
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
  
  // 設定常數
  const CONFIG = {
    // 頁面類型
    PAGE_TYPES: {
      ORDER_PRINT: 'order_print',
      SHIPPING: 'shipping'
    },
    
    // 物流提供商設定
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
    },
    
    // UI 模式
    UI_MODES: {
      NORMAL: 'normal',    // 一般模式
      GENIE: 'genie'       // 精靈模式
    }
  };
  
  // 全域狀態管理
  let state = {
    // 基本狀態
    isConverted: false,
    highlightQuantity: false,
    hideExtraInfo: true,  // 預設開啟精簡模式
    hideTableHeader: false,
    originalBodyStyle: null,
    isPanelMinimized: false,
    
    // 底圖相關
    logoDataUrl: null,
    logoAspectRatio: 1,
    
    // UI 相關
    collapsedSections: {},
    uiMode: CONFIG.UI_MODES.NORMAL,  // 預設一般模式
    
    // 頁面識別
    currentPageType: null,
    currentProvider: null,
    
    // 資料儲存
    shippingData: [],
    detailData: [],
    pdfShippingData: [],
    shippingDataBatches: [],  // 儲存多批次的物流單資料
    
    // 整合相關
    enableIntegration: false,
    cachedProviderSettings: {},
    previewCache: new Map(),
    lazyLoadObserver: null,
    
    // 頁面資料
    detailPages: [],
    shippingPages: [],
    
    // 配對相關
    matchingResults: [],
    matchMode: CONFIG.MATCH_MODES.INDEX,
    
    // 格式相關
    labelFormat: '10x15', // 預設 10×15
    
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
    
    // 自動檢查 interval
    autoCheckInterval: null
  };

  // 載入字體
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
  document.head.appendChild(fontLink);

  // ========================================================================================
  // 第二部分：頁面偵測與初始化
  // ========================================================================================
    
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
  
  // 偵測當前頁面類型
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

  // ========================================================================================
  // 第三部分：控制面板樣式定義
  // ========================================================================================
  
  function getPanelStyles() {
    return `
    /* 基礎樣式重置 */
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
    
    /* 控制面板主容器 */
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
    #bv-label-control-panel.genie-mode {
      width: 80px;
      height: 80px;
      bottom: auto;
      top: auto;
      right: 32px;
      bottom: 32px;
    }
    
    #bv-label-control-panel.genie-mode .bv-glass-panel {
      background: transparent;
      backdrop-filter: none;
      border: none;
      box-shadow: none;
    }
    
    #bv-label-control-panel.genie-mode .bv-panel-header,
    #bv-label-control-panel.genie-mode .bv-panel-content-wrapper,
    #bv-label-control-panel.genie-mode .bv-panel-footer {
      display: none;
    }
    
    /* 精靈按鈕 */
    .bv-genie-button {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #FF6B6B 0%, #FF4757 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 
        0 8px 32px rgba(255, 107, 107, 0.35),
        0 0 0 0.5px rgba(255, 255, 255, 0.3),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.4);
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      position: relative;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 8px 32px rgba(255, 107, 107, 0.35), 0 0 0 0 rgba(255, 107, 107, 0.4);
      }
      70% {
        box-shadow: 0 8px 32px rgba(255, 107, 107, 0.35), 0 0 0 15px rgba(255, 107, 107, 0);
      }
      100% {
        box-shadow: 0 8px 32px rgba(255, 107, 107, 0.35), 0 0 0 0 rgba(255, 107, 107, 0);
      }
    }
    
    .bv-genie-button:hover {
      transform: scale(1.1);
      box-shadow: 
        0 12px 40px rgba(255, 107, 107, 0.45),
        0 0 0 0.5px rgba(255, 255, 255, 0.4),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.5);
    }
    
    .bv-genie-button:active {
      transform: scale(0.95);
    }
    
    .bv-genie-button .material-icons {
      font-size: 40px;
      color: white;
    }
    
    /* 精靈提示 */
    .bv-genie-tooltip {
      position: absolute;
      bottom: 90px;
      right: 0;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    
    .bv-genie-button:hover .bv-genie-tooltip {
      opacity: 1;
    }
    
    /* 精靈菜單 */
    .bv-genie-menu {
      position: absolute;
      bottom: 90px;
      right: 0;
      width: 200px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 12px;
      box-shadow: 
        0 10px 40px rgba(0, 0, 0, 0.15),
        0 0 0 0.5px rgba(255, 255, 255, 0.6) inset;
      padding: 8px;
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    .bv-genie-menu.active {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    
    .bv-genie-menu-item {
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #333;
    }
    
    .bv-genie-menu-item:hover {
      background: rgba(81, 138, 255, 0.08);
      color: #518aff;
    }
    
    .bv-genie-menu-item .material-icons {
      font-size: 20px;
    }
    
    .bv-genie-menu-divider {
      height: 1px;
      background: rgba(0, 0, 0, 0.08);
      margin: 8px 0;
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
    
    /* 模式切換按鈕 */
    .bv-mode-toggle {
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
    
    .bv-mode-toggle:hover {
      background: rgba(255, 107, 107, 0.08);
      color: #FF6B6B;
      border-color: rgba(255, 107, 107, 0.15);
    }
    
    .bv-mode-toggle:active {
      transform: scale(0.96);
    }
    
    .bv-mode-toggle .material-icons {
      font-size: 20px;
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

  // ========================================================================================
  // 第四部分：控制面板建立與內容生成
  // ========================================================================================
  
  // 建立控制面板
  function createControlPanel() {
    // 只在支援的頁面創建面板
    if (!state.currentPageType) return;
    
    if (document.getElementById('bv-label-control-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'bv-label-control-panel';
    panel.className = state.uiMode === CONFIG.UI_MODES.GENIE ? 'genie-mode' : '';
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
  
  // 取得面板內容
  function getPanelContent() {
    // 精靈模式
    if (state.uiMode === CONFIG.UI_MODES.GENIE) {
      return getGenieModeContent();
    }
    
    // 一般模式
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
  
  // 精靈模式內容
  function getGenieModeContent() {
    return `
      <div class="bv-glass-panel">
        <div class="bv-genie-button" id="bv-genie-button">
          <span class="material-icons">auto_fix_high</span>
          <div class="bv-genie-tooltip">BV 出貨精靈</div>
        </div>
        
        <div class="bv-genie-menu" id="bv-genie-menu">
          ${state.isConverted ? `
            <div class="bv-genie-menu-item" data-action="print">
              <span class="material-icons">print</span>
              <span>快速列印</span>
            </div>
            <div class="bv-genie-menu-item" data-action="toggle-format">
              <span class="material-icons">aspect_ratio</span>
              <span>切換格式 (${state.labelFormat === '10x15' ? '10×10' : '10×15'})</span>
            </div>
            <div class="bv-genie-menu-divider"></div>
          ` : `
            <div class="bv-genie-menu-item" data-action="convert">
              <span class="material-icons">transform</span>
              <span>轉換成標籤格式</span>
            </div>
            <div class="bv-genie-menu-divider"></div>
          `}
          
          <div class="bv-genie-menu-item" data-action="switch-mode">
            <span class="material-icons">dashboard</span>
            <span>切換到一般模式</span>
          </div>
          
          ${state.isConverted ? `
            <div class="bv-genie-menu-item" data-action="revert">
              <span class="material-icons">undo</span>
              <span>恢復 A4 格式</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // A4 模式面板內容
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
            <button class="bv-mode-toggle" id="bv-mode-toggle">
              <span class="material-icons">auto_fix_high</span>
            </button>
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
  
  // 標籤模式面板內容
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
            <button class="bv-mode-toggle" id="bv-mode-toggle">
              <span class="material-icons">auto_fix_high</span>
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
            
            <!-- 物流單整合 -->
            <div class="bv-settings-card" data-section="integration">
              <h4 class="bv-card-title">
                <span class="material-icons">local_shipping</span>
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
                
                <button class="bv-glass-button" id="bv-clear-shipping" style="margin-top: 12px; width: 100%;">
                  <span class="material-icons">clear</span>
                  清除物流單資料
                </button>
              </div>
            </div>
            
            <!-- 出貨明細設定 -->
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
            
            <!-- 列印模式 -->
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
            
            <!-- 設定檔管理 -->
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
  
  // 物流單頁面內容
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
  
  // 宅配內容
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
  
  // 一般物流單內容
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

  // ========================================================================================
  // 第五部分：事件監聽器設定
  // ========================================================================================
  
  // 設定事件監聽器
  function setupEventListeners() {
    const convertBtn = document.getElementById('bv-convert-btn');
    const revertBtn = document.getElementById('bv-revert-btn');
    const minimizeBtn = document.getElementById('bv-minimize-btn');
    const minimizedButton = document.getElementById('bv-minimized-button');
    const highlightQty = document.getElementById('bv-highlight-qty');
    const applyPrint = document.getElementById('bv-apply-print');
    const modeToggle = document.getElementById('bv-mode-toggle');
    
    // 精靈模式切換
    if (modeToggle) {
      modeToggle.addEventListener('click', function() {
        state.uiMode = state.uiMode === CONFIG.UI_MODES.NORMAL ? CONFIG.UI_MODES.GENIE : CONFIG.UI_MODES.NORMAL;
        const panel = document.getElementById('bv-label-control-panel');
        
        if (state.uiMode === CONFIG.UI_MODES.GENIE) {
          panel.classList.add('genie-mode');
        } else {
          panel.classList.remove('genie-mode');
        }
        
        panel.innerHTML = getPanelContent();
        setupEventListeners();
        loadSettings();
        
        chrome.storage.local.set({ bvUiMode: state.uiMode });
      });
    }
    
    // 精靈模式事件
    if (state.uiMode === CONFIG.UI_MODES.GENIE) {
      setupGenieEventListeners();
      return;
    }
    
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
  
  // 設定精靈模式事件監聽
  function setupGenieEventListeners() {
    const genieButton = document.getElementById('bv-genie-button');
    const genieMenu = document.getElementById('bv-genie-menu');
    
    if (genieButton) {
      genieButton.addEventListener('click', function(e) {
        e.stopPropagation();
        genieMenu.classList.toggle('active');
      });
    }
    
    // 點擊外部關閉選單
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#bv-genie-menu') && !e.target.closest('#bv-genie-button')) {
        genieMenu.classList.remove('active');
      }
    });
    
    // 選單項目點擊
    document.querySelectorAll('.bv-genie-menu-item').forEach(item => {
      item.addEventListener('click', function() {
        const action = this.dataset.action;
        genieMenu.classList.remove('active');
        
        switch(action) {
          case 'convert':
            convertToLabelFormat();
            break;
            
          case 'print':
            preparePrintWithMode();
            break;
            
          case 'toggle-format':
            toggleLabelFormat();
            break;
            
          case 'switch-mode':
            state.uiMode = CONFIG.UI_MODES.NORMAL;
            const panel = document.getElementById('bv-label-control-panel');
            panel.classList.remove('genie-mode');
            panel.innerHTML = getPanelContent();
            setupEventListeners();
            loadSettings();
            chrome.storage.local.set({ bvUiMode: state.uiMode });
            break;
            
          case 'revert':
            revertToOriginal();
            break;
        }
      });
    });
  }
  
  // 快速切換標籤格式
  function toggleLabelFormat() {
    state.labelFormat = state.labelFormat === '10x15' ? '10x10' : '10x15';
    
    // 更新 body class
    document.body.classList.remove('format-10x15', 'format-10x10');
    document.body.classList.add(`format-${state.labelFormat}`);
    
    // 更新頁面樣式
    updatePageStyles();
    
    saveSettings();
    updatePreview();
    
    showNotification(`已切換為 ${CONFIG.LABEL_FORMATS[state.labelFormat].name} 格式`);
  }
  
  // 設定物流單頁面事件監聽
  function setupShippingEventListeners() {
    const fetchSaveBtn = document.getElementById('bv-fetch-save-shipping');
    
    if (fetchSaveBtn) {
      fetchSaveBtn.addEventListener('click', fetchAndSaveShippingData);
    }
    
    const deliveryPrintBtn = document.getElementById('bv-delivery-print');
    if (deliveryPrintBtn) {
      deliveryPrintBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }
  
  // 設定標籤模式事件監聽
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
  
  // 設定可摺疊卡片
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

  // ========================================================================================
  // 第六部分：物流單處理功能
  // ========================================================================================
  
  // 初始化物流單模式
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
  
  // 載入物流單資料
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
  
  // 抓取並儲存物流單資料
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
  
  // 提取物流單資料
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
  
  // 移除腳本標籤
  function removeScripts(element) {
    const scripts = element.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    const onclickElements = element.querySelectorAll('[onclick]');
    onclickElements.forEach(el => el.removeAttribute('onclick'));
  }
  
  // 合併所有批次資料
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
  
  // 更新批次列表
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
  
  // 處理批次操作
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
  
  // 更新物流單數量
  function updateShippingCount() {
    const countEl = document.getElementById('bv-shipping-count');
    if (countEl) {
      const totalCount = state.shippingData.length + state.pdfShippingData.length;
      countEl.textContent = totalCount;
    }
  }
  
  // 儲存物流單資料
  function saveShippingData() {
    chrome.storage.local.set({
      shippingDataBatches: state.shippingDataBatches,
      pdfShippingData: state.pdfShippingData,
      shippingData: state.shippingData
    }, () => {
      showNotification('已儲存物流單資料');
    });
  }
  
  // 檢查物流單資料狀態
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
  
  // 重置 PDF 上傳區域
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
  
  // 處理多個 PDF 上傳
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

  // ========================================================================================
  // 第七部分：標籤格式轉換與處理
  // ========================================================================================
  
  // 轉換為標籤格式
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
    
    showNotification(`已成功轉換為${CONFIG.LABEL_FORMATS[state.labelFormat].name}標籤格式`);
  }
  
  // 恢復為原始格式
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
    
    document.body.classList.remove('bv-converted', 'format-10x15', 'format-10x10');
    
    const labelStyle = document.getElementById('bv-label-styles');
    if (labelStyle) labelStyle.remove();
    
    const pageStyle = document.getElementById('bv-page-style');
    if (pageStyle) pageStyle.remove();
    
    // 恢復原始內容
    document.querySelectorAll('.order-content.bv-original').forEach(content => {
      content.classList.remove('bv-original');
      content.style.display = '';
    });
    
    state.isConverted = false;
    
    // 更新面板內容
    updatePanelContent();
    
    showNotification('已恢復為 A4 列印格式');
  }
  
  // 更新頁面樣式
  function updatePageStyles() {
    // 移除舊的 page 樣式
    const oldPageStyle = document.getElementById('bv-page-style');
    if (oldPageStyle) {
      oldPageStyle.remove();
    }
    
    // 創建新的 page 樣式
    const pageStyle = document.createElement('style');
    pageStyle.id = 'bv-page-style';
    
    if (state.labelFormat === '10x10') {
      pageStyle.textContent = `
        @page {
          size: 100mm 100mm;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        @media print {
          body.bv-converted {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          body.bv-converted .bv-label-page {
            width: 100mm !important;
            height: 100mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          
          body.bv-converted .bv-label-page.bv-shipping-page {
            padding: 3mm !important;
          }
          
          body.bv-converted .bv-label-page:last-child {
            page-break-after: auto !important;
          }
        }
      `;
    } else {
      pageStyle.textContent = `
        @page {
          size: 100mm 150mm;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        @media print {
          body.bv-converted {
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
          }
          
          body.bv-converted .bv-label-page.bv-shipping-page {
            padding: 3mm !important;
          }
          
          body.bv-converted .bv-label-page:last-child {
            page-break-after: auto !important;
          }
        }
      `;
    }
    
    document.head.appendChild(pageStyle);
  }
  
  // 更新標籤樣式
  function updateLabelStyles() {
    const fontSize = document.getElementById('bv-font-size')?.value || state.fontSize;
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
  
  // 處理分頁
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
              width: ${pageWidth - paddingPx * 2}px;
            `;
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            
            const elementHeight = wrapper.offsetHeight;
            document.body.removeChild(wrapper);
            
            if (element.classList.contains('title') || 
                currentHeight + elementHeight > contentHeight || 
                index === 0) {
              
              // 創建新頁面
              currentPage = createLabelPage(pageWidth, pageHeight, paddingPx);
              currentPageContent = currentPage.querySelector('.bv-page-content');
              currentHeight = 0;
              
              if (state.logoDataUrl) {
                addBackgroundLogo(currentPageContent);
              }
              
              pageContainer.appendChild(currentPage);
              
              orderData.pages.push({
                type: 'detail',
                element: currentPage,
                orderNo: orderInfo.orderNo,
                index: orderData.pages.length
              });
            }
            
            currentPageContent.appendChild(element.cloneNode(true));
            currentHeight += elementHeight + 10;
          });
        }
        
        state.detailPages.push(orderData);
      });
      
      // 根據列印模式處理物流單配對
      if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
        // 執行配對
        performMatching(shippingDataToUse, pdfDataToUse, showOrderLabel);
      }
    }
    
    updatePreview();
  }
  
  // 建立標籤頁面
  function createLabelPage(width, height, padding, isShipping = false) {
    const page = document.createElement('div');
    page.className = isShipping ? 'bv-label-page bv-shipping-page' : 'bv-label-page';
    page.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      padding: ${padding}px;
      margin: 0 auto 20px;
      box-sizing: border-box;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      page-break-after: always;
      page-break-inside: avoid;
    `;
    
    const content = document.createElement('div');
    content.className = 'bv-page-content';
    content.style.cssText = `
      flex: 1;
      position: relative;
      overflow: hidden;
    `;
    
    page.appendChild(content);
    
    return page;
  }
  
  // 加入背景 Logo
  function addBackgroundLogo(container) {
    if (state.logoDataUrl) {
      const logo = document.createElement('img');
      logo.src = state.logoDataUrl;
      logo.className = 'label-background-logo';
      container.appendChild(logo);
    }
  }
  
  // 處理商品圖片
  function processProductImages(orderContentClone) {
    const showProductImage = document.querySelector('.ignore-print #showProductImage')?.checked ?? false;
    
    if (showProductImage) {
      const listTable = orderContentClone.querySelector('.list');
      if (listTable) {
        // 在標題列加入圖片欄位
        const titleRow = listTable.querySelector('.list-title');
        if (titleRow) {
          const imageHeader = document.createElement('th');
          imageHeader.className = 'bv-product-image-col';
          imageHeader.textContent = '圖片';
          imageHeader.style.width = '8mm';
          const firstTh = titleRow.querySelector('th');
          if (firstTh) {
            titleRow.insertBefore(imageHeader, firstTh);
          }
        }
        
        // 在商品列加入圖片
        const itemRows = listTable.querySelectorAll('.list-item');
        itemRows.forEach(row => {
          const nameCell = row.querySelector('.list-item-name');
          const productImage = nameCell ? nameCell.querySelector('.orderProductImage') : null;
          
          const imageCell = document.createElement('td');
          imageCell.className = 'bv-product-image-col';
          
          if (productImage && productImage.src) {
            const img = document.createElement('img');
            img.src = productImage.src;
            img.className = 'bv-product-img';
            img.style.cssText = `
              width: 7mm !important;
              height: 7mm !important;
              object-fit: cover !important;
              border-radius: 2px !important;
              display: block !important;
            `;
            imageCell.appendChild(img);
          }
          
          const firstTd = row.querySelector('td');
          if (firstTd) {
            row.insertBefore(imageCell, firstTd);
          }
        });
      }
    }
  }
  
  // 處理精簡模式
  function processExtraInfoHiding(orderContentClone) {
    const orderExtra = orderContentClone.querySelector('.order-extra');
    if (orderExtra) {
      const paragraphs = orderExtra.querySelectorAll('p');
      paragraphs.forEach(p => {
        const text = p.textContent;
        if (text.includes('訂單時間：') || 
            text.includes('付款方式：') || 
            text.includes('訂單金額：') || 
            text.includes('運費：')) {
          // 保留這些重要資訊
        } else {
          p.remove();
        }
      });
      
      if (orderExtra.children.length === 0) {
        orderExtra.remove();
      }
    }
  }
  
  // 提取訂單資訊
  function extractOrderInfo(orderContent) {
    const orderInfo = {
      orderNo: '',
      logisticsNo: '',
      recipientName: '',
      recipientPhone: '',
      storeName: ''
    };
    
    // 提取訂單編號
    const orderNoElement = orderContent.querySelector('.order-info p');
    if (orderNoElement) {
      const orderNoMatch = orderNoElement.textContent.match(/訂單編號：([\w-]+)/);
      if (orderNoMatch) {
        orderInfo.orderNo = orderNoMatch[1].trim();
      }
    }
    
    // 提取物流編號
    const allParagraphs = orderContent.querySelectorAll('p');
    allParagraphs.forEach(p => {
      const text = p.textContent;
      
      // 物流單號
      const logisticsMatch = text.match(/物流單號[：:]\s*([\w-]+)/);
      if (logisticsMatch) {
        orderInfo.logisticsNo = logisticsMatch[1].trim();
      }
      
      // 收件人
      const recipientMatch = text.match(/收件人[：:]\s*([^\s]+)/);
      if (recipientMatch) {
        orderInfo.recipientName = recipientMatch[1].trim();
      }
      
      // 電話
      const phoneMatch = text.match(/電話[：:]\s*([\d-]+)/);
      if (phoneMatch) {
        orderInfo.recipientPhone = phoneMatch[1].trim();
      }
      
      // 取貨門市
      const storeMatch = text.match(/取貨門市[：:]\s*([^（\(]+)/);
      if (storeMatch) {
        orderInfo.storeName = storeMatch[1].trim();
      }
    });
    
    return orderInfo;
  }
  
  // 建立純物流單頁面
  function createShippingOnlyPages(shippingData, pdfData) {
    // 清空現有內容
    document.querySelectorAll('.order-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // 建立容器
    const container = document.createElement('div');
    container.className = 'bv-page-container';
    document.body.appendChild(container);
    
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
    const pageWidth = format.widthPx;
    const pageHeight = format.heightPx;
    const padding = format.padding * 3.78;
    
    // 處理一般物流單（HTML 內容）
    shippingData.forEach((data, index) => {
      const page = createLabelPage(pageWidth, pageHeight, 0, true);
      const content = page.querySelector('.bv-page-content');
      
      const wrapper = document.createElement('div');
      wrapper.className = 'bv-shipping-content';
      wrapper.innerHTML = data.html;
      
      content.appendChild(wrapper);
      container.appendChild(page);
      
      state.shippingPages.push({
        type: 'shipping',
        provider: data.provider,
        element: page,
        orderNo: data.orderNo,
        logisticsNo: data.logisticsNo,
        index: index
      });
    });
    
    // 處理 PDF/截圖物流單
    pdfData.forEach((data, index) => {
      const page = createLabelPage(pageWidth, pageHeight, 0, true);
      const content = page.querySelector('.bv-page-content');
      
      const wrapper = document.createElement('div');
      wrapper.className = 'bv-shipping-content';
      wrapper.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3mm;
        box-sizing: border-box;
      `;
      
      const img = document.createElement('img');
      img.src = data.imageData;
      img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      `;
      
      wrapper.appendChild(img);
      content.appendChild(wrapper);
      container.appendChild(page);
      
      state.shippingPages.push({
        type: 'shipping-pdf',
        element: page,
        orderNo: data.orderNo,
        index: shippingData.length + index
      });
    });
  }
  
  // 執行配對
  function performMatching(shippingData, pdfData, showOrderLabel) {
    state.matchingResults = [];
    
    if (state.matchMode === CONFIG.MATCH_MODES.INDEX) {
      // 索引配對
      performIndexMatching(shippingData, pdfData, showOrderLabel);
    } else {
      // 物流編號配對
      performLogisticsMatching(shippingData, pdfData, showOrderLabel);
    }
    
    // 顯示配對結果
    displayMatchingResults();
  }
  
  // 索引配對
  function performIndexMatching(shippingData, pdfData, showOrderLabel) {
    const allShippingData = [...shippingData, ...pdfData];
    
    state.detailPages.forEach((orderData, index) => {
      const shippingItem = allShippingData[index];
      
      if (shippingItem && orderData.pages.length > 0) {
        const pageContainer = document.querySelector(`.bv-page-container[data-order-index="${orderData.index}"]`);
        if (!pageContainer) return;
        
        // 建立物流單頁面
        const format = CONFIG.LABEL_FORMATS[state.labelFormat];
        const shippingPage = createShippingPageForData(shippingItem, format, showOrderLabel ? orderData.orderNo : null);
        
        // 插入到明細頁面後
        const lastDetailPage = orderData.pages[orderData.pages.length - 1].element;
        lastDetailPage.parentNode.insertBefore(shippingPage, lastDetailPage.nextSibling);
        
        state.matchingResults.push({
          orderNo: orderData.orderNo,
          shippingNo: shippingItem.orderNo || shippingItem.logisticsNo || `物流單 ${index + 1}`,
          status: 'matched'
        });
      } else if (!shippingItem) {
        state.matchingResults.push({
          orderNo: orderData.orderNo,
          shippingNo: '-',
          status: 'no-shipping'
        });
      }
    });
    
    // 處理多出的物流單
    const allShippingCount = allShippingData.length;
    const detailCount = state.detailPages.length;
    
    if (allShippingCount > detailCount) {
      for (let i = detailCount; i < allShippingCount; i++) {
        state.matchingResults.push({
          orderNo: '-',
          shippingNo: allShippingData[i].orderNo || `物流單 ${i + 1}`,
          status: 'extra-shipping'
        });
      }
    }
  }
  
  // 物流編號配對
  function performLogisticsMatching(shippingData, pdfData, showOrderLabel) {
    const allShippingData = [...shippingData, ...pdfData];
    const unmatchedShipping = new Set(allShippingData.map((_, index) => index));
    
    // 先嘗試精確配對
    state.detailPages.forEach(orderData => {
      const orderLogisticsNo = orderData.logisticsNo;
      if (!orderLogisticsNo) {
        state.matchingResults.push({
          orderNo: orderData.orderNo,
          shippingNo: '-',
          status: 'no-logistics-number'
        });
        return;
      }
      
      let matched = false;
      for (let i = 0; i < allShippingData.length; i++) {
        if (!unmatchedShipping.has(i)) continue;
        
        const shippingItem = allShippingData[i];
        const shippingLogisticsNo = shippingItem.logisticsNo || shippingItem.orderNo || '';
        
        if (shippingLogisticsNo && 
            (shippingLogisticsNo === orderLogisticsNo || 
             shippingLogisticsNo.includes(orderLogisticsNo) ||
             orderLogisticsNo.includes(shippingLogisticsNo))) {
          
          // 找到配對
          const pageContainer = document.querySelector(`.bv-page-container[data-order-index="${orderData.index}"]`);
          if (pageContainer && orderData.pages.length > 0) {
            const format = CONFIG.LABEL_FORMATS[state.labelFormat];
            const shippingPage = createShippingPageForData(shippingItem, format, showOrderLabel ? orderData.orderNo : null);
            
            const lastDetailPage = orderData.pages[orderData.pages.length - 1].element;
            lastDetailPage.parentNode.insertBefore(shippingPage, lastDetailPage.nextSibling);
          }
          
          unmatchedShipping.delete(i);
          matched = true;
          
          state.matchingResults.push({
            orderNo: orderData.orderNo,
            shippingNo: shippingLogisticsNo,
            status: 'matched'
          });
          break;
        }
      }
      
      if (!matched) {
        state.matchingResults.push({
          orderNo: orderData.orderNo,
          shippingNo: orderLogisticsNo,
          status: 'no-matching-shipping'
        });
      }
    });
    
    // 處理未配對的物流單
    unmatchedShipping.forEach(index => {
      const shippingItem = allShippingData[index];
      state.matchingResults.push({
        orderNo: '-',
        shippingNo: shippingItem.orderNo || shippingItem.logisticsNo || `物流單 ${index + 1}`,
        status: 'unmatched-shipping'
      });
    });
  }
  
  // 建立物流單頁面
  function createShippingPageForData(shippingItem, format, orderLabel = null) {
    const page = createLabelPage(format.widthPx, format.heightPx, 0, true);
    const content = page.querySelector('.bv-page-content');
    
    // 加入訂單編號標籤
    if (orderLabel) {
      const label = document.createElement('div');
      label.className = 'bv-order-label';
      label.textContent = `訂單：${orderLabel}`;
      content.appendChild(label);
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'bv-shipping-content';
    
    if (shippingItem.imageData) {
      // PDF 或截圖資料
      wrapper.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3mm;
        box-sizing: border-box;
      `;
      
      const img = document.createElement('img');
      img.src = shippingItem.imageData;
      img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      `;
      
      wrapper.appendChild(img);
    } else {
      // HTML 內容
      wrapper.innerHTML = shippingItem.html;
      
      // 如果是 7-11 或全家超商，進行縮放處理
      if (shippingItem.provider === 'SEVEN' || shippingItem.provider === 'FAMILY') {
        const innerWrapper = document.createElement('div');
        innerWrapper.className = 'bv-shipping-wrapper-inner bv-store-shipping-content';
        innerWrapper.innerHTML = wrapper.innerHTML;
        wrapper.innerHTML = '';
        wrapper.appendChild(innerWrapper);
      }
    }
    
    content.appendChild(wrapper);
    return page;
  }
  
  // 顯示配對結果
  function displayMatchingResults() {
    const resultsEl = document.getElementById('bv-matching-results');
    if (!resultsEl) return;
    
    if (state.printMode !== CONFIG.PRINT_MODES.MANUAL_MATCH || state.matchingResults.length === 0) {
      resultsEl.style.display = 'none';
      return;
    }
    
    const statusCounts = {
      matched: 0,
      'no-shipping': 0,
      'no-logistics-number': 0,
      'no-matching-shipping': 0,
      'extra-shipping': 0,
      'unmatched-shipping': 0
    };
    
    state.matchingResults.forEach(result => {
      statusCounts[result.status]++;
    });
    
    const totalOrders = state.detailPages.length;
    const matchedCount = statusCounts.matched;
    
    let statusText = `配對成功：${matchedCount}/${totalOrders}`;
    let details = [];
    
    if (statusCounts['no-shipping'] > 0) {
      details.push(`${statusCounts['no-shipping']} 筆訂單無物流單`);
    }
    
    if (statusCounts['no-logistics-number'] > 0) {
      details.push(`${statusCounts['no-logistics-number']} 筆訂單無物流編號`);
    }
    
    if (statusCounts['no-matching-shipping'] > 0) {
      details.push(`${statusCounts['no-matching-shipping']} 筆找不到對應物流單`);
    }
    
    if (statusCounts['extra-shipping'] > 0) {
      details.push(`${statusCounts['extra-shipping']} 張多餘物流單`);
    }
    
    if (statusCounts['unmatched-shipping'] > 0) {
      details.push(`${statusCounts['unmatched-shipping']} 張未配對物流單`);
    }
    
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
      <div class="bv-matching-results-title">${statusText}</div>
      ${details.length > 0 ? details.map(d => `
        <div class="bv-matching-result-item">${d}</div>
      `).join('') : '<div class="bv-matching-result-item">全部配對成功！</div>'}
    `;
  }

  // ========================================================================================
  // 第八部分：列印功能
  // ========================================================================================
  
  // 準備列印
  function preparePrintWithMode() {
    if (!state.isConverted) {
      // A4 模式直接列印
      if (state.highlightQuantity) {
        applyQuantityHighlight();
      }
      window.print();
      return;
    }
    
    // 標籤模式：更新預覽並列印
    updatePreview();
    
    // 確保所有圖片載入完成
    const images = document.querySelectorAll('.bv-label-page img');
    let loadCount = 0;
    const totalImages = images.length;
    
    if (totalImages === 0) {
      window.print();
      return;
    }
    
    images.forEach(img => {
      if (img.complete) {
        loadCount++;
        if (loadCount === totalImages) {
          setTimeout(() => window.print(), 100);
        }
      } else {
        img.onload = () => {
          loadCount++;
          if (loadCount === totalImages) {
            setTimeout(() => window.print(), 100);
          }
        };
        img.onerror = () => {
          loadCount++;
          if (loadCount === totalImages) {
            setTimeout(() => window.print(), 100);
          }
        };
      }
    });
  }
  
  // 更新預覽
  function updatePreview() {
    if (!state.isConverted) return;
    
    // 隱藏所有頁面
    document.querySelectorAll('.bv-label-page').forEach(page => {
      page.style.display = 'none';
    });
    
    // 根據列印模式顯示對應頁面
    const visiblePages = getVisiblePages();
    
    visiblePages.forEach(page => {
      if (page.element) {
        page.element.style.display = 'block';
      }
    });
    
    // 確保正確的列印樣式
    updatePageStyles();
    
    // 更新配對結果顯示
    if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
      displayMatchingResults();
    }
  }
  
  // 取得可見頁面
  function getVisiblePages() {
    const pages = [];
    
    switch (state.printMode) {
      case CONFIG.PRINT_MODES.DETAIL_ONLY:
        // 只顯示明細頁
        state.detailPages.forEach(orderData => {
          pages.push(...orderData.pages);
        });
        break;
        
      case CONFIG.PRINT_MODES.SHIPPING_ONLY:
        // 只顯示物流單頁
        pages.push(...state.shippingPages);
        break;
        
      case CONFIG.PRINT_MODES.MANUAL_MATCH:
        // 顯示已配對的頁面（配對時已經處理順序）
        document.querySelectorAll('.bv-label-page').forEach(page => {
          pages.push({ element: page });
        });
        break;
    }
    
    return pages;
  }
  
  // 更新列印模式 UI
  function updatePrintModeUI() {
    const sortOptions = document.getElementById('bv-sort-options');
    const reverseOption = document.getElementById('bv-reverse-shipping-option');
    const detailSortGroup = document.getElementById('bv-detail-sort-group');
    const shippingSort = document.getElementById('bv-shipping-sort');
    const matchModeSelector = document.getElementById('bv-match-mode-selector');
    const orderLabelSetting = document.getElementById('bv-order-label-setting');
    const orderLabelSwitch = document.getElementById('bv-order-label-switch');
    
    // 根據列印模式顯示/隱藏選項
    switch (state.printMode) {
      case CONFIG.PRINT_MODES.DETAIL_ONLY:
        if (sortOptions) {
          sortOptions.style.display = 'flex';
          if (detailSortGroup) detailSortGroup.style.display = 'block';
          if (shippingSort) shippingSort.style.display = 'none';
        }
        if (reverseOption) reverseOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) orderLabelSetting.style.display = 'none';
        break;
        
      case CONFIG.PRINT_MODES.SHIPPING_ONLY:
        if (sortOptions) {
          sortOptions.style.display = 'flex';
          if (detailSortGroup) detailSortGroup.style.display = 'none';
          if (shippingSort) shippingSort.style.display = 'block';
        }
        if (reverseOption) reverseOption.style.display = 'none';
        if (matchModeSelector) matchModeSelector.style.display = 'none';
        if (orderLabelSetting) orderLabelSetting.style.display = 'none';
        break;
        
      case CONFIG.PRINT_MODES.MANUAL_MATCH:
        if (sortOptions) sortOptions.style.display = 'none';
        if (reverseOption) reverseOption.style.display = 'block';
        if (matchModeSelector) matchModeSelector.style.display = 'block';
        
        // 顯示訂單標籤設定
        if (orderLabelSetting) {
          orderLabelSetting.style.display = 'flex';
          
          // 根據配對模式啟用/禁用
          const isIndexMode = state.matchMode === CONFIG.MATCH_MODES.INDEX;
          if (orderLabelSwitch) {
            if (isIndexMode) {
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
        break;
    }
  }

  // ========================================================================================
  // 第九部分：設定管理與工具函數
  // ========================================================================================
  
  // 載入設定
  function loadSettings() {
    chrome.storage.local.get([
      'bvHighlightQty',
      'bvLabelFormat',
      'bvFontSize',
      'bvHideExtraInfo',
      'bvHideTableHeader',
      'bvPrintMode',
      'bvMatchMode',
      'bvDetailSortOrder',
      'bvShippingSortOrder',
      'bvReverseShipping',
      'bvShowOrderLabel',
      'bvCollapsedSections',
      'bvPanelMinimized',
      'bvLogoData',
      'bvLogoSettings'
    ], (result) => {
      // 載入設定值
      state.highlightQuantity = result.bvHighlightQty ?? true;
      state.labelFormat = result.bvLabelFormat || '10x15';
      state.fontSize = result.bvFontSize || 11;
      state.hideExtraInfo = result.bvHideExtraInfo ?? true;
      state.hideTableHeader = result.bvHideTableHeader ?? false;
      state.printMode = result.bvPrintMode || CONFIG.PRINT_MODES.DETAIL_ONLY;
      state.matchMode = result.bvMatchMode || CONFIG.MATCH_MODES.INDEX;
      state.detailSortOrder = result.bvDetailSortOrder || 'asc';
      state.shippingSortOrder = result.bvShippingSortOrder || 'asc';
      state.reverseShipping = result.bvReverseShipping ?? false;
      state.showOrderLabel = result.bvShowOrderLabel ?? false;
      state.collapsedSections = result.bvCollapsedSections || {};
      state.isPanelMinimized = result.bvPanelMinimized ?? false;
      
      // Logo 設定
      if (result.bvLogoData) {
        state.logoDataUrl = result.bvLogoData;
        
        const logoSettings = result.bvLogoSettings || {};
        state.logoSize = logoSettings.size || 30;
        state.logoX = logoSettings.x || 50;
        state.logoY = logoSettings.y || 50;
        state.logoOpacity = logoSettings.opacity || 20;
        state.logoAspectRatio = logoSettings.aspectRatio || 1;
        
        updateLogoUI();
      }
      
      // 套用設定到 UI
      const highlightQtyCheckbox = document.getElementById('bv-highlight-qty');
      if (highlightQtyCheckbox) {
        highlightQtyCheckbox.checked = state.highlightQuantity;
        
        if (state.highlightQuantity) {
          applyQuantityHighlight();
        }
      }
      
      const fontSizeSlider = document.getElementById('bv-font-size');
      if (fontSizeSlider) {
        fontSizeSlider.value = state.fontSize;
        document.getElementById('bv-font-size-value').textContent = state.fontSize.toFixed(1);
        updateRangeProgress(fontSizeSlider);
      }
      
      const hideExtraInfoCheckbox = document.getElementById('bv-hide-extra-info');
      if (hideExtraInfoCheckbox) {
        hideExtraInfoCheckbox.checked = state.hideExtraInfo;
      }
      
      const hideTableHeaderCheckbox = document.getElementById('bv-hide-table-header');
      if (hideTableHeaderCheckbox) {
        hideTableHeaderCheckbox.checked = state.hideTableHeader;
      }
      
      const formatRadios = document.querySelectorAll('input[name="label-format"]');
      formatRadios.forEach(radio => {
        if (radio.value === state.labelFormat) {
          radio.checked = true;
          radio.closest('.bv-format-option')?.classList.add('selected');
        }
      });
      
      const printModeRadios = document.querySelectorAll('input[name="print-mode"]');
      printModeRadios.forEach(radio => {
        if (radio.value === state.printMode) {
          radio.checked = true;
          radio.closest('.bv-mode-option')?.classList.add('selected');
        }
      });
      
      const matchModeRadios = document.querySelectorAll('input[name="match-mode"]');
      matchModeRadios.forEach(radio => {
        if (radio.value === state.matchMode) {
          radio.checked = true;
        }
      });
      
      const reverseShippingCheckbox = document.getElementById('bv-reverse-shipping');
      if (reverseShippingCheckbox) {
        reverseShippingCheckbox.checked = state.reverseShipping;
      }
      
      const showOrderLabelCheckbox = document.getElementById('bv-show-order-label');
      if (showOrderLabelCheckbox) {
        showOrderLabelCheckbox.checked = state.showOrderLabel;
      }
      
      // 套用摺疊狀態
      Object.entries(state.collapsedSections).forEach(([sectionId, isCollapsed]) => {
        if (isCollapsed) {
          const card = document.querySelector(`.bv-settings-card[data-section="${sectionId}"]`);
          if (card) {
            card.classList.add('collapsed');
          }
        }
      });
      
      // 套用最小化狀態
      if (state.isPanelMinimized) {
        const panel = document.getElementById('bv-label-control-panel');
        const minButton = document.getElementById('bv-minimized-button');
        
        if (panel) panel.classList.add('minimized');
        if (minButton) minButton.style.display = 'flex';
      }
      
      // 套用排序按鈕狀態
      document.querySelectorAll('.bv-sort-button').forEach(btn => {
        const type = btn.dataset.type;
        const order = btn.dataset.order;
        
        if ((type === 'detail' && order === state.detailSortOrder) ||
            (type === 'shipping' && order === state.shippingSortOrder)) {
          btn.classList.add('active');
        }
      });
      
      if (state.isConverted) {
        updateLabelStyles();
        updatePrintModeUI();
      }
    });
  }
  
  // 儲存設定
  function saveSettings() {
    const settings = {
      bvHighlightQty: state.highlightQuantity,
      bvLabelFormat: state.labelFormat,
      bvFontSize: state.fontSize,
      bvHideExtraInfo: state.hideExtraInfo,
      bvHideTableHeader: state.hideTableHeader,
      bvPrintMode: state.printMode,
      bvMatchMode: state.matchMode,
      bvDetailSortOrder: state.detailSortOrder,
      bvShippingSortOrder: state.shippingSortOrder,
      bvReverseShipping: state.reverseShipping,
      bvShowOrderLabel: state.showOrderLabel
    };
    
    chrome.storage.local.set(settings);
  }
  
  // 套用數量標示
  function applyQuantityHighlight() {
    const targetElements = state.isConverted ? 
      document.querySelectorAll('.bv-label-page .list-item td:nth-child(3), .bv-label-page .list-item td:nth-child(4)') :
      document.querySelectorAll('.list-item td:nth-child(2), .list-item td:nth-child(3)');
    
    targetElements.forEach(td => {
      const text = td.textContent.trim();
      if (/^\d+$/.test(text)) {
        const num = parseInt(text);
        if (num >= 2) {
          const triangleSpan = td.querySelector('.bv-triangle');
          if (!triangleSpan) {
            td.innerHTML = `<span class="bv-triangle">▲</span>${text}`;
          }
        }
      }
    });
  }
  
  // 切換數量標示
  function toggleQuantityHighlight(e) {
    state.highlightQuantity = e.target.checked;
    chrome.storage.local.set({ bvHighlightQty: state.highlightQuantity });
    
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    } else {
      document.querySelectorAll('.bv-triangle').forEach(el => el.remove());
    }
  }
  
  // 觸發原始頁面更新
  function triggerOriginalPageUpdate() {
    const originalFontSize = document.querySelector('.ignore-print #fontSize');
    const originalShowImage = document.querySelector('.ignore-print #showProductImage');
    
    if (originalFontSize && typeof $ !== 'undefined') {
      $(originalFontSize).trigger('change');
    } else if (originalFontSize) {
      originalFontSize.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (originalShowImage && typeof $ !== 'undefined') {
      $(originalShowImage).trigger('change');
    } else if (originalShowImage) {
      originalShowImage.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  
  // 隱藏原始控制項
  function hideOriginalControls() {
    const ignoreElements = document.querySelectorAll('.ignore-print');
    ignoreElements.forEach(el => {
      if (!el.id || el.id !== 'bv-label-control-panel') {
        el.style.display = 'none';
      }
    });
    
    const pageBreaks = document.querySelectorAll('.page-break');
    pageBreaks.forEach(el => el.style.display = 'none');
  }
  
  // 監聽原始控制項
  function observeOriginalControls() {
    const originalShowImage = document.querySelector('.ignore-print #showProductImage');
    
    if (originalShowImage && !originalShowImage.hasAttribute('data-bv-listener')) {
      originalShowImage.setAttribute('data-bv-listener', 'true');
      
      originalShowImage.addEventListener('change', function() {
        if (state.isConverted) {
          setTimeout(() => {
            handlePagination();
          }, 100);
        }
      });
    }
  }
  
  // 更新滑桿進度條
  function updateRangeProgress(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const value = parseFloat(slider.value);
    const percentage = ((value - min) / (max - min)) * 100;
    
    slider.style.background = `linear-gradient(to right, #518aff 0%, #518aff ${percentage}%, rgba(81, 138, 255, 0.1) ${percentage}%, rgba(81, 138, 255, 0.1) 100%)`;
  }
  
  // 顯示通知
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `bv-notification ${type}`;
    notification.innerHTML = `
      <span class="material-icons">${type === 'success' ? 'check_circle' : type === 'warning' ? 'warning' : 'error'}</span>
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
  
  // 更新面板內容
  function updatePanelContent() {
    const panel = document.getElementById('bv-label-control-panel');
    if (!panel) return;
    
    // 保存當前的最小化狀態
    const isMinimized = panel.classList.contains('minimized');
    
    panel.innerHTML = getPanelContent();
    
    // 恢復最小化狀態
    if (isMinimized) {
      panel.classList.add('minimized');
    }
    
    setupEventListeners();
    loadSettings();
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      initShippingMode();
    } else if (state.isConverted) {
      checkShippingDataStatus();
    }
  }
  
  // 初始化拖曳功能
  function initDragFunction() {
    const panel = document.getElementById('bv-label-control-panel');
    const minimizedButton = document.getElementById('bv-minimized-button');
    
    if (!panel || !minimizedButton) return;
    
    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0, yOffset = 0;
    let dragTarget = null;
    
    function dragStart(e, target) {
      if (e.target.closest('input, button, label, .bv-panel-content-wrapper')) {
        return;
      }
      
      dragTarget = target;
      
      if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }
      
      if (e.target === dragTarget || e.target.closest('.bv-panel-header')) {
        isDragging = true;
        dragTarget.style.cursor = 'grabbing';
      }
    }
    
    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      if (dragTarget) {
        dragTarget.style.cursor = '';
      }
      dragTarget = null;
    }
    
    function drag(e) {
      if (!isDragging || !dragTarget) return;
      
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
      
      dragTarget.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
    
    // Panel 拖曳
    panel.addEventListener('mousedown', (e) => dragStart(e, panel));
    panel.addEventListener('touchstart', (e) => dragStart(e, panel));
    
    // Minimized button 拖曳
    minimizedButton.addEventListener('mousedown', (e) => dragStart(e, minimizedButton));
    minimizedButton.addEventListener('touchstart', (e) => dragStart(e, minimizedButton));
    
    // 全域事件
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
  }
  
  // 初始化 Logo 上傳
  function initLogoUpload() {
    const uploadArea = document.getElementById('logo-upload-area');
    const logoInput = document.getElementById('logo-input');
    const logoControls = document.getElementById('logo-controls');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    
    if (!uploadArea || !logoInput) return;
    
    uploadArea.addEventListener('click', function() {
      logoInput.click();
    });
    
    logoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.match('image.*')) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
            state.logoAspectRatio = this.width / this.height;
            state.logoDataUrl = e.target.result;
            
            updateLogoUI();
            saveLogo();
            updateLabelStyles();
            updatePreview();
          };
          img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
      }
    });
    
    // Logo 控制項
    const sizeSlider = document.getElementById('logo-size-slider');
    const xSlider = document.getElementById('logo-x-slider');
    const ySlider = document.getElementById('logo-y-slider');
    const opacitySlider = document.getElementById('logo-opacity-slider');
    
    [sizeSlider, xSlider, ySlider, opacitySlider].forEach(slider => {
      if (slider) {
        slider.addEventListener('input', function() {
          const valueLabel = document.getElementById(this.id.replace('-slider', ''));
          const value = this.value;
          
          if (valueLabel) {
            valueLabel.textContent = value + '%';
          }
          
          updateRangeProgress(this);
          
          // 更新狀態
          switch(this.id) {
            case 'logo-size-slider':
              state.logoSize = value;
              break;
            case 'logo-x-slider':
              state.logoX = value;
              break;
            case 'logo-y-slider':
              state.logoY = value;
              break;
            case 'logo-opacity-slider':
              state.logoOpacity = value;
              break;
          }
          
          saveLogo();
          updateLabelStyles();
          updatePreview();
        });
        
        updateRangeProgress(slider);
      }
    });
    
    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', function() {
        state.logoDataUrl = null;
        state.logoAspectRatio = 1;
        
        // 重置 UI
        const uploadPrompt = document.getElementById('upload-prompt');
        const logoPreview = document.getElementById('logo-preview');
        
        if (uploadPrompt) uploadPrompt.style.display = 'flex';
        if (logoPreview) logoPreview.style.display = 'none';
        if (logoControls) logoControls.style.display = 'none';
        if (logoInput) logoInput.value = '';
        
        // 清除儲存的資料
        chrome.storage.local.remove(['bvLogoData', 'bvLogoSettings']);
        
        // 更新樣式
        updateLabelStyles();
        updatePreview();
      });
    }
  }
  
  // 更新 Logo UI
  function updateLogoUI() {
    const uploadPrompt = document.getElementById('upload-prompt');
    const logoPreview = document.getElementById('logo-preview');
    const logoControls = document.getElementById('logo-controls');
    
    if (state.logoDataUrl) {
      if (uploadPrompt) uploadPrompt.style.display = 'none';
      if (logoPreview) {
        logoPreview.src = state.logoDataUrl;
        logoPreview.style.display = 'block';
      }
      if (logoControls) logoControls.style.display = 'block';
      
      // 更新滑桿值
      const sizeSlider = document.getElementById('logo-size-slider');
      const xSlider = document.getElementById('logo-x-slider');
      const ySlider = document.getElementById('logo-y-slider');
      const opacitySlider = document.getElementById('logo-opacity-slider');
      
      if (sizeSlider) {
        sizeSlider.value = state.logoSize;
        document.getElementById('logo-size').textContent = state.logoSize + '%';
        updateRangeProgress(sizeSlider);
      }
      
      if (xSlider) {
        xSlider.value = state.logoX;
        document.getElementById('logo-x').textContent = state.logoX + '%';
        updateRangeProgress(xSlider);
      }
      
      if (ySlider) {
        ySlider.value = state.logoY;
        document.getElementById('logo-y').textContent = state.logoY + '%';
        updateRangeProgress(ySlider);
      }
      
      if (opacitySlider) {
        opacitySlider.value = state.logoOpacity;
        document.getElementById('logo-opacity').textContent = state.logoOpacity + '%';
        updateRangeProgress(opacitySlider);
      }
    }
  }
  
  // 儲存 Logo
  function saveLogo() {
    if (state.logoDataUrl) {
      chrome.storage.local.set({
        bvLogoData: state.logoDataUrl,
        bvLogoSettings: {
          size: state.logoSize,
          x: state.logoX,
          y: state.logoY,
          opacity: state.logoOpacity,
          aspectRatio: state.logoAspectRatio
        }
      });
    }
  }
  
  // 初始化設定檔系統
  function initPresetSystem() {
    updatePresetList();
    
    const addPresetBtn = document.getElementById('bv-add-preset');
    const newPresetRow = document.getElementById('bv-new-preset-row');
    const newPresetInput = document.getElementById('bv-new-preset-name');
    const confirmSaveBtn = document.getElementById('bv-confirm-save');
    const cancelSaveBtn = document.getElementById('bv-cancel-save');
    
    if (addPresetBtn) {
      addPresetBtn.addEventListener('click', function() {
        newPresetRow.style.display = 'block';
        addPresetBtn.style.display = 'none';
        newPresetInput.value = '';
        newPresetInput.focus();
      });
    }
    
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', saveNewPreset);
    }
    
    if (cancelSaveBtn) {
      cancelSaveBtn.addEventListener('click', function() {
        newPresetRow.style.display = 'none';
        addPresetBtn.style.display = 'block';
      });
    }
    
    if (newPresetInput) {
      newPresetInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          saveNewPreset();
        } else if (e.key === 'Escape') {
          newPresetRow.style.display = 'none';
          addPresetBtn.style.display = 'block';
        }
      });
    }
  }
  
  // 更新設定檔列表
  function updatePresetList() {
    chrome.storage.local.get('bvPresets', (result) => {
      const presets = result.bvPresets || {};
      const presetList = document.getElementById('bv-preset-list');
      
      if (!presetList) return;
      
      const sortedPresets = Object.entries(presets).sort((a, b) => {
        return (b[1].timestamp || 0) - (a[1].timestamp || 0);
      });
      
      if (sortedPresets.length === 0) {
        presetList.innerHTML = '<div style="text-align: center; color: rgba(0,0,0,0.5); padding: 20px; font-size: 13px;">尚無儲存的設定檔</div>';
        return;
      }
      
      presetList.innerHTML = sortedPresets.map(([id, preset]) => `
        <div class="bv-preset-item" data-preset-id="${id}">
          <div class="bv-preset-name" data-preset-id="${id}">${preset.name}</div>
          <div class="bv-preset-actions">
            <button class="bv-preset-action-btn delete" data-preset-id="${id}">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      `).join('');
      
      // 綁定事件
      presetList.querySelectorAll('.bv-preset-name').forEach(el => {
        el.addEventListener('click', function() {
          const presetId = this.dataset.presetId;
          loadPreset(presetId);
        });
      });
      
      presetList.querySelectorAll('.bv-preset-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const presetId = this.dataset.presetId;
          
          if (confirm('確定要刪除這個設定檔嗎？')) {
            deletePreset(presetId);
          }
        });
      });
    });
  }
  
  // 儲存新設定檔
  function saveNewPreset() {
    const nameInput = document.getElementById('bv-new-preset-name');
    const name = nameInput.value.trim();
    
    if (!name) {
      showNotification('請輸入設定檔名稱', 'warning');
      return;
    }
    
    const preset = {
      name: name,
      timestamp: Date.now(),
      settings: {
        fontSize: state.fontSize,
        hideExtraInfo: state.hideExtraInfo,
        hideTableHeader: state.hideTableHeader,
        printMode: state.printMode,
        matchMode: state.matchMode,
        detailSortOrder: state.detailSortOrder,
        shippingSortOrder: state.shippingSortOrder,
        reverseShipping: state.reverseShipping,
        showOrderLabel: state.showOrderLabel,
        logoSize: state.logoSize,
        logoX: state.logoX,
        logoY: state.logoY,
        logoOpacity: state.logoOpacity
      }
    };
    
    chrome.storage.local.get('bvPresets', (result) => {
      const presets = result.bvPresets || {};
      const presetId = 'preset_' + Date.now();
      presets[presetId] = preset;
      
      chrome.storage.local.set({ bvPresets: presets }, () => {
        showNotification('設定檔已儲存');
        updatePresetList();
        
        // 重置輸入
        document.getElementById('bv-new-preset-row').style.display = 'none';
        document.getElementById('bv-add-preset').style.display = 'block';
      });
    });
  }
  
  // 載入設定檔
  function loadPreset(presetId) {
    chrome.storage.local.get('bvPresets', (result) => {
      const presets = result.bvPresets || {};
      const preset = presets[presetId];
      
      if (!preset) return;
      
      // 套用設定
      const settings = preset.settings;
      
      state.fontSize = settings.fontSize || 11;
      state.hideExtraInfo = settings.hideExtraInfo ?? true;
      state.hideTableHeader = settings.hideTableHeader ?? false;
      state.printMode = settings.printMode || CONFIG.PRINT_MODES.DETAIL_ONLY;
      state.matchMode = settings.matchMode || CONFIG.MATCH_MODES.INDEX;
      state.detailSortOrder = settings.detailSortOrder || 'asc';
      state.shippingSortOrder = settings.shippingSortOrder || 'asc';
      state.reverseShipping = settings.reverseShipping ?? false;
      state.showOrderLabel = settings.showOrderLabel ?? false;
      state.logoSize = settings.logoSize || 30;
      state.logoX = settings.logoX || 50;
      state.logoY = settings.logoY || 50;
      state.logoOpacity = settings.logoOpacity || 20;
      
      // 更新 UI
      const fontSizeSlider = document.getElementById('bv-font-size');
      if (fontSizeSlider) {
        fontSizeSlider.value = state.fontSize;
        document.getElementById('bv-font-size-value').textContent = state.fontSize.toFixed(1);
        updateRangeProgress(fontSizeSlider);
      }
      
      const hideExtraInfoCheckbox = document.getElementById('bv-hide-extra-info');
      if (hideExtraInfoCheckbox) {
        hideExtraInfoCheckbox.checked = state.hideExtraInfo;
      }
      
      const hideTableHeaderCheckbox = document.getElementById('bv-hide-table-header');
      if (hideTableHeaderCheckbox) {
        hideTableHeaderCheckbox.checked = state.hideTableHeader;
      }
      
      // 更新列印模式
      document.querySelectorAll('input[name="print-mode"]').forEach(radio => {
        radio.checked = radio.value === state.printMode;
        const option = radio.closest('.bv-mode-option');
        if (option) {
          option.classList.toggle('selected', radio.checked);
        }
      });
      
      document.querySelectorAll('input[name="match-mode"]').forEach(radio => {
        radio.checked = radio.value === state.matchMode;
      });
      
      // 更新排序按鈕
      document.querySelectorAll('.bv-sort-button').forEach(btn => {
        const type = btn.dataset.type;
        const order = btn.dataset.order;
        
        btn.classList.toggle('active', 
          (type === 'detail' && order === state.detailSortOrder) ||
          (type === 'shipping' && order === state.shippingSortOrder)
        );
      });
      
      const reverseShippingCheckbox = document.getElementById('bv-reverse-shipping');
      if (reverseShippingCheckbox) {
        reverseShippingCheckbox.checked = state.reverseShipping;
      }
      
      const showOrderLabelCheckbox = document.getElementById('bv-show-order-label');
      if (showOrderLabelCheckbox) {
        showOrderLabelCheckbox.checked = state.showOrderLabel;
      }
      
      // 更新 Logo 設定
      if (state.logoDataUrl) {
        const sizeSlider = document.getElementById('logo-size-slider');
        const xSlider = document.getElementById('logo-x-slider');
        const ySlider = document.getElementById('logo-y-slider');
        const opacitySlider = document.getElementById('logo-opacity-slider');
        
        if (sizeSlider) {
          sizeSlider.value = state.logoSize;
          document.getElementById('logo-size').textContent = state.logoSize + '%';
          updateRangeProgress(sizeSlider);
        }
        
        if (xSlider) {
          xSlider.value = state.logoX;
          document.getElementById('logo-x').textContent = state.logoX + '%';
          updateRangeProgress(xSlider);
        }
        
        if (ySlider) {
          ySlider.value = state.logoY;
          document.getElementById('logo-y').textContent = state.logoY + '%';
          updateRangeProgress(ySlider);
        }
        
        if (opacitySlider) {
          opacitySlider.value = state.logoOpacity;
          document.getElementById('logo-opacity').textContent = state.logoOpacity + '%';
          updateRangeProgress(opacitySlider);
        }
      }
      
      // 儲存設定
      saveSettings();
      saveLogo();
      
      // 更新樣式
      if (state.isConverted) {
        updateLabelStyles();
        updatePrintModeUI();
        updatePreview();
      }
      
      // 高亮顯示已載入的設定檔
      document.querySelectorAll('.bv-preset-item').forEach(item => {
        item.classList.toggle('active', item.dataset.presetId === presetId);
      });
      
      showNotification(`已載入設定檔: ${preset.name}`);
    });
  }
  
  // 刪除設定檔
  function deletePreset(presetId) {
    chrome.storage.local.get('bvPresets', (result) => {
      const presets = result.bvPresets || {};
      delete presets[presetId];
      
      chrome.storage.local.set({ bvPresets: presets }, () => {
        showNotification('設定檔已刪除');
        updatePresetList();
      });
    });
  }
  
  // 初始化延遲載入
  function initLazyLoad() {
    if (!state.isConverted) return;
    
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.01
    };
    
    state.lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const page = entry.target;
          const orderIndex = page.getAttribute('data-order-index');
          const cacheKey = `${orderIndex}_${state.labelFormat}_${state.hideExtraInfo}_${state.hideTableHeader}`;
          
          if (!state.previewCache.has(cacheKey)) {
            // 生成並快取內容
            const content = generatePageContent(orderIndex);
            state.previewCache.set(cacheKey, content);
            page.innerHTML = content;
          }
          
          state.lazyLoadObserver.unobserve(page);
        }
      });
    }, options);
  }
  
  // 生成頁面內容（供延遲載入使用）
  function generatePageContent(orderIndex) {
    // 這裡實際生成頁面內容的邏輯
    // 回傳 HTML 字串
    return '';
  }

  // ========================================================================================
  // 第十部分：初始化
  // ========================================================================================
  
  // 初始化擴充功能
  function initializeExtension() {
    // 檢查頁面類型
    detectCurrentPage();
    
    // 如果不是支援的頁面，就不執行
    if (!state.currentPageType) {
      console.log('BV SHOP 出貨助手：非支援頁面');
      return;
    }
    
    console.log('BV SHOP 出貨助手：初始化中...', {
      pageType: state.currentPageType,
      provider: state.currentProvider,
      url: window.location.href
    });
    
    // 載入 UI 模式設定
    chrome.storage.local.get('bvUiMode', (result) => {
      state.uiMode = result.bvUiMode || CONFIG.UI_MODES.NORMAL;
      
      // 建立控制面板
      createControlPanel();
      
      // 監聽 storage 變化（用於多分頁同步）
      state.storageListener = function(changes, namespace) {
        if (namespace === 'local') {
          // 同步物流單資料變化
          if (changes.shippingDataBatches || changes.shippingData || changes.pdfShippingData) {
            if (state.isConverted) {
              checkShippingDataStatus();
              
              // 如果列印模式需要物流單，則更新預覽
              if (state.printMode !== CONFIG.PRINT_MODES.DETAIL_ONLY) {
                handlePagination();
              }
            }
          }
          
          // 同步 UI 模式變化
          if (changes.bvUiMode) {
            state.uiMode = changes.bvUiMode.newValue;
            const panel = document.getElementById('bv-label-control-panel');
            if (panel) {
              if (state.uiMode === CONFIG.UI_MODES.GENIE) {
                panel.classList.add('genie-mode');
              } else {
                panel.classList.remove('genie-mode');
              }
              panel.innerHTML = getPanelContent();
              setupEventListeners();
              loadSettings();
            }
          }
        }
      };
      
      chrome.storage.onChanged.addListener(state.storageListener);
    });
    
    // 監聽頁面變化（用於 SPA 應用）
    observePageChanges();
    
    // 注入通知樣式
    injectNotificationStyles();
    
    console.log('BV SHOP 出貨助手：初始化完成');
  }
  
  // 監聽頁面變化
  function observePageChanges() {
    // 監聽 URL 變化（用於 SPA）
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        
        // 清理舊的面板
        const oldPanel = document.getElementById('bv-label-control-panel');
        const oldMinButton = document.getElementById('bv-minimized-button');
        if (oldPanel) oldPanel.remove();
        if (oldMinButton) oldMinButton.remove();
        
        // 清理 observer
        if (state.lazyLoadObserver) {
          state.lazyLoadObserver.disconnect();
          state.lazyLoadObserver = null;
        }
        
        if (state.autoCheckInterval) {
          clearInterval(state.autoCheckInterval);
          state.autoCheckInterval = null;
        }
        
        // 重新初始化
        setTimeout(() => {
          state.isConverted = false;
          state.currentPageType = null;
          state.currentProvider = null;
          initializeExtension();
        }, 500);
      }
    }).observe(document, { subtree: true, childList: true });
    
    // 監聽動態內容載入
    if (state.currentPageType === CONFIG.PAGE_TYPES.ORDER_LIST) {
      observeOrderListChanges();
    }
  }
  
  // 監聽訂單列表變化
  function observeOrderListChanges() {
    const targetNode = document.querySelector('.order-container, .content-wrapper, body');
    if (!targetNode) return;
    
    const observer = new MutationObserver((mutations) => {
      // 檢查是否有新的訂單內容載入
      const hasNewOrders = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === 1) {
            return node.classList?.contains('order-content') || 
                   node.querySelector?.('.order-content');
          }
          return false;
        });
      });
      
      if (hasNewOrders && state.isConverted) {
        // 延遲處理，確保 DOM 完全載入
        setTimeout(() => {
          handlePagination();
          
          if (state.highlightQuantity) {
            applyQuantityHighlight();
          }
        }, 300);
      }
    });
    
    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }
  
  // 注入通知樣式
  function injectNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .bv-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fff;
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10001;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 400px;
      }
      
      .bv-notification.show {
        transform: translateY(0);
        opacity: 1;
      }
      
      .bv-notification .material-icons {
        font-size: 24px;
      }
      
      .bv-notification.success {
        border-left: 4px solid #4caf50;
      }
      
      .bv-notification.success .material-icons {
        color: #4caf50;
      }
      
      .bv-notification.warning {
        border-left: 4px solid #ff9800;
      }
      
      .bv-notification.warning .material-icons {
        color: #ff9800;
      }
      
      .bv-notification.error {
        border-left: 4px solid #f44336;
      }
      
      .bv-notification.error .material-icons {
        color: #f44336;
      }
    `;
    document.head.appendChild(style);
  }
  
  // 清理函數（當擴充功能停用時）
  function cleanup() {
    // 移除 storage 監聽器
    if (state.storageListener) {
      chrome.storage.onChanged.removeListener(state.storageListener);
    }
    
    // 清除 interval
    if (state.autoCheckInterval) {
      clearInterval(state.autoCheckInterval);
    }
    
    // 斷開 observer
    if (state.lazyLoadObserver) {
      state.lazyLoadObserver.disconnect();
    }
    
    // 移除 DOM 元素
    const panel = document.getElementById('bv-label-control-panel');
    const minButton = document.getElementById('bv-minimized-button');
    const notifications = document.querySelectorAll('.bv-notification');
    
    if (panel) panel.remove();
    if (minButton) minButton.remove();
    notifications.forEach(n => n.remove());
    
    // 恢復原始狀態
    if (state.isConverted) {
      revertToOriginal();
    }
    
    console.log('BV SHOP 出貨助手：已清理');
  }
  
  // 監聽擴充功能訊息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'cleanup') {
      cleanup();
      sendResponse({ status: 'cleaned' });
    }
  });
  
  // 開始初始化
  initializeExtension();
})();
