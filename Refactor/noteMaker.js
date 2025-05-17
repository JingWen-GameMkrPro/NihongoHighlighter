//該class負責筆記建置相關功能
class NoteMaker {
  async fetchNote() {
    //取得
    const currentIndexItem = await viewModelInstance.asyncGetCurrentIndexItem();

    switch (currentIndexItem.item.sourceType) {
      case model.SourceType.NOTION_PAGE_ID:
        const notionJson = await this.fetchNotionPageJson(
          currentIndexItem.item.sourceItem.apiToken,
          currentIndexItem.item.sourceItem.id
        );
        const transformResult = await this.transformNotionPageJsonToNote(
          currentIndexItem.item,
          notionJson
        );
        return {
          notes: transformResult.Notes,
          wrongBlocks: transformResult.WrongBlocks,
        };
        break;
      default:
        break;
    }
  }

  //NOTE: 此函式高度依賴於NOTION本身的JSON結構
  async transformNotionPageJsonToNote(item, notionPageJson) {
    const Notes = [];
    const WrongBlocks = [];

    notionPageJson.results.forEach((block) => {
      //先篩選type = paragraph
      if (block.type !== "paragraph") return;
      //再來篩選是否有料
      if (block.paragraph.rich_text.length === 0) return;
      //再來是否可以分割
      const divideResult = this.tryDivideStrBySymbol(
        block.paragraph.rich_text[0].plain_text,
        item.sourceItem.splitSymbol
      );
      if (divideResult.isSuccess) {
        const infos = this.transformPageBlockValueToInfos(divideResult.part2);
        const note = new Note(divideResult.part1, infos);
        Notes.push(note);
      } else {
        WrongBlocks.push(block.paragraph.rich_text[0].plain_text);
      }
    });

    return { Notes: Notes, WrongBlocks: WrongBlocks };
  }

  //將PageBlockValue分解成info
  transformPageBlockValueToInfos(blockValue) {
    const infos = [];
    this.divideStrByRegex(blockValue).forEach((subStr) => {
      infos.push(this.makeInfoByRegex(subStr));
    });
    return infos;
  }

  //Calculation
  tryDivideStrBySymbol(str, symbol) {
    const index = str.indexOf(symbol);
    if (index !== -1) {
      const part1 = str.substring(0, index); // 沒有宣告 part1
      const part2 = str.substring(index + 1); // 沒有宣告 part2
      return { isSuccess: true, part1: part1, part2: part2 };
    } else {
      return { isSuccess: false };
    }
  }

  divideStrByRegex(str) {
    const regex = /[^@~&]+|[@~&]\{[^}]*\}/g;
    return str.match(regex);
  }

  makeInfoByRegex(str) {
    const regexExample = /^@\{(?<content>.*)\}$/;
    const regexNotice = /^~\{(?<content>.*)\}$/;
    const regexReference = /^&\{(?<content>.*)\}$/;
    let match = "";

    match = str.match(regexExample);
    if (match && match.groups?.content !== undefined) {
      return new Info(Info.InfoType.EXAMPLE, match.groups.content);
    }

    match = str.match(regexNotice);
    if (match && match.groups?.content !== undefined) {
      return new Info(Info.InfoType.NOTICE, match.groups.content);
    }

    match = str.match(regexReference);
    if (match && match.groups?.content !== undefined) {
      return new Info(Info.InfoType.REFERENCE, match.groups.content);
    }

    return new Info(Info.InfoType.TEXT, str);
  }

  //return notionPageJson
  async fetchNotionPageJson(token, pageId) {
    const apiUrl = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to fetch Notion page:", error);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching Notion page:", error);
      return null;
    }
  }
}

//NOTE: NOTE不知道來源類型，也不知道如何解析

class Note {
  constructor(key, infos) {
    this.key = key;
    this.infos = infos;
  }
}

class Info {
  constructor(type, content) {
    this.type = type;
    this.content = content;
  }

  static InfoType = Object.freeze({
    TEXT: "Text",
    REFERENCE: "Reference",
    NOTICE: "Notice",
    EXAMPLE: "Example",
  });
}
