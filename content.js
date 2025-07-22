// BV SHOP 出貨助手 (Wizard整合版 v7.0)
(function() {
  'use strict';
  
  // ===== 初始化設定區塊 =====
  
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
  
  // 載入 Noto Sans TC 字體
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
  document.head.appendChild(fontLink);
  
  // ===== 設定常數 =====
  const CONFIG = {
    // 頁面類型
    PAGE_TYPES: {
      ORDER_PRINT: 'order_print',
      SHIPPING: 'shipping'
    },
    
    // 物流供應商設定
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
    
    // Wizard 步驟定義
    WIZARD_STEPS: {
      FORMAT: {
        id: 'format',
        title: '選擇標籤格式',
        icon: 'aspect_ratio',
        description: '選擇要使用的標籤尺寸'
      },
      SHIPPING: {
        id: 'shipping',
        title: '物流單整合',
        icon: 'local_shipping',
        description: '上傳或匯入物流單資料'
      },
      LAYOUT: {
        id: 'layout',
        title: '版面設定',
        icon: 'tune',
        description: '調整文字大小與顯示選項'
      },
      PRINT_MODE: {
        id: 'print-mode',
        title: '列印模式',
        icon: 'print',
        description: '選擇列印方式與順序'
      },
      PREVIEW: {
        id: 'preview',
        title: '預覽與列印',
        icon: 'preview',
        description: '檢視結果並列印'
      }
    }
  };
  
  // ===== 狀態管理 =====
  let state = {
    // 基本狀態
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
    
    // 資料儲存
    shippingData: [],
    detailData: [],
    pdfShippingData: [],
    shippingDataBatches: [],  // 儲存多批次的物流單資料
    
    // 頁面管理
    detailPages: [],
    shippingPages: [],
    
    // 整合設定
    enableIntegration: false,
    cachedProviderSettings: {},
    previewCache: new Map(),
    lazyLoadObserver: null,
    
    // 配對與排序
    matchingResults: [],
    matchMode: CONFIG.MATCH_MODES.INDEX,
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
    
    // 自動檢查
    autoCheckInterval: null,
    
    // Wizard 狀態
    currentWizardStep: 'format',
    wizardMode: true,  // 預設啟用精靈模式
    completedSteps: new Set(),
    visitedSteps: new Set()
  };
  
  // ===== 主要功能區塊 =====
  
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
  
  // ===== 頁面偵測功能 =====
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

// ===== CSS 內容 =====
function getCSSContent() {
  return `
    /* === 通知樣式 === */
    .bv-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10000;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    }
    
    .bv-notification.show {
      transform: translateX(0);
    }
    
    .bv-notification.success {
      border-left: 4px solid #10b981;
    }
    
    .bv-notification.warning {
      border-left: 4px solid #f59e0b;
    }
    
    .bv-notification.error {
      border-left: 4px solid #ef4444;
    }
    
    .bv-notification .material-icons {
      font-size: 24px;
    }
    
    .bv-notification.success .material-icons {
      color: #10b981;
    }
    
    .bv-notification.warning .material-icons {
      color: #f59e0b;
    }
    
    .bv-notification.error .material-icons {
      color: #ef4444;
    }
    
    /* === 最小化按鈕樣式 === */
    .bv-minimized-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #518aff 0%, #6366f1 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(81, 138, 255, 0.3);
      display: none;
      align-items: center;
      gap: 8px;
      z-index: 9999;
      transition: all 0.3s ease;
      font-size: 14px;
      font-weight: 500;
    }
    
    .bv-minimized-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(81, 138, 255, 0.4);
    }
    
    .bv-minimized-button .material-icons {
      font-size: 20px;
    }
    
    /* === 主控制面板樣式 === */
    .bv-label-control-panel {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      max-height: calc(100vh - 40px);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .bv-label-control-panel.minimized {
      transform: translateX(450px);
      opacity: 0;
      pointer-events: none;
    }
    
    /* === 玻璃擬態面板 === */
    .bv-glass-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    .bv-panel-header {
      padding: 20px;
      background: linear-gradient(135deg, rgba(81, 138, 255, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .bv-header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .bv-icon-wrapper {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #518aff 0%, #6366f1 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(81, 138, 255, 0.3);
    }
    
    .bv-icon-wrapper.bv-label-mode {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    
    .bv-icon-wrapper.bv-shipping-mode {
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
    }
    
    .bv-icon-wrapper .material-icons {
      color: white;
      font-size: 24px;
    }
    
    .bv-title-group {
      display: flex;
      flex-direction: column;
    }
    
    .bv-panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #000;
    }
    
    .bv-panel-subtitle {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
      margin-top: 2px;
    }
    
    /* === 玻璃擬態按鈕 === */
    .bv-glass-button {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
    }
    
    .bv-glass-button:hover {
      background: rgba(255, 255, 255, 0.8);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .bv-glass-button:active {
      transform: translateY(0);
    }
    
    .bv-glass-button .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.7);
    }
    
    .bv-glass-button.bv-primary {
      background: rgba(81, 138, 255, 0.1);
      border-color: rgba(81, 138, 255, 0.2);
    }
    
    .bv-glass-button.bv-primary:hover {
      background: rgba(81, 138, 255, 0.15);
    }
    
    .bv-glass-button.bv-primary .material-icons {
      color: #518aff;
    }
    
    /* === 面板內容區域 === */
    .bv-panel-content-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    
    .bv-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      min-height: 0;
    }
    
    .bv-panel-body::-webkit-scrollbar {
      width: 6px;
    }
    
    .bv-panel-body::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.02);
      border-radius: 3px;
    }
    
    .bv-panel-body::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 3px;
    }
    
    .bv-panel-body::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.2);
    }
    
    /* === 主要操作區域 === */
    .bv-primary-section {
      margin-bottom: 24px;
    }
    
    .bv-primary-button {
      width: 100%;
      background: linear-gradient(135deg, #518aff 0%, #6366f1 100%);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(81, 138, 255, 0.3);
    }
    
    .bv-primary-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(81, 138, 255, 0.4);
    }
    
    .bv-primary-button:active {
      transform: translateY(0);
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
      font-size: 28px;
      color: white;
    }
    
    .bv-button-content {
      flex: 1;
      text-align: left;
    }
    
    .bv-button-title {
      display: block;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .bv-button-subtitle {
      display: block;
      font-size: 13px;
      opacity: 0.9;
    }
    
    /* === 設定卡片 === */
    .bv-settings-card {
      background: rgba(248, 250, 252, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      transition: all 0.3s ease;
    }
    
    .bv-settings-card.collapsed {
      padding-bottom: 0;
    }
    
    .bv-settings-card.collapsed .bv-card-content {
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      margin-top: 0;
    }
    
    .bv-settings-card.collapsed .bv-collapse-icon .material-icons {
      transform: rotate(-90deg);
    }
    
    .bv-card-title {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 600;
      color: #000;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    
    .bv-card-content {
      transition: all 0.3s ease;
      max-height: 1000px;
      opacity: 1;
    }
    
    .bv-collapse-icon {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }
    
    .bv-collapse-icon .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.4);
      transition: transform 0.3s ease;
    }
    
    .bv-card-title .material-icons:not(.bv-collapse-icon .material-icons) {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* === 設定項目 === */
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
    
    .bv-setting-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    
    .bv-setting-info .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.4);
    }
    
    .bv-setting-text {
      flex: 1;
    }
    
    .bv-setting-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #000;
      margin-bottom: 2px;
    }
    
    .bv-setting-desc {
      display: block;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* === 玻璃擬態開關 === */
    .bv-glass-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 26px;
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
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      border-radius: 13px;
      border: 1px solid rgba(0, 0, 0, 0.08);
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
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .bv-glass-switch input:checked + .bv-switch-slider {
      background: linear-gradient(135deg, #518aff 0%, #6366f1 100%);
      border-color: transparent;
    }
    
    .bv-glass-switch input:checked + .bv-switch-slider:before {
      transform: translateX(18px);
    }
    
    .bv-glass-switch.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    
    /* === 滑桿樣式 === */
    .bv-slider-group {
      margin-bottom: 20px;
    }
    
    .bv-slider-item {
      margin-bottom: 16px;
    }
    
    .bv-slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .bv-value-label {
      color: #518aff;
      font-weight: 600;
      min-width: 45px;
      text-align: right;
    }
    
    .bv-glass-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(to right, #518aff 0%, #518aff var(--progress, 0%), rgba(0, 0, 0, 0.1) var(--progress, 0%), rgba(0, 0, 0, 0.1) 100%);
      outline: none;
      transition: all 0.3s ease;
    }
    
    .bv-glass-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      border: 2px solid #518aff;
      transition: all 0.2s ease;
    }
    
    .bv-glass-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(81, 138, 255, 0.3);
    }
    
    /* === 面板底部 === */
    .bv-panel-footer {
      padding: 16px 20px;
      background: rgba(248, 250, 252, 0.8);
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    .bv-glass-action-button {
      width: 100%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
    }
    
    .bv-glass-action-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(16, 185, 129, 0.4);
    }
    
    .bv-glass-action-button:active {
      transform: translateY(0);
    }
    
    .bv-glass-action-button .material-icons {
      font-size: 20px;
    }
    
    /* === 精靈模式切換 === */
    .bv-mode-switch {
      padding: 16px 20px;
      background: rgba(240, 242, 245, 0.5);
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    
    .bv-mode-switch-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.7);
      font-weight: 500;
    }
    
    .bv-mode-switch-label .material-icons {
      font-size: 20px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* === 精靈模式步驟 === */
    .bv-wizard-steps {
      display: flex;
      padding: 0 20px 20px;
      gap: 8px;
      overflow-x: auto;
    }
    
    .bv-wizard-steps::-webkit-scrollbar {
      height: 4px;
    }
    
    .bv-wizard-steps::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.02);
    }
    
    .bv-wizard-steps::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 2px;
    }
    
    .bv-wizard-step {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.5);
      white-space: nowrap;
      cursor: default;
      transition: all 0.3s ease;
    }
    
    .bv-wizard-step.visited {
      cursor: pointer;
    }
    
    .bv-wizard-step.visited:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(81, 138, 255, 0.2);
    }
    
    .bv-wizard-step.active {
      background: linear-gradient(135deg, rgba(81, 138, 255, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
      border-color: #518aff;
      color: #518aff;
    }
    
    .bv-wizard-step.completed {
      color: #10b981;
      border-color: rgba(16, 185, 129, 0.3);
    }
    
    .bv-wizard-step-number {
      width: 24px;
      height: 24px;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .bv-wizard-step.active .bv-wizard-step-number {
      background: #518aff;
      color: white;
    }
    
    .bv-wizard-step.completed .bv-wizard-step-number {
      background: #10b981;
      color: white;
    }
    
    .bv-wizard-step.completed .bv-wizard-step-number .material-icons {
      font-size: 16px;
    }
    
    .bv-wizard-step-title {
      font-weight: 500;
    }
    
    /* === 精靈內容區域 === */
    .bv-wizard-content {
      animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .bv-wizard-header {
      margin-bottom: 24px;
    }
    
    .bv-wizard-header h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #000;
    }
    
    .bv-wizard-header p {
      margin: 0;
      font-size: 14px;
      color: rgba(0, 0, 0, 0.5);
      line-height: 1.5;
    }
    
    /* === 精靈導航按鈕 === */
    .bv-wizard-navigation {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      gap: 12px;
    }
    
    .bv-wizard-nav-btn {
      flex: 1;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.7);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    
    .bv-wizard-nav-btn:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .bv-wizard-nav-btn.primary {
      background: linear-gradient(135deg, #518aff 0%, #6366f1 100%);
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(81, 138, 255, 0.3);
    }
    
    .bv-wizard-nav-btn.primary:hover {
      box-shadow: 0 6px 20px rgba(81, 138, 255, 0.4);
    }
    
    .bv-wizard-nav-btn .material-icons {
      font-size: 18px;
    }
    
    /* === 格式選擇器 === */
    .bv-format-selector {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .bv-format-option {
      display: flex;
      align-items: center;
      padding: 16px;
      background: rgba(255, 255, 255, 0.6);
      border: 2px solid rgba(0, 0, 0, 0.08);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-format-option:hover {
      background: rgba(255, 255, 255, 0.8);
      border-color: rgba(81, 138, 255, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .bv-format-option.selected {
      background: rgba(81, 138, 255, 0.08);
      border-color: #518aff;
    }
    
    .bv-format-option input[type="radio"] {
      margin-right: 16px;
      width: 20px;
      height: 20px;
      cursor: pointer;
    }
    
    .bv-format-info {
      flex: 1;
    }
    
    .bv-format-title {
      font-size: 16px;
      font-weight: 600;
      color: #000;
      margin-bottom: 4px;
    }
    
    .bv-format-desc {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* === 設定列表 === */
    .bv-settings-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    /* === 輸入框樣式 === */
    .bv-glass-input {
      width: 100%;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      font-size: 14px;
      color: #000;
      transition: all 0.2s ease;
      outline: none;
    }
    
    .bv-glass-input:focus {
      background: rgba(255, 255, 255, 0.9);
      border-color: #518aff;
      box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
    }
    
    .bv-glass-input::placeholder {
      color: rgba(0, 0, 0, 0.4);
    }
    
    /* === 底圖上傳區域 === */
    .bv-logo-upload-area {
      border: 2px dashed rgba(0, 0, 0, 0.2);
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
      background: rgba(248, 250, 252, 0.5);
    }
    
    .bv-logo-upload-area:hover {
      border-color: #518aff;
      background: rgba(81, 138, 255, 0.05);
    }
    
    .bv-logo-upload-area.dragover {
      border-color: #518aff;
      background: rgba(81, 138, 255, 0.1);
    }
    
    .bv-logo-preview {
      max-width: 100%;
      max-height: 120px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .bv-upload-hint {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.5);
      margin-top: 8px;
    }
    
    /* === 底圖控制項 === */
    .bv-logo-controls {
      display: none;
      margin-top: 16px;
    }
    
    .bv-remove-logo-btn {
      width: 100%;
      padding: 10px;
      background: rgba(244, 67, 54, 0.08);
      border: 1px solid rgba(244, 67, 54, 0.2);
      border-radius: 8px;
      color: #f44336;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s ease;
      margin-top: 16px;
    }
    
    .bv-remove-logo-btn:hover {
      background: rgba(244, 67, 54, 0.12);
      transform: translateY(-1px);
    }
    
    .bv-remove-logo-btn .material-icons {
      font-size: 18px;
    }
    
    /* === 標籤頁面樣式 === */
    body.bv-converted {
      background: #f5f5f5 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: auto !important;
      max-width: none !important;
      min-width: auto !important;
    }
    
    body.bv-converted > *:not(.bv-page-container):not(#bv-label-control-panel):not(.bv-minimized-button):not(.bv-notification) {
      display: none !important;
    }
    
    .bv-page-container {
      margin: 20px auto;
      display: flex;
      justify-content: center;
    }
    
    .bv-label-page {
      background: white;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: relative;
      overflow: hidden;
    }
    
    /* 10×15 格式 */
    .bv-label-page.format-10x15,
    body.format-10x15 .bv-label-page {
      width: 100mm;
      height: 150mm;
      padding: 5mm;
      box-sizing: border-box;
    }
    
    /* 10×10 格式 */
    .bv-label-page.format-10x10,
    body.format-10x10 .bv-label-page {
      width: 100mm;
      height: 100mm;
      padding: 5mm;
      box-sizing: border-box;
    }
    
    .bv-page-content {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    /* === 底圖背景 === */
    .bv-logo-background {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-repeat: no-repeat;
      pointer-events: none;
      z-index: 0;
    }
    
    .bv-page-content > *:not(.bv-logo-background) {
      position: relative;
      z-index: 1;
    }
    
    /* === 標籤內容樣式調整 === */
    .bv-label-page .cutomer-order {
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
    
    .bv-label-page .order-info-card,
    .bv-label-page .order-payment-details {
      margin-bottom: 12px !important;
    }
    
    .bv-label-page .card-header {
      padding: 8px 12px !important;
      font-size: 13px !important;
    }
    
    .bv-label-page .card-body {
      padding: 12px !important;
    }
    
    .bv-label-page .field-label {
      font-size: 11px !important;
      color: rgba(0, 0, 0, 0.6) !important;
    }
    
    .bv-label-page .field-value {
      font-size: 12px !important;
      font-weight: 500 !important;
    }
    
    .bv-label-page .order-product-list {
      font-size: 11px !important;
    }
    
    .bv-label-page .order-product-list th,
    .bv-label-page .order-product-list td {
      padding: 6px 8px !important;
    }
    
    .bv-label-page .list-item-name {
      max-width: none !important;
    }
    
    .bv-label-page .list-item-name a {
      color: #333 !important;
      text-decoration: none !important;
    }
    
    /* === 數量標示樣式 === */
    .bv-qty-marker {
      color: #ff5722;
      font-weight: bold;
      margin-left: 4px;
    }
    
    /* === 精簡模式樣式 === */
    body.bv-converted .order-content.bv-original {
      display: none !important;
    }
    
    /* === 列印時的頁面設定 === */
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
    
    /* === 物流單狀態樣式 === */
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
    
    /* === PDF 上傳區域樣式 === */
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
    
    /* === 轉換進度樣式 === */
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
    
    /* === 物流單頁面樣式 === */
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
    
    /* === 列印模式選擇器樣式 === */
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
    
    /* === 排序選項樣式 === */
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
    
    /* === 超商物流單特殊處理 === */
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
    
    /* === 保護 QR Code === */
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
    
    /* === 商品圖片欄位 === */
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
    
    /* === 確保 10×15 模式下圖片可見 === */
    .bv-label-page .bv-product-image-col img,
    .bv-label-page .bv-product-img {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    /* === 確保原始 orderProductImage 在原位置隱藏 === */
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
      
      .bv-label-page.bv-shipping-page {
        padding: 3mm !important;
      }
    }
    
    /* === 預設管理優化 === */
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
    
    /* === 簡化的設定檔管理 === */
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
    
    /* === 物流單批次管理 === */
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
    
    /* === 物流單反序開關 === */
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
    
    /* === 配對結果顯示 === */
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
    
    .bv-matching-result-item.unmatched {
      color: #f44336;
    }
    
    /* === 配對模式選擇 === */
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
    
    /* === 確保商品圖片顯示 === */
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
  
  // ===== 取得樣式內容 =====
  function getStyleContent() {
    return `
      /* 這裡插入之前提供的所有 CSS 樣式內容 */
      ${getCSSContent()}
    `;
  }
  
  // ===== UI 建立功能 =====
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
  
  // ===== 樣式管理 =====
  function getPanelStyles() {
    return `
    /* === 基本樣式重置 === */
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
    
    /* === 主面板樣式 === */
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

    /* === Wizard 步驟指示器樣式 === */
    .bv-wizard-steps {
      padding: 20px 24px;
      background: rgba(248, 250, 252, 0.95);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: space-between;
      position: relative;
    }
    
    .bv-wizard-step {
      flex: 1;
      text-align: center;
      cursor: pointer;
      position: relative;
      z-index: 2;
    }
    
    .bv-wizard-step:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 20px;
      right: -50%;
      width: 100%;
      height: 2px;
      background: rgba(0, 0, 0, 0.1);
      z-index: -1;
    }
    
    .bv-wizard-step.completed:not(:last-child)::after {
      background: #10b981;
    }
    
    .bv-wizard-step-number {
      width: 40px;
      height: 40px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 8px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
    }
    
    .bv-wizard-step.active .bv-wizard-step-number {
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      color: white;
      box-shadow: 0 3px 12px rgba(81, 138, 255, 0.3);
    }
    
    .bv-wizard-step.completed .bv-wizard-step-number {
      background: #10b981;
      color: white;
    }
    
    .bv-wizard-step.visited:not(.active):not(.completed) .bv-wizard-step-number {
      background: rgba(81, 138, 255, 0.1);
      color: #518aff;
    }
    
    .bv-wizard-step-number .material-icons {
      font-size: 20px;
    }
    
    .bv-wizard-step-title {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.4);
      font-weight: 500;
    }
    
    .bv-wizard-step.active .bv-wizard-step-title,
    .bv-wizard-step.completed .bv-wizard-step-title {
      color: #000;
    }
    
    /* === Wizard 內容區域 === */
    .bv-wizard-content {
      padding: 24px;
      min-height: 300px;
    }
    
    .bv-wizard-header {
      margin-bottom: 24px;
      text-align: center;
    }
    
    .bv-wizard-header h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #000;
    }
    
    .bv-wizard-header p {
      margin: 0;
      font-size: 14px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    /* === Wizard 導航按鈕 === */
    .bv-wizard-navigation {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }
    
    .bv-wizard-nav-btn {
      flex: 1;
      padding: 12px 20px;
      background: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.7);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .bv-wizard-nav-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      transform: translateY(-1px);
    }
    
    .bv-wizard-nav-btn.primary {
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      color: white;
      border: none;
      box-shadow: 0 3px 12px rgba(81, 138, 255, 0.25);
    }
    
    .bv-wizard-nav-btn.primary:hover {
      box-shadow: 0 6px 20px rgba(81, 138, 255, 0.35);
    }
    
    .bv-wizard-nav-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
    
    /* === 模式切換開關 === */
    .bv-mode-switch {
      position: absolute;
      bottom: 20px;
      left: 24px;
      right: 24px;
      padding: 12px;
      background: rgba(248, 250, 252, 0.8);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-mode-switch-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* === 格式選擇器樣式 === */
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
    
    /* === Glass Panel 樣式 === */
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
    
    /* === 最小化按鈕樣式 === */
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
    
    /* === 面板標頭樣式 === */
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
    
    /* === Glass 按鈕樣式 === */
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
    
    /* === 內容區域樣式 === */
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
    
    /* === 主要按鈕樣式 === */
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
    
    /* === 設定卡片樣式 === */
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
    
    /* === 設定項目樣式 === */
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
    
    /* === 開關樣式 === */
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
    
    /* === 滑桿樣式 === */
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
    
    /* === 輸入框樣式 === */
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
    
    /* === 下拉選單樣式 === */
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
    
    /* === 頁尾樣式 === */
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
    
    /* === 滾動條樣式 === */
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
    
    /* === 通知樣式 === */
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
    
    /* === 數量標示樣式 === */
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
    
    /* === 圖片上傳區域樣式 === */
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
    
    /* === 底圖樣式 === */
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
    
    /* === 轉換後的頁面樣式 === */
    body.bv-converted {
      width: auto !important;
      max-width: none !important;
      min-width: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    /* === 10×10 格式的頁面樣式 === */
    .bv-label-page.format-10x10 {
      width: 377px !important;
      height: 377px !important;
    }
    
    /* === 10×10 格式的物流單特殊處理 === */
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
    
    /* === 10×10 格式下的超商物流單 === */
    .format-10x10 .bv-store-shipping-content {
      transform: scale(0.6);
      transform-origin: center center;
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
      
      .bv-label-page.format-10x10 {
        width: 377px !important;
        height: 377px !important;
        margin-bottom: 20px;
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
    
    /* === 列印時的頁面設定 === */
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
    
    /* === 物流單狀態樣式 === */
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
    
    /* === PDF 上傳區域樣式 === */
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
    
    /* === 轉換進度樣式 === */
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
    
    /* === 物流單頁面樣式 === */
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
    
    /* === 列印模式選擇器樣式 === */
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
    
    /* === 排序選項樣式 === */
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
    
    /* === 超商物流單特殊處理 === */
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
    
    /* === 保護 QR Code === */
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
    
    /* === 商品圖片欄位 === */
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
    
    /* === 確保 10×15 模式下圖片可見 === */
    .bv-label-page .bv-product-image-col img,
    .bv-label-page .bv-product-img {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    /* === 確保原始 orderProductImage 在原位置隱藏 === */
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
      
      .bv-label-page.bv-shipping-page {
        padding: 3mm !important;
      }
    }
    
    /* === 預設管理優化 === */
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
    
    /* === 簡化的設定檔管理 === */
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
    
    /* === 物流單批次管理 === */
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
    
    /* === 物流單反序開關 === */
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
    
    /* === 配對結果顯示 === */
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
    
    /* === 配對模式選擇 === */
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
    
    /* === 確保商品圖片顯示 === */
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
  
  // ===== UI 內容產生函式 =====
  function getPanelContent() {
    const collapseIcon = '<span class="bv-collapse-icon"><span class="material-icons">expand_more</span></span>';
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      return getShippingPanelContent();
    }
    
    if (!state.isConverted) {
      return getA4ModePanelContent();
    } else if (state.wizardMode) {
      return getWizardModePanelContent();
    } else {
      return getLabelModePanelContent(collapseIcon);
    }
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
                <span class="bv-button-title">轉換成標籤格式</span>
                <span class="bv-button-subtitle">建立10×15cm或10×10cm標籤</span>
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
                <span class="material-icons">star</span>
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
  
  // Wizard 模式面板內容
  function getWizardModePanelContent() {
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
        
        <div class="bv-wizard-steps">
          ${Object.values(CONFIG.WIZARD_STEPS).map((step, index) => `
            <div class="bv-wizard-step ${state.currentWizardStep === step.id ? 'active' : ''} ${state.completedSteps.has(step.id) ? 'completed' : ''} ${state.visitedSteps.has(step.id) ? 'visited' : ''}" data-step="${step.id}">
              <div class="bv-wizard-step-number">
                ${state.completedSteps.has(step.id) ? '<span class="material-icons">check</span>' : index + 1}
              </div>
              <div class="bv-wizard-step-title">${step.title}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="bv-panel-content-wrapper">
          <div class="bv-panel-body">
            <div class="bv-wizard-content">
              ${getWizardStepContent(state.currentWizardStep)}
            </div>
          </div>
          
          <div class="bv-mode-switch">
            <label class="bv-mode-switch-label">
              <span class="material-icons">assistant</span>
              精靈模式
            </label>
            <label class="bv-glass-switch">
              <input type="checkbox" id="bv-wizard-mode" checked>
              <span class="bv-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
  }
  
  // 取得 Wizard 步驟內容
  function getWizardStepContent(stepId) {
    const step = CONFIG.WIZARD_STEPS[Object.keys(CONFIG.WIZARD_STEPS).find(key => CONFIG.WIZARD_STEPS[key].id === stepId)];
    
    let content = `
      <div class="bv-wizard-header">
        <h3>${step.title}</h3>
        <p>${step.description}</p>
      </div>
    `;
    
    switch(stepId) {
      case 'format':
        content += getFormatStepContent();
        break;
      case 'shipping':
        content += getShippingStepContent();
        break;
      case 'layout':
        content += getLayoutStepContent();
        break;
      case 'print-mode':
        content += getPrintModeStepContent();
        break;
      case 'preview':
        content += getPreviewStepContent();
        break;
    }
    
    // 導航按鈕
    const currentIndex = Object.keys(CONFIG.WIZARD_STEPS).findIndex(key => CONFIG.WIZARD_STEPS[key].id === stepId);
    const isFirstStep = currentIndex === 0;
    const isLastStep = currentIndex === Object.keys(CONFIG.WIZARD_STEPS).length - 1;
    
    content += `
      <div class="bv-wizard-navigation">
        ${!isFirstStep ? `
          <button class="bv-wizard-nav-btn" id="bv-wizard-prev">
            <span class="material-icons">arrow_back</span>
            上一步
          </button>
        ` : ''}
        ${!isLastStep ? `
          <button class="bv-wizard-nav-btn primary" id="bv-wizard-next">
            下一步
            <span class="material-icons">arrow_forward</span>
          </button>
        ` : `
          <button class="bv-wizard-nav-btn primary" id="bv-wizard-finish">
            <span class="material-icons">print</span>
            完成並列印
          </button>
        `}
      </div>
    `;
    
    return content;
  }
  
  // 格式選擇步驟內容
  function getFormatStepContent() {
    return `
      <div class="bv-format-selector">
        <label class="bv-format-option ${state.labelFormat === '10x15' ? 'selected' : ''}">
          <input type="radio" name="label-format" value="10x15" ${state.labelFormat === '10x15' ? 'checked' : ''}>
          <div class="bv-format-info">
            <div class="bv-format-title">10×15cm</div>
            <div class="bv-format-desc">標準貼紙格式，適合一般出貨</div>
          </div>
        </label>
        
        <label class="bv-format-option ${state.labelFormat === '10x10' ? 'selected' : ''}">
          <input type="radio" name="label-format" value="10x10" ${state.labelFormat === '10x10' ? 'checked' : ''}>
          <div class="bv-format-info">
            <div class="bv-format-title">10×10cm</div>
            <div class="bv-format-desc">正方形貼紙格式，適合小包裝</div>
          </div>
        </label>
      </div>
    `;
  }
  
  // 物流單整合步驟內容
  function getShippingStepContent() {
    return `
      <div class="bv-integration-status ${state.shippingData.length > 0 || state.pdfShippingData.length > 0 ? 'success' : 'warning'}" id="bv-integration-status">
        ${state.shippingData.length > 0 || state.pdfShippingData.length > 0 ? `
          <span class="material-icons">check_circle</span>
          <div class="bv-status-info">
            <h4>已載入 ${state.shippingData.length + state.pdfShippingData.length} 張物流單</h4>
            <p>可整合列印</p>
          </div>
        ` : `
          <span class="material-icons">warning</span>
          <div class="bv-status-info">
            <h4>尚無物流單資料</h4>
            <p>請至物流單頁面抓取或上傳 PDF</p>
          </div>
        `}
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
      
      ${state.shippingDataBatches.length > 0 ? `
        <button class="bv-glass-button" id="bv-clear-shipping" style="margin-top: 12px; width: 100%;">
          <span class="material-icons">clear</span>
          清除物流單資料
        </button>
      ` : ''}
    `;
  }
  
  // 版面設定步驟內容
  function getLayoutStepContent() {
    return `
      <div class="bv-slider-group">
        <div class="bv-slider-item">
          <div class="bv-slider-header">
            <span>文字大小</span>
            <span class="bv-value-label" id="bv-font-size-value">${state.fontSize}.0</span>
          </div>
          <input type="range" id="bv-font-size" min="11" max="13" step="0.1" value="${state.fontSize}" class="bv-glass-slider">
        </div>
      </div>
      
      <div class="bv-settings-list" style="margin-top: 20px;">
        <div class="bv-setting-item">
          <div class="bv-setting-info">
            <span class="material-icons">star</span>
            <div class="bv-setting-text">
              <span class="bv-setting-label">數量標示</span>
              <span class="bv-setting-desc">標示數量 ≥ 2（▲）</span>
            </div>
          </div>
          <label class="bv-glass-switch">
            <input type="checkbox" id="bv-highlight-qty" ${state.highlightQuantity ? 'checked' : ''}>
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
            <input type="checkbox" id="bv-hide-extra-info" ${state.hideExtraInfo ? 'checked' : ''}>
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
            <input type="checkbox" id="bv-hide-table-header" ${state.hideTableHeader ? 'checked' : ''}>
            <span class="bv-switch-slider"></span>
          </label>
        </div>
      </div>
    `;
  }
  
  // 列印模式步驟內容
  function getPrintModeStepContent() {
    return `
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
            <div class="bv-mode-desc">依順序交錯列印</div>
          </div>
        </label>
      </div>
      
      ${state.printMode === 'manual_match' ? `
        <div class="bv-match-mode-selector" id="bv-match-mode-selector" style="margin-top: 16px;">
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
      ` : ''}
    `;
  }
  
  // 預覽步驟內容
  function getPreviewStepContent() {
    const detailCount = state.detailPages.length;
    const shippingCount = state.shippingPages.length;
    
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="margin-bottom: 20px;">
          <span class="material-icons" style="font-size: 48px; color: #10b981;">check_circle</span>
        </div>
        <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">準備完成！</h4>
        <p style="margin: 0 0 20px 0; color: rgba(0, 0, 0, 0.5);">
          已準備 ${detailCount} 張出貨明細${shippingCount > 0 ? ` 與 ${shippingCount} 張物流單` : ''}
        </p>
        
        <div style="background: rgba(248, 250, 252, 0.8); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #000; margin-bottom: 8px;">列印設定摘要</div>
          <div style="font-size: 12px; color: rgba(0, 0, 0, 0.5); text-align: left;">
            • 標籤格式：${CONFIG.LABEL_FORMATS[state.labelFormat].name}<br>
            • 列印模式：${state.printMode === 'detail_only' ? '出貨明細' : state.printMode === 'shipping_only' ? '物流單' : '出貨明細-物流單'}<br>
            • 文字大小：${state.fontSize}px<br>
            • 數量標示：${state.highlightQuantity ? '開啟' : '關閉'}<br>
            • 精簡模式：${state.hideExtraInfo ? '開啟' : '關閉'}
          </div>
        </div>
      </div>
    `;
  }
  
  // 標籤模式面板內容（進階模式）
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
            
            <!-- 物流單整合卡片 -->
            <div class="bv-settings-card" data-section="shipping">
              <h4 class="bv-card-title">
                <span class="material-icons">local_shipping</span>
                物流單整合
                ${collapseIcon}
              </h4>
              
              <div class="bv-card-content">
                <div class="bv-integration-status ${state.shippingData.length > 0 || state.pdfShippingData.length > 0 ? 'success' : 'warning'}" id="bv-integration-status">
                  ${state.shippingData.length > 0 || state.pdfShippingData.length > 0 ? `
                    <span class="material-icons">check_circle</span>
                    <div class="bv-status-info">
                      <h4>已載入 ${state.shippingData.length + state.pdfShippingData.length} 張物流單</h4>
                      <p>可整合列印</p>
                    </div>
                  ` : `
                    <span class="material-icons">warning</span>
                    <div class="bv-status-info">
                      <h4>尚無物流單資料</h4>
                      <p>請至物流單頁面抓取或上傳 PDF</p>
                    </div>
                  `}
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
            
            <!-- 版面設定卡片 -->
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
                      <span class="material-icons">star</span>
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
          
          <div class="bv-mode-switch">
            <label class="bv-mode-switch-label">
              <span class="material-icons">assistant</span>
              精靈模式
            </label>
            <label class="bv-glass-switch">
              <input type="checkbox" id="bv-wizard-mode">
              <span class="bv-switch-slider"></span>
            </label>
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
  
  // ===== 物流單頁面初始化 =====
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
  
  // ===== 事件監聽器設定 =====
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
    
    // Wizard 模式切換
    const wizardModeSwitch = document.getElementById('bv-wizard-mode');
    if (wizardModeSwitch) {
      wizardModeSwitch.addEventListener('change', function() {
        state.wizardMode = this.checked;
        chrome.storage.local.set({ bvWizardMode: state.wizardMode });
        updatePanelContent();
      });
    }
    
    // Wizard 步驟點擊
    document.querySelectorAll('.bv-wizard-step').forEach(step => {
      step.addEventListener('click', function() {
        const stepId = this.dataset.step;
        if (state.visitedSteps.has(stepId) || state.completedSteps.has(stepId)) {
          goToWizardStep(stepId);
        }
      });
    });
    
    // Wizard 導航按鈕
    const wizardPrevBtn = document.getElementById('bv-wizard-prev');
    const wizardNextBtn = document.getElementById('bv-wizard-next');
    const wizardFinishBtn = document.getElementById('bv-wizard-finish');
    
    if (wizardPrevBtn) {
      wizardPrevBtn.addEventListener('click', () => {
        const currentIndex = Object.keys(CONFIG.WIZARD_STEPS).findIndex(key => 
          CONFIG.WIZARD_STEPS[key].id === state.currentWizardStep
        );
        if (currentIndex > 0) {
          const prevStep = CONFIG.WIZARD_STEPS[Object.keys(CONFIG.WIZARD_STEPS)[currentIndex - 1]].id;
          goToWizardStep(prevStep);
        }
      });
    }
    
    if (wizardNextBtn) {
      wizardNextBtn.addEventListener('click', () => {
        // 標記當前步驟為完成
        state.completedSteps.add(state.currentWizardStep);
        
        const currentIndex = Object.keys(CONFIG.WIZARD_STEPS).findIndex(key => 
          CONFIG.WIZARD_STEPS[key].id === state.currentWizardStep
        );
        if (currentIndex < Object.keys(CONFIG.WIZARD_STEPS).length - 1) {
          const nextStep = CONFIG.WIZARD_STEPS[Object.keys(CONFIG.WIZARD_STEPS)[currentIndex + 1]].id;
          goToWizardStep(nextStep);
        }
      });
    }
    
    if (wizardFinishBtn) {
      wizardFinishBtn.addEventListener('click', () => {
        preparePrintWithMode();
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
  
  // ===== Wizard 步驟管理 =====
  function goToWizardStep(stepId) {
    state.currentWizardStep = stepId;
    state.visitedSteps.add(stepId);
    updatePanelContent();
  }
  
  // ===== 預覽更新 =====
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
  
  // ===== 列印模式 UI 更新 =====
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
  
  // ===== 列印準備功能 =====
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
  
  // ===== 排序功能 =====
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
  
  // ===== 物流單功能 =====
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
  
  // ===== 標籤模式事件監聽器 =====
  function setupLabelModeEventListeners() {
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
    
    // 精簡模式
    const hideExtraInfoCheckbox = document.getElementById('bv-hide-extra-info');
    if (hideExtraInfoCheckbox) {
      hideExtraInfoCheckbox.addEventListener('change', function(e) {
        state.hideExtraInfo = e.target.checked;
        saveSettings();
        updatePreview();
      });
    }
    
    // 隱藏表格標題
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
    
    // 字體大小滑桿
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
    
    // 清除物流單按鈕
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
    
    // PDF 上傳
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
    
    // 訂單標籤顯示
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
  
  // ===== PDF 處理功能 =====
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
  
  // ===== 物流單資料管理 =====
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
      const currentPatterns = CONFIG.PROVIDERS[state.currentProvider]?.patterns || {};
      
      // 提取訂單編號
      if (currentPatterns.orderNo) {
        for (const pattern of currentPatterns.orderNo) {
          const match = text.match(pattern);
          if (match) {
            data.orderNo = match[1].trim();
            break;
          }
        }
      }
      
      // 提取物流編號
      if (currentPatterns.logisticsNo) {
        for (const pattern of currentPatterns.logisticsNo) {
          const match = text.match(pattern);
          if (match) {
            data.logisticsNo = match[1].trim();
            break;
          }
        }
      }
      
      // 提取店舖資訊
      if (currentPatterns.storeId) {
        for (const pattern of currentPatterns.storeId) {
          const match = text.match(pattern);
          if (match) {
            data.storeId = match[1].trim();
            break;
          }
        }
      }
      
      if (currentPatterns.storeName) {
        for (const pattern of currentPatterns.storeName) {
          const match = text.match(pattern);
          if (match) {
            data.storeName = match[1].trim();
            break;
          }
        }
      }
      
      // 提取收件人資訊
      if (currentPatterns.recipientName) {
        for (const pattern of currentPatterns.recipientName) {
          const match = text.match(pattern);
          if (match) {
            data.recipientName = match[1].trim();
            break;
          }
        }
      }
      
      if (currentPatterns.recipientPhone) {
        for (const pattern of currentPatterns.recipientPhone) {
          const match = text.match(pattern);
          if (match) {
            data.recipientPhone = match[1].trim();
            break;
          }
        }
      }
    }
    
    return data;
  }
  
  function removeScripts(element) {
    element.querySelectorAll('script').forEach(script => script.remove());
    element.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
    element.querySelectorAll('[onload]').forEach(el => el.removeAttribute('onload'));
    element.querySelectorAll('[onerror]').forEach(el => el.removeAttribute('onerror'));
  }
  
  // ===== 隱藏原始控制項 =====
  function hideOriginalControls() {
    const originalControls = document.querySelector('.ignore-print');
    if (originalControls) {
      originalControls.style.display = 'none';
    }
  }
  
  // ===== 監聽原始控制項變化 =====
  function observeOriginalControls() {
    const showProductImageCheckbox = document.querySelector('.ignore-print #showProductImage');
    
    if (showProductImageCheckbox) {
      const observer = new MutationObserver(() => {
        updatePreview();
      });
      
      observer.observe(showProductImageCheckbox, {
        attributes: true,
        attributeFilter: ['checked']
      });
    }
  }
  
  // ===== 設定檔系統 =====
  function initPresetSystem() {
    loadPresets();
    
    const addPresetBtn = document.getElementById('bv-add-preset');
    const confirmSaveBtn = document.getElementById('bv-confirm-save');
    const cancelSaveBtn = document.getElementById('bv-cancel-save');
    const presetNameInput = document.getElementById('bv-new-preset-name');
    
    if (addPresetBtn) {
      addPresetBtn.addEventListener('click', () => {
        document.getElementById('bv-new-preset-row').style.display = 'block';
        presetNameInput.focus();
      });
    }
    
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', saveNewPreset);
    }
    
    if (cancelSaveBtn) {
      cancelSaveBtn.addEventListener('click', () => {
        document.getElementById('bv-new-preset-row').style.display = 'none';
        presetNameInput.value = '';
      });
    }
    
    if (presetNameInput) {
      presetNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveNewPreset();
        } else if (e.key === 'Escape') {
          document.getElementById('bv-new-preset-row').style.display = 'none';
          presetNameInput.value = '';
        }
      });
    }
  }
  
  function loadPresets() {
    chrome.storage.local.get(['bvPresets', 'bvActivePreset'], (result) => {
      if (result.bvPresets) {
        state.presets = result.bvPresets;
      }
      if (result.bvActivePreset) {
        state.activePreset = result.bvActivePreset;
      }
      renderPresetList();
    });
  }
  
  function renderPresetList() {
    const listEl = document.getElementById('bv-preset-list');
    if (!listEl) return;
    
    listEl.innerHTML = state.presets.map(preset => `
      <div class="bv-preset-item ${preset.id === state.activePreset ? 'active' : ''}" data-preset-id="${preset.id}">
        <div class="bv-preset-name">${preset.name}</div>
        <div class="bv-preset-actions">
          <button class="bv-preset-action-btn delete" data-preset-id="${preset.id}">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    `).join('');
    
    // 綁定事件
    listEl.querySelectorAll('.bv-preset-name').forEach(el => {
      el.addEventListener('click', function() {
        const presetId = this.parentElement.dataset.presetId;
        loadPreset(presetId);
      });
    });
    
    listEl.querySelectorAll('.bv-preset-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const presetId = this.dataset.presetId;
        deletePreset(presetId);
      });
    });
  }
  
  function saveNewPreset() {
    const nameInput = document.getElementById('bv-new-preset-name');
    const name = nameInput.value.trim();
    
    if (!name) {
      showNotification('請輸入設定檔名稱', 'warning');
      return;
    }
    
    const preset = {
      id: Date.now().toString(),
      name: name,
      settings: getCurrentSettings()
    };
    
    state.presets.push(preset);
    state.activePreset = preset.id;
    
    chrome.storage.local.set({
      bvPresets: state.presets,
      bvActivePreset: state.activePreset
    }, () => {
      showNotification(`已儲存設定檔: ${name}`);
      renderPresetList();
      document.getElementById('bv-new-preset-row').style.display = 'none';
      nameInput.value = '';
    });
  }
  
  function loadPreset(presetId) {
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) return;
    
    state.activePreset = presetId;
    applySettings(preset.settings);
    
    chrome.storage.local.set({ bvActivePreset: state.activePreset }, () => {
      showNotification(`已載入設定檔: ${preset.name}`);
      renderPresetList();
    });
  }
  
  function deletePreset(presetId) {
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) return;
    
    if (!confirm(`確定要刪除設定檔「${preset.name}」嗎？`)) return;
    
    state.presets = state.presets.filter(p => p.id !== presetId);
    
    if (state.activePreset === presetId) {
      state.activePreset = null;
    }
    
    chrome.storage.local.set({
      bvPresets: state.presets,
      bvActivePreset: state.activePreset
    }, () => {
      showNotification(`已刪除設定檔: ${preset.name}`);
      renderPresetList();
    });
  }
  
  function getCurrentSettings() {
    return {
      labelFormat: state.labelFormat,
      fontSize: state.fontSize,
      highlightQuantity: state.highlightQuantity,
      hideExtraInfo: state.hideExtraInfo,
      hideTableHeader: state.hideTableHeader,
      logoSettings: state.logoSettings,
      printMode: state.printMode,
      detailSortOrder: state.detailSortOrder,
      shippingSortOrder: state.shippingSortOrder,
      reverseShipping: state.reverseShipping,
      matchMode: state.matchMode,
      showOrderLabel: document.getElementById('bv-show-order-label')?.checked || false
    };
  }
  
  function applySettings(settings) {
    // 套用格式
    if (settings.labelFormat && settings.labelFormat !== state.labelFormat) {
      state.labelFormat = settings.labelFormat;
      document.body.classList.remove('format-10x15', 'format-10x10');
      document.body.classList.add(`format-${state.labelFormat}`);
      
      const formatRadio = document.querySelector(`input[name="label-format"][value="${settings.labelFormat}"]`);
      if (formatRadio) {
        formatRadio.checked = true;
        formatRadio.closest('.bv-format-option').classList.add('selected');
      }
    }
    
    // 套用字體大小
    if (settings.fontSize) {
      state.fontSize = settings.fontSize;
      const slider = document.getElementById('bv-font-size');
      if (slider) {
        slider.value = settings.fontSize;
        updateRangeProgress(slider);
        document.getElementById('bv-font-size-value').textContent = parseFloat(settings.fontSize).toFixed(1);
      }
    }
    
    // 套用其他設定
    if (typeof settings.highlightQuantity !== 'undefined') {
      state.highlightQuantity = settings.highlightQuantity;
      const checkbox = document.getElementById('bv-highlight-qty');
      if (checkbox) checkbox.checked = settings.highlightQuantity;
    }
    
    if (typeof settings.hideExtraInfo !== 'undefined') {
      state.hideExtraInfo = settings.hideExtraInfo;
      const checkbox = document.getElementById('bv-hide-extra-info');
      if (checkbox) checkbox.checked = settings.hideExtraInfo;
    }
    
    if (typeof settings.hideTableHeader !== 'undefined') {
      state.hideTableHeader = settings.hideTableHeader;
      const checkbox = document.getElementById('bv-hide-table-header');
      if (checkbox) checkbox.checked = settings.hideTableHeader;
    }
    
    if (settings.logoSettings) {
      state.logoSettings = settings.logoSettings;
      updateLogoDisplay();
    }
    
    if (settings.printMode) {
      state.printMode = settings.printMode;
      const radio = document.querySelector(`input[name="print-mode"][value="${settings.printMode}"]`);
      if (radio) {
        radio.checked = true;
        radio.closest('.bv-mode-option').classList.add('selected');
      }
      updatePrintModeUI();
    }
    
    if (settings.detailSortOrder) state.detailSortOrder = settings.detailSortOrder;
    if (settings.shippingSortOrder) state.shippingSortOrder = settings.shippingSortOrder;
    if (typeof settings.reverseShipping !== 'undefined') state.reverseShipping = settings.reverseShipping;
    if (settings.matchMode) state.matchMode = settings.matchMode;
    
    if (typeof settings.showOrderLabel !== 'undefined') {
      const checkbox = document.getElementById('bv-show-order-label');
      if (checkbox) checkbox.checked = settings.showOrderLabel;
    }
    
    updateLabelStyles();
    updatePreview();
  }
  
  // ===== 底圖上傳系統 =====
  function initLogoUpload() {
    const uploadArea = document.getElementById('logo-upload-area');
    const logoInput = document.getElementById('logo-input');
    const removeBtn = document.getElementById('remove-logo-btn');
    
    if (uploadArea && logoInput) {
      uploadArea.addEventListener('click', () => {
        logoInput.click();
      });
      
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
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.match(/image\/(png|jpeg|jpg)/)) {
          handleLogoFile(file);
        }
      });
      
      logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          handleLogoFile(file);
        }
      });
    }
    
    if (removeBtn) {
      removeBtn.addEventListener('click', removeLogo);
    }
    
    // 底圖控制滑桿
    const sizeSlider = document.getElementById('logo-size-slider');
    const xSlider = document.getElementById('logo-x-slider');
    const ySlider = document.getElementById('logo-y-slider');
    const opacitySlider = document.getElementById('logo-opacity-slider');
    
    [sizeSlider, xSlider, ySlider, opacitySlider].forEach(slider => {
      if (slider) {
        slider.addEventListener('input', function() {
          updateLogoSettings();
          updateRangeProgress(this);
        });
      }
    });
    
    // 載入已儲存的底圖
    chrome.storage.local.get(['bvLogoSettings'], (result) => {
      if (result.bvLogoSettings) {
        state.logoSettings = result.bvLogoSettings;
        updateLogoDisplay();
      }
    });
  }
  
  function handleLogoFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      state.logoSettings.imageData = e.target.result;
      updateLogoDisplay();
      saveLogoSettings();
    };
    
    reader.readAsDataURL(file);
  }
  
  function updateLogoDisplay() {
    const preview = document.getElementById('logo-preview');
    const uploadPrompt = document.getElementById('upload-prompt');
    const logoControls = document.getElementById('logo-controls');
    
    if (state.logoSettings.imageData) {
      if (preview) {
        preview.src = state.logoSettings.imageData;
        preview.style.display = 'block';
      }
      if (uploadPrompt) uploadPrompt.style.display = 'none';
      if (logoControls) logoControls.style.display = 'block';
      
      // 更新控制項數值
      const sizeSlider = document.getElementById('logo-size-slider');
      const xSlider = document.getElementById('logo-x-slider');
      const ySlider = document.getElementById('logo-y-slider');
      const opacitySlider = document.getElementById('logo-opacity-slider');
      
      if (sizeSlider) {
        sizeSlider.value = state.logoSettings.size;
        document.getElementById('logo-size').textContent = state.logoSettings.size + '%';
        updateRangeProgress(sizeSlider);
      }
      if (xSlider) {
        xSlider.value = state.logoSettings.positionX;
        document.getElementById('logo-x').textContent = state.logoSettings.positionX + '%';
        updateRangeProgress(xSlider);
      }
      if (ySlider) {
        ySlider.value = state.logoSettings.positionY;
        document.getElementById('logo-y').textContent = state.logoSettings.positionY + '%';
        updateRangeProgress(ySlider);
      }
      if (opacitySlider) {
        opacitySlider.value = state.logoSettings.opacity;
        document.getElementById('logo-opacity').textContent = state.logoSettings.opacity + '%';
        updateRangeProgress(opacitySlider);
      }
    } else {
      if (preview) preview.style.display = 'none';
      if (uploadPrompt) uploadPrompt.style.display = 'flex';
      if (logoControls) logoControls.style.display = 'none';
    }
    
    updatePreview();
  }
  
  function updateLogoSettings() {
    state.logoSettings.size = parseInt(document.getElementById('logo-size-slider').value);
    state.logoSettings.positionX = parseInt(document.getElementById('logo-x-slider').value);
    state.logoSettings.positionY = parseInt(document.getElementById('logo-y-slider').value);
    state.logoSettings.opacity = parseInt(document.getElementById('logo-opacity-slider').value);
    
    document.getElementById('logo-size').textContent = state.logoSettings.size + '%';
    document.getElementById('logo-x').textContent = state.logoSettings.positionX + '%';
    document.getElementById('logo-y').textContent = state.logoSettings.positionY + '%';
    document.getElementById('logo-opacity').textContent = state.logoSettings.opacity + '%';
    
    saveLogoSettings();
    updatePreview();
  }
  
  function saveLogoSettings() {
    chrome.storage.local.set({ bvLogoSettings: state.logoSettings });
  }
  
  function removeLogo() {
    state.logoSettings.imageData = null;
    updateLogoDisplay();
    saveLogoSettings();
  }
  
  // ===== 列印相關功能 =====
  function preparePrintStyles() {
    // 確保列印時隱藏控制面板
    const style = document.createElement('style');
    style.id = 'bv-print-style';
    style.textContent = `
      @media print {
        #bv-label-control-panel,
        .bv-minimized-button {
          display: none !important;
        }
        
        body.bv-converted .bv-shipping-page {
          padding: 3mm !important;
        }
        
        /* 確保商品圖片在列印時顯示 */
        .bv-product-img {
          display: block !important;
          visibility: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    
    // 移除舊的列印樣式
    const oldStyle = document.getElementById('bv-print-style');
    if (oldStyle) oldStyle.remove();
    
    document.head.appendChild(style);
  }
  
  // ===== 儲存設定 =====
  function saveSettings() {
    const settings = {
      labelFormat: state.labelFormat,
      fontSize: state.fontSize,
      highlightQuantity: state.highlightQuantity,
      hideExtraInfo: state.hideExtraInfo,
      hideTableHeader: state.hideTableHeader,
      printMode: state.printMode,
      detailSortOrder: state.detailSortOrder,
      shippingSortOrder: state.shippingSortOrder,
      reverseShipping: state.reverseShipping,
      matchMode: state.matchMode,
      showOrderLabel: document.getElementById('bv-show-order-label')?.checked || false,
      wizardMode: state.wizardMode
    };
    
    chrome.storage.local.set({ bvSettings: settings });
  }

  // ===== 載入設定 =====
  function loadSettings(callback) {
    chrome.storage.local.get(['bvSettings', 'bvWizardMode', 'bvPanelMinimized'], (result) => {
      if (result.bvSettings) {
        // 載入各項設定
        if (result.bvSettings.labelFormat) state.labelFormat = result.bvSettings.labelFormat;
        if (result.bvSettings.fontSize) state.fontSize = result.bvSettings.fontSize;
        if (typeof result.bvSettings.highlightQuantity !== 'undefined') {
          state.highlightQuantity = result.bvSettings.highlightQuantity;
        }
        if (typeof result.bvSettings.hideExtraInfo !== 'undefined') {
          state.hideExtraInfo = result.bvSettings.hideExtraInfo;
        }
        if (typeof result.bvSettings.hideTableHeader !== 'undefined') {
          state.hideTableHeader = result.bvSettings.hideTableHeader;
        }
        if (result.bvSettings.printMode) state.printMode = result.bvSettings.printMode;
        if (result.bvSettings.detailSortOrder) state.detailSortOrder = result.bvSettings.detailSortOrder;
        if (result.bvSettings.shippingSortOrder) state.shippingSortOrder = result.bvSettings.shippingSortOrder;
        if (typeof result.bvSettings.reverseShipping !== 'undefined') {
          state.reverseShipping = result.bvSettings.reverseShipping;
        }
        if (result.bvSettings.matchMode) state.matchMode = result.bvSettings.matchMode;
      }
      
      if (typeof result.bvWizardMode !== 'undefined') {
        state.wizardMode = result.bvWizardMode;
      }
      
      if (typeof result.bvPanelMinimized !== 'undefined') {
        state.isPanelMinimized = result.bvPanelMinimized;
      }
      
      // 執行回調
      if (callback) {
        callback();
      }
    });
  }
  
  // ===== 檢查物流單資料狀態 =====
  function checkShippingDataStatus() {
    chrome.storage.local.get(['shippingDataBatches', 'shippingData', 'pdfShippingData', 'shippingProvider'], (result) => {
      if (result.shippingDataBatches) {
        state.shippingDataBatches = result.shippingDataBatches;
        mergeAllBatchData();
      } else {
        // 相容舊版資料
        if (result.shippingData) {
          state.shippingData = result.shippingData;
        }
        if (result.pdfShippingData) {
          state.pdfShippingData = result.pdfShippingData;
        }
      }
      
      updateIntegrationStatus();
      updateBatchList();
    });
  }
  
  function updateIntegrationStatus() {
    const statusEl = document.getElementById('bv-integration-status');
    if (!statusEl) return;
    
    const hasShippingData = state.shippingData.length > 0 || state.pdfShippingData.length > 0;
    const totalCount = state.shippingData.length + state.pdfShippingData.length;
    
    if (hasShippingData) {
      statusEl.classList.remove('warning');
      statusEl.classList.add('success');
      statusEl.innerHTML = `
        <span class="material-icons">check_circle</span>
        <div class="bv-status-info">
          <h4>已載入 ${totalCount} 張物流單</h4>
          <p>可整合列印</p>
        </div>
      `;
    } else {
      statusEl.classList.remove('success');
      statusEl.classList.add('warning');
      statusEl.innerHTML = `
        <span class="material-icons">warning</span>
        <div class="bv-status-info">
          <h4>尚無物流單資料</h4>
          <p>請至物流單頁面抓取或上傳 PDF</p>
        </div>
      `;
    }
  }
  
  // ===== 可折疊卡片功能 =====
  function setupCollapsibleCards() {
    document.querySelectorAll('.bv-settings-card').forEach(card => {
      const title = card.querySelector('.bv-card-title');
      const content = card.querySelector('.bv-card-content');
      
      if (title && content) {
        title.addEventListener('click', function() {
          const section = card.dataset.section;
          const isCollapsed = card.classList.contains('collapsed');
          
          if (isCollapsed) {
            card.classList.remove('collapsed');
            state.collapsedSections.delete(section);
          } else {
            card.classList.add('collapsed');
            state.collapsedSections.add(section);
          }
          
          // 儲存折疊狀態
          chrome.storage.local.set({ bvCollapsedSections: Array.from(state.collapsedSections) });
        });
      }
    });
    
    // 載入折疊狀態
    chrome.storage.local.get(['bvCollapsedSections'], (result) => {
      if (result.bvCollapsedSections) {
        state.collapsedSections = new Set(result.bvCollapsedSections);
        state.collapsedSections.forEach(section => {
          const card = document.querySelector(`.bv-settings-card[data-section="${section}"]`);
          if (card) {
            card.classList.add('collapsed');
          }
        });
      }
    });
  }
  
  // ===== 更新進度條 =====
  function updateRangeProgress(slider) {
    const progress = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty('--progress', progress + '%');
  }
  
  // ===== 通知功能 =====
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
  
  // ===== 主要功能函式 =====
  
  // 數量標示功能
  function applyQuantityHighlight() {
    if (!state.highlightQuantity) return;
    
    const qtyHeaders = document.querySelectorAll('.list-item-qty-column-value.list-header');
    qtyHeaders.forEach(header => {
      if (!header.querySelector('.bv-qty-marker')) {
        header.innerHTML = '數量▲';
      }
    });
    
    const qtyElements = document.querySelectorAll('.list-item-qty');
    qtyElements.forEach(el => {
      const qtyText = el.textContent.trim();
      const qtyMatch = qtyText.match(/(\d+)/);
      
      if (qtyMatch) {
        const quantity = parseInt(qtyMatch[1]);
        if (quantity >= 2 && !el.querySelector('.bv-qty-marker')) {
          el.innerHTML = el.innerHTML.replace(/(\d+)/, '$1<span class="bv-qty-marker">▲</span>');
        }
      }
    });
  }
  
  function toggleQuantityHighlight(e) {
    state.highlightQuantity = e.target.checked;
    saveSettings();
    
    if (state.isConverted) {
      if (state.highlightQuantity) {
        applyQuantityHighlight();
      } else {
        document.querySelectorAll('.list-item-qty-column-value.list-header').forEach(header => {
          header.textContent = '數量';
        });
        
        document.querySelectorAll('.bv-qty-marker').forEach(marker => {
          marker.remove();
        });
      }
    } else {
      if (state.highlightQuantity) {
        applyQuantityHighlight();
      } else {
        document.querySelectorAll('.list-item-qty-column-value.list-header').forEach(header => {
          header.textContent = '數量';
        });
        
        document.querySelectorAll('.bv-qty-marker').forEach(marker => {
          marker.remove();
        });
      }
    }
  }
  
  // 轉換為標籤格式
  function convertToLabelFormat() {
    state.isConverted = true;
    state.currentWizardStep = CONFIG.WIZARD_STEPS.FORMAT.id;
    state.visitedSteps.add(state.currentWizardStep);
    
    document.body.classList.add('bv-converted', `format-${state.labelFormat}`);
    
    checkShippingDataStatus();
    
    updatePanelContent();
    
    handlePagination();
    
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    }
    
    saveConversionState();
  }
  
  // 還原為原始格式
  function revertToOriginal() {
    state.isConverted = false;
    state.currentWizardStep = CONFIG.WIZARD_STEPS.FORMAT.id;
    state.visitedSteps.clear();
    state.completedSteps.clear();
    
    document.body.classList.remove('bv-converted', 'format-10x15', 'format-10x10');
    
    // 移除所有標籤頁面
    document.querySelectorAll('.bv-page-container').forEach(container => container.remove());
    
    // 顯示原始內容
    document.querySelectorAll('.order-content.bv-original').forEach(el => {
      el.classList.remove('bv-original');
      el.style.display = '';
    });
    
    updatePanelContent();
    
    // 清除狀態標記
    chrome.storage.local.remove(['bvConversionState']);
    
    // 停止自動檢查
    if (state.autoCheckInterval) {
      clearInterval(state.autoCheckInterval);
      state.autoCheckInterval = null;
    }
  }
  
  // 處理分頁
  function handlePagination() {
    const orderContents = document.querySelectorAll('.order-content:not(.bv-original)');
    
    orderContents.forEach(order => {
      order.classList.add('bv-original');
    });
    
    document.querySelectorAll('.bv-page-container').forEach(container => container.remove());
    
    state.detailPages = [];
    state.shippingPages = [];
    
    const format = CONFIG.LABEL_FORMATS[state.labelFormat];
    const formatClass = state.labelFormat === '10x10' ? 'format-10x10' : 'format-10x15';
    
    orderContents.forEach((orderContent, orderIndex) => {
      const pageContainer = document.createElement('div');
      pageContainer.className = 'bv-page-container';
      
      const labelPage = document.createElement('div');
      labelPage.className = `bv-label-page ${formatClass}`;
      
      const pageContent = document.createElement('div');
      pageContent.className = 'bv-page-content';
      
      // 添加底圖
      if (state.logoSettings.imageData) {
        const logoBackground = document.createElement('div');
        logoBackground.className = 'bv-logo-background';
        logoBackground.style.cssText = `
          background-image: url(${state.logoSettings.imageData});
          background-size: ${state.logoSettings.size}%;
          background-position: ${state.logoSettings.positionX}% ${state.logoSettings.positionY}%;
          opacity: ${state.logoSettings.opacity / 100};
        `;
        pageContent.appendChild(logoBackground);
      }
      
      const clonedOrder = orderContent.cloneNode(true);
      clonedOrder.classList.remove('bv-original');
      
      const customerOrder = clonedOrder.querySelector('.cutomer-order');
      if (customerOrder) {
        customerOrder.style.padding = '0';
        customerOrder.style.margin = '0';
        customerOrder.style.border = 'none';
        customerOrder.style.boxShadow = 'none';
      }
      
      const productList = clonedOrder.querySelector('.order-product-list');
      if (productList) {
        updateProductListForLabel(productList);
      }
      
      const paymentDetails = clonedOrder.querySelector('.order-payment-details');
      if (paymentDetails && state.hideExtraInfo) {
        const elementsToHide = [
          '.col-sm-6.mb-4',
          '.row:nth-child(3)',
          '.col-sm-4.col-6'
        ];
        
        elementsToHide.forEach(selector => {
          const elements = paymentDetails.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.textContent.includes('付款方式') || 
                el.textContent.includes('訂單狀態') ||
                el.textContent.includes('商品售價') ||
                el.textContent.includes('運費') ||
                el.textContent.includes('折扣')) {
              el.style.display = 'none';
            }
          });
        });
      }
      
      pageContent.appendChild(clonedOrder);
      labelPage.appendChild(pageContent);
      pageContainer.appendChild(labelPage);
      
      document.body.appendChild(pageContainer);
      
      state.detailPages.push(pageContainer);
    });
    
    // 根據列印模式處理物流單
    if (state.printMode !== CONFIG.PRINT_MODES.DETAIL_ONLY) {
      insertShippingPages();
    }
    
    updateLabelStyles();
  }
  
  // 更新產品列表樣式
  function updateProductListForLabel(productList) {
    const showProductImage = document.querySelector('.ignore-print #showProductImage')?.checked;
    
    const rows = productList.querySelectorAll('tr');
    rows.forEach((row, index) => {
      if (index === 0 && state.hideTableHeader) {
        row.style.display = 'none';
        return;
      }
      
      const cells = row.querySelectorAll('td, th');
      
      if (showProductImage && cells.length >= 2) {
        // 檢查是否已經有圖片欄位
        const hasImageColumn = row.querySelector('.bv-product-image-col');
        
        if (!hasImageColumn) {
          // 插入圖片欄位
          const imageCell = document.createElement(index === 0 ? 'th' : 'td');
          imageCell.className = 'bv-product-image-col';
          
          if (index === 0) {
            // 標題列
            imageCell.textContent = '';
          } else {
            // 產品列
            const nameCell = cells[0];
            const productImage = nameCell.querySelector('.orderProductImage');
            
            if (productImage) {
              const img = productImage.querySelector('img');
              if (img) {
                const newImg = img.cloneNode(true);
                newImg.className = 'bv-product-img';
                imageCell.appendChild(newImg);
              }
            }
          }
          
          // 插入到第一個欄位之前
          row.insertBefore(imageCell, cells[0]);
        }
      }
      
      // 調整其他欄位
      cells.forEach(cell => {
        if (cell.classList.contains('list-item-name')) {
          // 隱藏原始圖片
          const originalImg = cell.querySelector('.orderProductImage');
          if (originalImg) {
            originalImg.style.display = 'none';
          }
          
          // 移除所有內嵌樣式
          const nameLink = cell.querySelector('a');
          if (nameLink) {
            nameLink.removeAttribute('style');
          }
        }
      });
    });
    
    // 移除表格的寬度限制
    productList.style.width = '100%';
    productList.style.tableLayout = 'fixed';
  }
  
  // 插入物流單頁面
  function insertShippingPages() {
    // 如果使用反轉資料，則使用暫存的反轉資料
    const shippingData = state.useReversedShipping && state.tempShippingData ? 
      state.tempShippingData : state.shippingData;
    const pdfData = state.useReversedShipping && state.tempPdfShippingData ? 
      state.tempPdfShippingData : state.pdfShippingData;
    
    // 清除反轉標記
    state.useReversedShipping = false;
    state.tempShippingData = null;
    state.tempPdfShippingData = null;
    
    const allShippingData = [...shippingData, ...pdfData];
    
    if (state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY) {
      // 只顯示物流單
      allShippingData.forEach((data, index) => {
        const pageContainer = createShippingPage(data, index, null);
        document.body.appendChild(pageContainer);
        state.shippingPages.push(pageContainer);
      });
    } else if (state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH) {
      // 手動配對模式
      if (state.matchMode === 'logistics') {
        // 物流編號配對
        matchByLogisticsNumber(allShippingData);
      } else {
        // 索引配對（預設）
        matchByIndex(allShippingData);
      }
    }
  }
  
  // 依索引配對
  function matchByIndex(allShippingData) {
    const showOrderLabel = document.getElementById('bv-show-order-label')?.checked;
    const matchingResults = [];
    
    // 建立配對結果
    state.detailPages.forEach((detailPage, index) => {
      const shippingData = allShippingData[index];
      
      if (shippingData) {
        // 如果需要顯示訂單標籤，從明細頁面提取訂單編號
        let orderNo = null;
        if (showOrderLabel) {
          const orderElement = detailPage.querySelector('.order-number .badge-success');
          if (orderElement) {
            orderNo = orderElement.textContent.trim();
          }
        }
        
        const shippingPage = createShippingPage(shippingData, index, orderNo);
        
        // 插入到明細後面
        detailPage.parentNode.insertBefore(shippingPage, detailPage.nextSibling);
        state.shippingPages.push(shippingPage);
        
        matchingResults.push({
          detail: `明細 ${index + 1}`,
          shipping: shippingData.orderNo || `物流單 ${index + 1}`,
          matched: true
        });
      } else {
        matchingResults.push({
          detail: `明細 ${index + 1}`,
          shipping: '無配對',
          matched: false
        });
      }
    });
    
    // 處理多餘的物流單
    if (allShippingData.length > state.detailPages.length) {
      for (let i = state.detailPages.length; i < allShippingData.length; i++) {
        const shippingData = allShippingData[i];
        const shippingPage = createShippingPage(shippingData, i, null);
        document.body.appendChild(shippingPage);
        state.shippingPages.push(shippingPage);
        
        matchingResults.push({
          detail: '無明細',
          shipping: shippingData.orderNo || `物流單 ${i + 1}`,
          matched: false
        });
      }
    }
    
    // 顯示配對結果
    updateMatchingResults(matchingResults);
  }
  
  // 依物流編號配對
  function matchByLogisticsNumber(allShippingData) {
    const showOrderLabel = document.getElementById('bv-show-order-label')?.checked;
    const matchingResults = [];
    const usedShippingIndices = new Set();
    
    // 建立物流編號索引
    const logisticsIndex = new Map();
    allShippingData.forEach((data, index) => {
      if (data.logisticsNo || data.orderNo) {
        const key = data.logisticsNo || data.orderNo;
        logisticsIndex.set(key, index);
      }
    });
    
    // 配對明細和物流單
    state.detailPages.forEach((detailPage, index) => {
      // 從明細中提取物流編號
      const logisticsElement = detailPage.querySelector('.col-sm-6:nth-child(2) .field-value');
      let logisticsNo = null;
      
      if (logisticsElement) {
        const text = logisticsElement.textContent.trim();
        // 嘗試匹配各種物流編號格式
        const patterns = [
          /^([A-Z0-9-]+)$/,  // 純編號
          /物流編號[：:]\s*([A-Z0-9-]+)/,
          /^(.+)$/  // 任意文字作為最後手段
        ];
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            logisticsNo = match[1].trim();
            break;
          }
        }
      }
      
      let matched = false;
      if (logisticsNo && logisticsIndex.has(logisticsNo)) {
        const shippingIndex = logisticsIndex.get(logisticsNo);
        if (!usedShippingIndices.has(shippingIndex)) {
          const shippingData = allShippingData[shippingIndex];
          
          // 如果需要顯示訂單標籤
          let orderNo = null;
          if (showOrderLabel) {
            const orderElement = detailPage.querySelector('.order-number .badge-success');
            if (orderElement) {
              orderNo = orderElement.textContent.trim();
            }
          }
          
          const shippingPage = createShippingPage(shippingData, shippingIndex, orderNo);
          
          // 插入到明細後面
          detailPage.parentNode.insertBefore(shippingPage, detailPage.nextSibling);
          state.shippingPages.push(shippingPage);
          usedShippingIndices.add(shippingIndex);
          
          matchingResults.push({
            detail: `明細 ${index + 1} (${logisticsNo})`,
            shipping: shippingData.orderNo || shippingData.logisticsNo || `物流單 ${shippingIndex + 1}`,
            matched: true
          });
          matched = true;
        }
      }
      
      if (!matched) {
        matchingResults.push({
          detail: `明細 ${index + 1}${logisticsNo ? ` (${logisticsNo})` : ''}`,
          shipping: '無配對',
          matched: false
        });
      }
    });
    
    // 處理未配對的物流單
    allShippingData.forEach((shippingData, index) => {
      if (!usedShippingIndices.has(index)) {
        const shippingPage = createShippingPage(shippingData, index, null);
        document.body.appendChild(shippingPage);
        state.shippingPages.push(shippingPage);
        
        matchingResults.push({
          detail: '無明細',
          shipping: shippingData.orderNo || shippingData.logisticsNo || `物流單 ${index + 1}`,
          matched: false
        });
      }
    });
    
    // 顯示配對結果
    updateMatchingResults(matchingResults);
  }
  
  // 更新配對結果顯示
  function updateMatchingResults(results) {
    const resultsEl = document.getElementById('bv-matching-results');
    if (!resultsEl) return;
    
    const matchedCount = results.filter(r => r.matched).length;
    const unmatchedCount = results.length - matchedCount;
    
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
      <div class="bv-matching-results-title">
        配對結果：${matchedCount} 組成功，${unmatchedCount} 組未配對
      </div>
      ${results.slice(0, 5).map(result => `
        <div class="bv-matching-result-item ${result.matched ? '' : 'unmatched'}">
          ${result.detail} → ${result.shipping}
        </div>
      `).join('')}
      ${results.length > 5 ? `<div class="bv-matching-result-item">... 還有 ${results.length - 5} 組</div>` : ''}
    `;
  }
  
  // 創建物流單頁面
  function createShippingPage(shippingData, index, orderNo = null) {
    const pageContainer = document.createElement('div');
    pageContainer.className = 'bv-page-container';
    
    const labelPage = document.createElement('div');
    labelPage.className = `bv-label-page bv-shipping-page ${state.labelFormat === '10x10' ? 'format-10x10' : 'format-10x15'}`;
    
    const pageContent = document.createElement('div');
    pageContent.className = 'bv-page-content';
    
    // 如果有訂單編號標籤且啟用了顯示
    if (orderNo && document.getElementById('bv-show-order-label')?.checked) {
      const orderLabel = document.createElement('div');
      orderLabel.className = 'bv-order-label';
      orderLabel.textContent = orderNo;
      pageContent.appendChild(orderLabel);
    }
    
    const shippingContent = document.createElement('div');
    shippingContent.className = 'bv-shipping-content';
    
    if (shippingData.html) {
      // HTML 物流單
      const wrapper = document.createElement('div');
      wrapper.className = 'bv-shipping-wrapper';
      
      const innerWrapper = document.createElement('div');
      innerWrapper.className = 'bv-shipping-wrapper-inner';
      
      // 檢查是否為超商物流單
      const isStoreShipping = ['SEVEN', 'FAMILY', 'HILIFE'].includes(shippingData.provider);
      
      if (isStoreShipping) {
        innerWrapper.innerHTML = shippingData.html;
        // 為超商物流單添加特殊樣式類別
        innerWrapper.classList.add('bv-store-shipping-content');
      } else {
        innerWrapper.innerHTML = shippingData.html;
      }
      
      wrapper.appendChild(innerWrapper);
      shippingContent.appendChild(wrapper);
    } else if (shippingData.imageData) {
      // 圖片物流單（PDF 或截圖）
      const img = document.createElement('img');
      img.src = shippingData.imageData;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      `;
      shippingContent.appendChild(img);
    }
    
    pageContent.appendChild(shippingContent);
    labelPage.appendChild(pageContent);
    pageContainer.appendChild(labelPage);
    
    return pageContainer;
  }
  
  // 更新標籤樣式
  function updateLabelStyles() {
    const labels = document.querySelectorAll('.bv-label-page:not(.bv-shipping-page)');
    const fontSize = state.fontSize || 11;
    
    labels.forEach(label => {
      label.style.fontSize = `${fontSize}px`;
      
      // 表格標題隱藏
      const tableHeaders = label.querySelectorAll('.order-product-list tr:first-child');
      tableHeaders.forEach(header => {
        header.style.display = state.hideTableHeader ? 'none' : '';
      });
    });
  }
  
  // 儲存轉換狀態
  function saveConversionState() {
    chrome.storage.local.set({
      bvConversionState: {
        isConverted: state.isConverted,
        labelFormat: state.labelFormat,
        settings: getCurrentSettings()
      }
    });
  }
  
  // 恢復轉換狀態
  function checkConversionState() {
    chrome.storage.local.get(['bvConversionState'], (result) => {
      if (result.bvConversionState && result.bvConversionState.isConverted) {
        state.isConverted = true;
        state.labelFormat = result.bvConversionState.labelFormat || '10x15';
        
        if (result.bvConversionState.settings) {
          applySettings(result.bvConversionState.settings);
        }
        
        document.body.classList.add('bv-converted', `format-${state.labelFormat}`);
        
        handlePagination();
        
        if (state.highlightQuantity) {
          applyQuantityHighlight();
        }
      }
    });
  }

  // ===== 注入樣式 =====
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'bv-label-styles';
    style.textContent = getStyleContent();
    document.head.appendChild(style);
    
    // 注入 Material Icons
    const materialIcons = document.createElement('link');
    materialIcons.rel = 'stylesheet';
    materialIcons.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    document.head.appendChild(materialIcons);
  }

  
  // ===== 檢查是否為物流單頁面 =====
  function checkIfShippingPage() {
    // 檢查各物流商的特徵
    for (const [provider, config] of Object.entries(CONFIG.PROVIDERS)) {
      if (!config) continue;
      
      if (provider === 'DELIVERY') {
        // 宅配需要特別處理子類型
        if (config.urlPatterns && typeof config.urlPatterns === 'object') {
          for (const [subType, patterns] of Object.entries(config.urlPatterns)) {
            if (Array.isArray(patterns) && patterns.some(pattern => window.location.href.includes(pattern))) {
              state.currentProvider = provider;
              state.deliverySubType = subType;
              return true;
            }
          }
        }
      } else {
        // 其他物流商
        if (config.urlPatterns && Array.isArray(config.urlPatterns)) {
          if (config.urlPatterns.some(pattern => window.location.href.includes(pattern))) {
            state.currentProvider = provider;
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // ===== 初始化函數 =====
  function init() {
    // 檢查是否為訂單列表頁面
    const isOrderListPage = (window.location.pathname.includes('/order_print') || 
                            window.location.pathname.includes('/admin/order')) && 
                           document.querySelector('.order-content');
    
    // 檢查是否為物流單頁面
    const isShippingPage = checkIfShippingPage();
    
    if (!isOrderListPage && !isShippingPage) {
      console.log('BV Shop 出貨助手: 非目標頁面', {
        pathname: window.location.pathname,
        hasOrderContent: !!document.querySelector('.order-content'),
        isOrderListPage,
        isShippingPage
      });
      return; // 不是目標頁面，不執行
    }
    
    console.log('BV Shop 出貨助手: 初始化中...', {
      pageType: isShippingPage ? 'shipping' : 'order_list',
      pathname: window.location.pathname
    });
    
    // 設定頁面類型
    state.currentPageType = isShippingPage ? CONFIG.PAGE_TYPES.SHIPPING : CONFIG.PAGE_TYPES.ORDER_LIST;
    
    // 載入設定
    loadSettings(() => {
      // 注入樣式
      injectStyles();
      
      // 創建控制面板
      createControlPanel();
      
      // 設置事件監聽器
      setupEventListeners();
      
      // 檢查面板最小化狀態
      chrome.storage.local.get(['bvPanelMinimized'], (result) => {
        if (result.bvPanelMinimized) {
          state.isPanelMinimized = true;
          const panel = document.getElementById('bv-label-control-panel');
          const minButton = document.getElementById('bv-minimized-button');
          if (panel) panel.classList.add('minimized');
          if (minButton) minButton.style.display = 'flex';
        }
      });
      
      // 如果是訂單列表頁面，檢查轉換狀態
      if (state.currentPageType === CONFIG.PAGE_TYPES.ORDER_LIST) {
        checkConversionState();
        
        // 如果 URL 中有 highlightQty 參數，自動開啟數量標示
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('highlightQty') === 'true') {
          state.highlightQuantity = true;
          const checkbox = document.getElementById('bv-highlight-qty');
          if (checkbox) checkbox.checked = true;
          applyQuantityHighlight();
        }
      }
      
      // 如果是物流單頁面，初始化物流單模式
      if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
        initShippingMode();
      }
    });
  }
  
  // ===== 初始化 =====
  init();
})();
