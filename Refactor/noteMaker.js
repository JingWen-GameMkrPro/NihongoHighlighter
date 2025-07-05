//該class負責筆記建置相關功能
class NoteMaker {
  async fetchNote(apiToken, database, index) {
    switch (database[index].sourceType) {
      case model.SourceType.NOTION_PAGE_ID:
        const notionPageInfoJson = await this.fetchNotionPageInfoJson(
          apiToken,
          database[index].sourceItem.id
        ); //檢查是否有重複Database

        let isDuplicateFound = false;

        database.forEach((item, mIndex) => {
          if (
            String(mIndex) !== index &&
            notionPageInfoJson.id.replace(/-/g, "") === item.sourceItem.id
          ) {
            //跳出switch

            isDuplicateFound = true;

            return;
          }
        });

        if (isDuplicateFound === true) {
          return null;
        }

        const notionPageBlocks = await this.fetchNotionPageBlockJson(
          apiToken,
          database[index].sourceItem.id
        );
        const transformResult = await this.transformNotionPageJsonToNote(
          database[index],
          notionPageBlocks
        );
        return {
          title: notionPageInfoJson.properties.Name.title[0].plain_text,
          notes: transformResult.Notes,
          wrongBlocks: transformResult.WrongBlocks,
        };
      default:
        return null;
    }
  }

  //NOTE: 此函式高度依賴於NOTION本身的JSON結構
  async transformNotionPageJsonToNote(item, notionPageBlocks) {
    const Notes = [];
    const WrongBlocks = [];

    notionPageBlocks.results.forEach((block) => {
      //先篩選type = paragraph
      if (block.type !== "paragraph") return;

      //再來篩選是否有料
      if (block.paragraph.rich_text.length === 0) return;

      //針對文字客製化屬性，e.g. 粗體...，Notion會拆分複數個richText，因此要先組合所有richtext
      let combinedRichText = block.paragraph.rich_text
        .map((richText) => richText.plain_text)
        .join("");

      //再來是否可以分割
      const divideResult = this.tryDivideStrBySymbol(
        combinedRichText,
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

    if (blockValue === "") {
      infos.push(new Info(Info.InfoType.TEXT, ""));
      return infos;
    }

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

  async fetchNotionPageBlockJson(token, pageId) {
    let allBlocks = [];
    let nextCursor = undefined; // Initialize nextCursor to undefined for the first request

    try {
      do {
        let apiUrl = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
        if (nextCursor) {
          apiUrl += `&start_cursor=${nextCursor}`; // Add start_cursor for subsequent requests
        }

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
          },
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Failed to fetch Notion page blocks:", error);
          return null;
        }

        const data = await response.json();
        allBlocks = allBlocks.concat(data.results); // Add fetched blocks to the array
        nextCursor = data.next_cursor; // Get the cursor for the next page
      } while (nextCursor); // Continue as long as there's a next_cursor

      return { results: allBlocks }; // Return the merged blocks in the same structure as Notion's API
    } catch (error) {
      console.error("Error fetching Notion page blocks:", error);
      return null;
    }
  }

  //return notionPageJson
  async fetchNotionPageInfoJson(token, pageId) {
    const apiUrl = `https://api.notion.com/v1/pages/${pageId}`;

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
        console.error("Failed to fetch Notion page info:", error);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching Notion page info:", error);
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
