let processTime = 0;
let isNeedRecordTime = 0;
let fetchTime = 0;
let currentDbIndex = 0; // 目前顯示的資料庫索引
let tmp;

document.addEventListener("DOMContentLoaded", () => {
  //TODO: Token 應該要移到item
  //Card: Token
  const checkboxIsSaveToken = document.getElementById("checkbox-isSaveToken");
  const inputNotionToken = document.getElementById("input-notionToken");
  const toggleTokenVisibility = document.getElementById(
    "toggle-tokenVisibility"
  );

  // Card: Control Panel
  const textCurrentMode = document.getElementById("text-currentMode");
  //TODO: Token 應該要移到item
  const inputSplitChar = document.getElementById("input-splitChar");
  const inputHighlightColor = document.getElementById("input-highlightColor");
  const buttonExchangeMode = document.getElementById("button-exchangeMode");

  // Card: Item Title

  const buttonPreDb = document.getElementById("button-preDb");
  const buttonNextDb = document.getElementById("button-nextDb");
  const buttonAddDb = document.getElementById("button-addDb");
  const buttonDeleteDb = document.getElementById("button-deleteDb");
  const buttonInitDb = document.getElementById("button-initDb");

  //DEBUG
  const buttonDebug = document.getElementById("button-debug");
  //DEBUG
  const textIndex = document.getElementById("index");
  //DEBUG
  const textIndexx = document.getElementById("indexx");

  function updateTokenView(newValue) {
    inputNotionToken.value = newValue || "";
  }

  function updateSplitCharView(newValue) {
    inputSplitChar.value = newValue;
  }

  function updateModeTitleView(newValue) {
    if (newValue == true) {
      textCurrentMode.textContent = model.DisplayText.TITLE_MODE_HIGHLIGHT;
    } else {
      textCurrentMode.textContent = model.DisplayText.TITLE_MODE_UNHIGHLIGHT;
    }
  }

  function updateHighlightColor(newValue) {
    inputHighlightColor.value = newValue;
  }

  //DEBUG: 顯示目前index
  function updateTextIndex(newValue) {
    textIndex.textContent = newValue + 1;
  }

  //DEBUG: 顯示目前index
  function updateTextIndexx(newValue) {
    textIndexx.textContent = newValue.length;
  }

  //Subscribe
  viewModelInstance.subscribe(model.DataType.TOKEN, updateTokenView);
  viewModelInstance.subscribe(model.DataType.SPLIT_CHAR, updateSplitCharView);
  viewModelInstance.subscribe(
    model.DataType.IS_HIGHLIGHT_MODE,
    updateModeTitleView
  );
  viewModelInstance.subscribe(
    model.DataType.HIGHLIGHT_COLOR,
    updateHighlightColor
  );
  //DEBUG: 顯示目前index
  viewModelInstance.subscribe(model.DataType.DATABASE_INDEX, updateTextIndex);
  //DEBUG: 顯示目前資料庫大小
  viewModelInstance.subscribe(updateTextIndexx);

  //UserInput
  checkboxIsSaveToken.addEventListener("change", (e) => {
    if (e.target.checked) {
      // 重新訂閱
      viewModelInstance.subscribe(model.DataType.TOKEN, updateTokenView);
      // 設定資料
      viewModelInstance.setData(
        model.DataType.TOKEN,
        inputNotionToken.value.trim()
      );
    } else {
      // 解除訂閱
      viewModelInstance.unsubscribe(model.DataType.TOKEN, updateTokenView);
      // 將資料銷毀
      viewModelInstance.removeData(model.DataType.TOKEN);
    }
    checkboxIsSaveToken.checked = e.target.checked;
  });
  inputNotionToken.addEventListener("change", (e) => {
    //先查看目前是否有bind，決定是否要set data
    if (checkboxIsSaveToken.checked) {
      // 設定資料
      viewModelInstance.setData(model.DataType.TOKEN, e.target.value.trim());
    } else {
      inputNotionToken.value = e.target.value.trim();
    }
  });
  toggleTokenVisibility.addEventListener("click", () => {
    inputNotionToken.type =
      inputNotionToken.type === "password" ? "text" : "password";
    toggleTokenVisibility.textContent = "👁";
  });
  inputSplitChar.addEventListener("change", (e) => {
    viewModelInstance.setData(model.DataType.SPLIT_CHAR, e.target.value);
  });
  inputHighlightColor.addEventListener("change", (e) => {
    viewModelInstance.setData(model.DataType.HIGHLIGHT_COLOR, e.target.value);
  });
  buttonExchangeMode.addEventListener("click", () => {
    viewModelInstance.exchangeMode();
  });
  buttonDebug.addEventListener("click", () => {
    modelInstance.getAllData();
  });
  buttonPreDb.addEventListener("click", () => {
    viewModelInstance.moveBackwardIndex();
  });
  buttonNextDb.addEventListener("click", () => {
    viewModelInstance.moveForwardIndex();
  });
  buttonAddDb.addEventListener("click", () => {
    viewModelInstance.addDatabaseItem();
  });
  buttonDeleteDb.addEventListener("click", () => {
    viewModelInstance.deleteDatabaseItemAtCurrentIndex();
  });
  buttonInitDb.addEventListener("click", () => {
    viewModelInstance.initDatabase();
  });
  selectSourceType.addEventListener("change", () => {
    viewModelInstance.whenViewItemSourceTypeChanged(selectSourceType.value);
  });

  //可以從輸入Database id開始
  //繼續，流程如下：
  //Model新增新的資料
  //ViewModel關注訂閱
  //View: pop.js
  //Initial
  //Subscribe
  //Input

  //初始化所有View
  viewModelInstance.initView({
    token: inputNotionToken,
    isSaveToken: checkboxIsSaveToken,
    splitChar: inputSplitChar,
    highlightColor: inputHighlightColor,
    mode: textCurrentMode,
    debug1: textIndex,
    debug2: textIndexx,
  });

  // INIT
  viewModelInstance.getCurrentIndexItem(({ index, item }) => {
    textDbTitle.textContent =
      model.DisplayText.TITLE_DATABASE_PREFIX + (index + 1);
    selectSourceType.value = item.sourceType;
    //Source Item
    const template = document.getElementById(`sourceItem-${item.sourceType}`);
    containerSourceItem.innerHTML = "";
    const clone = template.content.cloneNode(true);
    containerSourceItem.appendChild(clone);

    switch (item.sourceType) {
      case model.SourceType.NOTION_PAGE_ID:
        const inputPageId = document.getElementById("input-pageId");
        inputPageId.textContent = item.sourceItem.id;
        break;
      case model.SourceType.NOTION_DATABASE_ID:
        const inputDbId = document.getElementById("input-dbId");
        inputDbId.textContent = item.sourceItem.id;
        break;

      case model.SourceType.TEXT_FILE:
        break;
    }
  });

  //有訂閱的會傳key+callback
  //改以狀態模式?
  const sourceItemSubscribeCallback = {};
  function unsubscribeItemElement() {
    //目前託管的callback
    sourceItemSubscribeCallback.array.forEach((element) => {});
  }

  viewModelInstance.subscribe(
    viewModel.EventType.VIEW_ITEM_NEED_CHANGED,
    ({ newItem, newIndex }) => {
      //非Source Item
      textDbTitle.textContent =
        model.DisplayText.TITLE_DATABASE_PREFIX + (newIndex + 1);
      selectSourceType.value = newItem.sourceType;

      //Source Item
      const template = document.getElementById(
        `sourceItem-${newItem.sourceType}`
      );
      containerSourceItem.innerHTML = "";
      const clone = template.content.cloneNode(true);
      containerSourceItem.appendChild(clone);
      switch (newItem.sourceType) {
        case model.SourceType.NOTION_PAGE_ID:
          const inputPageId = document.getElementById("input-pageId");
          inputPageId.textContent = newItem.sourceItem.id;
          break;

        case model.SourceType.NOTION_DATABASE_ID:
          const inputDbId = document.getElementById("input-dbId");
          inputDbId.textContent = newItem.sourceItem.id;
          break;

        case model.SourceType.TEXT_FILE:
          break;
      }
    }
  );

  //根據SourceType，而有不同的ItemState
  class ItemState {
    constructor() {}

    //第一次
    init() {}

    //當資料變化時，sourcetype變化會觸發、更改id會觸發
    //檢查有無更改type，如果沒有，則更新值就好
    //如果有則更改狀態
    updateView() {}

    //當更改sourcetype時會觸發，主要是訂閱
    subscribe({ index, item }) {}

    //當離開狀態時會觸發，主要是解除訂閱
    unsubscribe() {}

    bindUserInput() {}

    unbindUserInput() {}
  }

  // class ItemState extends ItemState {
  //   constructor() {}

  //   init({ index, item }) {
  //     //DOM 取得元素
  //     this.textDbTitle = document.getElementById("text-dbTitle");
  //     this.selectSourceType = document.getElementById("select-sourceType");
  //     this.containerSourceItem = document.getElementById(
  //       "container-sourceItem"
  //     );

  //     //setter
  //     //HACK: 先用INDEX+1代替
  //     this.textDbTitle.textContent =
  //       model.DisplayText.TITLE_DATABASE_PREFIX + (index + 1);
  //     this.selectSourceType.value = item.sourceType;
  //   }

  //   updateView({ index, item }) {
  //     //setter
  //     //HACK: 先用INDEX+1代替
  //     this.textDbTitle.textContent =
  //       model.DisplayText.TITLE_DATABASE_PREFIX + (index + 1);
  //     this.selectSourceType.value = item.sourceType;
  //   }
  // }

  //有什麼元素
  class ItemStateNotionPageID extends ItemState {
    constructor() {
      this.textDbTitle = null;
      this.selectSourceType = null;
      this.containerSourceItem = null;
    }

    //一開始賦予初始值
    init() {
      //取得元素
      this.getElement();

      //賦予初始值
      this.setElementValue();

      //訂閱

      //User Input綁定
    }

    //取得元素
    getElement() {
      this.textDbTitle = document.getElementById("text-dbTitle");
      this.selectSourceType = document.getElementById("select-sourceType");
      this.containerSourceItem = document.getElementById(
        "container-sourceItem"
      );
    }

    //賦予初始值
    setElementValue() {
      viewModelInstance.getCurrentIndexItem(({ index, item }) => {
        //HACK: 先用INDEX+1代替
        this.textDbTitle.textContent =
          model.DisplayText.TITLE_DATABASE_PREFIX + (index + 1);
        this.selectSourceType.value = item.sourceType;
      });
    }

    updateView() {}

    subscribe({ index, item }) {}

    unsubscribe() {}

    bindUserInput() {}

    unbindUserInput() {}
  }

  class ItemStateNotionDatabaseID extends ItemState {
    constructor() {}

    init() {}

    updateView() {}

    subscribe({ index, item }) {}

    unsubscribe() {}

    bindUserInput() {}

    unbindUserInput() {}
  }

  class ItemStateManager {
    constructor() {
      //共同物件都會在這裡
      //this.currentSourceType = null;
      this.itemState = null;
      this.getStateByType = {
        [model.SourceType.NOTION_PAGE_ID]: new ItemStateNotionPageID(),
        [model.SourceType.NOTION_DATABASE_ID]: new ItemStateNotionDatabaseID(),
      };
    }

    getElement() {
      this.itemState.getElement();
    }

    init() {
      this.itemState.init();
    }

    subscribe() {
      viewModelInstance.subscribe(
        viewModelInstance.EventType.VIEW_ITEM_NEED_CHANGED,
        this.itemState.updateView
      );
    }

    unsubscribe() {
      viewModelInstance.subscribe(
        viewModelInstance.EventType.VIEW_ITEM_NEED_CHANGED,
        this.itemState.updateView
      );
    }

    bindUserInput() {
      this.itemState.bindUserInput();
    }

    unbindUserInput() {
      this.itemState.unbindUserInput();
    }

    //這個函式會關注SourceType，只要他變化就變更State
    changeItemState(newSourceType) {
      //Unsubscribe/Unbind
      if (this.itemState) {
        this.itemState.unsubscribe();
        this.itemState.unbindUserInput();
      }

      //Subscribe/Bind
      this.itemState = this.getStateByType(newSourceType);
      this.itemState.init();
      this.itemState.subscribe();
      this.itemState.bindUserInput();
    }
  }

  const itemStateManager = new ItemStateManager();
  //GetElement
  itemStateManager.getElement();

  //Init
  itemStateManager.init();

  //Subscribe
  itemStateManager.subscribe();

  //UserInput
  itemStateManager.bindUserInput();

  //sourceItemStateManager.getStateByType[]

  // TODO: 目前輸入id還無法儲存到database

  //       const html = `
  //         <h1 style="font-size:15px;">${showTitle}</h1>
  //         <label class="info-line">Page ID：</label><br>
  //         <input type="text" class="pageIdInput styled-input" style="margin-top:10px;" value="${
  //           dbItem.pageId
  //         }" data-id="${dbItem.id}" />
  //         <br>
  //         <br>
  //         ${renderStatsInfo(dbItem)}
  //         <button class="refreshDbBtn" data-id="${
  //           dbItem.id
  //         }" style="margin-top:10px;">Refresh</button>
  //         <button class="deleteDbBtn" data-id="${
  //           dbItem.id
  //         }" style="margin-top:10px;">Delete</button>
  //         <br><br>
  //         <span style="font-size:14px;">${currentNum}/${total}</span>
  //       `;
  //       dbDisplay.innerHTML = html;
  //   // ========== 多資料庫操作：新增、刪除全部 ==========
  //   addDbBtn.addEventListener("click", () => {
  //     chrome.storage.local.get("notionDatabases", (res) => {
  //       let notionDatabases = res.notionDatabases || [];
  //       notionDatabases.push({
  //         id: Date.now().toString(),
  //         pageId: "",
  //         pageTitle: "",
  //         jsonData: {},
  //         latestStats: null,
  //       });
  //       currentDbIndex = notionDatabases.length - 1;
  //       chrome.storage.local.set({ notionDatabases }, () => {
  //         renderCurrentDb();
  //       });
  //     });
  //   });

  //   // ========== 「Highlight！」／「Stop」按鈕 ==========
  //   buttonExchangeMode.addEventListener("click", () => {
  //     if (buttonExchangeMode.textContent === "Highlight！") {
  //       chrome.storage.local.get("notionDatabases", (res) => {
  //         const notionDatabases = res.notionDatabases || [];
  //         let hasData = false;
  //         for (const db of notionDatabases) {
  //           if (db.jsonData && Object.keys(db.jsonData).length > 0) {
  //             hasData = true;
  //             break;
  //           }
  //         }
  //         if (!hasData) {
  //           alert(
  //             "No data. Please click Refresh on the current database to load from Notion."
  //           );
  //           return;
  //         }
  //         sendHighlightMessageForAll();
  //         updateModeDisplay("highlighter");
  //         buttonExchangeMode.textContent = "Stop";
  //         updateBackground(true);
  //       });
  //     } else {
  //       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //         chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" });
  //       });
  //       updateModeDisplay("stopped");
  //       buttonExchangeMode.textContent = "Highlight！";
  //       updateBackground(false);
  //     }
  //   });

  //   // ========== 單一資料庫顯示區 ==========
  //   function renderCurrentDb() {
  //     chrome.storage.local.get("notionDatabases", (res) => {
  //       let notionDatabases = res.notionDatabases || [];
  //       // 確保至少有一組資料庫
  //       if (!notionDatabases.length) {
  //         notionDatabases = [
  //           {
  //             id: Date.now().toString(),
  //             pageId: "",
  //             pageTitle: "",
  //             jsonData: {},
  //             latestStats: null,
  //           },
  //         ];
  //         chrome.storage.local.set({ notionDatabases });
  //         currentDbIndex = 0;
  //       }
  //       // 初次若 currentDbIndex = -1，則表示從尾端開始
  //       if (currentDbIndex === -1) {
  //         currentDbIndex = notionDatabases.length - 1;
  //       }
  //       if (currentDbIndex < 0) currentDbIndex = 0;
  //       if (currentDbIndex >= notionDatabases.length)
  //         currentDbIndex = notionDatabases.length - 1;
  //       const total = notionDatabases.length;
  //       const currentNum = currentDbIndex + 1;
  //       // 更新索引指示器
  //       //dbIndexIndicator.textContent = `${currentNum}/${total}`;
  //       const dbItem = notionDatabases[currentDbIndex];
  //       const showTitle = dbItem.pageTitle
  //         ? dbItem.pageTitle
  //         : `Database #${currentNum}`;
  //       const html = `
  //         <h1 style="font-size:15px;">${showTitle}</h1>
  //         <label class="info-line">Page ID：</label><br>
  //         <input type="text" class="pageIdInput styled-input" style="margin-top:10px;" value="${
  //           dbItem.pageId
  //         }" data-id="${dbItem.id}" />
  //         <br>
  //         <br>
  //         ${renderStatsInfo(dbItem)}
  //         <button class="refreshDbBtn" data-id="${
  //           dbItem.id
  //         }" style="margin-top:10px;">Refresh</button>
  //         <button class="deleteDbBtn" data-id="${
  //           dbItem.id
  //         }" style="margin-top:10px;">Delete</button>
  //         <br><br>
  //         <span style="font-size:14px;">${currentNum}/${total}</span>
  //       `;
  //       dbDisplay.innerHTML = html;
  //       bindDbEvents();
  //       updateNavButtons(total);
  //     });
  //   }

  //   function renderStatsInfo(dbItem) {
  //     const stats = dbItem.latestStats;
  //     if (!stats) {
  //       return `
  //         <p class="info-line" id="status_${dbItem.id}">Data Status：None</p>
  //         <p class="info-line" id="elapsedTime_${dbItem.id}">Runtime：0ms</p>
  //         <p class="info-line" id="keyCount_${dbItem.id}">Block Number：0</p>
  //         <p class="info-line" id="problemBlock_${dbItem.id}">Wrong Block：0</p>
  //       `;
  //     } else {
  //       return `
  //         <p class="info-line" id="status_${dbItem.id}">Data Status：${
  //         stats.dataStatus
  //       }</p>
  //         <p class="info-line" id="elapsedTime_${
  //           dbItem.id
  //         }">Runtime：${stats.runTime.toFixed(2)}s</p>
  //         <p class="info-line" id="keyCount_${dbItem.id}">Block Number：${
  //         stats.blockCount
  //       }</p>
  //         <p class="info-line" id="problemBlock_${dbItem.id}">Wrong Block：${
  //         stats.problemCount
  //       }</p>
  //       `;
  //     }
  //   }

  //   function bindDbEvents() {
  //     const pageIdInput = dbDisplay.querySelector(".pageIdInput");
  //     if (pageIdInput) {
  //       pageIdInput.addEventListener("change", (e) => {
  //         const changedId = e.target.dataset.id;
  //         chrome.storage.local.get("notionDatabases", (res) => {
  //           const notionDatabases = res.notionDatabases || [];
  //           const findItem = notionDatabases.find((x) => x.id === changedId);
  //           if (findItem) {
  //             findItem.pageId = e.target.value.trim();
  //             chrome.storage.local.set({ notionDatabases });
  //           }
  //         });
  //       });
  //     }
  //     const refreshBtn = dbDisplay.querySelector(".refreshDbBtn");
  //     if (refreshBtn) {
  //       refreshBtn.addEventListener("click", async () => {
  //         const dbId = refreshBtn.dataset.id;
  //         const statusEl = document.getElementById(`status_${dbId}`);
  //         if (statusEl) statusEl.textContent = "Data Status：Processing...";
  //         // 先從輸入框取得最新 Page ID，並同步更新 storage
  //         const pageIdInput = dbDisplay.querySelector(".pageIdInput");
  //         if (pageIdInput) {
  //           const newPageId = pageIdInput.value.trim();
  //           const storageData = await new Promise((resolve) =>
  //             chrome.storage.local.get("notionDatabases", resolve)
  //           );
  //           let notionDatabases = storageData.notionDatabases || [];
  //           const targetDb = notionDatabases.find((x) => x.id === dbId);
  //           if (targetDb) {
  //             targetDb.pageId = newPageId;
  //             await new Promise((resolve) =>
  //               chrome.storage.local.set({ notionDatabases }, resolve)
  //             );
  //           }
  //         }
  //         const startTime = performance.now();
  //         const success = await fetchSingleNotion(dbId, startTime);
  //         if (success) {
  //           fetchTime = Date.now();
  //           if (!isNeedRecordTime) {
  //             isNeedRecordTime = 1;
  //             processTime = Date.now();
  //           }
  //           sendHighlightMessageForAll();
  //         }
  //         renderCurrentDb();
  //       });
  //     }
  //     const deleteBtn = dbDisplay.querySelector(".deleteDbBtn");
  //     if (deleteBtn) {
  //       deleteBtn.addEventListener("click", () => {
  //         const delId = deleteBtn.dataset.id;
  //         chrome.storage.local.get("notionDatabases", (res) => {
  //           let notionDatabases = res.notionDatabases || [];
  //           if (notionDatabases.length === 1) {
  //             alert("無法刪除，至少需保留一組資料庫！");
  //             return;
  //           }
  //           notionDatabases = notionDatabases.filter((x) => x.id !== delId);
  //           if (currentDbIndex >= notionDatabases.length) {
  //             currentDbIndex = notionDatabases.length - 1;
  //           }
  //           chrome.storage.local.set({ notionDatabases }, () => {
  //             renderCurrentDb();
  //           });
  //         });
  //       });
  //     }
  //     const problemBlockP = dbDisplay.querySelector(
  //       `#problemBlock_${pageIdInput?.dataset.id}`
  //     );
  //     if (problemBlockP) {
  //       problemBlockP.addEventListener("mouseover", () => {
  //         chrome.storage.local.get("notionDatabases", (res) => {
  //           const notionDatabases = res.notionDatabases || [];
  //           const dbItem = notionDatabases.find(
  //             (x) => x.id === pageIdInput.dataset.id
  //           );
  //           if (
  //             !dbItem ||
  //             !dbItem.latestStats ||
  //             !dbItem.latestStats.problemBlockList?.length
  //           )
  //             return;
  //           let tooltip = document.createElement("div");
  //           tooltip.id = `problemTooltip_${dbItem.id}`;
  //           tooltip.style.position = "absolute";
  //           tooltip.style.padding = "8px 12px";
  //           tooltip.style.background = "rgba(0, 0, 0, 0.8)";
  //           tooltip.style.color = "#fff";
  //           tooltip.style.borderRadius = "4px";
  //           tooltip.style.fontSize = "14px";
  //           tooltip.style.zIndex = "10000";
  //           tooltip.innerHTML = dbItem.latestStats.problemBlockList.join("<br>");
  //           dbDisplay.appendChild(tooltip);
  //           const rect = problemBlockP.getBoundingClientRect();
  //           const dispRect = dbDisplay.getBoundingClientRect();
  //           tooltip.style.left = rect.left - dispRect.left + "px";
  //           tooltip.style.top = rect.bottom - dispRect.top + 5 + "px";
  //         });
  //       });
  //       problemBlockP.addEventListener("mouseout", () => {
  //         const tooltip = dbDisplay.querySelector(
  //           `#problemTooltip_${pageIdInput?.dataset.id}`
  //         );
  //         if (tooltip) tooltip.remove();
  //       });
  //     }
  //   }

  //   function updateNavButtons(total) {
  //     prevDbBtn.disabled = currentDbIndex <= 0;
  //     nextDbBtn.disabled = currentDbIndex >= total - 1;
  //   }

  //   async function fetchSingleNotion(dbId, startTime) {
  //     return new Promise((resolve) => {
  //       chrome.storage.local.get(
  //         ["notionDatabases", "splitChar", "notionToken", "originalJsonData"], // 增加 originalJsonData 的讀取
  //         async (res) => {
  //           let notionDatabases = res.notionDatabases || [];
  //           const splitChar = res.splitChar || "/";
  //           const notionToken = res.notionToken || "";
  //           const targetDb = notionDatabases.find((x) => x.id === dbId);
  //           if (!targetDb) return resolve(false);
  //           const pageId = targetDb.pageId.trim();
  //           if (!pageId || !notionToken) {
  //             return resolve(false);
  //           }

  //           try {
  //             const pageTitle = await fetchPageTitle(pageId, notionToken);
  //             targetDb.pageTitle = pageTitle;
  //             const allBlocks = await fetchAllBlocks(pageId, notionToken);
  //             const { notionJson, problemBlockList } = convertBlocksToJson(
  //               allBlocks,
  //               splitChar
  //             );

  //             // 儲存原始 JSON 數據
  //             targetDb.originalJsonData = JSON.parse(JSON.stringify(notionJson)); // 深拷貝一份
  //             //chrome.storage.local.set({originalJsonData: notionJson})

  //             // 替換佔位符，並儲存轉換後的數據
  //             targetDb.jsonData = substitutePlaceholders(
  //               notionJson,
  //               notionDatabases.map((db) => db.originalJsonData || {})
  //             );

  //             const endTime = performance.now();
  //             const runSec = (endTime - startTime) / 1000;
  //             targetDb.latestStats = {
  //               dataStatus: "Finish",
  //               blockCount: Object.keys(notionJson).length,
  //               problemCount: problemBlockList.length,
  //               problemBlockList,
  //               runTime: runSec,
  //             };

  //             //   const allOriginalJsonData = notionDatabases.map(db => db.originalJsonData || {});
  //             //   notionDatabases.forEach(db => {
  //             //     if (db.originalJsonData) {
  //             //       db.jsonData = substitutePlaceholders(db.originalJsonData, allOriginalJsonData);
  //             //     }
  //             //   });

  //             //   chrome.storage.local.set({ notionDatabases }, () => {
  //             //     resolve(true);
  //             //   });
  //             // });

  //             // 重新替換所有資料庫的佔位符 (包含剛剛新增的)
  //             const allOriginalJsonData = notionDatabases.map(
  //               (db) => db.originalJsonData || {}
  //             );
  //             notionDatabases.forEach((db) => {
  //               if (db.originalJsonData) {
  //                 db.jsonData = substitutePlaceholders(
  //                   JSON.parse(JSON.stringify(db.originalJsonData)),
  //                   allOriginalJsonData
  //                 ); // 確保每次都用原始數據替換
  //               }
  //             });

  //             chrome.storage.local.set({ notionDatabases }, () => {
  //               resolve(true);
  //             });
  //           } catch (error) {
  //             console.error(error);
  //             if (targetDb) {
  //               targetDb.latestStats = {
  //                 dataStatus: "Fail",
  //                 blockCount: 0,
  //                 problemCount: 0,
  //                 problemBlockList: [],
  //                 runTime: 0,
  //               };
  //               chrome.storage.local.set({ notionDatabases }, () => {
  //                 resolve(false);
  //               });
  //             } else {
  //               resolve(false);
  //             }
  //           }
  //         }
  //       );
  //     });
  //   }
  //   function substitutePlaceholders(currentJson, allOriginalJsonData) {
  //     const finalOriginalJsonData = {}; // 修改為累加物件
  //     allOriginalJsonData.forEach((dbData) => {
  //       // 遍歷每個資料庫的原始資料
  //       if (dbData) {
  //         Object.keys(dbData).forEach((key) => {
  //           if (!finalOriginalJsonData[key]) {
  //             finalOriginalJsonData[key] = []; // 初始化為陣列
  //           }
  //           finalOriginalJsonData[key].push(dbData[key]); // 將資料庫內容放入陣列
  //         });
  //       }
  //     });

  //     const jsonData = JSON.parse(JSON.stringify(currentJson));

  //     Object.keys(jsonData).forEach((mainKey) => {
  //       const obj = jsonData[mainKey];
  //       if (typeof obj === "object" && obj !== null) {
  //         Object.keys(obj).forEach((prop) => {
  //           let text = obj[prop];
  //           if (typeof text === "string") {
  //             text = text.replace(/\&\{([^}]+)\}/g, (match, refKey) => {
  //               let foundValues = [];
  //               let isFirst = true;
  //               if (
  //                 finalOriginalJsonData &&
  //                 finalOriginalJsonData.hasOwnProperty(refKey)
  //               ) {
  //                 finalOriginalJsonData[refKey].forEach((refObj) => {
  //                   // 遍歷陣列
  //                   if (refObj && refObj.description) {
  //                     const cleanDesc = refObj.description
  //                       .replace(/\&\{[^}]+\}/g, "")
  //                       .replace(/\~\{[^}]+\}/g, "");
  //                     if (isFirst) {
  //                       foundValues.push("\n");
  //                       isFirst = false;
  //                     }
  //                     foundValues.push(
  //                       `<span style="color: gray; font-size: 10px;">From: ${getDbTitleByKey(
  //                         allOriginalJsonData,
  //                         refKey
  //                       )}</span>__PLACEHOLDER_GREEN__【※】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanDesc}__ENDPLACEHOLDER__`
  //                     );
  //                   }
  //                 });
  //               }
  //               return foundValues.length > 0 ? foundValues.join("") : refKey; // 使用換行符分隔
  //             });

  //             text = text.replace(/\~\{([^}]+)\}/g, (match, refKey) => {
  //               let foundValues = [];
  //               let isFirst = true;
  //               if (
  //                 finalOriginalJsonData &&
  //                 finalOriginalJsonData.hasOwnProperty(refKey)
  //               ) {
  //                 finalOriginalJsonData[refKey].forEach((refObj) => {
  //                   // 遍歷陣列
  //                   if (refObj && refObj.description) {
  //                     const cleanDesc = refObj.description
  //                       .replace(/\&\{[^}]+\}/g, "")
  //                       .replace(/\~\{[^}]+\}/g, "");
  //                     if (isFirst) {
  //                       foundValues.push("\n");
  //                       isFirst = false;
  //                     }
  //                     foundValues.push(
  //                       `<span style="color: gray; font-size: 10px;">From: ${getDbTitleByKey(
  //                         allOriginalJsonData,
  //                         refKey
  //                       )}</span>__PLACEHOLDER_RED__【！】: ${refKey}<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${cleanDesc}__ENDPLACEHOLDER__`
  //                     );
  //                   }
  //                 });
  //               }
  //               return foundValues.length > 0 ? foundValues.join("") : refKey; // 使用換行符分隔
  //             });

  //             text = text.replace(/\@\{([^}]+)\}/g, (match, content) => {
  //               return `__PLACEHOLDER_BLUE__【e.g.】: ${content}__ENDPLACEHOLDER__`;
  //             });

  //             obj[prop] = text;
  //           }
  //         });
  //       }
  //     });

  //     return jsonData;
  //   }

  //   function getDbTitleByKey(allOriginalJsonData, key) {
  //     for (const dbData of allOriginalJsonData) {
  //       if (dbData && dbData[key]) {
  //         // 在這裡，我們假設每個 dbData 物件都有一個名為 'pageTitle' 的屬性
  //         // 如果您的 dbData 物件結構不同，您需要相應地調整這個部分
  //         return dbData[key].pageTitle || "Unknown Database";
  //       }
  //     }
  //     return "Unknown Database";
  //   }

  //   async function fetchAllBlocks(pageId, notionToken) {
  //     let allBlocks = [];
  //     let hasMore = true;
  //     let startCursor;
  //     while (hasMore) {
  //       let url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
  //       if (startCursor) {
  //         url += `&start_cursor=${startCursor}`;
  //       }
  //       const response = await fetch(url, {
  //         method: "GET",
  //         headers: {
  //           Authorization: `Bearer ${notionToken}`,
  //           "Notion-Version": "2022-06-28",
  //           "Content-Type": "application/json",
  //         },
  //       });
  //       const data = await response.json();
  //       if (data.results) {
  //         allBlocks = allBlocks.concat(data.results);
  //       }
  //       hasMore = data.has_more;
  //       startCursor = data.next_cursor;
  //     }
  //     return allBlocks;
  //   }

  //   async function fetchPageTitle(pageId, notionToken) {
  //     try {
  //       const response = await fetch(
  //         `https://api.notion.com/v1/pages/${pageId}`,
  //         {
  //           method: "GET",
  //           headers: {
  //             Authorization: `Bearer ${notionToken}`,
  //             "Notion-Version": "2022-06-28",
  //           },
  //         }
  //       );
  //       const data = await response.json();
  //       if (data.object === "page" && data.properties) {
  //         for (const propName in data.properties) {
  //           const prop = data.properties[propName];
  //           if (
  //             prop &&
  //             prop.type === "title" &&
  //             Array.isArray(prop.title) &&
  //             prop.title.length
  //           ) {
  //             return prop.title[0].plain_text || "Untitled Page";
  //           }
  //         }
  //         return "Untitled Page";
  //       }
  //       return "Unknown Page";
  //     } catch (error) {
  //       console.error("fetchPageTitle Error:", error);
  //       return "Error Fetching Title";
  //     }
  //   }

  //   function convertBlocksToJson(blocks, splitChar) {
  //     const notionJson = {};
  //     const problemBlockList = [];
  //     blocks.forEach((block) => {
  //       if (
  //         block.type === "paragraph" &&
  //         block.paragraph &&
  //         block.paragraph.rich_text &&
  //         block.paragraph.rich_text.length > 0
  //       ) {
  //         const textContent = block.paragraph.rich_text
  //           .map((t) => t.plain_text)
  //           .join("");
  //         const parts = textContent.split(splitChar);
  //         if (parts.length >= 2) {
  //           const key = parts[0].trim();
  //           const merged = parts.slice(1).join(splitChar);
  //           const description = merged.trim();
  //           if (!notionJson[key]) {
  //             notionJson[key] = { description };
  //           } else {
  //             notionJson[
  //               key
  //             ].description += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"></div>${description}`;
  //           }
  //         } else {
  //           problemBlockList.push(textContent.trim() || "(Empty)");
  //         }
  //       }
  //     });
  //     return { notionJson, problemBlockList };
  //   }

  //   function sendHighlightMessageForAll() {
  //     chrome.storage.local.get(["notionDatabases", "highlightColor"], (res) => {
  //       const notionDatabases = res.notionDatabases || [];
  //       const color =
  //         res.highlightColor || inputHighlightColor.value || "#ffff33";
  //       const finalCombined = {};
  //       // 跨資料庫重複 key 用分隔線合併，且前面標示來源（以灰色小字顯示）
  //       notionDatabases.forEach((db) => {
  //         if (db.jsonData && typeof db.jsonData === "object") {
  //           for (const [key, val] of Object.entries(db.jsonData)) {
  //             if (!finalCombined[key]) {
  //               finalCombined[key] = {
  //                 description: `<span style="color: gray; font-size: 10px;">From: ${db.pageTitle}</span>\n${val.description}`,
  //               };
  //             } else {
  //               finalCombined[
  //                 key
  //               ].description += `<div style="border-top:1px solid rgba(255,255,255,0.2); margin:4px 0;"><span style="color: gray; font-size: 10px;">From: ${db.pageTitle}</span>
  // ${val.description}`;
  //             }
  //           }
  //         }
  //       });
  //       const keyValues = Object.entries(finalCombined).map(([k, v]) => ({
  //         key: k,
  //         value: v,
  //       }));
  //       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //         chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR" }, () => {
  //           chrome.tabs.sendMessage(tabs[0].id, {
  //             action: "HIGHLIGHT_BATCH",
  //             keyValues: keyValues,
  //             highlightColor: color,
  //           });
  //         });
  //       });
  //     });
  //   }

  //   function updateModeDisplay(mode) {
  //     textCurrentMode.textContent =
  //       "Current Mode：" + (mode === "highlighter" ? "Highlighting" : "Stop");
  //   }
  //   function updateBackground(isHighlighting) {
  //     document.body.style.background = isHighlighting
  //       ? "linear-gradient(120deg, #4A251B 0%, #7F4339 100%)"
  //       : "linear-gradient(120deg, rgb(61, 61, 61) 0%, rgb(0, 0, 0) 100%)";
  //   }

  //   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  //     if (message.action === "HIGHLIGHT_FINISHED" && isNeedRecordTime) {
  //       const fetchDuration = fetchTime - processTime;
  //       const highlightDuration = Date.now() - fetchTime;
  //       const totalSec = (fetchDuration + highlightDuration) / 1000;
  //       console.log("Process Time：", totalSec.toFixed(2) + "s");
  //       isNeedRecordTime = 0;
  //     }
  //     sendResponse();
  //   });

  //   // 初始載入：若已有資料則預設顯示最後一筆資料
  //   chrome.storage.local.get("notionDatabases", (res) => {
  //     const notionDatabases = res.notionDatabases || [];
  //     if (notionDatabases.length > 0) {
  //       currentDbIndex = notionDatabases.length - 1;
  //     }
  //     let hasData = false;
  //     for (const db of notionDatabases) {
  //       if (db.jsonData && Object.keys(db.jsonData).length > 0) {
  //         hasData = true;
  //         break;
  //       }
  //     }
  //     renderCurrentDb();
  //     if (hasData) {
  //       buttonExchangeMode.textContent = "Stop";
  //       updateModeDisplay("highlighter");
  //       updateBackground(true);
  //     } else {
  //       buttonExchangeMode.textContent = "Highlight！";
  //       updateModeDisplay("stopped");
  //       updateBackground(false);
  //     }
  //   });
});
// document.addEventListener('DOMContentLoaded', () => {
//   const messageDiv = document.getElementById('message');
//   const changeMessageBtn = document.getElementById('changeMessageBtn');
//   const sendMessageToBgBtn = document.getElementById('sendMessageToBg');

//   // 在 popup.html 載入完成後執行
//   console.log('popup.js 已載入。');
//   messageDiv.textContent = 'Popup 視窗已成功載入！';

//   // 為按鈕添加點擊事件監聽器
//   changeMessageBtn.addEventListener('click', async () => {
//     changeMessageBtn.disabled = true;
//     try {
//       await dataManagerInstance.clickFetchButton('1c8b9e0d4f118022a76ef82fdf679d27', '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');
//     } catch (error) {
//     } finally {
//       changeMessageBtn.disabled = false;
//     }
//   });

// });
