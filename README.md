# Wordpress To Sanity Migration

⚠️ Not production code, still in development.

This is an evolved example of how to migrate content from a Wordpress website to [Sanity.io](https://www.sanity.io). Since each WordPress website can have custom post types alongside the stardard post types of `post` and `page`, your migration made require code adjustments to compensate for custom post types, etc. You document schema may also differ from the standard blog examples, so be sure to check that as well.

## Getting Started

1. `git clone` this repo.
2. Add your WordPress export xml file(s) to the `/exports` directory.
3. Copy `config.example.json` to `config.json` and set the allowed `postTypes` array.
4. Run `npm run migrate` to run the `/src/index.js` migration script.
5. Each post type will be parsed and each post will be added as a separate json file within the `/imports` directory.
6. A new line json file will be compiled from all the parsed post types and added to the `/imports` directory root named with the current datetime like `sanity-import-YYYY-MM-DD-HH-MM-SS.ndjson`.
7. Try to import the file with `sanity dataset import [your-sanity-import-file]` in your Sanity project folder.

## How It Works
For most blogs and simplier websites created with WordPress, this tool should cover a full migration including post categories and tags. For more advanced WordPress websites, like those that use custom post types or e-commerce plugins like WooCommerce, further customization and testing will be required


- This migration script in `/src/index.js` reads the wordpress export XML files you supplied in the `exports` directory. You can add more than one for each post type if need be, or just use the default WordPress export all. 
  - If you blog/website is not very large, then the single export file will serve you best since this will also include post image attachments by default.
  - Separate export files per post type are a more reliable approach when you have thousands of posts over multiple post types. You will need to use a plugin in WordPress in this case to also include the image attachments for each post type
- It parses the XML export file for post types of `attachment`, `post`, and `page`, which are the defaults set in `const allowedPostTypes` array read from `config.json`.
- Debugging deserialization (`parseBody.js`) is easier with the script in `/test`
- The exported WordPress posts are mapped to Sanity document schema types manually within the `/src/index.js` file. In the future this should be more configurable, but for now you will have to verify the schema matched your intended document schemas.
- The HTML is sanitized, but _most_ HTML tags are allowed (check `/lib/sanitizeHTML.js`)
  - This also includes compatibility with Portable Text.
- The mapped Sanity document files are created as separate json files, each within a directory organized by post type. The `nljson` import file is compiled from all the individual document files created, with soft linking for import compatibility.