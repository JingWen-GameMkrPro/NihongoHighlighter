class viewModel {
  constructor(model) {
    this._model = model;
    this._subscribers = {};
    this._datas = {};
    // //Chrome Storage Local Datas
    // this._datas.push({ isSaveToken: false });
    // this._datas.push({ token: "" });

    //我想關注...資料，資料一變化就執行...
    this._init();
  }
  _init() {
    this._model.subscribe(model.DataType.TOKEN, (newValue) => {
      //this._datas[model.DataType.TOKEN] = newValue; //有必要存在?
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

    this._model.subscribe(model.DataType.DATABASE_INDEX, (newValue) => {
      this._notify(model.DataType.DATABASE_INDEX, newValue);
      this.getData(model.DataType.DATABASE, (database) => {
        this._notify(viewModel.EventType.VIEW_PAGE_CHANGED, {
          newPage: database[newValue],
          newIndex: newValue,
        });
      });
    });

    this._model.subscribe(model.DataType.DATABASE, (newValue) => {
      this._notify(model.DataType.DATABASE, newValue);
      this.getData(model.DataType.DATABASE_INDEX, (index) => {
        this._notify(viewModel.EventType.VIEW_PAGE_CHANGED, {
          newPage: newValue[index],
          newIndex: index,
        });
      });
    });
  }

  static EventType = Object.freeze({
    VIEW_PAGE_CHANGED: "View_Page_Changed",
  });

  setData(dataType, value) {
    this._model.setData(dataType, value);
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
    this._model.getData(model.DataType.IS_HIGHLIGHT_MODE, (value) => {
      if (value !== undefined) {
        if (value === true) {
          this._model.setData(model.DataType.IS_HIGHLIGHT_MODE, false);
        } else {
          this._model.setData(model.DataType.IS_HIGHLIGHT_MODE, true);
        }
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
}
const viewModelInstance = new viewModel(modelInstance);
