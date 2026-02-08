module.exports = {
  write: {
    platform: 'notion',
    notion: {
      token: process.env.NOTION_TOKEN,
      databaseId: process.env.NOTION_DATABASE_ID,
      filter: { property: 'status', select: { equals: '已发布' }}
    }
  },
  deploy: {
    platform: 'local',
    local: {
      outputDir: './source/_posts',
      filename: 'title',
      format: 'markdown',
      catalog: false,
      frontMatter: {
        enable: true,
        include: ['title', 'date', 'updated', 'permalink'],
        timeFormat: true,
      },
    }
  },
  image: {
    enable: true,
    platform: 'local',
    local: {
      outputDir: './source/images',
      prefixKey: '/images'
    }
  },
}
