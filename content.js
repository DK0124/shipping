// ========================================
// UI 測試與展示
// ========================================

// 添加測試步驟內容
BVWizard.UI.TestSteps = {
    // Step 1: 格式選擇
    renderFormatStep() {
        const container = BVWizard.Utils.DOM.createElement('div');
        
        const title = BVWizard.Utils.DOM.createElement('h2', {
            textContent: '請選擇標籤尺寸',
            style: {
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: '600'
            }
        });
        
        const subtitle = BVWizard.Utils.DOM.createElement('p', {
            textContent: '選擇適合您印表機的標籤格式',
            style: {
                margin: '0 0 32px 0',
                color: 'rgba(0, 0, 0, 0.5)',
                fontSize: '14px'
            }
        });
        
        const cards = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-format-cards'
        });
        
        // 10×15 卡片
        const card1 = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-format-card selected',
            innerHTML: `
                <div class="bv-format-card-icon">📋</div>
                <div class="bv-format-card-title">10×15cm</div>
                <div class="bv-format-card-desc">標準貼紙格式</div>
            `
        });
        
        // 10×10 卡片
        const card2 = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-format-card',
            innerHTML: `
                <div class="bv-format-card-icon">📋</div>
                <div class="bv-format-card-title">10×10cm</div>
                <div class="bv-format-card-desc">正方形貼紙格式</div>
            `
        });
        
        // 點擊事件
        [card1, card2].forEach(card => {
            card.addEventListener('click', function() {
                document.querySelectorAll('.bv-format-card').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
        
        cards.appendChild(card1);
        cards.appendChild(card2);
        
        container.appendChild(title);
        container.appendChild(subtitle);
        container.appendChild(cards);
        
        return container;
    },
    
    // Step 2: 模式選擇
    renderModeStep() {
        const container = BVWizard.Utils.DOM.createElement('div');
        
        const title = BVWizard.Utils.DOM.createElement('h2', {
            textContent: '選擇列印模式',
            style: {
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: '600'
            }
        });
        
        const subtitle = BVWizard.Utils.DOM.createElement('p', {
            textContent: '選擇您要的列印方式',
            style: {
                margin: '0 0 32px 0',
                color: 'rgba(0, 0, 0, 0.5)',
                fontSize: '14px'
            }
        });
        
        const options = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-mode-options'
        });
        
        // 選項 A
        const optionA = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-mode-option',
            innerHTML: `
                <div class="bv-mode-option-icon">📄</div>
                <div class="bv-mode-option-content">
                    <div class="bv-mode-option-title">A. 僅列印出貨明細</div>
                    <div class="bv-mode-option-desc">快速列印訂單資料</div>
                </div>
            `
        });
        
        // 選項 B
        const optionB = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-mode-option',
            innerHTML: `
                <div class="bv-mode-option-icon">📄📦</div>
                <div class="bv-mode-option-content">
                    <div class="bv-mode-option-title">B. 明細 + 物流單</div>
                    <div class="bv-mode-option-desc">整合列印訂單與物流單</div>
                </div>
            `
        });
        
        // 點擊事件
        [optionA, optionB].forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.bv-mode-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
        
        options.appendChild(optionA);
        options.appendChild(optionB);
        
        container.appendChild(title);
        container.appendChild(subtitle);
        container.appendChild(options);
        
        return container;
    },
    
    // Step 3: 明細設定
    renderDetailSettingsStep() {
        const container = BVWizard.Utils.DOM.createElement('div');
        
        const title = BVWizard.Utils.DOM.createElement('h2', {
            textContent: '明細設定',
            style: {
                margin: '0 0 24px 0',
                fontSize: '20px',
                fontWeight: '600'
            }
        });
        
        // 文字設定區塊
        const textSection = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-settings-section',
            innerHTML: `
                <h3 class="bv-settings-title">
                    <span class="material-icons" style="font-size: 20px;">text_fields</span>
                    文字設定
                </h3>
            `
        });
        
        const fontSizeItem = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-setting-item'
        });
        
        const fontSizeLabel = BVWizard.Utils.DOM.createElement('div', {
            innerHTML: `
                <div class="bv-setting-label">字體大小</div>
                <div class="bv-setting-desc">調整標籤文字大小</div>
            `
        });
        
        const fontSizeSlider = BVWizard.UI.Components.createSlider({
            min: 11,
            max: 13,
            value: 11.5,
            step: 0.1
        });
        
        fontSizeItem.appendChild(fontSizeLabel);
        fontSizeItem.appendChild(fontSizeSlider);
        textSection.appendChild(fontSizeItem);
        
        // 顯示選項區塊
        const displaySection = BVWizard.Utils.DOM.createElement('div', {
            className: 'bv-settings-section',
            innerHTML: `
                <h3 class="bv-settings-title">
                    <span class="material-icons" style="font-size: 20px;">visibility</span>
                    顯示選項
                </h3>
            `
        });
        
        // 設定項目
        const settings = [
            { label: '數量標示', desc: '≥2 顯示▲', checked: true },
            { label: '精簡模式', desc: '僅顯示必要資訊', checked: true },
            { label: '隱藏表格標題', desc: '隱藏商品列表標題', checked: false },
            { label: '顯示商品圖片', desc: '在標籤上顯示商品圖', checked: true }
        ];
        
        settings.forEach(setting => {
            const item = BVWizard.Utils.DOM.createElement('div', {
                className: 'bv-setting-item'
            });
            
            const label = BVWizard.Utils.DOM.createElement('div', {
                innerHTML: `
                    <div class="bv-setting-label">${setting.label}</div>
                    <div class="bv-setting-desc">${setting.desc}</div>
                `
            });
            
            const toggle = BVWizard.UI.Components.createSwitch(setting.checked);
            
            item.appendChild(label);
            item.appendChild(toggle);
            displaySection.appendChild(item);
        });
        
        container.appendChild(title);
        container.appendChild(textSection);
        container.appendChild(displaySection);
        
        return container;
    }
};

// 測試函數：顯示 Wizard
BVWizard.UI.showDemo = function(stepName = 'format') {
    // 初始化 UI（如果還沒初始化）
    if (!document.getElementById('bv-wizard-container')) {
        this.init();
    }
    
    // 根據步驟名稱渲染內容
    let content;
    switch(stepName) {
        case 'format':
            content = this.TestSteps.renderFormatStep();
            BVWizard.State.set('currentStep', 'format');
            this.updateButtons({
                showPrev: false,
                nextText: '下一步'
            });
            break;
            
        case 'mode':
            content = this.TestSteps.renderModeStep();
            BVWizard.State.set('currentStep', 'mode');
            this.updateButtons({
                showPrev: true,
                nextText: '下一步'
            });
            break;
            
        case 'settings':
            content = this.TestSteps.renderDetailSettingsStep();
            BVWizard.State.set('currentStep', 'detail_settings');
            this.updateButtons({
                showPrev: true,
                nextText: '下一步'
            });
            break;
    }
    
    // 更新內容和顯示
    this.updateContent(content);
    this.updateStepIndicator(BVWizard.State.get('currentStep'), []);
    this.show();
};

// 創建啟動按鈕（用於測試）
BVWizard.UI.createLaunchButton = function() {
    const button = BVWizard.Utils.DOM.createElement('button', {
        textContent: '開始轉換',
        style: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #518aff 0%, #0040ff 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(81, 138, 255, 0.3)',
            zIndex: '9999'
        }
    });
    
    button.addEventListener('click', () => {
        BVWizard.UI.showDemo('format');
    });
    
    document.body.appendChild(button);
};

// 自動創建啟動按鈕
if (BVWizard.Config.DEBUG) {
    // 等待 DOM 載入完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            BVWizard.UI.createLaunchButton();
        });
    } else {
        BVWizard.UI.createLaunchButton();
    }
    
    console.log('💡 測試模式：點擊右下角「開始轉換」按鈕查看 UI');
    console.log('💡 或在控制台執行：');
    console.log('   BVWizard.UI.showDemo("format")  - 顯示格式選擇');
    console.log('   BVWizard.UI.showDemo("mode")    - 顯示模式選擇');
    console.log('   BVWizard.UI.showDemo("settings") - 顯示明細設定');
}
