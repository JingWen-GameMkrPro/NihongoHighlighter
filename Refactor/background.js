//每當筆記有更動時，應該要收到通知，並即時更新
let notesCache = [];
//此變數決定DOM是否要高亮，應該要收到通知，並即時更新
let isHighlightMode = [];

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

//HACK: 此處硬編碼KEY
async function loadDataFromStorage() {
  const database = await getChromeDataAsync("Database");
  const isHighlightMode = await getChromeDataAsync("IsHighlightMode");
}

//於剛開chrome時，就會拿取筆記
chrome.runtime.onStartup.addListener(loadDataFromStorage);
