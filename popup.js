document.addEventListener("DOMContentLoaded", () => {
  // DOM要素の取得
  const startModeBtn = document.getElementById("startModeBtn"),
        stopModeBtn = document.getElementById("stopModeBtn"),
        deleteStorageBtn = document.getElementById("deleteStorageBtn"),
        currentModeP = document.getElementById("currentMode"),
        currentDataSourceP = document.getElementById("currentDataSource"),
        gistInputArea = document.getElementById("gistInputArea"),
        gistUrlInput = document.getElementById("gistUrl"),
        updateGistBtn = document.getElementById("updateGistBtn"),
        keyCountElement = document.getElementById("keyCount");

  // データソースは常にGist固定
  const defaultGistUrl = "https://gist.github.com/JingWen-GameMkrPro/59306ed6b3f7e9a2847712b45e554390";
  gistUrlInput.value = defaultGistUrl;
  chrome.storage.local.set({ dataSource: "gist" });
  updateDataSourceDisplay("gist");

  let highlighterTimer = null;

  // 深い比較関数（シンプル実装）
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

  // 現在の状態表示を更新
  function updateModeDisplay(mode) {
    currentModeP.textContent = "現在の状態：" + (mode === "highlighter" ? "ハイライト中" : "停止中");
  }

  // データソース表示の更新（常にGist）
  function updateDataSourceDisplay(mode) {
    gistInputArea.style.display = "block";
    currentDataSourceP.textContent = "データソース：Gist";
  }

  // JSONキー数の表示を更新
  function updateKeyCount() {
    chrome.storage.local.get("jsonData", (result) => {
      let keys = [];
      if (result.jsonData && typeof result.jsonData === "object") {
        keys = Object.keys(result.jsonData);
      }
      keyCountElement.textContent = keys.length > 0 ? keys.length : "0";
    });
  }

  // JSON内のプレースホルダおよび改行処理（新フォーマット対応）
  function substitutePlaceholders(jsonData) {
    Object.keys(jsonData).forEach(mainKey => {
      const obj = jsonData[mainKey];
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach(prop => {
          let text = obj[prop];
          if (typeof text === "string") {
            // 既存の${...}形式の置換
            text = text.replace(/\$\{([^}]+)\}/g, (match, refKey) => {
              if (jsonData.hasOwnProperty(refKey)) {
                const refObj = jsonData[refKey];
                if (typeof refObj === "object" && refObj !== null && refObj.hasOwnProperty(prop)) {
                  return refObj[prop];
                }
              }
              return match;
            });
            // 新規：&{...}形式（背景：緑色）→ "ref.：key: [description]"
            text = text.replace(/&\{([^}]+)\}/g, (match, refKey) => {
              if (jsonData.hasOwnProperty(refKey)) {
                const refObj = jsonData[refKey];
                if (refObj && refObj.description) {
                  return `__PLACEHOLDER_GREEN__ref.：${refKey}: ${refObj.description}__ENDPLACEHOLDER__`;
                }
              }
              return match;
            });
            // 新規：~{...}形式（背景：赤色）→ "v.s.：key: [description]"
            text = text.replace(/~\{([^}]+)\}/g, (match, refKey) => {
              if (jsonData.hasOwnProperty(refKey)) {
                const refObj = jsonData[refKey];
                if (refObj && refObj.description) {
                  return `__PLACEHOLDER_RED__v.s.：${refKey}: ${refObj.description}__ENDPLACEHOLDER__`;
                }
              }
              return match;
            });
            // 新規：@{...}形式（背景：青色）、括弧内の内容を直接表示
            text = text.replace(/@\{([^}]+)\}/g, (match, content) => {
              return `__PLACEHOLDER_BLUE__e.g.: ${content}__ENDPLACEHOLDER__`;
            });
            // 改行処理
            text = text.replace(/\\n/g, "\n");
            obj[prop] = text;
          }
        });
      }
    });
    return jsonData;
  }

  // Gistから最新JSONを取得する関数
  async function fetchGistJson() {
    const gistUrl = gistUrlInput.value.trim();
    if (!gistUrl) {
      alert("GistのURLを入力してください！");
      return null;
    }
    const parts = gistUrl.split("/"),
          gistId = parts[4];
    if (!gistId) {
      alert("GistのURLからIDを取得できません");
      return null;
    }
    const apiUrl = `https://api.github.com/gists/${gistId}?t=${Date.now()}`;
    try {
      const response = await fetch(apiUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Gistのデータ取得に失敗しました");
      const gistData = await response.json();
      const files = gistData.files,
            fileKeys = Object.keys(files);
      if (!fileKeys.length) throw new Error("このGistにファイルがありません");
      let jsonData = JSON.parse(files[fileKeys[0]].content);
      jsonData = substitutePlaceholders(jsonData);
      return jsonData;
    } catch (error) {
      alert("Gistのデータ取得に失敗しました：" + error.message);
      return null;
    }
  }

  // JSONをchrome.storageから読み込み、ハイライト用にcontentScriptへ送信
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

  // 1秒ごとにGistの更新をチェック
  async function checkForGistUpdate() {
    chrome.storage.local.get(["dataSource", "jsonData"], async (result) => {
      const mode = result.dataSource || "gist";
      if (mode !== "gist") return;
      const newJsonData = await fetchGistJson();
      if (!newJsonData) {
        console.log("checkForGistUpdate: 新しいデータの取得に失敗");
        return;
      }
      if (!deepEqual(newJsonData, result.jsonData)) {
        console.log("checkForGistUpdate: 更新が検出されました。自動更新します");
        chrome.storage.local.set({ jsonData: newJsonData }, () => {
          sendHighlightMessage();
          updateKeyCount();
        });
      } else {
        console.log("checkForGistUpdate: 更新はありません");
      }
    });
  }

  // ハイライト開始：初回更新後、1秒ごとに更新チェックを開始
  function startHighlighterMode() {
    if (highlighterTimer) clearInterval(highlighterTimer);
    updateHighlighter();
    highlighterTimer = setInterval(checkForGistUpdate, 1000);
    updateModeDisplay("highlighter");
  }

  // 初回更新（Gist用）
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

  // ハイライト停止
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

  // GistからJSONを読み込み（読み取り専用）
  async function updateGistData() {
    const jsonData = await fetchGistJson();
    if (jsonData) {
      chrome.storage.local.set({ jsonData, dataSource: "gist" }, () => {
        updateDataSourceDisplay("gist");
      });
    } else {
      updateKeyCount();
    }
  }

  // Gist読み込みボタンのイベント
  updateGistBtn.addEventListener("click", async () => {
    await updateGistData();
  });

  // ハイライト開始ボタンのイベント
  startModeBtn.addEventListener("click", () => {
    chrome.storage.local.get("jsonData", (result) => {
      if (result.jsonData) startHighlighterMode();
      else alert("JSONデータがありません。先にGistから読み込んでください。");
    });
  });

  // ハイライト停止ボタンのイベント
  stopModeBtn.addEventListener("click", stopHighlighterMode);

  // JSON削除ボタンのイベント
  deleteStorageBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["jsonData", "dataSource"], () => {
      alert("JSONデータを削除しました");
      stopHighlighterMode();
      updateModeDisplay("stopped");
      currentDataSourceP.textContent = "データソース：なし";
      keyCountElement.textContent = "0";
    });
  });

  // 初期設定：データソースは強制的にGistに設定
  chrome.storage.local.set({ dataSource: "gist" }, () => {
    updateModeDisplay("highlighter");
    updateDataSourceDisplay("gist");
    updateKeyCount();
  });
});
