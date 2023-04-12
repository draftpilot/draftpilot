'use strict'

const singleFileMode = process.argv.length > 2

module.exports = {
  slow: 1000,
  recursive: true,
  spec: singleFileMode ? [] : ['./dist/test/**/*.test.js'],
}
