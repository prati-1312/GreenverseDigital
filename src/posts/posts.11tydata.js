export default {
  layout: 'article.njk',
  eleventyComputed: {
    permalink: (data) => data.published === true ? `/blog/${data.slug}.html` : false,
    eleventyExcludeFromCollections: (data) => data.published !== true
  }
};
