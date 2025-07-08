const fileInput = document.getElementById('fileInput');
const fileSelectionArea = document.getElementById('fileSelectionArea');
const gachaTypeSelect = document.getElementById('gachaTypeSelect');
const searchButton = document.getElementById('searchButton');
const resultContainer = document.getElementById('resultContainer');
const importFileInput = document.getElementById('importFileInput');
const importButton = document.getElementById('importButton');
const exportButton = document.getElementById('exportButton');
const fileErrorContainer = document.getElementById('fileErrorContainer');
const searchErrorContainer = document.getElementById('searchErrorContainer');
const statsContainer = document.getElementById('statsContainer');

let currentAuthkey = null;
let fullGachaList = [];
let authkeyLoadedFromStorage = false;
const HISTORY_STORAGE_KEY = 'hkrpg-gacha-history-all';

document.addEventListener('DOMContentLoaded', initializeApp);
fileInput.addEventListener('change', handleFileSelect);
searchButton.addEventListener('click', executeSearch);
importFileInput.addEventListener('change', processImportFile);
importButton.addEventListener('click', () => importFileInput.click());
exportButton.addEventListener('click', handleExport);
gachaTypeSelect.addEventListener('change', handleGachaTypeChange);

function initializeApp() {
    const savedAuthkey = localStorage.getItem('hkrpg-gacha-authkey');
    if (savedAuthkey) {
        authkeyLoadedFromStorage = true;
        currentAuthkey = savedAuthkey;
        const statusMessage = `<p class="status-text">✅ 保存されたAuthKeyを読み込みました。「検索開始」ボタンを押してください。</p>`;
        fileSelectionArea.insertAdjacentHTML('afterbegin', statusMessage);
        searchButton.disabled = false;
    }
    handleGachaTypeChange();
}

function handleGachaTypeChange() {
    const allHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '{}');
    const gachaType = gachaTypeSelect.value;
    const cachedList = allHistory[gachaType] || [];
    statsContainer.textContent = '';
    resultContainer.innerHTML = '<p>ここに検索結果が表示されます。</p>';
    exportButton.disabled = Object.keys(allHistory).length === 0;
    fullGachaList = [];

    if (cachedList.length > 0) {
        fullGachaList = calculatePityCounts(cachedList);
        calculateAndDisplayStats();
        displayResults();
    }
}


function handleFileSelect(event) {
    fileSelectionArea.querySelector('.status-text')?.remove();
    fileErrorContainer.textContent = '';
    
    const file = event.target.files[0];
    resetState(false);
    if (!file) return;

    if (!file.name.startsWith('data_2') || file.name.includes('.')) {
        fileErrorContainer.textContent = 'エラー: data_2ファイルを選択してください。';
        fileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const matches = Array.from(content.matchAll(/authkey=([^&]+)/g));

        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            currentAuthkey = lastMatch[1];
            localStorage.setItem('hkrpg-gacha-authkey', currentAuthkey);
            authkeyLoadedFromStorage = false;
            searchButton.disabled = false;
            resultContainer.innerHTML = '<p>AuthKeyの抽出に成功しました。「検索開始」ボタンを押してください。</p>';
        } else {
            fileErrorContainer.textContent = 'ファイルからauthkeyが見つかりませんでした。';
        }
    };
    reader.onerror = () => {
        fileErrorContainer.textContent = 'ファイルの読み込みに失敗しました。';
    };
    reader.readAsText(file);
}

async function executeSearch() {
    if (!currentAuthkey) {
        searchErrorContainer.textContent = 'AuthKeyがありません。ファイルを先に選択してください。';
        return;
    }
    
    searchButton.disabled = true;
    searchErrorContainer.textContent = '';

    const gachaType = gachaTypeSelect.value;
    const allHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '{}');
    const cachedList = allHistory[gachaType] || [];
    const latestKnownId = (cachedList.length > 0) ? cachedList[0].id : null;
    
    let newlyFetchedList = [];
    let lastId = '';
    let pageCounter = 1;
    let hasMoreData = true;
    let reachedKnownData = false;

    const baseApiUrl = `https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?authkey_ver=1&sign_type=2&auth_appid=webview_gacha&win_mode=fullscreen&gacha_id=0bc5c644daf16850590c69cbf6b12e760add4e51&timestamp=${Date.now()}&region=prod_official_asia&default_gacha_type=${gachaType}&lang=ja&plat_type=pc&game_biz=hkrpg_global&page=1&size=20&gacha_type=${gachaType}`;

    while(hasMoreData && !reachedKnownData) {
        resultContainer.innerHTML = `<p>データを取得中です... (${pageCounter}ページ目、新規${newlyFetchedList.length}件取得済み)</p>`;
        
        let fetchUrl = `${baseApiUrl}&authkey=${currentAuthkey}`;
        if (lastId) {
            fetchUrl += `&end_id=${lastId}`;
        }
        
        try {
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.retcode !== 0) {
                handleApiError(data);
                hasMoreData = false;
                continue;
            }

            const pageData = data.data?.list || [];

            if (pageData.length > 0) {
                for (const item of pageData) {
                    if (item.id === latestKnownId) {
                        reachedKnownData = true;
                        break;
                    }
                    newlyFetchedList.push(item);
                }

                if (reachedKnownData) break;

                lastId = pageData[pageData.length - 1].id;
                pageCounter++;
                await new Promise(resolve => setTimeout(resolve, 300));
            } else {
                hasMoreData = false;
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            searchErrorContainer.textContent = '通信エラーが発生しました。再試行してください。';
            hasMoreData = false;
        }
    }

    const combinedList = [...newlyFetchedList, ...cachedList];
    
    if (combinedList.length > 0) {
        fullGachaList = calculatePityCounts(combinedList);
        allHistory[gachaType] = fullGachaList;
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(allHistory));
        exportButton.disabled = false;
    }

    searchButton.disabled = false;
    
    if (searchErrorContainer.textContent === '') {
        if (newlyFetchedList.length === 0 && cachedList.length > 0) {
            searchErrorContainer.textContent = '更新内容はありませんでした。';
        } else {
            resultContainer.innerHTML = '';
        }
    }

    if (fullGachaList.length > 0) {
        calculateAndDisplayStats();
        displayResults();
    } else {
        if (searchErrorContainer.textContent === '' && fileErrorContainer.textContent === '') {
           resultContainer.innerHTML = `<p>有効なガチャデータが見つかりませんでした。</p>`;
        }
    }
}

function calculatePityCounts(list) {
    let pity5 = 0;
    let pity4 = 0;
    const listWithPity = [];
    const totalPulls = list.length;

    for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        pity5++;
        pity4++;
        
        const globalIndex = totalPulls - i;
        const newItem = { ...item, pity4: '', pity5: '', global_index: globalIndex };

        if (item.rank_type === '5') {
            newItem.pity5 = pity5;
            pity5 = 0;
            pity4 = 0;
        } else if (item.rank_type === '4') {
            newItem.pity4 = pity4;
            pity4 = 0;
        }
        listWithPity.push(newItem);
    }
    return listWithPity.reverse();
}

function calculateAndDisplayStats() {
    statsContainer.textContent = '';
    if (fullGachaList.length === 0) return;

    const star5Pulls = fullGachaList.filter(item => item.rank_type === '5');

    if (star5Pulls.length > 0) {
        const totalPity = star5Pulls.reduce((sum, item) => sum + item.pity5, 0);
        const averagePity = totalPity / star5Pulls.length;
        statsContainer.textContent = `[平均☆5出現]: ${averagePity.toFixed(2)}連`;
    }
}

function displayResults() {
    const gachaTypeText = gachaTypeSelect.options[gachaTypeSelect.selectedIndex].text;

    resultContainer.innerHTML = `
        <div class="result-header">
            <span><strong>跳躍種別:</strong> ${gachaTypeText}</span>
        </div>
        <div class="filter-container">
            <div>
                <label for="typeFilter">タイプ:</label>
                <select id="typeFilter">
                    <option value="all">全部</option>
                    <option value="キャラクター">キャラクター</option>
                    <option value="光円錐">光円錐</option>
                </select>
            </div>
            <div>
                <label for="rarityFilter">レアリティ:</label>
                <select id="rarityFilter">
                    <option value="all">全部</option>
                    <option value="5">☆5</option>
                    <option value="4">☆4</option>
                    <option value="3">☆3</option>
                </select>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>跳躍数</th>
                    <th>天井</th>
                    <th>タイプ</th>
                    <th>レアリティ</th>
                    <th>名前</th>
                    <th>時刻</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
    
    document.getElementById('typeFilter').addEventListener('change', handleFilterChange);
    document.getElementById('rarityFilter').addEventListener('change', handleFilterChange);
    
    updateTable(fullGachaList);
}

function processImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedHistory = JSON.parse(e.target.result);
            if (typeof importedHistory !== 'object' || Array.isArray(importedHistory)) {
                throw new Error('インポートされたデータ形式が正しくありません。');
            }

            const existingHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '{}');
            let totalNewItems = 0;

            for (const gachaType in importedHistory) {
                if (Object.hasOwnProperty.call(importedHistory, gachaType)) {
                    const importedItems = importedHistory[gachaType];
                    const existingItems = existingHistory[gachaType] || [];
                    const existingIds = new Set(existingItems.map(item => item.id));

                    const newItems = importedItems.filter(item => item.id && !existingIds.has(item.id));
                    
                    if (newItems.length > 0) {
                        totalNewItems += newItems.length;
                        existingHistory[gachaType] = [...existingItems, ...newItems].sort((a, b) => b.id.localeCompare(a.id));
                    }
                }
            }

            if (totalNewItems === 0) {
                alert('新規データはありませんでした。');
                return;
            }

            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(existingHistory));
            exportButton.disabled = false;
            
            alert(`インポートが完了しました。合計${totalNewItems}件の新規データを追加しました。`);
            handleGachaTypeChange();

        } catch (error) {
            console.error('Import Error:', error);
            alert('ファイルの読み込みまたは解析に失敗しました。有効なJSONファイルではありません。');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function handleExport() {
    const dataToExport = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!dataToExport || dataToExport === '{}') {
        alert('エクスポートするデータがありません。');
        return;
    }

    const blob = new Blob([dataToExport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    a.download = `hkrpg-gacha-history-all-${formattedDate}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleApiError(data) {
    if (data.retcode === -101 && authkeyLoadedFromStorage) {
        localStorage.removeItem('hkrpg-gacha-authkey');
        const oldStatus = fileSelectionArea.querySelector('.status-text');
        if (oldStatus) oldStatus.remove();
        const timeoutMessage = `<p class="status-text" style="color:red; border-color:red;">❗️ 保存されたAuthKeyがタイムアウトした可能性があります。お手数ですが、手順1からやり直してください。</p>`;
        fileSelectionArea.insertAdjacentHTML('afterbegin', timeoutMessage);
        
        searchErrorContainer.textContent = 'AuthKeyの有効期限が切れています。';
        searchButton.disabled = true;
        authkeyLoadedFromStorage = false;
    } else {
        searchErrorContainer.textContent = `エラー: ${data.message} (retcode: ${data.retcode})`;
    }
}

function handleFilterChange() {
    const typeFilter = document.getElementById('typeFilter').value;
    const rarityFilter = document.getElementById('rarityFilter').value;
    
    let filteredList = fullGachaList;

    if (typeFilter !== 'all') {
        filteredList = filteredList.filter(item => item.item_type === typeFilter);
    }
    if (rarityFilter !== 'all') {
        filteredList = filteredList.filter(item => item.rank_type == rarityFilter);
    }
    
    updateTable(filteredList);
}

function updateTable(list) {
    const tbody = resultContainer.querySelector("table tbody");
    if (!tbody) return;

    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">該当するデータがありません。</td></tr>`;
        return;
    }

    list.forEach((item, index) => {
        const rankClass = `rank-${item.rank_type}`;
        const nameStyle = ['3', '4', '5'].includes(item.rank_type) ? `class="${rankClass}"` : '';
        const typeDisplay = item.item_type === 'キャラクター' ? `<strong>${item.item_type}</strong>` : item.item_type;
        const rarityDisplay = `☆${item.rank_type}`;
        
        let pityDisplay = '';
        if (item.pity5) {
            pityDisplay = `<strong class="rank-5">${item.pity5}</strong>`;
        } else if (item.pity4) {
            pityDisplay = `<strong class="rank-4">${item.pity4}</strong>`;
        }

        const row = `
            <tr>
                <td>${item.global_index}</td>
                <td>${pityDisplay}</td>
                <td>${typeDisplay}</td>
                <td class="${rankClass}">${rarityDisplay}</td>
                <td ${nameStyle}>${item.name}</td>
                <td>${item.time}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}


function resetState(clearUI = true) {
    searchButton.disabled = true;
    exportButton.disabled = true;
    currentAuthkey = null;
    fullGachaList = [];
    statsContainer.textContent = '';
    fileErrorContainer.textContent = '';
    searchErrorContainer.textContent = '';
    if(clearUI) {
        resultContainer.innerHTML = '<p>ここに検索結果が表示されます。</p>';
    }
}