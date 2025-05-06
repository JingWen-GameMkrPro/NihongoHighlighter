//該class負責筆記建置相關功能
class NoteMaker {
  async updateNote() {
    //取得
    const currentIndexItem = await viewModelInstance.asyncGetCurrentIndexItem();

    switch (currentIndexItem.item.sourceType) {
      case model.SourceType.NOTION_PAGE_ID:
        const notionJson = await this.fetchNotionPage(
          "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",
          currentIndexItem.item.sourceItem.id
        );
        console.log(notionJson);
        break;
      default:
        break;
    }
  }

  async makeNote({ index, item }) {}

  async fetchNotionPage(token, pageId) {
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
