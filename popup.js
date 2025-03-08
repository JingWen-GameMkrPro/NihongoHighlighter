document.addEventListener("DOMContentLoaded", () => {
  // 取得必要的 DOM 元素
  const uploadFileBtn = document.getElementById("uploadFileBtn"),
    startModeBtn = document.getElementById("startModeBtn"),
    stopModeBtn = document.getElementById("stopModeBtn"),
    deleteStorageBtn = document.getElementById("deleteStorageBtn"),
    currentModeP = document.getElementById("currentMode"),
    currentDataSourceP = document.getElementById("currentDataSource"),
    dataSourceSelect = document.getElementById("dataSourceSelect"),
    gistInputArea = document.getElementById("gistInputArea"),
    gistUrlInput = document.getElementById("gistUrl"),
    updateGistBtn = document.getElementById("updateGistBtn"),
    keyCountElement = document.getElementById("keyCount");

  // 初始化預設資料來源為 Gist，並設定預設 Gist 網址
  const defaultGistUrl = "https://gist.github.com/JingWen-GameMkrPro/59306ed6b3f7e9a2847712b45e554390";
  gistUrlInput.value = defaultGistUrl;
  chrome.storage.local.set({ dataSource: "gist" });
  dataSourceSelect.value = "gist";
  updateDataSourceDisplay("gist");

  let highlighterTimer = null;
  // TIMER_INTERVAL 保留給本地模式或其他更新需求
  const TIMER_INTERVAL = 10000;

  // 深度比較函式（簡單實作）
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== "object" || a === null || typeof b !== "object" || b === null)
      return false;
    const keysA = Object.keys(a), keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  // 更新目前模式顯示
  function updateModeDisplay(mode) {
    currentModeP.textContent =
      "目前模式：" + (mode === "highlighter" ? "高亮模式" : "停止模式");
  }

  // 更新資料來源模式顯示
  function updateDataSourceDisplay(mode) {
    if (mode === "gist") {
      gistInputArea.style.display = "block";
      currentDataSourceP.textContent = "資料來源模式：Gist檔案模式";
    } else if (mode === "local") {
      gistInputArea.style.display = "none";
      currentDataSourceP.textContent = "資料來源模式：本地檔案模式";
    } else {
      currentDataSourceP.textContent = "資料來源模式：無";
    }
  }

  // 更新顯示 chrome.storage 中 JSON 檔案的 key 總數
  function updateKeyCount() {
    chrome.storage.local.get("jsonData", (result) => {
      let keys = [];
      if (result.jsonData && typeof result.jsonData === "object") {
        keys = Object.keys(result.jsonData);
      }
      keyCountElement.textContent = keys.length > 0 ? keys.length : "0";
    });
  }

  // 新增：解析 JSON 中的 ${key} 佔位符，並處理字串內的 "\n" 換行
  function substitutePlaceholders(jsonData) {
    // 遍歷所有 key 對應的物件
    Object.keys(jsonData).forEach(mainKey => {
      const obj = jsonData[mainKey];
      // 確保該項目為物件
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(prop => {
          let text = obj[prop];
          if (typeof text === "string") {
            // 處理 ${...} 佔位符替換
            text = text.replace(/\$\{([^}]+)\}/g, (match, refKey) => {
              // 若參照的 key 存在且為物件，則取同名屬性的值
              if (jsonData.hasOwnProperty(refKey)) {
                const refObj = jsonData[refKey];
                if (typeof refObj === "object" && refObj !== null && refObj.hasOwnProperty(prop)) {
                  return refObj[prop];
                }
              }
              // 找不到則保持原樣
              return match;
            });
            // 若字串內包含 "\n"（反斜線 n），則替換成真正換行符號
            text = text.replace(/\\n/g, "\n");
            obj[prop] = text;
          }
        });
      }
    });
    return jsonData;
  }

  // 透過 GitHub Gist API 取得最新 JSON 內容
  async function fetchGistJson() {
    const gistUrl = gistUrlInput.value.trim();
    if (!gistUrl) {
      alert("請輸入 Gist 的網址！");
      return null;
    }
    const parts = gistUrl.split("/"),
      gistId = parts[4];
    if (!gistId) {
      alert("無法從 Gist 網址中提取 gist id");
      return null;
    }
    const apiUrl = `https://api.github.com/gists/${gistId}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("無法取得 Gist 資料");
      const gistData = await response.json();
      const files = gistData.files,
        fileKeys = Object.keys(files);
      if (!fileKeys.length) throw new Error("該 Gist 中沒有檔案");
      let jsonData = JSON.parse(files[fileKeys[0]].content);
      // 執行佔位符替換與換行符號處理
      jsonData = substitutePlaceholders(jsonData);
      return jsonData;
    } catch (error) {
      alert("取得 Gist 資料失敗：" + error.message);
      return null;
    }
  }

  // 從 chrome.storage 讀取 JSON 並發送高亮訊息給 contentScript
  function sendHighlightMessage() {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) {
        const keyValues = Object.entries(result.jsonData).map(([key, value]) => ({ key, value }));
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" }, () => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "HIGHLIGHT_BATCH", keyValues });
          });
        });
      }
    });
  }

  // 每秒檢查遠端 Gist JSON 是否有更新
  async function checkForGistUpdate() {
    chrome.storage.local.get(["dataSource", "jsonData"], async (result) => {
      const mode = result.dataSource || "gist";
      // 僅針對 Gist 模式進行檢查
      if (mode !== "gist") return;
      const newJsonData = await fetchGistJson();
      if (!newJsonData) {
        console.log("checkForGistUpdate: 取得新資料失敗");
        return;
      }
      // 比較新舊資料（使用 deepEqual）
      if (!deepEqual(newJsonData, result.jsonData)) {
        console.log("checkForGistUpdate: 偵測到更新，開始自動更新資料與高亮");
        chrome.storage.local.set({ jsonData: newJsonData }, () => {
          sendHighlightMessage();
          updateKeyCount();
        });
      } else {
        console.log("checkForGistUpdate: 無更新");
      }
    });
  }

  // 啟動高亮模式：立即更新後再開始定時檢查更新
  function startHighlighterMode() {
    if (highlighterTimer) clearInterval(highlighterTimer);
    updateHighlighter(); // 初次更新（若非 Gist 模式則直接發送高亮）
    // Gist 模式下每秒檢查更新
    highlighterTimer = setInterval(checkForGistUpdate, 1000);
    updateModeDisplay("highlighter");
  }

  // 保留原 updateHighlighter 供本地模式使用（或初次更新）
  async function updateHighlighter() {
    chrome.storage.local.get("dataSource", async (result) => {
      const mode = result.dataSource || "gist";
      if (mode === "gist") {
        const jsonData = await fetchGistJson();
        if (jsonData) {
          chrome.storage.local.set({ jsonData }, () => {
            sendHighlightMessage();
            updateKeyCount();
          });
        } else {
          updateKeyCount();
        }
      } else {
        sendHighlightMessage();
        updateKeyCount();
      }
    });
  }

  // 停止高亮模式：清除定時器並通知 contentScript 清除高亮
  function stopHighlighterMode() {
    if (highlighterTimer) {
      clearInterval(highlighterTimer);
      highlighterTimer = null;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
    });
    updateModeDisplay("stopped");
  }

  // 讀取 Gist JSON 的函式（只讀取，不更新遠端資料）
  async function updateGistData() {
    const jsonData = await fetchGistJson();
    if (jsonData) {
      chrome.storage.local.set({ jsonData, dataSource: "gist" }, () => {
        dataSourceSelect.value = "gist";
        updateDataSourceDisplay("gist");
      });
    } else {
      updateKeyCount();
    }
  }

  // 當下拉選單改變時更新資料來源模式
  dataSourceSelect.addEventListener("change", () => {
    const mode = dataSourceSelect.value;
    chrome.storage.local.set({ dataSource: mode });
    updateDataSourceDisplay(mode);
  });

  // 上傳檔案（本地模式）：讀取 JSON 檔案後更新 chrome.storage 並切換模式
  uploadFileBtn.addEventListener("click", async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: "JSON Files", accept: { "application/json": [".json"] } }],
        multiple: false
      });
      const file = await fileHandle.getFile();
      const content = await file.text();
      let jsonData = JSON.parse(content);
      // 執行佔位符替換與換行符號處理
      jsonData = substitutePlaceholders(jsonData);
      chrome.storage.local.set({ jsonData, dataSource: "local" }, () => {
        dataSourceSelect.value = "local";
        updateDataSourceDisplay("local");
        startHighlighterMode();
      });
    } catch (err) {
      alert("上傳檔案失敗或取消了操作。");
    }
  });

  // Gist 讀取按鈕：按下時呼叫 updateGistData
  updateGistBtn.addEventListener("click", async () => {
    await updateGistData();
  });

  // 開啟高亮模式：若有 JSON 資料則啟動，否則提示先上傳或讀取 Gist
  startModeBtn.addEventListener("click", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) startHighlighterMode();
      else alert("目前沒有儲存的 JSON 資料，請先上傳或讀取 Gist！");
    });
  });

  // 停止高亮模式
  stopModeBtn.addEventListener("click", stopHighlighterMode);

  // 刪除 JSON 資料並切換至停止模式
  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["jsonData", "dataSource"], () => {
      alert("已刪除 JSON 資料");
      stopHighlighterMode();
      updateModeDisplay("stopped");
      currentDataSourceP.textContent = "資料來源模式：無";
      keyCountElement.textContent = "0";
    });
  });

  // 初始設定：依據 chrome.storage 中的資料來源更新畫面
  chrome.storage.local.get("dataSource", (result) => {
    const mode = result.dataSource || "gist";
    updateModeDisplay(mode === "gist" || mode === "local" ? "highlighter" : "stopped");
    updateDataSourceDisplay(mode);
    updateKeyCount();
  });
});
