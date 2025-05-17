//每當筆記有更動時，應該要收到通知，並即時更新
let database = [];
//此變數決定DOM是否要高亮，應該要收到通知，並即時更新
let isHighlightMode = [];
let trie;

// 監聽所有分頁載入完成
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && /^https?:/.test(tab.url)) {
    // 發一個自訂訊息，把 raw database 推給 content
    await init();
    if (isHighlightMode === true) {
      chrome.tabs.sendMessage(tabId, {
        action: "HIGHLIGHT",
        trie,
      });
    }
  }
});

function sendTabMessage() {
  // 通知目前前景分頁
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tabId = tabs[0].id;
    if (isHighlightMode === true) {
      chrome.tabs.sendMessage(tabId, {
        action: "HIGHLIGHT",
        trie,
      });
    } else {
      chrome.tabs.sendMessage(tabId, {
        action: "UNHIGHLIGHT",
      });
    }
  });
}

//被動收到是否HIGHLIGHT事件
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup-background") {
    port.onMessage.addListener(async (msg) => {
      console.log("收到");
      switch (msg.cmd) {
        case "MODE_UPDATE":
          isHighlightMode = await getChromeDataAsync("IsHighlightMode");
          sendTabMessage();
          break;
        case "NOTE_UPDATE":
          database = await getChromeDataAsync("Database");
          trie = await constructTrieByDatabase(database);
          sendTabMessage();
          break;
      }
    });
  }
});

//根據key拿取chorme local 資料
async function getChromeDataAsync(dataType) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([dataType], (res) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(res[dataType]);
      }
    });
  });
}
async function init() {
  isHighlightMode = await getChromeDataAsync("IsHighlightMode");
  database = await getChromeDataAsync("Database");
  trie = await constructTrieByDatabase(database);
}

async function constructTrieByDatabase(database) {
  let trie = new Trie();
  for (const element of database) {
    for (const note of element.notes) {
      trie.insert(note.key, note.infos, element.name);
    }
  }
  return trie;
}

//於剛開chrome時，就會拿取筆記
//chrome.runtime.onStartup.addListener(init);

class TrieNode {
  constructor() {
    this.children = {};
    //infos[] = [infos[], infos[]...]
    this.infos = [];
    this.isEnd = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(key, subInfos, source) {
    let node = this.root;
    for (const char of key) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEnd = true;
    node.infos.push({ source: source, subInfos: subInfos });
  }
}
