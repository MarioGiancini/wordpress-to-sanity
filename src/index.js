/* eslint-disable id-length, max-depth, max-statements, no-console, no-nested-ternary, no-process-env, no-sync, no-process-exit, no-warning-comments */
const fs = require('fs')
const path = require('path')
const config = require('../config.json')

const parseDate = require('./lib/parseDate')
const parseBody = require('./lib/parseBody')
const utils = require('./lib/utils')
const slugify = require('slugify')
const xml2js = require('xml2js')

// Location for where we store our xml export files from WordPress
const exportDir = './exports/'
 
// Import destinations for parsed exported data and newline json file
const now = new Date
const dateRun = now.toISOString().split('.')[0].replace(/:|T/gi, '-')
const importsDir = path.resolve(__dirname, '../imports/')
const nlJsonFile = `${importsDir}/sanity-import-${dateRun}.nljson`

// Configurable settings
const allowedPostTypes = config.postTypes
const usePostLinkForSlug = config.usePostLinkForSlug

const xmlExportDir = fs.readdirSync(exportDir, (err, files) => {
  if (err) {
      throw new Error(`Export files directory missing: ${err}`)
  }
})

const xmlExportFiles = xmlExportDir.filter(file => path.extname(file) === '.xml')

for (const [index, xmlExportFile] of xmlExportFiles.entries()) {
  // https://github.com/Leonidas-from-XIV/node-xml2js#options
  const parser = new xml2js.Parser({explicitArray: false})

  const xmlFile = fs.readFileSync(exportDir + xmlExportFile, "utf8")

  const posts = []
  const categories = []
  const tags = []
  const authors = []
  const attachments = []
  
  parser.parseString(xmlFile, (error, result) => {
    if (error === null) {
  
      // Get the exported data we're after from the first channel xml tag
      const exportObject = result.rss.channel
      
      const wpAuthors = Array.isArray(exportObject['wp:author']) ? exportObject['wp:author'] : [exportObject['wp:author']]
      
      const siteLink = exportObject.link
  
      for (const author of wpAuthors) {
        const wpAuthor = {
          _type: 'author',
          _id: utils.createDocumentId('author', author['wp:author_id']),
          name: author['wp:author_display_name'],
          slug: {
            current: slugify(author['wp:author_login'], { lower: true })
          },
          email: author['wp:author_email']
        }
        authors.push(wpAuthor)

        const authorImportDirPath = `${importsDir}/author`
        const authorImportFilePath = `${authorImportDirPath}/${wpAuthor._id}.json`
        utils.createDocumentFile(`${authorImportDirPath}`, authorImportFilePath, wpAuthor)
      }
  
      const meta = {
        title: exportObject.title,
        link: siteLink,
        description: exportObject.description,
        authors: authors.length,
      }
  
      console.log(`Site Meta from ${index + 1} of ${xmlExportFiles.length} export files`, meta)
      console.log(`\nStarting parsing of xml file ${xmlExportFiles[index]}`)
  
      for (const item of exportObject.item) {
        const postType = item['wp:post_type']
        if (!allowedPostTypes.includes(postType)) {
          console.log(`\nItem is a ${postType} and not a ${allowedPostTypes.join(' or ')}, so skipping...`)
          continue 
        }

        // If this is an attachment post type, it's a featured image we just want to store reference to.
        // We just need the post_id and src url to create a _sanityAsset when a post uses it as a featured image.
        if (postType === 'attachment') {
          attachments.push({
            id: item['wp:post_id'],
            src: item['wp:attachment_url']
          })

          continue
        }
  
        const { title, description } = item
        const itemCategories = []
        const itemTags = []
  
        // Make sure we can iterate over posts with one or none taxonomies
        // This handles both when we export Posts from WordPress in a separate file, or All
        const category = Array.isArray(item.category) ? item.category : (item.category === undefined ? [] : [item.category])
  
        for (const taxonomy of category) {
          if (taxonomy.$.domain === 'category') {

            // Create the category
            const postCategory = {
              _type: 'category',
              _id: utils.createDocumentId('category', taxonomy.$.nicename),
              title: taxonomy._
            }
  
            // Add it to the post category references
            itemCategories.push(utils.createReferenceObject(postCategory))
  
            // See if it's not already added to all categories to import
            if (categories.find(postCat => postCat._id === postCategory._id) === undefined) {
              categories.push(postCategory)

              const categoryImportDirPath = `${importsDir}/category`
              const categoryImportFilePath = `${categoryImportDirPath}/${postCategory._id}.json`
              utils.createDocumentFile(`${categoryImportDirPath}`, categoryImportFilePath, postCategory)
            } else {
              console.log(`\ncategory: ${postCategory.title} is already parsed...`)
            }
  
          } else if ((taxonomy.$.domain === 'post_tag')) {
            // Create the tag
            const tag = {
              _type: 'tag',
              _id: utils.createDocumentId('tag', taxonomy.$.nicename),
              title: taxonomy._
            }
  
            // Add it to the post category references
            itemTags.push(utils.createReferenceObject(tag))
  
            // See if it's not already added to all categories to import
            if (tags.find(postTag => postTag._id === tag._id) === undefined) {
              tags.push(tag)

              const tagImportDirPath = `${importsDir}/tag`
              const tagImportFilePath = `${tagImportDirPath}/${tag._id}.json`
              utils.createDocumentFile(`${tagImportDirPath}`, tagImportFilePath, tag)
            } else {
              console.log(`\ntag: ${tag.title} is already parsed...`)
            }
          }
        }
  
        // Relate the current post author
        const postAuthor = authors.find(user => user.slug.current === item['dc:creator'])
        
        let mainImage = null 
        // find in postmeta array meta_key = "_thumbnail_id" 
        const wpPostMeta = Array.isArray(item['wp:postmeta']) ? item['wp:postmeta'] : [item['wp:postmeta']]
        const thumbnailPostMeta = wpPostMeta.find(postMeta => postMeta['wp:meta_key'] === '_thumbnail_id')

        if (thumbnailPostMeta !== undefined) {
          // Attachments may come before or after the posts that reference them, so just add id for now
          mainImage = thumbnailPostMeta['wp:meta_value']
        }

        // If the post is in a draft status, let's import it as such using Sanity's "drafts." _id prefix.
        const draftStatus = item['wp:status'] === 'draft' ? 'drafts.' : ''

        // Use the site link to split the post/page slug from it's link. Will only work for published posts.
        const postSlug = item.link.split(siteLink)[1].replaceAll(/\//gi, '')

        const post = {
          _id: draftStatus + utils.createDocumentId(postType, item['wp:post_id']),
          _type: postType,
          title,
          slug: {
            current: usePostLinkForSlug && !draftStatus ? postSlug : slugify(title, { lower: true, strict: true })
          },
          description,
          body: parseBody(item['content:encoded']),
        }

        // Only posts need categories, tags, or an author
        if (postType === 'post') {
          post.categories = itemCategories
          post.tags = itemTags
          post.author = utils.createReferenceObject(postAuthor, false)
        }

        const publishedAt = parseDate(item)

        if (publishedAt && !draftStatus) {
          post.publishedAt = publishedAt
        }

        if (mainImage) {
          post.mainImage = mainImage
        }

        // add the post/page to the array to create document files for
        posts.push(post)
      }
  
    } else {
      console.log(error)
    }
  })

  
  // Create the json file for each post here
  for (const post of posts) {
    // Now that full xml file is parse, relate post and page featured images to attachments
    if (attachments.length && post.mainImage) {
      const postAttachment = attachments.find(attachment => attachment.id === post.mainImage)
      post.mainImage = {
        _type: 'image',
        _sanityAsset: `image@${postAttachment.src}`
      }
    }
    const postImportDirPath = `${importsDir}/${post._type}`
    const postImportFilePath = `${postImportDirPath}/${post._id}.json`
    utils.createDocumentFile(`${postImportDirPath}`, postImportFilePath, post)
  }
}

console.log("\nStarting recursive import file write...", importsDir)
const documentCounter = []
      
utils.walkDirRecursively(importsDir, nlJsonFile, documentCounter)
      
console.log(`\r> Finished in ${((new Date).getTime() - now.getTime())/1000} seconds!`)
console.log(`\n> ${documentCounter.length} document files appended to import file: ${nlJsonFile}\n`)


console.log('ALLOWED POST TYPES:', allowedPostTypes)
