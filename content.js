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
      SEVEN: { name: '7-11', selector: '.shipping-7eleven', type: 'store' },
      FAMILY: { name: '全家', selector: '.shipping-family', type: 'store' },
      HILIFE: { name: '萊爾富', selector: '.shipping-hilife', type: 'store' },
      OKMART: { name: 'OK超商', selector: '.shipping-okmart', type: 'store' },
      DELIVERY: { 
        name: '宅配', 
        type: 'delivery',
        subTypes: {
          PDF: '宅配PDF'
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
      
      if (url.includes(config.name) || 
          document.querySelector(config.selector)) {
        state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
        state.currentProvider = provider;
        initShippingMode();
        return;
      }
    }
    
    // 檢查是否為宅配物流單頁面 - 簡化只判斷 PDF
    if (url.includes('pdf') || url.includes('delivery')) {
      state.currentPageType = CONFIG.PAGE_TYPES.SHIPPING;
      state.currentProvider = 'DELIVERY';
      state.deliverySubType = 'PDF';
      initShippingMode();
      return;
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
    
    // 只在出貨明細頁面載入 Material Icons
    if (state.currentPageType === CONFIG.PAGE_TYPES.DETAIL) {
      const materialIcons = document.createElement('link');
      materialIcons.rel = 'stylesheet';
      materialIcons.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      document.head.appendChild(materialIcons);
    }
    
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
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(81, 138, 255, 0.3);
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
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      color: white;
      border: none;
    }
    
    .bv-glass-button.bv-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(81, 138, 255, 0.4);
    }
    
    /* 主要按鈕 */
    .bv-primary-button {
      width: 100%;
      padding: 16px 20px;
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
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
      box-shadow: 0 4px 16px rgba(81, 138, 255, 0.3);
    }
    
    .bv-primary-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(81, 138, 255, 0.4);
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
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
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

        /* 滑桿 */
    .bv-glass-range {
      width: 100%;
      height: 8px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      outline: none;
      -webkit-appearance: none;
      position: relative;
      cursor: pointer;
    }
    
    .bv-glass-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 2;
    }
    
    .bv-glass-range::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      border: none;
      position: relative;
      z-index: 2;
    }
    
    .bv-glass-range::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: var(--value, 0);
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      border-radius: 4px;
      z-index: 1;
    }
    
    /* 範圍值顯示 */
    .bv-range-value {
      display: inline-block;
      min-width: 40px;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      text-align: center;
      margin-left: 8px;
    }
    
    /* 設定群組 */
    .bv-setting-group {
      margin-bottom: 16px;
    }
    
    .bv-setting-group:last-child {
      margin-bottom: 0;
    }
    
    .bv-setting-label {
      font-size: 13px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.7);
      margin-bottom: 8px;
      display: block;
    }
    
    .bv-setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .bv-setting-row:last-child {
      margin-bottom: 0;
    }
    
    .bv-setting-text {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.87);
    }
    
    /* 檔案上傳 */
    .bv-upload-area {
      border: 2px dashed rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .bv-upload-area:hover {
      border-color: rgba(81, 138, 255, 0.5);
      background: rgba(81, 138, 255, 0.05);
    }
    
    .bv-upload-area.dragging {
      border-color: #518aff;
      background: rgba(81, 138, 255, 0.1);
    }
    
    .bv-upload-icon {
      font-size: 48px;
      color: rgba(0, 0, 0, 0.3);
      margin-bottom: 8px;
    }
    
    .bv-upload-text {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    .bv-upload-hint {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.4);
      margin-top: 4px;
    }
    
    /* 最小化按鈕 */
    .bv-minimized-button {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9999;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(81, 138, 255, 0.3);
    }
    
    .bv-minimized-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(81, 138, 255, 0.4);
    }
    
    .bv-minimized-button .material-icons {
      color: white;
      font-size: 24px;
    }
    
    /* A4 列印模式樣式 */
    @media print {
      @page {
        size: A4;
        margin: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      
      .bv-label-control-panel,
      .bv-minimized-button {
        display: none !important;
      }
      
      .order-info {
        page-break-inside: avoid;
        break-inside: avoid;
        width: 100%;
        max-width: 210mm;
        margin: 0 auto;
        padding: 20mm;
        box-sizing: border-box;
      }
      
      .order-info.bv-new-page {
        page-break-before: always;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
      }
      
      td, th {
        padding: 8px;
        border: 1px solid #ddd;
      }
      
      img {
        max-width: 100%;
        height: auto;
      }
      
      /* 隱藏指定元素 */
      .row.order-info {
        display: none !important;
      }
      
      /* 標籤模式時保持單頁不分頁 */
      body.label-mode {
        margin: 0;
        padding: 0;
      }
      
      body.label-mode .order-info {
        padding: 0;
        margin: 0;
        border: none;
        page-break-inside: auto;
      }
    }
    
    /* 通知 */
    .bv-notification {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 16px 24px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      z-index: 10001;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      animation: slideIn 0.3s forwards;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
    }
    
    .bv-notification.bv-success {
      border-left: 4px solid #4caf50;
    }
    
    .bv-notification.bv-error {
      border-left: 4px solid #f44336;
    }
    
    .bv-notification .material-icons {
      font-size: 24px;
    }
    
    .bv-notification.bv-success .material-icons {
      color: #4caf50;
    }
    
    .bv-notification.bv-error .material-icons {
      color: #f44336;
    }
    
    /* 標籤模式專用樣式 */
    body.label-mode {
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    
    body.label-mode .order-info {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    /* 數量強調樣式 */
    .quantity-highlight {
      background: #ffeb3b !important;
      font-weight: bold !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      display: inline-block !important;
    }
    
    /* 列印模式樣式 */
    .bv-print-mode-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .bv-mode-button {
      flex: 1;
      padding: 12px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      color: rgba(0, 0, 0, 0.87);
      font-family: inherit;
    }
    
    .bv-mode-button:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
    }
    
    .bv-mode-button.active {
      background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
      color: white;
      border: none;
    }
    
    /* 批次區域 */
    .bv-batch-list {
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.02);
    }
    
    .bv-batch-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      margin-bottom: 4px;
      transition: all 0.2s ease;
    }
    
    .bv-batch-item:last-child {
      margin-bottom: 0;
    }
    
    .bv-batch-item:hover {
      background: rgba(81, 138, 255, 0.05);
    }
    
    .bv-batch-info {
      flex: 1;
      font-size: 13px;
    }
    
    .bv-batch-count {
      font-weight: 600;
      color: #518aff;
    }
    
    .bv-batch-actions {
      display: flex;
      gap: 4px;
    }
    
    .bv-batch-action {
      padding: 4px;
      background: transparent;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s ease;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-batch-action:hover {
      background: rgba(0, 0, 0, 0.05);
      color: rgba(0, 0, 0, 0.87);
    }
    
    .bv-batch-action .material-icons {
      font-size: 18px;
    }
    
    /* 預覽區域 */
    .bv-preview-container {
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.02);
      margin-top: 12px;
    }
    
    .bv-preview-pages {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 8px 0;
    }
    
    .bv-preview-page {
      flex-shrink: 0;
      width: 80px;
      height: 113px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      background: white;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .bv-preview-page:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .bv-preview-page.shipping {
      border-color: #4facfe;
    }
    
    .bv-preview-page-number {
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    /* 物流單預覽卡片 */
    .bv-shipping-preview {
      background: rgba(79, 172, 254, 0.1);
      border: 1px solid rgba(79, 172, 254, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .bv-shipping-preview-title {
      font-weight: 600;
      color: #4facfe;
      margin-bottom: 4px;
    }
    
    .bv-shipping-preview-content {
      color: rgba(0, 0, 0, 0.7);
      line-height: 1.4;
    }
    
    /* 排序控制 */
    .bv-sort-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }
    
    .bv-sort-button {
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
      color: rgba(0, 0, 0, 0.87);
      font-family: inherit;
    }
    
    .bv-sort-button:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
    }
    
    .bv-sort-button.active {
      background: rgba(81, 138, 255, 0.1);
      border-color: #518aff;
      color: #518aff;
    }
    
    .bv-sort-button .material-icons {
      font-size: 16px;
    }
    
    /* 狀態指示器 */
    .bv-status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(76, 175, 80, 0.1);
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      color: #4caf50;
    }
    
    .bv-status-indicator.warning {
      background: rgba(255, 152, 0, 0.1);
      color: #ff9800;
    }
    
    .bv-status-indicator.error {
      background: rgba(244, 67, 54, 0.1);
      color: #f44336;
    }
    
    .bv-status-dot {
      width: 6px;
      height: 6px;
      background: currentColor;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    
    /* 物流單面板樣式 */
    .bv-shipping-panel {
      padding: 20px;
    }
    
    .bv-shipping-header {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .bv-shipping-title {
      font-size: 20px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
      margin-bottom: 8px;
    }
    
    .bv-shipping-subtitle {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.5);
    }
    
    .bv-shipping-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }
    
    .bv-shipping-button {
      flex: 1;
      padding: 12px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      color: rgba(0, 0, 0, 0.87);
      font-family: inherit;
    }
    
    .bv-shipping-button:hover {
      background: rgba(255, 255, 255, 0.9);
      border-color: rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .bv-shipping-button.primary {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: white;
      border: none;
    }
    
    .bv-shipping-button.primary:hover {
      box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4);
    }
    
    /* 簡化物流單頁面的面板 - 不使用 Material Icons */
    .bv-shipping-mode .bv-panel-header {
      background: rgba(79, 172, 254, 0.1);
    }
    
    .bv-shipping-mode .bv-icon-wrapper {
      font-size: 20px;
      font-weight: bold;
      color: white;
    }
    
    .bv-shipping-mode .bv-icon-wrapper::before {
      content: "物";
    }
    
    .bv-shipping-mode .material-icons {
      display: none;
    }
    
    /* 7-11 物流單特殊樣式 */
    .bv-711-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      background: #ddd;
      padding: 2px;
      margin-bottom: 16px;
    }
    
    .bv-711-label {
      background: white;
      padding: 8px;
      min-height: 200px;
      position: relative;
      overflow: hidden;
    }
    
    .bv-711-label img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .bv-711-label-number {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    `;
  }
  
  function getPanelContent() {
    const collapseIcon = '<span class="material-icons bv-collapse-icon">expand_more</span>';
    
    if (state.currentPageType === CONFIG.PAGE_TYPES.DETAIL) {
      return state.isConverted ? getLabelModePanelContent(collapseIcon) : getA4ModePanelContent();
    } else if (state.currentPageType === CONFIG.PAGE_TYPES.SHIPPING) {
      return getShippingPanelContent();
    }
  }
  
  function getA4ModePanelContent() {
    return `
    <div class="bv-glass-panel">
      <div class="bv-panel-header">
        <div class="bv-header-content">
          <div class="bv-icon-wrapper">
            <span class="material-icons">description</span>
          </div>
          <div class="bv-title-group">
            <h3 class="bv-panel-title">BV 出貨小幫手</h3>
            <p class="bv-panel-subtitle">A4 出貨明細模式</p>
          </div>
        </div>
        <button class="bv-glass-button" id="bv-minimize-btn">
          <span class="material-icons">minimize</span>
        </button>
      </div>
      <div class="bv-panel-body">
        <button class="bv-primary-button" id="bv-convert-btn">
          <div class="bv-button-icon">
            <span class="material-icons">transform</span>
          </div>
          <div class="bv-button-content">
            <span class="bv-button-title">轉換為標籤模式</span>
            <span class="bv-button-subtitle">自動處理圖片並優化版面</span>
          </div>
        </button>
      </div>
    </div>
    `;
  }
  
  function getLabelModePanelContent(collapseIcon) {
    const hasShippingData = state.shippingData.length > 0 || state.pdfShippingData.length > 0;
    const totalShippingCount = state.shippingData.length + state.pdfShippingData.length;
    
    return `
    <div class="bv-glass-panel">
      <div class="bv-panel-header">
        <div class="bv-header-content">
          <div class="bv-icon-wrapper bv-label-mode">
            <span class="material-icons">label</span>
          </div>
          <div class="bv-title-group">
            <h3 class="bv-panel-title">BV 出貨小幫手</h3>
            <p class="bv-panel-subtitle">標籤模式</p>
          </div>
        </div>
        <button class="bv-glass-button" id="bv-minimize-btn">
          <span class="material-icons">minimize</span>
        </button>
      </div>
      <div class="bv-panel-body">
        <div class="bv-panel-content-wrapper">
          ${hasShippingData ? `
          <div class="bv-settings-card">
            <h4 class="bv-card-title">
              <span class="material-icons">local_shipping</span>
              列印模式
              ${collapseIcon}
            </h4>
            <div class="bv-card-content">
              <div class="bv-print-mode-selector">
                <button class="bv-mode-button ${state.printMode === CONFIG.PRINT_MODES.DETAIL_ONLY ? 'active' : ''}" 
                        data-mode="${CONFIG.PRINT_MODES.DETAIL_ONLY}">
                  僅出貨明細
                </button>
                <button class="bv-mode-button ${state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY ? 'active' : ''}" 
                        data-mode="${CONFIG.PRINT_MODES.SHIPPING_ONLY}">
                  僅物流單
                </button>
                <button class="bv-mode-button ${state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH ? 'active' : ''}" 
                        data-mode="${CONFIG.PRINT_MODES.MANUAL_MATCH}">
                  手動對應
                </button>
              </div>
              
              <div class="bv-shipping-status" style="margin-top: 12px;">
                <div class="bv-status-indicator">
                  <span class="bv-status-dot"></span>
                  <span>已載入 ${totalShippingCount} 張物流單</span>
                </div>
              </div>
              
              ${state.printMode === CONFIG.PRINT_MODES.DETAIL_ONLY ? `
                <div class="bv-sort-controls">
                  <span style="font-size: 12px; color: rgba(0, 0, 0, 0.5);">出貨明細排序：</span>
                  <button class="bv-sort-button ${state.detailSortOrder === CONFIG.SORT_ORDERS.ASC ? 'active' : ''}" 
                          id="bv-detail-sort-asc">
                    <span class="material-icons">arrow_upward</span>
                    順序
                  </button>
                  <button class="bv-sort-button ${state.detailSortOrder === CONFIG.SORT_ORDERS.DESC ? 'active' : ''}" 
                          id="bv-detail-sort-desc">
                    <span class="material-icons">arrow_downward</span>
                    倒序
                  </button>
                </div>
              ` : ''}
              
              ${state.printMode === CONFIG.PRINT_MODES.SHIPPING_ONLY ? `
                <div class="bv-sort-controls">
                  <span style="font-size: 12px; color: rgba(0, 0, 0, 0.5);">物流單排序：</span>
                  <button class="bv-sort-button ${state.shippingSortOrder === CONFIG.SORT_ORDERS.ASC ? 'active' : ''}" 
                          id="bv-shipping-sort-asc">
                    <span class="material-icons">arrow_upward</span>
                    順序
                  </button>
                  <button class="bv-sort-button ${state.shippingSortOrder === CONFIG.SORT_ORDERS.DESC ? 'active' : ''}" 
                          id="bv-shipping-sort-desc">
                    <span class="material-icons">arrow_downward</span>
                    倒序
                  </button>
                </div>
                <div class="bv-setting-row" style="margin-top: 8px;">
                  <span class="bv-setting-text">反轉物流單列印順序</span>
                  <label class="bv-glass-switch">
                    <input type="checkbox" id="bv-reverse-shipping" ${state.reverseShipping ? 'checked' : ''}>
                    <span class="bv-switch-slider"></span>
                  </label>
                </div>
              ` : ''}
              
              ${state.printMode === CONFIG.PRINT_MODES.MANUAL_MATCH ? `
                <div class="bv-preview-container">
                  <div class="bv-preview-pages" id="bv-preview-pages">
                    <!-- 預覽頁面將在這裡動態生成 -->
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          ` : ''}
          
          <div class="bv-settings-card">
            <h4 class="bv-card-title">
              <span class="material-icons">tune</span>
              顯示設定
              ${collapseIcon}
            </h4>
            <div class="bv-card-content">
              <div class="bv-setting-group">
                <div class="bv-setting-row">
                  <span class="bv-setting-text">強調數量（▲2、▲3...）</span>
                  <label class="bv-glass-switch">
                    <input type="checkbox" id="bv-highlight-quantity" ${state.highlightQuantity ? 'checked' : ''}>
                    <span class="bv-switch-slider"></span>
                  </label>
                </div>
                <div class="bv-setting-row">
                  <span class="bv-setting-text">精簡模式（隱藏備註等）</span>
                  <label class="bv-glass-switch">
                    <input type="checkbox" id="bv-hide-extra" ${state.hideExtraInfo ? 'checked' : ''}>
                    <span class="bv-switch-slider"></span>
                  </label>
                </div>
                <div class="bv-setting-row">
                  <span class="bv-setting-text">隱藏表頭</span>
                  <label class="bv-glass-switch">
                    <input type="checkbox" id="bv-hide-header" ${state.hideTableHeader ? 'checked' : ''}>
                    <span class="bv-switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bv-settings-card">
            <h4 class="bv-card-title">
              <span class="material-icons">text_fields</span>
              字體大小
              ${collapseIcon}
            </h4>
            <div class="bv-card-content">
              <div class="bv-setting-group">
                <input type="range" id="bv-font-size" class="bv-glass-range" 
                       min="9" max="16" value="${state.fontSize}" step="1">
                <span class="bv-range-value">${state.fontSize}px</span>
              </div>
            </div>
          </div>
          
          <div class="bv-settings-card">
            <h4 class="bv-card-title">
              <span class="material-icons">image</span>
              Logo 設定
              ${collapseIcon}
            </h4>
            <div class="bv-card-content">
              <div class="bv-upload-area" id="bv-logo-upload-area">
                <input type="file" id="bv-logo-upload" accept="image/*" style="display: none;">
                <span class="material-icons bv-upload-icon">cloud_upload</span>
                <div class="bv-upload-text">點擊或拖曳上傳 Logo</div>
                <div class="bv-upload-hint">支援 JPG、PNG 格式</div>
              </div>
              ${state.logoDataUrl ? `
                <div style="margin-top: 12px;">
                  <img src="${state.logoDataUrl}" style="max-width: 100%; max-height: 100px; display: block; margin: 0 auto;">
                  <button class="bv-glass-button" id="bv-remove-logo" style="width: 100%; margin-top: 8px;">
                    <span class="material-icons">delete</span>
                    移除 Logo
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="bv-settings-card collapsed">
            <h4 class="bv-card-title">
              <span class="material-icons">folder</span>
              物流單管理
              ${collapseIcon}
            </h4>
            <div class="bv-card-content">
              ${hasShippingData ? `
                <div class="bv-batch-list" id="bv-batch-list">
                  ${state.shippingDataBatches.map((batch, index) => `
                    <div class="bv-batch-item">
                      <div class="bv-batch-info">
                        <span>批次 ${index + 1}</span>
                        <span class="bv-batch-count">${batch.type === 'pdf' ? batch.data.length : batch.data.length} 筆</span>
                      </div>
                      <div class="bv-batch-actions">
                        <button class="bv-batch-action" data-action="remove" data-index="${index}">
                          <span class="material-icons">delete</span>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <button class="bv-glass-button" id="bv-clear-all-shipping" style="width: 100%; margin-top: 8px;">
                  <span class="material-icons">clear_all</span>
                  清除所有物流單
                </button>
              ` : `
                <div style="text-align: center; padding: 20px; color: rgba(0, 0, 0, 0.5);">
                  <span class="material-icons" style="font-size: 48px; opacity: 0.3;">inbox</span>
                  <p style="margin-top: 8px;">尚無物流單資料</p>
                </div>
              `}
            </div>
          </div>
          
          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button class="bv-glass-button" id="bv-revert-btn" style="flex: 1;">
              <span class="material-icons">undo</span>
              還原
            </button>
            <button class="bv-glass-button bv-primary" id="bv-print-btn" style="flex: 2;">
              <span class="material-icons">print</span>
              列印
            </button>
          </div>
        </div>
      </div>
    </div>
    `;
  }

   function getShippingPanelContent() {
    if (state.currentProvider === '7-11') {
      return get711PanelContent();
    }
    
    // 通用超商物流單面板（簡化版，不使用 Material Icons）
    return `
    <div class="bv-glass-panel">
      <div class="bv-panel-header">
        <div class="bv-header-content">
          <div class="bv-icon-wrapper bv-shipping-mode"></div>
          <div class="bv-title-group">
            <h3 class="bv-panel-title">BV 出貨小幫手</h3>
            <p class="bv-panel-subtitle">物流單抓取模式</p>
          </div>
        </div>
        <button class="bv-glass-button" id="bv-minimize-btn">×</button>
      </div>
      <div class="bv-panel-body">
        <div class="bv-shipping-panel">
          <div class="bv-shipping-header">
            <h2 class="bv-shipping-title">${getProviderName()}物流單</h2>
            <p class="bv-shipping-subtitle">請確認頁面已載入所有物流單</p>
          </div>
          
          <div class="bv-shipping-actions">
            <button class="bv-shipping-button primary" id="bv-capture-shipping">
              抓取物流單
            </button>
          </div>
          
          ${state.currentProvider === 'DELIVERY' && state.deliverySubType === 'PDF' ? 
            getDeliveryContent() : 
            getGeneralShippingContent()
          }
        </div>
      </div>
    </div>
    `;
  }
  
  function get711PanelContent() {
    return `
    <div class="bv-glass-panel">
      <div class="bv-panel-header">
        <div class="bv-header-content">
          <div class="bv-icon-wrapper bv-shipping-mode"></div>
          <div class="bv-title-group">
            <h3 class="bv-panel-title">7-11 物流單抓取</h3>
            <p class="bv-panel-subtitle">A4格式四格抓取</p>
          </div>
        </div>
        <button class="bv-glass-button" id="bv-minimize-btn">×</button>
      </div>
      <div class="bv-panel-body">
        <div class="bv-shipping-panel">
          <div class="bv-shipping-header">
            <h2 class="bv-shipping-title">7-11 交貨便服務單</h2>
            <p class="bv-shipping-subtitle">將自動抓取每一格物流單</p>
          </div>
          
          <div class="bv-shipping-actions">
            <button class="bv-shipping-button primary" id="bv-capture-711">
              開始抓取
            </button>
          </div>
          
          <div id="bv-711-preview" style="margin-top: 20px;">
            <!-- 預覽區域 -->
          </div>
        </div>
      </div>
    </div>
    `;
  }
  
  function getDeliveryContent() {
    return `
    <div style="margin-top: 20px;">
      <div class="bv-upload-area" id="bv-pdf-upload-area">
        <input type="file" id="bv-pdf-upload" accept=".pdf" multiple style="display: none;">
        <div class="bv-upload-icon" style="font-size: 48px;">📄</div>
        <div class="bv-upload-text">上傳宅配 PDF 檔案</div>
        <div class="bv-upload-hint">支援多檔上傳</div>
      </div>
      
      <div id="bv-pdf-list" style="margin-top: 12px;">
        <!-- PDF 列表將在這裡顯示 -->
      </div>
    </div>
    `;
  }
  
  function getGeneralShippingContent() {
    return `
    <div style="margin-top: 20px; text-align: center; color: rgba(0, 0, 0, 0.5);">
      <p>點擊「抓取物流單」按鈕開始</p>
      <p style="font-size: 12px; margin-top: 8px;">抓取完成後將自動保存</p>
    </div>
    `;
  }
  
  function getProviderName() {
    const names = {
      'SEVEN': '7-11',
      'FAMILY': '全家',
      'HILIFE': '萊爾富',
      'OKMART': 'OK超商',
      'DELIVERY': '宅配'
    };
    return names[state.currentProvider] || '物流';
  }
  
  function initShippingMode() {
    createControlPanel();
    setupShippingEventListeners();
  }
  
  // 7-11 物流單抓取
  async function capture711ShippingLabels() {
    try {
      showNotification('開始抓取 7-11 物流單...', 'info');
      
      // 找到所有包含物流單的 div
      const labelDivs = document.querySelectorAll('div[style*="width: 298px"][style*="height: 450px"]');
      
      if (labelDivs.length === 0) {
        showNotification('未找到物流單', 'error');
        return;
      }
      
      const shippingData = [];
      const previewContainer = document.getElementById('bv-711-preview');
      previewContainer.innerHTML = '<div class="bv-711-container"></div>';
      const gridContainer = previewContainer.querySelector('.bv-711-container');
      
      // 抓取每個物流單
      for (let i = 0; i < labelDivs.length; i++) {
        const labelDiv = labelDivs[i];
        
        // 使用 html2canvas 截圖
        const canvas = await html2canvas(labelDiv, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false
        });
        
        const imageData = canvas.toDataURL('image/png');
        
        // 提取物流單資訊
        const orderNoElement = labelDiv.querySelector('span[id*="lblOrderNo"]');
        const orderNo = orderNoElement ? orderNoElement.textContent : `7-11-${i + 1}`;
        
        shippingData.push({
          orderNo: orderNo,
          type: '7-11',
          image: imageData,
          index: i
        });
        
        // 顯示預覽
        const previewDiv = document.createElement('div');
        previewDiv.className = 'bv-711-label';
        previewDiv.innerHTML = `
          <img src="${imageData}" alt="物流單 ${i + 1}">
          <span class="bv-711-label-number">${i + 1}</span>
        `;
        gridContainer.appendChild(previewDiv);
      }
      
      // 保存資料
      state.shippingData = shippingData;
      saveShippingData();
      
      showNotification(`成功抓取 ${shippingData.length} 張物流單`, 'success');
      
      // 添加完成按鈕
      const completeButton = document.createElement('button');
      completeButton.className = 'bv-shipping-button primary';
      completeButton.textContent = '完成並返回出貨明細';
      completeButton.style.marginTop = '16px';
      completeButton.style.width = '100%';
      completeButton.onclick = () => {
        window.close();
      };
      previewContainer.appendChild(completeButton);
      
    } catch (error) {
      console.error('抓取失敗:', error);
      showNotification('抓取失敗，請重試', 'error');
    }
  }
  
  async function captureDeliveryPage() {
    // 通用物流單抓取邏輯
    try {
      const shippingElements = document.querySelectorAll('.shipping-label, .delivery-note, [class*="shipping"]');
      
      if (shippingElements.length === 0) {
        showNotification('未找到物流單元素', 'error');
        return;
      }
      
      const shippingData = [];
      
      for (let i = 0; i < shippingElements.length; i++) {
        const element = shippingElements[i];
        const orderNo = extractOrderNumber(element.textContent) || `${state.currentProvider}-${i + 1}`;
        
        shippingData.push({
          orderNo: orderNo,
          type: state.currentProvider,
          content: element.innerHTML,
          text: element.textContent.trim()
        });
      }
      
      state.shippingData = shippingData;
      saveShippingData();
      showNotification(`成功抓取 ${shippingData.length} 筆物流單`, 'success');
      
    } catch (error) {
      console.error('抓取失敗:', error);
      showNotification('抓取失敗，請重試', 'error');
    }
  }
  
  function setupEventListeners() {
    // 最小化按鈕
    const minimizeBtn = document.getElementById('bv-minimize-btn');
    const minimizedBtn = document.getElementById('bv-minimized-button');
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        state.isPanelMinimized = true;
        document.getElementById('bv-label-control-panel').classList.add('minimized');
        minimizedBtn.style.display = 'flex';
      });
    }
    
    if (minimizedBtn) {
      minimizedBtn.addEventListener('click', () => {
        state.isPanelMinimized = false;
        document.getElementById('bv-label-control-panel').classList.remove('minimized');
        minimizedBtn.style.display = 'none';
      });
    }
    
    // A4 模式轉換按鈕
    const convertBtn = document.getElementById('bv-convert-btn');
    if (convertBtn) {
      convertBtn.addEventListener('click', () => {
        state.isConverted = true;
        convertToLabelFormat();
        checkShippingDataStatus();
      });
    }
    
    // 標籤模式事件
    if (state.isConverted) {
      setupLabelModeEventListeners();
    }
  }
  
  function updatePreview() {
    if (state.printMode !== CONFIG.PRINT_MODES.MANUAL_MATCH) return;
    
    clearTimeout(state.previewTimeout);
    state.previewTimeout = setTimeout(() => {
      const previewContainer = document.getElementById('bv-preview-pages');
      if (!previewContainer) return;
      
      previewContainer.innerHTML = '';
      
      // 合併所有頁面
      const allPages = [];
      
      // 添加出貨明細頁
      state.detailPages.forEach((page, index) => {
        allPages.push({
          type: 'detail',
          element: page,
          index: index,
          orderNo: extractOrderNumber(page.textContent)
        });
      });
      
      // 添加物流單頁
      state.shippingPages.forEach((page, index) => {
        allPages.push({
          type: 'shipping',
          element: page,
          index: index,
          orderNo: page.dataset.orderNo
        });
      });
      
      // 排序
      allPages.sort((a, b) => {
        // 可以根據需要調整排序邏輯
        return a.index - b.index;
      });
      
      // 生成預覽
      allPages.forEach((page, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = `bv-preview-page ${page.type}`;
        previewDiv.dataset.pageIndex = index;
        previewDiv.dataset.pageType = page.type;
        
        // 簡單的縮略圖
        const thumbnail = document.createElement('div');
        thumbnail.style.padding = '8px';
        thumbnail.style.fontSize = '10px';
        thumbnail.style.overflow = 'hidden';
        thumbnail.textContent = page.orderNo || `${page.type} ${page.index + 1}`;
        
        previewDiv.appendChild(thumbnail);
        
        const pageNumber = document.createElement('div');
        pageNumber.className = 'bv-preview-page-number';
        pageNumber.textContent = index + 1;
        previewDiv.appendChild(pageNumber);
        
        previewContainer.appendChild(previewDiv);
      });
    }, 300);
  }
  
  function updatePrintModeUI() {
    // 更新預覽
    updatePreview();
    
    // 更新按鈕狀態
    document.querySelectorAll('.bv-mode-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.printMode);
    });
  }
  
  function preparePrintWithMode() {
    switch (state.printMode) {
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
  }
  
  function prepareDetailOnlyPrint() {
    // 隱藏所有物流單頁
    state.shippingPages.forEach(page => {
      page.style.display = 'none';
    });
    
    // 顯示並排序出貨明細頁
    sortDetailPages();
    state.detailPages.forEach(page => {
      page.style.display = 'block';
    });
  }
  
  function prepareShippingOnlyPrint() {
    // 隱藏所有出貨明細頁
    state.detailPages.forEach(page => {
      page.style.display = 'none';
    });
    
    // 顯示並排序物流單頁
    sortShippingPages();
    
    // 根據反轉設定調整順序
    if (state.reverseShipping) {
      reverseShippingPagesForPrint();
    }
    
    state.shippingPages.forEach(page => {
      page.style.display = 'block';
    });
  }
  
  function prepareManualMatchPrint() {
    // 顯示所有頁面，由使用者在預覽中手動調整順序
    state.detailPages.forEach(page => {
      page.style.display = 'block';
    });
    state.shippingPages.forEach(page => {
      page.style.display = 'block';
    });
  }
  
  function sortDetailPages() {
    const container = document.body;
    const pages = Array.from(state.detailPages);
    
    pages.sort((a, b) => {
      const indexA = parseInt(a.dataset.originalIndex) || 0;
      const indexB = parseInt(b.dataset.originalIndex) || 0;
      
      return state.detailSortOrder === CONFIG.SORT_ORDERS.ASC ? 
        indexA - indexB : indexB - indexA;
    });
    
    pages.forEach(page => container.appendChild(page));
    state.detailPages = pages;
  }
  
  function sortShippingPages() {
    const container = document.body;
    const pages = Array.from(state.shippingPages);
    
    pages.sort((a, b) => {
      const indexA = parseInt(a.dataset.shippingIndex) || 0;
      const indexB = parseInt(b.dataset.shippingIndex) || 0;
      
      return state.shippingSortOrder === CONFIG.SORT_ORDERS.ASC ? 
        indexA - indexB : indexB - indexA;
    });
    
    pages.forEach(page => container.appendChild(page));
    state.shippingPages = pages;
  }
  
  function reverseShippingPagesForPrint() {
    const container = document.body;
    const pages = Array.from(state.shippingPages).reverse();
    pages.forEach(page => container.appendChild(page));
    state.shippingPages = pages;
  }
  
  function setupShippingEventListeners() {
    // 7-11 抓取按鈕
    const capture711Btn = document.getElementById('bv-capture-711');
    if (capture711Btn) {
      capture711Btn.addEventListener('click', capture711ShippingLabels);
    }
    
    // 通用抓取按鈕
    const captureBtn = document.getElementById('bv-capture-shipping');
    if (captureBtn) {
      captureBtn.addEventListener('click', captureDeliveryPage);
    }
    
    // PDF 上傳
    const pdfUpload = document.getElementById('bv-pdf-upload');
    const pdfUploadArea = document.getElementById('bv-pdf-upload-area');
    
    if (pdfUpload && pdfUploadArea) {
      pdfUploadArea.addEventListener('click', () => pdfUpload.click());
      
      pdfUpload.addEventListener('change', (e) => {
        handleMultiplePdfUpload(e.target.files);
      });
      
      // 拖放支援
      pdfUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        pdfUploadArea.classList.add('dragging');
      });
      
      pdfUploadArea.addEventListener('dragleave', () => {
        pdfUploadArea.classList.remove('dragging');
      });
      
      pdfUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        pdfUploadArea.classList.remove('dragging');
        handleMultiplePdfUpload(e.dataTransfer.files);
      });
    }
  }
  
  function setupLabelModeEventListeners() {
    // 列印模式選擇
    document.querySelectorAll('.bv-mode-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.printMode = e.target.dataset.mode;
        updatePrintModeUI();
        saveSettings();
      });
    });
    
    // 排序按鈕
    const detailSortAsc = document.getElementById('bv-detail-sort-asc');
    const detailSortDesc = document.getElementById('bv-detail-sort-desc');
    const shippingSortAsc = document.getElementById('bv-shipping-sort-asc');
    const shippingSortDesc = document.getElementById('bv-shipping-sort-desc');
    
    if (detailSortAsc) {
      detailSortAsc.addEventListener('click', () => {
        state.detailSortOrder = CONFIG.SORT_ORDERS.ASC;
        updatePrintModeUI();
        saveSettings();
      });
    }
    
    if (detailSortDesc) {
      detailSortDesc.addEventListener('click', () => {
        state.detailSortOrder = CONFIG.SORT_ORDERS.DESC;
        updatePrintModeUI();
        saveSettings();
      });
    }
    
    if (shippingSortAsc) {
      shippingSortAsc.addEventListener('click', () => {
        state.shippingSortOrder = CONFIG.SORT_ORDERS.ASC;
        updatePrintModeUI();
        saveSettings();
      });
    }
    
    if (shippingSortDesc) {
      shippingSortDesc.addEventListener('click', () => {
        state.shippingSortOrder = CONFIG.SORT_ORDERS.DESC;
        updatePrintModeUI();
        saveSettings();
      });
    }
    
    // 反轉物流單
    const reverseShipping = document.getElementById('bv-reverse-shipping');
    if (reverseShipping) {
      reverseShipping.addEventListener('change', (e) => {
        state.reverseShipping = e.target.checked;
        saveSettings();
      });
    }
    
    // 顯示設定
    const highlightQuantity = document.getElementById('bv-highlight-quantity');
    const hideExtra = document.getElementById('bv-hide-extra');
    const hideHeader = document.getElementById('bv-hide-header');
    
    if (highlightQuantity) {
      highlightQuantity.addEventListener('change', toggleQuantityHighlight);
    }
    
    if (hideExtra) {
      hideExtra.addEventListener('change', (e) => {
        state.hideExtraInfo = e.target.checked;
        document.querySelectorAll('.order-info').forEach(page => {
          processExtraInfoHiding(page);
        });
        saveSettings();
      });
    }
    
    if (hideHeader) {
      hideHeader.addEventListener('change', (e) => {
        state.hideTableHeader = e.target.checked;
        updateLabelStyles();
        saveSettings();
      });
    }
    
    // 字體大小
    const fontSizeSlider = document.getElementById('bv-font-size');
    if (fontSizeSlider) {
      updateRangeProgress(fontSizeSlider);
      fontSizeSlider.addEventListener('input', (e) => {
        state.fontSize = e.target.value;
        updateRangeProgress(e.target);
        document.querySelector('.bv-range-value').textContent = `${state.fontSize}px`;
        updateLabelStyles();
        saveSettings();
      });
    }
    
    // Logo 上傳
    initLogoUpload();
    
    // 批次管理
    const batchList = document.getElementById('bv-batch-list');
    if (batchList) {
      batchList.addEventListener('click', handleBatchAction);
    }
    
    const clearAllBtn = document.getElementById('bv-clear-all-shipping');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (confirm('確定要清除所有物流單資料嗎？')) {
          state.shippingData = [];
          state.pdfShippingData = [];
          state.shippingDataBatches = [];
          state.shippingPages = [];
          saveShippingData();
          updatePanelContent();
          showNotification('已清除所有物流單資料', 'success');
        }
      });
    }
    
    // 還原按鈕
    const revertBtn = document.getElementById('bv-revert-btn');
    if (revertBtn) {
      revertBtn.addEventListener('click', revertToOriginal);
    }
    
    // 列印按鈕
    const printBtn = document.getElementById('bv-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        preparePrintStyles();
        preparePrintWithMode();
        setTimeout(() => window.print(), 100);
      });
    }
    
    // 設置可折疊卡片
    setupCollapsibleCards();
  }

   async function handleMultiplePdfUpload(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      showNotification('請選擇 PDF 檔案', 'error');
      return;
    }
    
    showNotification(`正在處理 ${pdfFiles.length} 個 PDF 檔案...`, 'info');
    
    const pdfData = [];
    
    for (const file of pdfFiles) {
      try {
        // 載入 PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        // 處理每一頁
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2 });
          
          // 創建 canvas 來渲染 PDF
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // 獲取文字內容
          const textContent = await page.getTextContent();
          const text = textContent.items.map(item => item.str).join(' ');
          
          // 提取物流編號
          const shippingNo = extractShippingNumberFromText(text);
          
          pdfData.push({
            fileName: file.name,
            pageNum: pageNum,
            totalPages: pdf.numPages,
            orderNo: shippingNo || `${file.name}-P${pageNum}`,
            image: canvas.toDataURL('image/png'),
            text: text,
            type: 'pdf'
          });
        }
      } catch (error) {
        console.error(`處理 ${file.name} 時發生錯誤:`, error);
        showNotification(`處理 ${file.name} 失敗`, 'error');
      }
    }
    
    if (pdfData.length > 0) {
      // 添加到批次
      state.pdfShippingData.push(...pdfData);
      state.shippingDataBatches.push({
        type: 'pdf',
        timestamp: Date.now(),
        data: pdfData
      });
      
      saveShippingData();
      updateBatchList();
      showNotification(`成功處理 ${pdfData.length} 頁 PDF`, 'success');
    }
    
    // 顯示 PDF 列表
    const pdfList = document.getElementById('bv-pdf-list');
    if (pdfList) {
      pdfList.innerHTML = pdfData.map((data, index) => `
        <div class="bv-pdf-item" style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <div style="font-weight: 500;">${data.fileName} - 第 ${data.pageNum} 頁</div>
          <div style="font-size: 12px; color: rgba(0,0,0,0.6);">物流編號: ${data.orderNo}</div>
        </div>
      `).join('');
    }
  }

  // 從文字中提取物流編號
  function extractShippingNumberFromText(text) {
    // 常見的物流單號格式
    const patterns = [
      /訂單編號[：:]\s*([A-Z0-9]+)/i,
      /運單號碼[：:]\s*([A-Z0-9]+)/i,
      /物流編號[：:]\s*([A-Z0-9]+)/i,
      /Tracking\s*No[.:]\s*([A-Z0-9]+)/i,
      /\b([A-Z]{2}\d{9,12}[A-Z]{2})\b/, // 國際快遞格式
      /\b(\d{10,20})\b/ // 純數字格式
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  function loadShippingData() {
    try {
      const savedData = localStorage.getItem('bv_shipping_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        state.shippingData = parsed.shippingData || [];
        state.pdfShippingData = parsed.pdfShippingData || [];
        state.shippingDataBatches = parsed.batches || [];
        
        // 重新合併資料
        mergeAllBatchData();
      }
    } catch (error) {
      console.error('載入物流單資料失敗:', error);
    }
  }
  
  function mergeAllBatchData() {
    const allData = [];
    
    // 合併所有批次資料
    state.shippingDataBatches.forEach(batch => {
      if (batch.type === 'pdf') {
        allData.push(...batch.data);
      } else {
        allData.push(...batch.data);
      }
    });
    
    // 建立物流單頁面
    createShippingOnlyPages();
  }
  
  function updateBatchList() {
    const batchList = document.getElementById('bv-batch-list');
    if (!batchList) return;
    
    batchList.innerHTML = state.shippingDataBatches.map((batch, index) => `
      <div class="bv-batch-item">
        <div class="bv-batch-info">
          <span>批次 ${index + 1}</span>
          <span class="bv-batch-count">${batch.data.length} 筆</span>
        </div>
        <div class="bv-batch-actions">
          <button class="bv-batch-action" data-action="remove" data-index="${index}">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  }
  
  function handleBatchAction(e) {
    const button = e.target.closest('.bv-batch-action');
    if (!button) return;
    
    const action = button.dataset.action;
    const index = parseInt(button.dataset.index);
    
    if (action === 'remove') {
      state.shippingDataBatches.splice(index, 1);
      mergeAllBatchData();
      updateBatchList();
      saveShippingData();
      showNotification('已移除批次', 'success');
    }
  }
  
  function updateShippingCount() {
    const totalCount = state.shippingData.length + state.pdfShippingData.length;
    return totalCount;
  }
  
  async function fetchShippingData() {
    try {
      // 先嘗試從 localStorage 載入
      loadShippingData();
      
      // 如果沒有資料，嘗試從外部來源載入
      if (state.shippingData.length === 0 && state.pdfShippingData.length === 0) {
        // 可以在這裡添加從伺服器或其他來源載入的邏輯
        await fetchShippingDataHTML();
      }
    } catch (error) {
      console.error('載入物流單資料失敗:', error);
    }
  }
  
  function fetchShippingDataHTML() {
    // 嘗試從當前頁面或其他頁面抓取物流單資料
    const shippingElements = document.querySelectorAll('[data-shipping-info]');
    
    if (shippingElements.length > 0) {
      const tempData = [];
      shippingElements.forEach((element, index) => {
        tempData.push(extractShippingData(element));
      });
      
      if (tempData.length > 0) {
        state.shippingDataBatches.push({
          type: 'html',
          timestamp: Date.now(),
          data: tempData
        });
        state.shippingData.push(...tempData);
        saveShippingData();
      }
    }
  }
  
  function extractShippingData(element) {
    // 移除 script 標籤
    const cleanElement = element.cloneNode(true);
    removeScripts(cleanElement);
    
    return {
      orderNo: element.dataset.orderNo || extractOrderNumber(element.textContent),
      type: element.dataset.shippingType || 'unknown',
      content: cleanElement.innerHTML,
      text: cleanElement.textContent.trim()
    };
  }
  
  function removeScripts(element) {
    const scripts = element.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      scripts[i].remove();
    }
  }
  
  function saveShippingData() {
    try {
      const dataToSave = {
        shippingData: state.shippingData,
        pdfShippingData: state.pdfShippingData,
        batches: state.shippingDataBatches,
        timestamp: Date.now()
      };
      localStorage.setItem('bv_shipping_data', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('儲存物流單資料失敗:', error);
    }
  }
  
  function checkShippingDataStatus() {
    loadShippingData();
    const totalCount = updateShippingCount();
    
    if (totalCount > 0) {
      createShippingOnlyPages();
      updatePanelContent();
    }
  }
  
  function setupCollapsibleCards() {
    document.querySelectorAll('.bv-card-title').forEach(title => {
      title.addEventListener('click', (e) => {
        // 避免點擊內部元素時觸發
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        
        const card = title.closest('.bv-settings-card');
        card.classList.toggle('collapsed');
        
        // 儲存折疊狀態
        const cardText = title.textContent.trim();
        state.collapsedSections[cardText] = card.classList.contains('collapsed');
        saveSettings();
      });
    });
    
    // 恢復折疊狀態
    restoreCollapsedStates();
  }
  
  function restoreCollapsedStates() {
    document.querySelectorAll('.bv-card-title').forEach(title => {
      const cardText = title.textContent.trim();
      if (state.collapsedSections[cardText]) {
        title.closest('.bv-settings-card').classList.add('collapsed');
      }
    });
  }
  
  function initDragFunction() {
    const panel = document.getElementById('bv-label-control-panel');
    const header = panel.querySelector('.bv-panel-header');
    
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    let active = false;
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        active = true;
        panel.style.transition = 'none';
      }
    }
    
    function dragEnd(e) {
      initialX = currentX;
      initialY = currentY;
      active = false;
      panel.style.transition = '';
    }
    
    function drag(e) {
      if (active) {
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        setTranslate(currentX, currentY, panel);
      }
    }
    
    function setTranslate(xPos, yPos, el) {
      el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
  }
  
  function initLogoUpload() {
    const logoUpload = document.getElementById('bv-logo-upload');
    const logoUploadArea = document.getElementById('bv-logo-upload-area');
    const removeLogo = document.getElementById('bv-remove-logo');
    
    if (logoUploadArea) {
      logoUploadArea.addEventListener('click', () => {
        if (logoUpload) logoUpload.click();
      });
    }
    
    if (logoUpload) {
      logoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
              state.logoAspectRatio = img.width / img.height;
              state.logoDataUrl = event.target.result;
              updateLogos();
              updatePanelContent();
              saveSettings();
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }
    
    if (removeLogo) {
      removeLogo.addEventListener('click', () => {
        state.logoDataUrl = null;
        state.logoAspectRatio = 1;
        updateLogos();
        updatePanelContent();
        saveSettings();
      });
    }
  }
  
  function initPresetSystem() {
    // 預設系統可在此擴展
  }
  
  function loadPresetList() {
    // 載入預設列表
  }
  
  function observeOriginalControls() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && state.isConverted) {
          triggerOriginalPageUpdate();
        }
      });
    });
    
    const targetNode = document.querySelector('#original-control-area');
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
    }
  }
  
  function convertToLabelFormat() {
    hideOriginalControls();
    
    const orderInfos = document.querySelectorAll('.order-info');
    let validPageCount = 0;
    
    state.detailPages = [];
    
    orderInfos.forEach((info, index) => {
      // 處理原始內容
      info.classList.add('bv-label-page');
      info.dataset.originalIndex = index;
      
      // 處理產品圖片
      processProductImages(info);
      
      // 處理精簡模式
      if (state.hideExtraInfo) {
        processExtraInfoHiding(info);
      }
      
      // 設置延遲載入
      setupLazyLoadForPage(info);
      
      state.detailPages.push(info);
      validPageCount++;
    });
    
    // 應用樣式
    document.body.classList.add('label-mode');
    updateLabelStyles();
    
    // 處理分頁
    handlePagination();
    
    // 更新面板
    updatePanelContent();
    
    showNotification(`成功轉換 ${validPageCount} 個標籤頁面`, 'success');
  }
  
  function handlePagination() {
    // 移除原有的分頁元素
    const pageBreaks = document.querySelectorAll('hr, .page-break, [style*="page-break"]');
    pageBreaks.forEach(el => el.remove());
    
    // 為每個頁面添加適當的間距
    state.detailPages.forEach((page, index) => {
      if (index > 0) {
        page.classList.add('bv-new-page');
      }
    });
  }
  
  function processProductImages(container) {
    const images = container.querySelectorAll('img');
    
    images.forEach(img => {
      // 移除 loading="lazy" 屬性以避免衝突
      img.removeAttribute('loading');
      
      // 設置最大尺寸
      img.style.maxWidth = '100px';
      img.style.maxHeight = '100px';
      img.style.objectFit = 'contain';
      
      // 處理圖片載入錯誤
      img.onerror = function() {
        this.style.display = 'none';
      };
    });
  }
  
  function processExtraInfoHiding(container) {
    // 精簡模式：隱藏所有 class="row order-info" 的元素
    const extraRows = container.querySelectorAll('.row.order-info');
    extraRows.forEach(row => {
      row.style.display = 'none';
    });
    
    // 同時隱藏其他可能的額外資訊
    const selectors = [
      '.order-note',
      '.order-memo',
      '.customer-note',
      '[class*="remark"]',
      '[class*="note"]',
      '[class*="備註"]'
    ];
    
    selectors.forEach(selector => {
      const elements = container.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.display = state.hideExtraInfo ? 'none' : '';
      });
    });
  }
  
  function setupLazyLoadForPage(page) {
    if (!state.lazyLoadObserver) return;
    
    const images = page.querySelectorAll('img[src]');
    images.forEach(img => {
      // 保存原始 src
      img.dataset.src = img.src;
      // 設置占位圖
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3C/svg%3E';
      // 開始觀察
      state.lazyLoadObserver.observe(img);
    });
  }
  
  function applySortOrder() {
    sortDetailPages();
    if (state.shippingPages.length > 0) {
      sortShippingPages();
    }
  }
  
  function createShippingOnlyPages() {
    // 移除現有的物流單頁面
    state.shippingPages.forEach(page => page.remove());
    state.shippingPages = [];
    
    // 獲取所有出貨明細頁的訂單編號
    const detailOrders = state.detailPages.map((page, index) => ({
      orderNo: extractOrderNumber(page.textContent),
      index: index,
      element: page
    }));
    
    // 合併所有物流單資料
    const allShippingData = [...state.shippingData, ...state.pdfShippingData];
    
    // 為每個出貨明細創建對應的物流單頁
    detailOrders.forEach((detail, detailIndex) => {
      const matchingShipping = findMatchingShippingData(detail.orderNo, detailIndex);
      
      if (matchingShipping) {
        const shippingPage = createShippingPage(
          matchingShipping,
          detail.orderNo,
          true,
          detailIndex
        );
        state.shippingPages.push(shippingPage);
      }
    });
    
    // 處理沒有匹配的物流單
    allShippingData.forEach((shipping, index) => {
      const isMatched = state.shippingPages.some(page => 
        page.dataset.shippingOrderNo === shipping.orderNo
      );
      
      if (!isMatched) {
        const shippingPage = createShippingPage(
          shipping,
          shipping.orderNo,
          false,
          state.detailPages.length + index
        );
        state.shippingPages.push(shippingPage);
      }
    });
  }
  
  function extractOrderNumber(orderContent) {
    // 嘗試多種模式提取訂單編號
    const patterns = [
      /訂單編號[：:]\s*([A-Z0-9\-]+)/i,
      /Order\s*#?\s*[：:]?\s*([A-Z0-9\-]+)/i,
      /單號[：:]\s*([A-Z0-9\-]+)/i,
      /\b(S\d{10,})\b/, // 特定格式
      /\b([A-Z]{2,}\d{6,})\b/ // 通用格式
    ];
    
    for (const pattern of patterns) {
      const match = orderContent.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }
  
  function findMatchingShippingData(orderNo, index) {
    if (!orderNo) return null;
    
    // 優先精確匹配
    const allShipping = [...state.shippingData, ...state.pdfShippingData];
    let match = allShipping.find(s => s.orderNo === orderNo);
    
    if (match) return match;
    
    // 模糊匹配
    match = allShipping.find(s => 
      s.orderNo.includes(orderNo) || orderNo.includes(s.orderNo)
    );
    
    if (match) return match;
    
    // 按索引匹配
    if (allShipping[index]) {
      return allShipping[index];
    }
    
    return null;
  }
  
  function createShippingPage(shippingInfo, orderNo, showOrderLabel, orderIndex) {
    const shippingPage = document.createElement('div');
    shippingPage.className = 'order-info bv-shipping-page';
    shippingPage.dataset.orderNo = orderNo;
    shippingPage.dataset.shippingOrderNo = shippingInfo.orderNo;
    shippingPage.dataset.shippingIndex = orderIndex;
    
    // 根據物流單類型創建內容
    if (shippingInfo.type === 'pdf' || shippingInfo.type === '7-11') {
      // PDF 或圖片類型
      shippingPage.innerHTML = `
        <div class="shipping-content">
          ${showOrderLabel ? `<div class="shipping-order-label">訂單: ${getOrderLabelForShipping(orderIndex, orderNo)}</div>` : ''}
          <img src="${shippingInfo.image}" style="width: 100%; height: auto;">
        </div>
      `;
    } else {
      // HTML 內容類型
      shippingPage.innerHTML = `
        <div class="shipping-content">
          ${showOrderLabel ? `<div class="shipping-order-label">訂單: ${getOrderLabelForShipping(orderIndex, orderNo)}</div>` : ''}
          ${shippingInfo.content}
        </div>
      `;
    }
    
    // 添加到 DOM
    document.body.appendChild(shippingPage);
    
    return shippingPage;
  }
  
  function getOrderLabelForShipping(shippingIndex, defaultOrderNo) {
    // 嘗試獲取對應的出貨明細訂單編號
    if (state.detailPages[shippingIndex]) {
      const detailOrderNo = extractOrderNumber(state.detailPages[shippingIndex].textContent);
      return detailOrderNo || defaultOrderNo;
    }
    return defaultOrderNo;
  }
  
  function triggerOriginalPageUpdate() {
    // 重新處理頁面
    if (state.isConverted) {
      const newPages = document.querySelectorAll('.order-info:not(.bv-label-page)');
      newPages.forEach((page, index) => {
        convertToLabelFormat();
      });
    }
  }
  
  function updateLabelStyles() {
    let styleEl = document.getElementById('bv-dynamic-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'bv-dynamic-styles';
      document.head.appendChild(styleEl);
    }
    
    styleEl.textContent = `
      body.label-mode .order-info {
        font-size: ${state.fontSize}px !important;
      }
      
      body.label-mode table {
        font-size: ${state.fontSize}px !important;
      }
      
      ${state.hideTableHeader ? `
      body.label-mode .order-info table thead,
      body.label-mode .order-info table th {
        display: none !important;
      }
      ` : ''}
      
      /* 數量強調樣式 */
      .quantity-highlight {
        background: #ffeb3b !important;
        font-weight: bold !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        display: inline-block !important;
      }
      
      /* 物流單頁面樣式 */
      .bv-shipping-page {
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 20px;
        padding: 20px;
        background: white;
        border: 1px solid #e0e0e0;
      }
      
      .shipping-order-label {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 10px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 4px;
      }
      
      @media print {
        .bv-shipping-page {
          margin: 0;
          border: none;
          padding: 0;
        }
      }
    `;
  }
  
  function updateLogos() {
    // Logo 更新邏輯可在此實現
  }
  
  function preparePrintStyles() {
    // 準備列印樣式
    document.body.classList.add('printing');
    
    // 儲存當前捲動位置
    const scrollY = window.scrollY;
    
    // 列印完成後恢復
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing');
      window.scrollTo(0, scrollY);
    }, { once: true });
  }
  
  function revertToOriginal() {
    if (!confirm('確定要還原到原始狀態嗎？所有設定將會保留。')) return;
    
    state.isConverted = false;
    document.body.classList.remove('label-mode');
    
    // 移除動態樣式
    const dynamicStyles = document.getElementById('bv-dynamic-styles');
    if (dynamicStyles) dynamicStyles.remove();
    
    // 移除物流單頁面
    state.shippingPages.forEach(page => page.remove());
    state.shippingPages = [];
    
    // 恢復原始樣式
    document.querySelectorAll('.order-info').forEach(info => {
      info.classList.remove('bv-label-page', 'bv-new-page');
      info.style.display = '';
      
      // 恢復隱藏的元素
      info.querySelectorAll('[style*="display: none"]').forEach(el => {
        if (!el.classList.contains('bv-hidden-original')) {
          el.style.display = '';
        }
      });
    });
    
    // 恢復數量高亮
    removeQuantityHighlight();
    
    // 更新面板
    updatePanelContent();
    
    showNotification('已還原到原始狀態', 'success');
  }
  
  function toggleQuantityHighlight(e) {
    state.highlightQuantity = e.target.checked;
    
    if (state.highlightQuantity) {
      applyQuantityHighlight();
    } else {
      removeQuantityHighlight();
    }
    
    saveSettings();
  }
  
  function applyQuantityHighlight() {
    document.querySelectorAll('.order-info').forEach(page => {
      // 尋找可能包含數量的元素
      const walker = document.createTreeWalker(
        page,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent;
        const parent = node.parentElement;
        
        // 跳過已處理的節點
        if (parent.classList.contains('quantity-highlight')) continue;
        
        // 匹配數量 >= 2 的模式
        const matches = text.match(/\b([2-9]|\d{2,})\b/g);
        
        if (matches && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
          const newHtml = text.replace(/\b([2-9]|\d{2,})\b/g, (match) => {
            const num = parseInt(match);
            if (num >= 2) {
              return `<span class="quantity-highlight">▲${match}</span>`;
            }
            return match;
          });
          
          if (newHtml !== text) {
            const span = document.createElement('span');
            span.innerHTML = newHtml;
            parent.replaceChild(span, node);
          }
        }
      }
    });
  }
  
  function removeQuantityHighlight() {
    document.querySelectorAll('.quantity-highlight').forEach(highlight => {
      const parent = highlight.parentElement;
      const text = highlight.textContent.replace('▲', '');
      highlight.replaceWith(text);
      
      // 合併相鄰的文字節點
      parent.normalize();
    });
  }
  
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `bv-notification bv-${type}`;
    
    const icon = type === 'success' ? 'check_circle' : 
                 type === 'error' ? 'error' : 'info';
    
    notification.innerHTML = `
      <span class="material-icons">${icon}</span>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  function updateRangeProgress(input) {
    const value = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty('--value', value + '%');
  }
  
  function updatePanelContent() {
    const panel = document.getElementById('bv-label-control-panel');
    if (panel) {
      const body = panel.querySelector('.bv-panel-body');
      if (body) {
        body.innerHTML = getPanelContent().match(/<div class="bv-panel-body">([\s\S]*?)<\/div>\s*<\/div>\s*$/)[1];
      }
      
      // 重新綁定事件
      if (state.isConverted) {
        setupLabelModeEventListeners();
      } else {
        setupEventListeners();
      }
    }
  }
  
  function hideOriginalControls() {
    // 隱藏原始的控制元素
    const selectorsToHide = [
      '.print-button',
      '.print-controls',
      '#printButton',
      '[onclick*="print"]',
      'button:contains("列印")',
      'button:contains("Print")'
    ];
    
    selectorsToHide.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          el.classList.add('bv-hidden-original');
          el.style.display = 'none';
        });
      } catch (e) {
        // 忽略無效的選擇器
      }
    });
  }
  
  function getCurrentSettings() {
    return {
      fontSize: state.fontSize,
      highlightQuantity: state.highlightQuantity,
      hideExtraInfo: state.hideExtraInfo,
      hideTableHeader: state.hideTableHeader,
      logoDataUrl: state.logoDataUrl,
      logoAspectRatio: state.logoAspectRatio,
      printMode: state.printMode,
      detailSortOrder: state.detailSortOrder,
      shippingSortOrder: state.shippingSortOrder,
      reverseShipping: state.reverseShipping,
      collapsedSections: state.collapsedSections
    };
  }
  
  function applyPresetSettings(settings) {
    Object.assign(state, settings);
    updateLabelStyles();
    updateLogos();
    updatePanelContent();
  }
  
  function saveSettings() {
    try {
      localStorage.setItem('bv_label_settings', JSON.stringify(getCurrentSettings()));
    } catch (error) {
      console.error('儲存設定失敗:', error);
    }
  }
  
  function loadSettings() {
    try {
      const saved = localStorage.getItem('bv_label_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        applyPresetSettings(settings);
      }
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  }
  
  function init() {
    console.log('BV Shop Label Assistant v' + CONFIG.VERSION + ' 初始化中...');
    
    // 偵測當前頁面類型
    detectCurrentPage();
    
    // 觀察原始控制項的變化
    observeOriginalControls();
  }
  
  // 等待 DOM 載入完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
