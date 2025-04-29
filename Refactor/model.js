class model {
  constructor() {
    this._subscribers = {};
  }

  //所有資料
  static DataType = Object.freeze({
    TOKEN: "Token",
    IS_HIGHLIGHT_MODE: "IsHighlightMode",
    SPLIT_CHAR: "SplitChar",
    HIGHLIGHT_COLOR: "HighlightColor",
    DATABASE_INDEX: "DatabaseIndex",
    DATABASE: "Database",
  });

  static DisplayText = Object.freeze({
    TITLE_MODE_HIGHLIGHT: "Mode: Highlight Mode",
    TITLE_MODE_UNHIGHLIGHT: "Mode: Unhighlight Mode",
  });

  setData(dataType, value) {
    chrome.storage.local.set({ [dataType]: value }, () => {
      this._notify(dataType, value);
    });
  }

  getData(dataType, callback) {
    chrome.storage.local.get([dataType], (res) => {
      if (res[dataType] !== undefined) {
        callback(res[dataType]);
      } else {
        callback(undefined);
      }
    });
  }

  getAllData() {
    chrome.storage.local.get(null, function (items) {
      console.log("Chrome Storage Local 内容:", items);
      // 你可以在这里进一步处理这些数据，例如显示在你的扩展界面上
    });
  }

  subscribe(dataType, callback) {
    if (!this._subscribers[dataType]) {
      this._subscribers[dataType] = [];
    }
    if (!this._subscribers[dataType].includes(callback)) {
      this._subscribers[dataType].push(callback);
    }
  }

  _notify(dataType, data) {
    if (this._subscribers[dataType]) {
      this._subscribers[dataType].forEach((callback) => {
        callback(data);
      });
    }
  }

  //新增新的資料庫到尾端
  addDatabaseItem(callback) {
    //先拿現有的
    this.getData(model.DataType.DATABASE, (database) => {
      const newItem = new model.DatabaseItemStruct();
      //如果有
      if (database !== undefined) {
        database.push(newItem);
      } else {
        database = [];
        database.push(newItem);
      }

      //覆寫資料庫
      this.setData(model.DataType.DATABASE, database);
      callback(database.length);
    });
  }

  deleteDatabaseItemAtInedx(index, callback) {
    this.getData(model.DataType.DATABASE, (database) => {
      if (database !== undefined) {
        if (database.length > 1) {
          database.splice(index, 1);
          callback(database.length);
        }
      }
      //Override
      this.setData(model.DataType.DATABASE, database);
    });
  }

  emptyDatabase() {
    const newItem = new model.DatabaseItemStruct();
    const database = [newItem];
    this.setData(model.DataType.DATABASE, database);
  }

  static DatabaseItemStruct = class {
    constructor() {}
  };
}
const modelInstance = new model();
//   asyncGetChormeStorageValue(key, callback) {

//   }

//   setChromeStorageValue(key, value) {
//     chrome.storage.local.set({ [key]: value });
//   }

//   removeChromeStorageValue(key) {
//     chrome.storage.local.remove(key);
//   }
