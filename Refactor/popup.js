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

  //MakeNote
  const buttonUpdateNote = document.getElementById("button-updateNote");

  const listNotes = document.getElementById("list-notes");

  viewModelInstance.subscribe(model.DataType.DATABASE, updateListNotes);

  viewModelInstance.subscribe(
    model.DataType.DATABASE_INDEX,
    updateSelectListItem
  );

  function updateSelectListItem(index) {
    highlightListItem(listNotes, index);
  }

  async function updateListNotes(newDatabase) {
    //清空List
    emptyList(listNotes);

    //根據新資料庫內容，重新顯示List
    newDatabase.forEach((dateBaseItem, index) => {
      pushListItem(listNotes, index, dateBaseItem);
    });

    //Highlight目前Select
    const index = await viewModelInstance.asyncGetCurrentIndex();
    highlightListItem(listNotes, index);
  }

  function emptyList(list) {
    list.innerHTML = ""; // 最直接高效的清空方式
  }

  function pushListItem(list, index, databaseItem) {
    const listItem = document.createElement("li");
    listItem.setAttribute("item-index", index);
    listItem.classList.add("list-item");

    const itemTitle = document.createElement("span");
    itemTitle.classList.add("item-title");
    itemTitle.textContent =
      databaseItem.name === "" ? "Unknown Name" : databaseItem.name;

    const itemCount = document.createElement("span");
    itemCount.classList.add("item-count");
    itemCount.textContent = databaseItem.notes.length;

    listItem.appendChild(itemTitle);
    listItem.appendChild(itemCount);

    listItem.addEventListener("click", function () {
      viewModelInstance.gotoIndex(listItem.getAttribute("item-index"));
    });
    list.appendChild(listItem);
  }

  function highlightListItem(list, index) {
    const currentSelected = list.querySelector(".list-item.selected");
    if (currentSelected) {
      currentSelected.classList.remove("selected");
    }
    list.children[index].classList.toggle("selected");
  }

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
  viewModelInstance.subscribe(model.DataType.DATABASE, updateTextIndexx);

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

  buttonUpdateNote.addEventListener("click", () => {
    clickedButtonUpdateNote(buttonUpdateNote);
  });

  async function clickedButtonUpdateNote(button) {
    button.disabled = true;

    const singleDataController = document.getElementById(
      "single-data-controller"
    );
    singleDataController.classList.add("loading");

    const normalDataController = document.getElementById(
      "normal-data-controller"
    );
    normalDataController.classList.add("loading");

    listNotes.classList.add("loading");
    try {
      await viewModelInstance.updateNote();
    } catch (e) {
      console.error(e);
    } finally {
      button.disabled = false;
      singleDataController.classList.remove("loading");
      normalDataController.classList.remove("loading");
      listNotes.classList.remove("loading");
    }
  }

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
    list: listNotes,
    debug1: textIndex,
    debug2: textIndexx,
  });

  //根據SourceType，而有不同的ItemState
  class ItemState {
    constructor() {}

    enter() {}

    exit() {}

    getElement() {
      //每個state都有的元素
      this.textDbTitle = document.getElementById("text-dbTitle");
    }

    initValue() {
      //HACK: 先用INDEX+1代替
      //每個state都有的元素
      viewModelInstance.getCurrentIndexItem(({ index, item }) => {
        //根據state而有的元素
        this.textDbTitle.textContent =
          String(parseInt(index, 10) + 1).padStart(3, "0") +
          "：" +
          (item.name === "" ? "Unknow Name" : item.name);
      });
    }

    updateView(index, item) {
      //根據state而有的元素
      this.textDbTitle.textContent =
        String(parseInt(index, 10) + 1).padStart(3, "0") +
        "：" +
        (item.name === "" ? "Unknow Name" : item.name);
    }

    updateDomElementFromTemplate(sourceType) {
      const containerSourceItem = document.getElementById(
        "container-sourceItem"
      );
      //銷毀template元素
      const template = document.getElementById(`sourceItem-${sourceType}`);
      containerSourceItem.innerHTML = "";
      //新增template元素
      const clone = template.content.cloneNode(true);
      containerSourceItem.appendChild(clone);
    }

    bindUserInput() {}

    unbindUserInput() {}

    userInputSourceTypeChange(event) {
      viewModelInstance.setItemData("sourceType", event.target.value);
    }
  }

  //有什麼元素
  class ItemStateNotionPageID extends ItemState {
    constructor() {
      super();
    }
    enter() {
      super.updateDomElementFromTemplate(model.SourceType.NOTION_PAGE_ID);

      super.getElement();
      this.getElement();

      super.initValue();
      this.initValue();

      super.bindUserInput();
      this.bindUserInput();
    }

    exit() {
      super.unbindUserInput();
      this.unbindUserInput();
    }

    getElement() {
      this.inputPageId = document.getElementById("input-pageId");
    }

    initValue() {
      viewModelInstance.getCurrentIndexItem(({ index, item }) => {
        this.inputPageId.value = item.sourceItem.id;
      });
    }

    updateView(index, item) {
      super.updateView(index, item);
      this.inputPageId.value = item.sourceItem.id;
    }

    bindUserInput() {
      this.inputPageId.addEventListener("change", this.userInputPageIdChange);
    }

    unbindUserInput() {
      this.inputPageId.removeEventListener(
        "change",
        this.userInputPageIdChange
      );
    }

    //HACK: 需要檢查是否有重複ID
    userInputPageIdChange(event) {
      viewModelInstance.setSourceItemData("id", event.target.value);
    }

    userInputApiTokenChange(event) {
      viewModelInstance.setSourceItemData("apiToken", event.target.value);
    }
  }

  class ItemStateNotionDatabaseID extends ItemState {
    constructor() {
      super();
    }
    enter() {
      super.updateDomElementFromTemplate(model.SourceType.NOTION_DATABASE_ID);

      super.getElement();
      this.getElement();

      super.initValue();
      this.initValue();

      super.bindUserInput();
      this.bindUserInput();
    }

    exit() {
      super.unbindUserInput();
      this.unbindUserInput();
    }

    getElement() {
      this.inputDbId = document.getElementById("input-dbId");
    }

    initValue() {
      viewModelInstance.getCurrentIndexItem(({ index, item }) => {
        this.inputDbId.value = item.sourceItem.id;
      });
    }

    updateView(index, item) {
      super.updateView(index, item);
      this.inputDbId.value = item.sourceItem.id;
    }

    bindUserInput() {
      this.inputDbId.addEventListener("change", this.userInputDbIdChange);
    }

    unbindUserInput() {
      this.inputDbId.removeEventListener("change", this.userInputDbIdChange);
    }

    userInputDbIdChange(event) {
      viewModelInstance.setSourceItemData("id", event.target.value);
    }
  }

  class ItemStateManager {
    constructor() {
      this.itemState = null;
      this.itemType = null;
      this.getStateByType = {
        [model.SourceType.NOTION_PAGE_ID]: new ItemStateNotionPageID(),
        [model.SourceType.NOTION_DATABASE_ID]: new ItemStateNotionDatabaseID(),
      };
    }

    updateItemView(index, item) {
      //判斷是否要change item state
      if (item.sourceType !== this.itemType) {
        this.changeItemState(item.sourceType);
      }
      this.itemState.updateView(index, item);
    }

    //這個函式會關注SourceType，只要他變化就變更State
    changeItemState(newSourceType) {
      //Unsubscribe/Unbind
      if (this.itemState) {
        this.itemState.exit();
      }

      //Subscribe/Bind
      this.itemState = this.getStateByType[newSourceType];
      this.itemType = newSourceType;
      this.itemState.enter();
    }
  }

  const itemStateManager = new ItemStateManager();
  //Init
  viewModelInstance.getCurrentIndexItem(({ index, item }) => {
    itemStateManager.updateItemView(index, item);
  });

  //Subscribe
  //HACK: 拿區區一個SOURCETYPE，竟然需要拿整個資料庫
  viewModelInstance.subscribe(
    viewModel.EventType.VIEW_ITEM_NEED_CHANGED,
    ({ index, item }) => {
      itemStateManager.updateItemView(index, item);
    }
  );
});
