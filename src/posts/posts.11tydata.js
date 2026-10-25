export default {
  layout: 'article.njk',
  eleventyComputed: {
    permalink: (data) => data.published === true ? `/blog/${data.slug}/` : false,
    eleventyExcludeFromCollections: (data) => data.published !== true
  }
};
