// sortAndFilterSelections(rawAbilities, alignedAbilityOptions)をsortAndFilterSelections(rawAbilities, abilityOptions)に戻せば、選択肢の自動整列を無効化できる
document.addEventListener('DOMContentLoaded', () => {
    const sectionA = document.getElementById('section-a');
    const previewModeIndicator = document.getElementById('preview-mode-indicator');
    const exitPreviewButton = document.getElementById('exit-preview-button');
    const editButtonsContainer = document.getElementById('edit-buttons-container');
    const squareWrapper = document.getElementById('square-wrapper');
    const previewSquare = document.getElementById('image-preview-square');
    const roleSelector = document.getElementById('role-selector');
    const allEditorSelectors = document.querySelectorAll('#section-a .dropdown-menu');
    const resetButton = document.getElementById('reset-all-button');
    const sectionB = document.getElementById('section-b');
    const imageSelector = document.getElementById('image-selector');
    const getFromLinkButton = document.getElementById('get-from-link-button');
    const tableRows = document.querySelectorAll('#section-b tbody tr');
    const clearButton = document.getElementById('clear-button');
    const exportButton = document.getElementById('export-button');
    const importButton = document.getElementById('import-button');
    const importFileInput = document.getElementById('import-file-input');
    const abilitySelectors = document.querySelectorAll('.ability-selector');
    const abilityCheckboxes = document.querySelectorAll('.ability-checkbox');
    const crestSelectors = document.querySelectorAll('.crest-selector');
    const characterNameInput = document.getElementById('character-name');
    const tooltip = document.getElementById('tooltip');
    const tooltipName = document.getElementById('tooltip-name');
    const tooltipAbilities = document.getElementById('tooltip-abilities');
    const tooltipCrests = document.getElementById('tooltip-crests');
    const refinedButton = document.getElementById('refined-button');
    
    const STORAGE_KEY = 'gameTeamToolData';
    const roleOrder = ['main', 'sub2', 'sub3', 'sub4'];
    const roleBorderClasses = { main: 'border-main', sub2: 'border-sub2', sub3: 'border-sub3', sub4: 'border-sub4' };
    const defaultOption = '(選択なし)';
    const abilityOptions = [ defaultOption, '同撃', '同命撃', '同撃速', '撃撃', '撃命撃', '撃撃速', '戦撃', '戦命撃', '戦撃速', '友撃', '速殺', '将命', '兵命', '同命', '同速', '同速命', '撃命', '撃速', '撃速命', '戦命', '戦速', '戦速命', 'ケガ減り', 'ハート', '毒がまん', 'ちび癒し', '失神' ];
    const alignedAbilityOptions = [ defaultOption, 'ハート', 'ちび癒し', '毒がまん', '速殺', '失心', '兵命', '将命', 'ケガ減り', '友撃', '戦命', '戦速命', '戦速', '撃命', '撃速命', '撃速', '同命', '同速命', '同速', '戦命撃', '戦撃速', '戦撃', '撃命撃', '撃撃速', '撃撃', '同命撃', '同撃速', '同撃'];
    const crestOptions = [ defaultOption, '対火の心得', '対水の心得', '対木の心得', '対光の心得', '対闇の心得', '対弱の心得', '対将の心得', '対兵の心得', '精神力', 'NP耐性', '火柱耐性', '窮地の活路', 'HWマスター', '鎖縛回避', '収檻回避', '不屈の防御', '不屈の闘力', '不屈の速度', '常冷却', '不屈の必殺', '変身回復', '伝染抵抗', 'ゲージ必中', '守護獣の加勢', '運技の発揮', 'HPマスター' ];
    
    let isPreviewMode = false;
    let draggedElement = null;
    let dragStartSourceCell = null;

    exitPreviewButton.addEventListener('click', resetEditor);
    sectionA.addEventListener('click', () => setActiveSection(sectionA));
    sectionB.addEventListener('click', () => setActiveSection(sectionB));
    imageSelector.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
    getFromLinkButton.addEventListener('click', handleGetFromLink);
    document.addEventListener('paste', handlePaste);
    roleSelector.addEventListener('change', handleRoleChange);
    resetButton.addEventListener('click', () => {
        resetEditor();
        saveStateToLocalStorage();
    });
    abilitySelectors.forEach((selector, index) => {
        selector.addEventListener('change', () => {
            syncDropdowns(abilitySelectors, abilityOptions);
            const checkbox = abilityCheckboxes[index];
            if (selector.value !== defaultOption) {
                checkbox.disabled = false;
            } else {
                checkbox.disabled = true;
                checkbox.checked = false;
            }
        });
    });

    crestSelectors.forEach(s => s.addEventListener('change', () => syncDropdowns(crestSelectors, crestOptions)));
    squareWrapper.addEventListener('dragstart', handleDragStartFromEditor);
    squareWrapper.addEventListener('dragend', handleDragEnd);
    squareWrapper.addEventListener('dragover', handleDragOver);
    squareWrapper.addEventListener('dragleave', handleDragLeave);
    squareWrapper.addEventListener('drop', handleDropOnEditor);
    clearButton.addEventListener('click', handleClearTable);
    exportButton.addEventListener('click', handleExport);
    importButton.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImport);
    document.querySelectorAll('.drop-target').forEach(target => {
        target.addEventListener('dragover', handleDragOver);
        target.addEventListener('dragleave', handleDragLeave);
        target.addEventListener('drop', handleDropOnTarget);
    });
    document.querySelectorAll('.editable-content').forEach(cell => {
        cell.addEventListener('blur', saveStateToLocalStorage); // テキスト編集後も保存
    });
    characterNameInput.addEventListener('blur', saveStateToLocalStorage);
    allEditorSelectors.forEach(s => s.addEventListener('change', saveStateToLocalStorage));
    
    function saveStateToLocalStorage() {
        const rawAbilities = Array.from(abilitySelectors).map(s => s.value);
        abilitySelectors.forEach((selector, index) => {
            rawAbilities.push({
                name: selector.value,
                isEL: abilityCheckboxes[index].checked
            });
        });
        const rawCrests = Array.from(crestSelectors).map(s => s.value);

        const editorData = {
            imageData: previewSquare.style.backgroundImage.slice(5, -2), // url("...")を除去
            name: characterNameInput.value,
            role: roleSelector.value,
            abilities: sortAndFilterSelections(rawAbilities, alignedAbilityOptions),
            crests: sortAndFilterSelections(rawCrests, crestOptions)
        };
        const tableData = [];
        tableRows.forEach(row => {
            const team = [];
            row.querySelector('.drop-target').querySelectorAll('.dropped-square').forEach(sq => {
                team.push(JSON.parse(sq.dataset.characterData));
            });
            const editableContents = row.querySelectorAll('.editable-content');
            tableData.push({
                team,
                loan: editableContents[0].innerHTML,
                notes: editableContents[1].innerHTML
            });
        });
        const fullData = {
            editor: editorData,
            table: tableData
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
    }

    function loadStateFromLocalStorage() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const fullData = JSON.parse(savedData);
                if (fullData.table) {
                    populateTable(fullData.table);
                }
                if (fullData.editor) {
                    populateEditor(fullData.editor);
                }
            } catch (e) {
                console.error("Failed to load data from localStorage", e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }

    function populateTable(data) {
        data.forEach((rowData, index) => {
            const tableRow = tableRows[index];
            if (!tableRow) return;

            const dropTarget = tableRow.querySelector('.drop-target');
            dropTarget.innerHTML = '';
            if (rowData.team) {
                rowData.team.forEach(charData => {
                    dropTarget.appendChild(createMiniSquare(charData));
                });
            }
            sortAndResizeSquares(dropTarget);
            
            const editableContents = tableRow.querySelectorAll('.editable-content');
            editableContents[0].innerHTML = rowData.loan || '';
            editableContents[1].innerHTML = rowData.notes || '';
        });
    }

    function handleExport() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            alert("エクスポートするデータがありません。");
            return;
        }
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game_team_data_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData && typeof importedData.editor === 'object' && Array.isArray(importedData.table)) {
                    populateEditor(importedData.editor);
                    populateTable(importedData.table);
                    
                    saveStateToLocalStorage();
                    alert("データのインポートに成功しました。");
                } else {
                    if (Array.isArray(importedData) && importedData.length > 0 && typeof importedData[0].team !== 'undefined') {
                        resetEditor();
                        populateTable(importedData);
                        saveStateToLocalStorage();
                        alert("（旧形式）データのインポートに成功しました。");
                    } else {
                        throw new Error("Invalid file format");
                    }
                }
            } catch (error) {
                alert("ファイルの読み込みに失敗しました。JSON形式が正しくありません。");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function setEditorLockState(locked) {
        isPreviewMode = locked;
        allEditorSelectors.forEach(s => s.disabled = locked);
        characterNameInput.disabled = locked;
        editButtonsContainer.style.display = locked ? 'none' : 'flex';
        resetButton.style.display = locked ? 'none' : 'block';
        previewModeIndicator.style.display = locked ? 'block' : 'none';
        squareWrapper.draggable = !locked;
    }
    function enterPreviewMode(characterData) {
        populateEditor(characterData);
        setEditorLockState(true);
    }

    function showTooltip(event, data) {
        tooltipName.textContent = data.name || '(名前なし)';
        const abilitiesHtml = data.abilities
            .filter(v => (v.name || v) !== defaultOption)
            .map(v => {
                // 新旧データ形式に対応
                const name = typeof v === 'object' ? v.name : v;
                const isEL = typeof v === 'object' ? v.isEL : false;
                return `<li>${name}${isEL ? ' (EL)' : ''}</li>`;
            }).join('');
        const crestsHtml = data.crests.filter(v => v !== defaultOption)
            .map(v => `<li>${v}</li>`).join('');

        tooltipAbilities.innerHTML = abilitiesHtml ? '<h4>わくわくの実</h4><ul>' + abilitiesHtml + '</ul>' : '';
        tooltipCrests.innerHTML = crestsHtml ? '<h4>魂の紋章</h4><ul>' + crestsHtml + '</ul>' : '';

        let top = event.clientY + 15;
        let left = event.clientX + 15;

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.display = 'block';

        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }

    function hideTooltip() {
        tooltip.style.display = 'none';
    }

    function moveTooltip(event) {
        if (tooltip.style.display === 'none') return;

        let top = event.clientY + 15;
        let left = event.clientX + 15;
        
        const rect = tooltip.getBoundingClientRect();
        if (left + rect.width > window.innerWidth) {
            left = window.innerWidth - rect.width - 10;
        }
        if (top + rect.height > window.innerHeight) {
            top = window.innerHeight - rect.height - 10;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }
    
    function createMiniSquare(data) {
        const miniSquare = document.createElement('div');
        miniSquare.className = 'dropped-square';
        miniSquare.classList.add(roleBorderClasses[data.role]);
        miniSquare.style.backgroundImage = `url(${data.imageData})`;
        miniSquare.draggable = true;
        miniSquare.dataset.characterData = JSON.stringify(data);
        
        miniSquare.addEventListener('dragstart', handleDragStartFromTable);
        miniSquare.addEventListener('dragend', handleDragEnd);
        miniSquare.addEventListener('click', () => {
            if ((previewSquare.style.backgroundImage && previewSquare.style.backgroundImage !== 'none') && !isPreviewMode) {
                return;
            }
            enterPreviewMode(data);
        });

        miniSquare.addEventListener('mouseenter', (event) => {
            showTooltip(event, data);
        });
        miniSquare.addEventListener('mousemove', moveTooltip);
        miniSquare.addEventListener('mouseleave', hideTooltip);

        return miniSquare;
    }

    function convertImageToBase64(source) {
        return new Promise((resolve, reject) => {
            if (source instanceof File || source instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(source);
            }
            else if (typeof source === 'string') {
                fetch(source)
                    .then(response => {
                        if (!response.ok) throw new Error('Network response was not ok.');
                        return response.blob();
                    })
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = (error) => reject(error);
                        reader.readAsDataURL(blob);
                    })
                    .catch(error => reject(error));
            } else {
                reject(new Error("Unsupported source type."));
            }
        });
    }

    async function handleGetFromLink() {
        const url = prompt("画像のURLを入力してください：");
        if (!url) return;
        try {
            const base64 = await convertImageToBase64(url);
            displayImage(base64);
        } catch (error) {
            alert('画像の読み込み・変換に失敗しました。URLが正しいか、CORSポリシーなどを確認してください。');
            console.error(error);
        }
    }

    async function handleImageFile(file) {
        if (!file) return;
        try {
            const base64 = await convertImageToBase64(file);
            displayImage(base64);
        } catch (error) {
            alert('画像の変換に失敗しました。');
            console.error(error);
        }
    }
    function displayImage(base64String) {
        if (!base64String) {
            previewSquare.innerHTML = '';
            return;
        };
        previewSquare.innerHTML = '';
        const img = document.createElement('img');
        img.src = base64String;
        previewSquare.appendChild(img);
    }
    function displayImage(base64String) {
        if (!base64String) {
            previewSquare.style.backgroundImage = '';
            return;
        };
        previewSquare.style.backgroundImage = `url(${base64String})`;
        previewSquare.style.backgroundSize = 'cover';
        previewSquare.style.backgroundRepeat = 'no-repeat';
        previewSquare.style.backgroundPosition = 'center';
        previewSquare.innerHTML = '';
    }
    function handlePaste(event) {
        if (isPreviewMode || !sectionA.classList.contains('active-section')) return;
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.includes('image')) {
                const file = items[i].getAsFile();
                if (file) handleImageFile(file);
                break;
            }
        }
    }
    function handleDragStartFromEditor(event) {
        if (isPreviewMode) { event.preventDefault(); return; }
        const bgImage = previewSquare.style.backgroundImage;
        if (!bgImage || bgImage === 'none') {
            event.preventDefault();
            return;
        }
        const imageData = bgImage.slice(5, -2);

        const rawAbilities = [];
        abilitySelectors.forEach((selector, index) => {
            rawAbilities.push({
                name: selector.value,
                isEL: abilityCheckboxes[index].checked
            });
        });
        const rawCrests = Array.from(crestSelectors).map(s => s.value);

        const characterData = {
            isReturning: false,
            imageData: imageData,
            name: characterNameInput.value,
            role: roleSelector.value,
            abilities: sortAndFilterSelections(rawAbilities, alignedAbilityOptions),
            crests: sortAndFilterSelections(rawCrests, crestOptions)
        };

        event.dataTransfer.setData('application/json', JSON.stringify(characterData));
        draggedElement = event.target;
    }
    function handleDragStartFromTable(event) {
        const characterData = JSON.parse(event.target.dataset.characterData);
        characterData.isReturning = true;
        event.dataTransfer.setData('application/json', JSON.stringify(characterData));
        draggedElement = event.target;
        dragStartSourceCell = event.target.parentElement;
        event.stopPropagation();
    }
    function handleDragEnd() { draggedElement = null; dragStartSourceCell = null; }
    function handleDragOver(event) {
        event.preventDefault();
        const target = event.currentTarget;
        if (target.id === 'square-wrapper') {
            try {
                const data = JSON.parse(event.dataTransfer.getData('application/json'));
                if (data.isReturning && previewSquare.style.backgroundImage && !isPreviewMode) return;
            } catch (e) {}
        }
        target.classList.add('drag-over');
    }
    function handleDragLeave(event) { event.currentTarget.classList.remove('drag-over'); }
    function handleDropOnTarget(event) {
        event.preventDefault();
        const target = event.currentTarget;
        target.classList.remove('drag-over');
        const characterData = JSON.parse(event.dataTransfer.getData('application/json'));
        if (characterData.isReturning && target === dragStartSourceCell) return;
        if (target.children.length >= 4) return;
        
        target.appendChild(createMiniSquare(characterData));
        
        if (characterData.isReturning) {
            draggedElement.remove();
        } else {
            resetEditor();
        }
        
        sortAndResizeSquares(target);
        if (dragStartSourceCell) {
            sortAndResizeSquares(dragStartSourceCell);
        }
        saveStateToLocalStorage();
    }
    function handleDropOnEditor(event) {
        event.preventDefault();
        squareWrapper.classList.remove('drag-over');
        const characterData = JSON.parse(event.dataTransfer.getData('application/json'));
        if (!characterData.isReturning || (previewSquare.style.backgroundImage && !isPreviewMode)) return;
        
        setEditorLockState(false);
        populateEditor(characterData);

        if (draggedElement) {
            const oldCell = draggedElement.parentElement;
            draggedElement.remove();
            sortAndResizeSquares(oldCell);
            saveStateToLocalStorage();
        }
    }
    
    function sortAndResizeSquares(dropTarget) {
        if (!dropTarget || !dropTarget.classList.contains('drop-target')) return;
        const squares = Array.from(dropTarget.children);
        squares.sort((a, b) => {
            const roleA = JSON.parse(a.dataset.characterData).role;
            const roleB = JSON.parse(b.dataset.characterData).role;
            return roleOrder.indexOf(roleA) - roleOrder.indexOf(roleB);
        });
        squares.forEach(square => dropTarget.appendChild(square));
        const count = squares.length;
        if (count === 0) return;
        const cellWidth = dropTarget.clientWidth;
        const cellHeight = dropTarget.clientHeight;
        const gap = 2;
        const totalGap = gap * (Math.max(0, count - 1));
        const padding = 4;
        const border = 3 * 2;
        let size = cellHeight - padding;
        if ((size * count + totalGap) > cellWidth) {
            size = (cellWidth - totalGap - padding) / count;
        }
        squares.forEach(s => {
            s.style.width = `${size - border}px`;
            s.style.height = `${size - border}px`;
        });
    }

    function populateEditor(data) {
        displayImage(data.imageData);
        characterNameInput.value = data.name || '';
        roleSelector.value = data.role;
        handleRoleChange();
        populateDropdowns(abilitySelectors, data.abilities);
        populateDropdowns(crestSelectors, data.crests);
        syncDropdowns(abilitySelectors, abilityOptions);
        syncDropdowns(crestSelectors, crestOptions);
    }
    function resetEditor() {
        setEditorLockState(false);
        previewSquare.style.backgroundImage = '';
        previewSquare.innerHTML = '';
        characterNameInput.value = '';
        roleSelector.value = 'main';
        handleRoleChange();
        initDropdowns(abilitySelectors, abilityOptions);
        initDropdowns(crestSelectors, crestOptions);
        abilityCheckboxes.forEach(cb => {
            cb.checked = false;
            cb.disabled = true;
        });
    }

    function handleClearTable() {
        if (confirm("本当によろしいですか？\n表に配置したキャラクターやメモがすべて削除されます。")) {
            const savedData = localStorage.getItem(STORAGE_KEY);
            let fullData = { editor: {}, table: [] };
            if (savedData) {
                try {
                    fullData = JSON.parse(savedData);
                } catch (e) { /* no-op */ }
            }
            fullData.table = [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
            location.reload();
        }
    }
    
    function handleRoleChange() { previewSquare.className = 'image-preview-square'; previewSquare.classList.add(roleBorderClasses[roleSelector.value]); }
    function setActiveSection(activeSection) { [sectionA, sectionB].forEach(s => s.classList.remove('active-section')); activeSection.classList.add('active-section'); }
    function initDropdowns(selectors, options) {
        selectors.forEach(selector => {
            selector.innerHTML = '';
            options.forEach(opt => selector.add(new Option(opt, opt)));
            selector.value = defaultOption;
        });
        syncDropdowns(selectors, options);
    }
    function populateDropdowns(selectors, values) {
        if (!values) return;
        // わくわくの実
        if (selectors === abilitySelectors) {
            selectors.forEach((selector, index) => {
                const data = values[index];
                if (data) {
                    // 新旧データ形式に対応
                    const abilityName = typeof data === 'object' ? data.name : data;
                    const isEL = typeof data === 'object' ? (data.isEL || false) : false;
                    selector.value = abilityName;
                    abilityCheckboxes[index].checked = isEL;
                    
                    if (abilityName !== defaultOption) {
                        abilityCheckboxes[index].disabled = false;
                    } else {
                        abilityCheckboxes[index].disabled = true;
                    }
                } else {
                    selector.value = defaultOption;
                    abilityCheckboxes[index].checked = false;
                    abilityCheckboxes[index].disabled = true;
                }
            });
        } 
        // 魂の紋章
        else if (selectors === crestSelectors) {
            selectors.forEach((selector, index) => {
                selector.value = values[index] || defaultOption;
            });
        }
    }
    function syncDropdowns(selectors, options) {
        const selectedValues = Array.from(selectors).map(s => s.value).filter(v => v !== defaultOption && v !== '失神');;
        selectors.forEach(currentSelector => {
            const currentValue = currentSelector.value;
            currentSelector.innerHTML = '';
            options.forEach(option => {
                if (option === defaultOption || option === currentValue || !selectedValues.includes(option)) {
                    currentSelector.add(new Option(option, option));
                }
            });
            currentSelector.value = currentValue;
        });
    }
    function sortAndFilterSelections(selections, masterList) {
        const filtered = selections.filter(s => (s.name || s) !== defaultOption);
        filtered.sort((a, b) => {
            const nameA = a.name || a;
            const nameB = b.name || b;
            return masterList.indexOf(nameA) - masterList.indexOf(nameB);
        });
        return filtered;
    }

    refinedButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const text = await file.text();
            const refinedText = text.replace(/\./g, "");
            const baseName = file.name.replace(/\.json$/i, "");
            const newFileName = `${baseName}_refined.json`;
            const blob = new Blob([refinedText], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = newFileName;
            a.click();
            URL.revokeObjectURL(url);
            alert("旧ファイルを修正しました。\nダウンロードしたファイルをインポートしてください。");
        };
        input.click();
    });


    function initialize() {
        resetEditor();
        loadStateFromLocalStorage();
    }
    
    initialize();
});
