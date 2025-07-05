class viewModel {
  constructor(model) {
    this._model = model;
    this._subscribers = {};
    this.noteMakerInstance = new NoteMaker();
    this.port = chrome.runtime.connect({ name: "popup-background" });

    //我想關注...資料，資料一變化就執行...
    this._init();
  }
  _init() {
    this._model.subscribe(model.DataType.TOKEN, (newValue) => {
      this._notify(model.DataType.TOKEN, newValue);
    });

    this._model.subscribe(model.DataType.SPLIT_CHAR, (newValue) => {
      this._notify(model.DataType.SPLIT_CHAR, newValue);
    });

    this._model.subscribe(model.DataType.HIGHLIGHT_COLOR, (newValue) => {
      this._notify(model.DataType.HIGHLIGHT_COLOR, newValue);
    });

    this._model.subscribe(model.DataType.IS_HIGHLIGHT_MODE, (newValue) => {
      this._notify(model.DataType.IS_HIGHLIGHT_MODE, newValue);
    });

    //HACK: 以下兩個函式要維護同樣的操作，容易有錯誤
    this._model.subscribe(model.DataType.DATABASE_INDEX, (newValue) => {
      this._notify(model.DataType.DATABASE_INDEX, newValue);
      this._notifyEventViewItemNeedChangedSubscribers();
    });

    this._model.subscribe(model.DataType.DATABASE, (newValue) => {
      this._notify(model.DataType.DATABASE, newValue);
      this._notifyEventViewItemNeedChangedSubscribers();
    });
  }

  static EventType = Object.freeze({
    VIEW_ITEM_NEED_CHANGED: "View_Iten_Need_Changed",
  });

  _notifyEventViewItemNeedChangedSubscribers() {
    this.getData(model.DataType.DATABASE, (database) => {
      this.getData(model.DataType.DATABASE_INDEX, (index) => {
        this._notify(viewModel.EventType.VIEW_ITEM_NEED_CHANGED, {
          item: database[index],
          index: index,
        });
      });
    });
  }

  setData(dataType, value) {
    this._model.setData(dataType, value);
  }

  //設定Item的值
  setItemData(target, value) {
    this._model.setItemData(target, value);
  }

  //設定sourceItem的值
  setSourceItemData(target, value) {
    this._model.setSourceItemData(target, value);
  }

  getData(dataType, callback) {
    this._model.getData(dataType, callback);
  }

  removeData(dataType) {
    chrome.storage.local.remove(dataType);
  }

  subscribe(dataType, callback) {
    if (!this._subscribers[dataType]) {
      this._subscribers[dataType] = [];
    }
    if (!this._subscribers[dataType].includes(callback)) {
      this._subscribers[dataType].push(callback);
    }
  }

  unsubscribe(dataType, callback) {
    if (this._subscribers[dataType]) {
      this._subscribers[dataType] = this._subscribers[dataType].filter(
        (cb) => cb !== callback
      );
    }
  }

  _notify(dataType, data) {
    if (this._subscribers[dataType]) {
      this._subscribers[dataType].forEach((callback) => {
        callback(data);
      });
    }
  }

  exchangeMode() {
    console.log("awfe");
    this._model.getData(model.DataType.IS_HIGHLIGHT_MODE, (value) => {
      if (value !== undefined) {
        if (value === true) {
          this._model.setData(model.DataType.IS_HIGHLIGHT_MODE, false);
        } else {
          this._model.setData(model.DataType.IS_HIGHLIGHT_MODE, true);
        }
        //通知BACKGROUND
        this.port.postMessage({ cmd: "MODE_UPDATE" });
      }
    });
  }

  //初始化一個新的資料庫
  addNewDatabase() {
    //新增新的資料庫
    this._model.addDatabaseItem((newLength) => {
      this._model.setData(model.DataType.DATABASE_INDEX, newLength - 1);
    });
  }

  addDatabaseItem() {
    //新增新的資料庫成員
    this._model.addDatabaseItem((newLength) => {
      this._model.setData(model.DataType.DATABASE_INDEX, newLength - 1);
    });
    // //INDEX自動指向資料庫尾巴
    // this._model.getData(model.DataType.DATABASE, (database) => {
    //   if (database) {
    //     this._model.setData(model.DataType.DATABASE_INDEX, database.length - 1);
    //   }
    // });
  }

  deleteDatabaseItemAtCurrentIndex() {
    //刪除目前index的成員
    this._model.getData(model.DataType.DATABASE_INDEX, (index) => {
      if (index !== undefined) {
        this._model.deleteDatabaseItemAtInedx(index, (newLength) => {
          if (index >= newLength) {
            this._model.setData(model.DataType.DATABASE_INDEX, index - 1);
          }
        });
      }
    });
  }

  initDatabase() {
    this._model.emptyDatabase();
    this._model.setData(model.DataType.DATABASE_INDEX, 0);
  }

  moveForwardIndex() {
    this._model.getData(model.DataType.DATABASE_INDEX, (index) => {
      if (index !== undefined) {
        this._model.getData(model.DataType.DATABASE, (database) => {
          if (database !== undefined) {
            if (index + 1 < database.length) {
              this._model.setData(model.DataType.DATABASE_INDEX, index + 1);
            }
          }
        });
      }
    });
  }

  moveBackwardIndex() {
    this._model.getData(model.DataType.DATABASE_INDEX, (index) => {
      if (index !== undefined) {
        this._model.getData(model.DataType.DATABASE, (database) => {
          if (database !== undefined) {
            if (index - 1 >= 0) {
              this._model.setData(model.DataType.DATABASE_INDEX, index - 1);
            }
          }
        });
      }
    });
  }

  getCurrentIndexItem(callback) {
    this._model.getData(model.DataType.DATABASE_INDEX, (index) => {
      this._model.getData(model.DataType.DATABASE, (database) => {
        if (database[index]) {
          callback({ index: index, item: database[index] });
        }
      });
    });
  }

  //HACK: 此函式的方式可以考慮取代目前所有GET DATA方式，利用PROMISE
  async asyncGetCurrentIndexItem(callback) {
    const index = await new Promise((resolve) => {
      this._model.getData(model.DataType.DATABASE_INDEX, (index) =>
        resolve(index)
      );
    });

    const database = await new Promise((resolve) => {
      this._model.getData(model.DataType.DATABASE, (database) =>
        resolve(database)
      );
    });

    return { index, item: database[index] };
  }

  //檢查callback是否有訂閱target，匿名函式無法查詢
  isSubscribe(target, callback) {
    return this._subscribers[target]?.includes(callback) ?? false;
  }

  async updateNote() {
    const token = await this._model.getDataAsync(model.DataType.TOKEN);
    const result = await this.noteMakerInstance.fetchNote(token);
    const index = await this._model.getDataAsync(model.DataType.DATABASE_INDEX);
    const database = await this._model.getDataAsync(model.DataType.DATABASE);
    database[index].name = result.title;
    database[index].notes = result.notes;
    database[index].wrongs = result.wrongBlocks;
    await this._model.setDataAsync(model.DataType.DATABASE, database);
  }

  //初始化所有VIEW資料
  initView({
    token,
    isSaveToken,
    splitChar,
    highlightColor,
    mode,
    list,
    debug1,
    debug2,
  }) {
    this.getData(model.DataType.TOKEN, (value) => {
      if (value !== undefined) {
        token.value = value;
        isSaveToken.checked = true;
      } else {
        token.value = "";
        isSaveToken.checked = false;
      }
    });

    this.getData(model.DataType.SPLIT_CHAR, (value) => {
      if (value !== undefined) {
        splitChar.value = value;
      } else {
        //HACK: 是否要主動設定初始值
        this.setData(model.DataType.SPLIT_CHAR, "/"); //Default
      }
    });

    this.getData(model.DataType.HIGHLIGHT_COLOR, (value) => {
      if (value !== undefined) {
        highlightColor.value = value;
      } else {
        //HACK: 是否要主動設定初始值
        this.setData(model.DataType.HIGHLIGHT_COLOR, "#ffff33"); //Default
      }
    });

    this.getData(model.DataType.IS_HIGHLIGHT_MODE, (value) => {
      if (value !== undefined) {
        if (value === true) {
          mode.textContent = model.DisplayText.TITLE_MODE_HIGHLIGHT;
        } else {
          mode.textContent = model.DisplayText.TITLE_MODE_UNHIGHLIGHT;
        }
      } else {
        //HACK: 是否要主動設定初始值
        this.setData(model.DataType.IS_HIGHLIGHT_MODE, true);
      }
    });

    //DEBUG
    this.getData(model.DataType.DATABASE_INDEX, (index) => {
      if (index !== undefined) {
        debug1.textContent = index + 1;
      } else {
        //HACK: 是否要主動設定初始值
        this.addNewDatabase();
      }
    });

    //DEBUG
    this.getData(model.DataType.DATABASE, (database) => {
      if (database !== undefined) {
        debug2.textContent = database.length;

        this._notify(model.DataType.DATABASE, database);
      }
    });
  }
}
const viewModelInstance = new viewModel(modelInstance);
