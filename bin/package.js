#!/usr/bin/env node

/**
 * Builds app binaries for OS X, Linux, and Windows.
 */

var config = require('../config')
var cp = require('child_process')
var electronPackager = require('electron-packager')
var fs = require('fs')
var path = require('path')
var pkg = require('../package.json')
var plist = require('plist')

function build () {
  var platform = process.argv[2]
  if (platform === '--darwin') {
    buildDarwin()
  } else if (platform === '--win32') {
    buildWin32()
  } else if (platform === '--linux') {
    buildLinux()
  } else {
    buildDarwin(() => buildWin32(() => buildLinux())) // Build all
  }
}

var all = {
  // Build 64 bit binaries only.
  arch: 'x64',

  // The application source directory.
  dir: path.join(__dirname, '..'),

  // The release version of the application. Maps to the `ProductVersion` metadata
  // property on Windows, and `CFBundleShortVersionString` on OS X.
  'app-version': pkg.version,

  // Package the application's source code into an archive, using Electron's archive
  // format. Mitigates issues around long path names on Windows and slightly speeds up
  // require().
  asar: true,

  // A glob expression, that unpacks the files with matching names to the
  // "app.asar.unpacked" directory.
  'asar-unpack': 'WebTorrent*',

  // The build version of the application. Maps to the FileVersion metadata property on
  // Windows, and CFBundleVersion on OS X. We're using the short git hash (e.g. 'e7d837e')
  // Windows requires the build version to start with a number :/ so we stick on a prefix
  'build-version': '0-' + cp.execSync('git rev-parse --short HEAD').toString().replace('\n', ''),

  // Pattern which specifies which files to ignore when copying files to create the
  // package(s).
  ignore: /^\/dist|\/(appveyor.yml|AUTHORS|CONTRIBUTORS|bench|benchmark|benchmark\.js|bin|bower\.json|component\.json|coverage|doc|docs|docs\.mli|dragdrop\.min\.js|example|examples|example\.html|example\.js|externs|ipaddr\.min\.js|Makefile|min|minimist|perf|rusha|simplepeer\.min\.js|simplewebsocket\.min\.js|static\/screenshot\.png|test|tests|test\.js|tests\.js|webtorrent\.min\.js|\.[^\/]*|.*\.md|.*\.markdown)$/,

  // The application name.
  name: config.APP_NAME,

  // The base directory where the finished package(s) are created.
  out: path.join(__dirname, '..', 'dist'),

  // Replace an already existing output directory.
  overwrite: true,

  // Runs `npm prune --production` which remove the packages specified in
  // "devDependencies" before starting to package the app.
  prune: true,

  // The Electron version with which the app is built (without the leading 'v')
  version: pkg.devDependencies['electron-prebuilt']
}

var darwin = {
  platform: 'darwin',

  // The bundle identifier to use in the application's plist (OS X only).
  'app-bundle-id': 'io.webtorrent.app',

  // The application category type, as shown in the Finder via "View" -> "Arrange by
  // Application Category" when viewing the Applications directory (OS X only).
  'app-category-type': 'public.app-category.utilities',

  // The bundle identifier to use in the application helper's plist (OS X only).
  'helper-bundle-id': 'io.webtorrent.app.helper',

  // Application icon.
  icon: config.APP_ICON + '.icns'
}

var win32 = {
  platform: 'win32',

  // Object hash of application metadata to embed into the executable (Windows only)
  'version-string': {

    // Company that produced the file.
    CompanyName: config.APP_NAME,

    // Copyright notices that apply to the file.
    LegalCopyright: config.COPYRIGHT,

    // Name of the program, displayed to users
    FileDescription: config.APP_NAME,

    // Original name of the file, not including a path. This information enables an
    // application to determine whether a file has been renamed by a user. The format of
    // the name depends on the file system for which the file was created.
    OriginalFilename: 'WebTorrent.exe',

    // Name of the product with which the file is distributed.
    ProductName: config.APP_NAME,

    // Internal name of the file, if one exists, for example, a module name if the file
    // is a dynamic-link library. If the file has no internal name, this string should be
    // the original filename, without extension. This string is required.
    InternalName: config.APP_NAME
  },

  // Application icon.
  icon: config.APP_ICON + '.ico'
}

var linux = {
  platform: 'linux'

  // Note: Application icon for Linux is specified via the BrowserWindow `icon` option.
}

build()

function buildDarwin (cb) {
  electronPackager(Object.assign({}, all, darwin), function (err, appPath) {
    printDone(err, appPath)
    if (err) return cb(err)

    var contentsPath = path.join(
      __dirname,
      '..',
      'dist',
      `${config.APP_NAME}-darwin-x64`,
      `${config.APP_NAME}.app`,
      'Contents'
    )
    var resourcesPath = path.join(contentsPath, 'Resources')
    var infoPlistPath = path.join(contentsPath, 'Info.plist')
    var webTorrentFileIconPath = path.join(
      __dirname,
      '..',
      'static',
      'WebTorrentFile.icns'
    )
    var infoPlist = plist.parse(fs.readFileSync(infoPlistPath, 'utf8'))

    infoPlist.CFBundleDocumentTypes = [
      {
        CFBundleTypeExtensions: [ 'torrent' ],
        CFBundleTypeIconFile: path.basename(config.APP_FILE_ICON) + '.icns',
        CFBundleTypeName: 'BitTorrent Document',
        CFBundleTypeRole: 'Editor',
        LSHandlerRank: 'Owner',
        LSItemContentTypes: [ 'org.bittorrent.torrent' ]
      },
      {
        CFBundleTypeName: 'Any',
        CFBundleTypeOSTypes: [ '****' ],
        CFBundleTypeRole: 'Editor',
        LSHandlerRank: 'Owner',
        LSTypeIsPackage: false
      }
    ]

    infoPlist.CFBundleURLTypes = [
      {
        CFBundleTypeRole: 'Editor',
        CFBundleURLIconFile: path.basename(config.APP_FILE_ICON) + '.icns',
        CFBundleURLName: 'BitTorrent Magnet URL',
        CFBundleURLSchemes: [ 'magnet' ]
      }
    ]

    infoPlist.NSHumanReadableCopyright = config.COPYRIGHT

    fs.writeFileSync(infoPlistPath, plist.build(infoPlist))
    cp.execSync(`cp ${config.APP_FILE_ICON + '.icns'} ${resourcesPath}`)

    if (cb) cb(null)
  })
}

function buildWin32 (cb) {
  electronPackager(Object.assign({}, all, win32), function (err, appPath) {
    printDone(err, appPath)
    if (cb) cb(err)
  })
}

function buildLinux (cb) {
  electronPackager(Object.assign({}, all, linux), function (err, appPath) {
    printDone(err, appPath)
    if (cb) cb(err)
  })
}

function printDone (err, appPath) {
  if (err) console.error(err.message || err)
  else console.log('Built ' + appPath)
}
