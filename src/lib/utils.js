/* eslint-disable max-params, no-sync */
const fs = require('fs')
const path = require('path')


/**
 * Create a reference object to relate to a sanity document either as a single reference or to an array by default.
 * @param {object} documentObject
 * @param {boolean} forArrayRef if this reference can have many, use the document type
 * @returns object
 */
 function createReferenceObject(documentObject, forArrayRef = true) {
  return {
    "_type": forArrayRef ? documentObject._type : 'reference',
    "_ref": documentObject._id,
  }
}

/**
 * 
 * @param {string} postType 
 * @param {string} id 
 * @param {string} separator 
 * @returns 
 */
function createDocumentId(postType, id, separator = '_') {
  return `${postType}${separator}${id}`
}

/**
 * Create a new document json file based the object and path given, or update it if requested.
 * @param {string} documentDirPath 
 * @param {string} documentFilePath 
 * @param {object} documentObject 
 * @param {boolean} forceUpdate
 * @returns boolean
 */
 function createDocumentFile(documentDirPath, documentFilePath, documentObject, forceUpdate = true) {
  if (!fs.existsSync(documentFilePath) || forceUpdate) {
    // first make sure each folder exisits
    if (!fs.existsSync(documentDirPath)) {
      fs.mkdirSync(documentDirPath)
    }

    fs.writeFileSync(documentFilePath, JSON.stringify(documentObject))

    return true
  }

  return false
}

/**
 * Walk a directory recursively and append each json file object to another file.
 * @param {string} fullPath 
 * @param {array} counter 
 * @returns void
 */
 function walkDirRecursively(fullPath, appendFile, counter = []) {
  // Our base case, 
  if (!fs.existsSync(fullPath)) {
    return
  }

  // make sure we're working with json files
  if (fs.lstatSync(fullPath).isFile() && path.extname(fullPath) === '.json') {
    // Read the file as a document json object
    const sanityDocumentBuffer = fs.readFileSync(fullPath)
    const sanityDocument = JSON.parse(sanityDocumentBuffer)

    process.stdout.write(`\r> Loading file ${counter.length}`)

    // Append each JSON object. Add a new line if it's not the first one.
    fs.appendFileSync(appendFile, (counter.length ? "\n" : "") + JSON.stringify(sanityDocument))

    // push the object to the counter
    counter.push(sanityDocument)
  }

  if (fs.lstatSync(fullPath).isDirectory()) {
    const pathItems = fs.readdirSync(fullPath)
    for (const item of pathItems) {
      walkDirRecursively(`${fullPath}/${item}`, appendFile, counter)
    }
  }
}

module.exports = {
  createReferenceObject,
  createDocumentFile,
  createDocumentId,
  walkDirRecursively
}