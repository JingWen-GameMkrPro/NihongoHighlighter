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
    TITLE_DATABASE_PREFIX: "Title: ",
  });

  static SourceType = Object.freeze({
    NOTION_PAGE_ID: "NotionPageId",
    NOTION_DATABASE_ID: "NotionDatabaseId",
    TEXT_FILE: "TextFile",
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

  //刪除所有資料庫，並初始化成只有一個空的Page
  emptyDatabase() {
    const newItem = new model.DatabaseItemStruct();
    const database = [newItem];
    this.setData(model.DataType.DATABASE, database);
  }

  //改變目前index的來源物件類型
  //HACK: 變得更泛用一點
  //更改類型的時候，source資料的部分自動初始化
  // changeItemSourceType(newSourceType) {
  //   this.getData(model.DataType.DATABASE_INDEX, (index) => {
  //     this.getData(model.DataType.DATABASE, (database) => {
  //       const newItem = new model.DatabaseItemStruct({
  //         sourceType: newSourceType,
  //         existData: database[index],
  //       });
  //       database[index] = newItem;
  //       this.setData(model.DataType.DATABASE, database);
  //     });
  //   });
  // }

  setItemData(target, value) {
    this.getData(model.DataType.DATABASE_INDEX, (index) => {
      this.getData(model.DataType.DATABASE, (database) => {
        if (target in database[index]) {
          if (target === "sourceType") {
            database[index].sourceType = value;
            //如果是source type，則source資料的部分自動初始化
            database[index].sourceItem = this.returnSourceItemByType(value);
          } else {
            database[index][target] = value;
          }
        }
        this.setData(model.DataType.DATABASE, database);
      });
    });
  }

  setSourceItemData(target, value) {
    this.getData(model.DataType.DATABASE_INDEX, (index) => {
      this.getData(model.DataType.DATABASE, (database) => {
        if (target in database[index].sourceItem) {
          database[index].sourceItem[target] = value;
        }
        this.setData(model.DataType.DATABASE, database);
      });
    });
  }

  static DatabaseItemStruct = class {
    constructor({
      sourceType = model.SourceType.NOTION_PAGE_ID,
      existData = null,
    } = {}) {
      this.isActive = existData?.isActive ?? true;
      this.name = existData?.name ?? "";
      this.sourceType = sourceType;
      this.sourceItem = this._returnSourceItemByType(sourceType);
    }
    _returnSourceItemByType(sourceType) {
      switch (sourceType) {
        case model.SourceType.NOTION_PAGE_ID:
          return new model.SourceItemNotionPageIdStruct();
        case model.SourceType.NOTION_DATABASE_ID:
          return new model.SourceItemNotionDatabaseIdStruct();
        case model.SourceType.TEXT_FILE:
          throw new Error(`Unknown source type: ${sourceType}`);
        default:
          throw new Error(`Unknown source type: ${sourceType}`);
      }
    }
  };

  returnSourceItemByType(sourceType) {
    switch (sourceType) {
      case model.SourceType.NOTION_PAGE_ID:
        return new model.SourceItemNotionPageIdStruct();
      case model.SourceType.NOTION_DATABASE_ID:
        return new model.SourceItemNotionDatabaseIdStruct();
      case model.SourceType.TEXT_FILE:
        throw new Error(`Unknown source type: ${sourceType}`);
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
  }

  static SourceItemNotionPageIdStruct = class {
    constructor() {
      //使用者可以自行更改?
      this.apiToken = "";
      this.id = "";
      this.splitSymbol = "/";
    }
  };

  static SourceItemNotionDatabaseIdStruct = class {
    constructor() {
      //使用者可以自行更改?
      this.id = "";
    }
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
