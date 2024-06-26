const { JSDOM } = require('jsdom')
const blockTools = require('@sanity/block-tools').default
const sanitizeHTML = require('./sanitizeHTML')
const defaultSchema = require('../../schema/defaultSchema')

const blockContentType = defaultSchema
  .get('blogPost')
  .fields.find(field => field.name === 'body').type

function htmlToBlocks (html, options) {
  if (!html) {
    return []
  }

  const blocks = blockTools.htmlToBlocks(sanitizeHTML(html), blockContentType, {
    parseHtml: htmlContent => new JSDOM(htmlContent).window.document,
    rules: [
      {
        deserialize (el, next, block) {
          // Special case for code blocks (wrapped in pre and code tag)
          if (el.tagName.toLowerCase() !== 'pre') {
            return undefined
          }
          const code = el.children[0]
          let text = ''
          if (code) {
            const childNodes =
              code && code.tagName.toLowerCase() === 'code'
                ? code.childNodes
                : el.childNodes
            childNodes.forEach(node => {
              text += node.textContent
            })
          } else {
            text = el.textContent
          }
          if(!text) {
            return undefined
          }
          // Use code key to work with code-input plugin
          return block({
            _type: 'code',
            code: text
          })
        }
      },
      {
        deserialize (el, next, block) {
          if (el.tagName === 'IMG') {
            return block({
                _type: "image",
                _sanityAsset: `image@${el
                  .getAttribute('src')
                  .replace(/^\/\//, 'https://')}`
            })
          }

          if (
            el.tagName.toLowerCase() === 'p' &&
            el.childNodes.length === 1 &&
            el.childNodes.tagName &&
            el.childNodes[0].tagName.toLowerCase() === 'img'
          ) {
            return block({
                _type: "image",
                _sanityAsset: `image@${el.childNodes[0]
                  .getAttribute('src')
                  .replace(/^\/\//, 'https://')}`
            })
          }
          // Only convert block-level images, for now
          return undefined
        }
      }
    ],
  })
  return blocks
}

module.exports = bodyHTML => htmlToBlocks(bodyHTML)
