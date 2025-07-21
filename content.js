// ========================================
// 6. UI 系統 (UI)
// ========================================
BVWizard.UI = {
    // UI 設定
    config: {
        colors: {
            primary: '#518aff',
            primaryDark: '#0040ff',
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
                    animation: fadeIn 0.3s ease;
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
                    animation: slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }
                
                /* Wizard 頭部 */
                .bv-wizard-header {
                    padding: 24px 32px;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                    background: rgba(255, 255, 255, 0.7);
                    flex-shrink: 0;
                }
                
                .bv-wizard-title {
                    margin: 0 0 8px 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #000;
                    letter-spacing: -0.02em;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .bv-wizard-title .bv-icon {
                    width: 32px;
                    height: 32px;
                    background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 18px;
                }
                
                .bv-wizard-subtitle {
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.5);
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
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                
                .bv-step-dot.active {
                    width: 24px;
                    border-radius: 4px;
                    background: #518aff;
                }
                
                .bv-step-dot.completed {
                    background: #10b981;
                }
                
                .bv-step-line {
                    flex: 1;
                    height: 2px;
                    background: rgba(0, 0, 0, 0.1);
                    margin: 0 4px;
                }
                
                .bv-step-line.completed {
                    background: #10b981;
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
                
                /* Wizard 底部 */
                .bv-wizard-footer {
                    padding: 24px 32px;
                    border-top: 1px solid rgba(0, 0, 0, 0.06);
                    background: rgba(255, 255, 255, 0.7);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                
                /* 按鈕樣式 */
                .bv-button {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    letter-spacing: -0.01em;
                }
                
                .bv-button-primary {
                    background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
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
                
                .bv-button-secondary {
                    background: rgba(0, 0, 0, 0.04);
                    color: rgba(0, 0, 0, 0.7);
                    border: 1px solid rgba(0, 0, 0, 0.08);
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
                    border: 2px solid rgba(0, 0, 0, 0.08);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-align: center;
                }
                
                .bv-format-card:hover {
                    background: rgba(248, 250, 252, 1);
                    border-color: rgba(81, 138, 255, 0.3);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                }
                
                .bv-format-card.selected {
                    background: rgba(81, 138, 255, 0.08);
                    border-color: #518aff;
                    box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
                }
                
                .bv-format-card-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.8;
                }
                
                .bv-format-card-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #000;
                    margin-bottom: 8px;
                }
                
                .bv-format-card-desc {
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.5);
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
                    border: 2px solid rgba(0, 0, 0, 0.08);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                
                .bv-mode-option:hover {
                    background: rgba(248, 250, 252, 1);
                    border-color: rgba(81, 138, 255, 0.3);
                    transform: translateX(4px);
                }
                
                .bv-mode-option.selected {
                    background: rgba(81, 138, 255, 0.08);
                    border-color: #518aff;
                    box-shadow: 0 0 0 3px rgba(81, 138, 255, 0.1);
                }
                
                .bv-mode-option-icon {
                    font-size: 32px;
                    flex-shrink: 0;
                }
                
                .bv-mode-option-content {
                    flex: 1;
                }
                
                .bv-mode-option-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #000;
                    margin-bottom: 4px;
                }
                
                .bv-mode-option-desc {
                    font-size: 14px;
                    color: rgba(0, 0, 0, 0.5);
                }
                
                /* 設定表單 */
                .bv-settings-section {
                    background: rgba(248, 250, 252, 0.5);
                    border: 1px solid rgba(0, 0, 0, 0.06);
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 20px;
                }
                
                .bv-settings-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #000;
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
                    color: #000;
                }
                
                .bv-setting-desc {
                    font-size: 12px;
                    color: rgba(0, 0, 0, 0.5);
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
                
                .bv-switch input:checked + .bv-switch-slider {
                    background: linear-gradient(135deg, #518aff 0%, #0040ff 100%);
                }
                
                .bv-switch input:checked + .bv-switch-slider:before {
                    transform: translateX(20px);
                }
                
                /* 滑桿樣式 */
                .bv-slider-container {
                    display: flex;
                    align-items: center;
                    gap: 16px;
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
                    color: #518aff;
                    background: rgba(81, 138, 255, 0.08);
                    padding: 4px 8px;
                    border-radius: 6px;
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
                    border-top-color: #518aff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
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
                
                /* 響應式設計 */
                @media (max-width: 768px) {
                    .bv-wizard-panel {
                        width: 100%;
                        max-width: 100%;
                        height: 100%;
                        max-height: 100%;
                        border-radius: 0;
                    }
                    
                    .bv-wizard-content {
                        padding: 20px;
                    }
                    
                    .bv-wizard-footer {
                        padding: 16px 20px;
                    }
                    
                    .bv-format-cards {
                        grid-template-columns: 1fr;
                    }
                }
            `;
        }
    },
    
    // ========== UI 元件 ==========
    Components: {
        // 創建主容器
        createContainer() {
            const container = BVWizard.Utils.DOM.createElement('div', {
                id: 'bv-wizard-container',
                className: 'bv-wizard-container'
            });
            
            // 點擊背景關閉
            container.addEventListener('click', (e) => {
                if (e.target === container) {
                    BVWizard.Events.emit('wizard:close');
                }
            });
            
            return container;
        },
        
        // 創建 Wizard 面板
        createPanel() {
            return BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-wizard-panel'
            });
        },
        
        // 創建頭部
        createHeader(title, subtitle) {
            const header = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-wizard-header'
            });
            
            // 標題區
            const titleContainer = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-wizard-title'
            }, [
                BVWizard.Utils.DOM.createElement('div', {
                    className: 'bv-icon',
                    innerHTML: '<span class="material-icons">label</span>'
                }),
                title || 'BV SHOP 出貨助手'
            ]);
            
            const subtitleEl = BVWizard.Utils.DOM.createElement('p', {
                className: 'bv-wizard-subtitle',
                textContent: subtitle || '標籤列印精靈'
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
            const indicator = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-step-indicator',
                id: 'bv-step-indicator'
            });
            
            const steps = Object.values(BVWizard.Config.WIZARD_STEPS)
                .filter(step => !step.condition || step.condition(BVWizard.State.get()))
                .sort((a, b) => a.order - b.order);
            
            steps.forEach((step, index) => {
                // 步驟點
                const dot = BVWizard.Utils.DOM.createElement('div', {
                    className: 'bv-step-dot',
                    'data-step': step.id,
                    title: step.title
                });
                
                indicator.appendChild(dot);
                
                // 連接線（最後一個不需要）
                if (index < steps.length - 1) {
                    const line = BVWizard.Utils.DOM.createElement('div', {
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
            return BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-wizard-content',
                id: 'bv-wizard-content'
            });
        },
        
        // 創建底部
        createFooter() {
            const footer = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-wizard-footer'
            });
            
            // 左側按鈕組
            const leftButtons = BVWizard.Utils.DOM.createElement('div', {
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
            const rightButtons = BVWizard.Utils.DOM.createElement('div', {
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
            return BVWizard.Utils.DOM.createElement('button', {
                ...attributes,
                textContent: text
            });
        },
        
        // 創建開關
        createSwitch(checked = false) {
            const label = BVWizard.Utils.DOM.createElement('label', {
                className: 'bv-switch'
            });
            
            const input = BVWizard.Utils.DOM.createElement('input', {
                type: 'checkbox',
                checked: checked
            });
            
            const slider = BVWizard.Utils.DOM.createElement('span', {
                className: 'bv-switch-slider'
            });
            
            label.appendChild(input);
            label.appendChild(slider);
            
            return label;
        },
        
        // 創建滑桿
        createSlider(options = {}) {
            const container = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-slider-container'
            });
            
            const slider = BVWizard.Utils.DOM.createElement('input', {
                type: 'range',
                className: 'bv-slider',
                min: options.min || 0,
                max: options.max || 100,
                value: options.value || 50,
                step: options.step || 1
            });
            
            const value = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-slider-value',
                textContent: options.value || 50
            });
            
            // 更新顯示值
            slider.addEventListener('input', (e) => {
                value.textContent = e.target.value;
                // 更新滑桿填充
                const percent = (e.target.value - e.target.min) / (e.target.max - e.target.min) * 100;
                e.target.style.background = `linear-gradient(to right, #518aff ${percent}%, rgba(0,0,0,0.06) ${percent}%)`;
            });
            
            // 初始化滑桿填充
            const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
            slider.style.background = `linear-gradient(to right, #518aff ${percent}%, rgba(0,0,0,0.06) ${percent}%)`;
            
            container.appendChild(slider);
            container.appendChild(value);
            
            return container;
        },
        
        // 顯示通知
        showNotification(message, type = 'success') {
            // 移除現有通知
            const existing = document.querySelector('.bv-notification');
            if (existing) existing.remove();
            
            const icons = {
                success: 'check_circle',
                warning: 'warning',
                error: 'error'
            };
            
            const notification = BVWizard.Utils.DOM.createElement('div', {
                className: `bv-notification ${type}`
            }, [
                BVWizard.Utils.DOM.createElement('span', {
                    className: 'material-icons',
                    textContent: icons[type] || 'info'
                }),
                BVWizard.Utils.DOM.createElement('span', {
                    textContent: message
                })
            ]);
            
            document.body.appendChild(notification);
            
            // 自動移除
            setTimeout(() => {
                notification.style.animation = 'slideUp 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        },
        
        // 創建載入畫面
        createLoading(message = '載入中...') {
            return BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-loading'
            }, [
                BVWizard.Utils.DOM.createElement('div', {
                    className: 'bv-loading-spinner'
                }),
                BVWizard.Utils.DOM.createElement('div', {
                    textContent: message,
                    style: { color: 'rgba(0,0,0,0.5)' }
                })
            ]);
        }
    },
    
    // ========== UI 初始化 ==========
    init() {
        // 注入樣式
        BVWizard.Utils.DOM.addStyles(this.Styles.getStyles());
        
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
        
        console.log('✅ UI 系統初始化完成');
    },
    
    // ========== 事件綁定 ==========
    bindBaseEvents() {
        // 取消按鈕
        const cancelBtn = document.getElementById('bv-btn-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                BVWizard.Events.emit('wizard:close');
            });
        }
        
        // 上一步按鈕
        const prevBtn = document.getElementById('bv-btn-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                BVWizard.Events.emit('wizard:prev');
            });
        }
        
        // 下一步按鈕
        const nextBtn = document.getElementById('bv-btn-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                BVWizard.Events.emit('wizard:next');
            });
        }
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && BVWizard.State.get('isWizardOpen')) {
                BVWizard.Events.emit('wizard:close');
            }
        });
    },
    
    // ========== UI 控制方法 ==========
    show() {
        const container = document.getElementById('bv-wizard-container');
        if (container) {
            container.style.display = 'flex';
            BVWizard.State.set('isWizardOpen', true);
        }
    },
    
    hide() {
        const container = document.getElementById('bv-wizard-container');
        if (container) {
            container.style.display = 'none';
            BVWizard.State.set('isWizardOpen', false);
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
            nextBtn.textContent = config.nextText || '下一步';
            nextBtn.disabled = config.nextDisabled || false;
            
            // 如果是最後一步，改變樣式
            if (config.isLastStep) {
                nextBtn.innerHTML = '<span class="material-icons">print</span> 列印';
            }
        }
        
        if (cancelBtn) {
            cancelBtn.style.display = config.showCancel !== false ? '' : 'none';
        }
    }
};

// 測試 UI 初始化
console.log('📦 UI 系統載入完成');
