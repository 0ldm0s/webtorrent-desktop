/* global URL, Blob */

// var prettyBytes = require('pretty-bytes')
var airplay = require('airplay-js')
var chromecasts = require('chromecasts')()
var createTorrent = require('create-torrent')
var dragDrop = require('drag-drop')
var electron = require('electron')
var networkAddress = require('network-address')
var path = require('path')
var throttle = require('throttleit')
var thunky = require('thunky')
var torrentPoster = require('./lib/torrent-poster')
var WebTorrent = require('webtorrent')
var xhr = require('xhr')

var createElement = require('virtual-dom/create-element')
var diff = require('virtual-dom/diff')
var patch = require('virtual-dom/patch')

var HEADER_HEIGHT = 38

var App = require('./views/app')

global.WEBTORRENT_ANNOUNCE = createTorrent.announceList
  .map(function (arr) {
    return arr[0]
  })
  .filter(function (url) {
    return url.indexOf('wss://') === 0 || url.indexOf('ws://') === 0
  })

var state = global.state = {
  torrents: [],
  server: null,
  player: null,
  currentPage: {
    type: 'list'
  },
  view: {
    title: 'WebTorrent',
    savedWindowBounds: null,
    history: [],
    historyIndex: 0,
    chromecast: null,
    airplay: null
  }
}

var currentVDom, rootElement, getClient, updateThrottled

function init () {
  currentVDom = App(state, dispatch)
  rootElement = createElement(currentVDom)
  document.body.appendChild(rootElement)

  updateThrottled = throttle(update, 250)

  getClient = thunky(function (cb) {
    getRtcConfig('https://instant.io/rtcConfig', function (err, rtcConfig) {
      if (err) console.error(err)
      var client = global.client = new WebTorrent({ rtcConfig: rtcConfig })
      state.torrents = client.torrents // internal webtorrent array -- do not modify!
      client.on('warning', onWarning)
      client.on('error', onError)
      cb(null, client)
    })
  })

  // For performance, create the client immediately
  getClient(function () {})

  dragDrop('body', onFiles)

  chromecasts.on('update', function (player) {
    state.view.chromecast = player
    update()
  })

  airplay.createBrowser().on('deviceOn', function (player) {
    state.view.airplay = player
  }).start()

  document.addEventListener('paste', function () {
    electron.ipcRenderer.send('addTorrentFromPaste')
  })
}
init()

function update () {
  var newVDom = App(state, dispatch)
  var patches = diff(currentVDom, newVDom)
  rootElement = patch(rootElement, patches)
  currentVDom = newVDom
}

function dispatch (action, ...args) {
  console.log('dispatch: %s %o', action, args)
  if (action === 'addTorrent') {
    addTorrent(args[0] /* torrentId */)
  }
  if (action === 'seed') {
    seed(args[0] /* files */)
  }
  if (action === 'openPlayer') {
    openPlayer(args[0] /* torrent */)
  }
  // if (action === 'closePlayer') {
  //   closePlayer()
  // }
  if (action === 'openChromecast') {
    openChromecast(args[0] /* torrent */)
  }
  if (action === 'openAirplay') {
    openAirplay(args[0] /* torrent */)
  }
  if (action === 'setDimensions') {
    setDimensions(args[0] /* dimensions */)
  }
  if (action === 'back') {
    if (state.player === 'local') {
      restoreBounds()
      closePlayer()
    }
  }
}

electron.ipcRenderer.on('addTorrent', function (e, torrentId) {
  addTorrent(torrentId)
})

electron.ipcRenderer.on('seed', function (e, files) {
  seed(files)
})

function onFiles (files) {
  // .torrent file = start downloading the torrent
  files.filter(isTorrentFile).forEach(function (torrentFile) {
    dispatch('addTorrent', torrentFile)
  })

  // everything else = seed these files
  dispatch('seed', files.filter(isNotTorrentFile))
}

function isTorrentFile (file) {
  var extname = path.extname(file.name).toLowerCase()
  return extname === '.torrent'
}

function isNotTorrentFile (file) {
  return !isTorrentFile(file)
}

function getRtcConfig (url, cb) {
  xhr(url, function (err, res) {
    if (err || res.statusCode !== 200) {
      cb(new Error('Could not get WebRTC config from server. Using default (without TURN).'))
    } else {
      var rtcConfig
      try { rtcConfig = JSON.parse(res.body) } catch (err) {}
      if (rtcConfig) {
        console.log('got rtc config: %o', rtcConfig)
        cb(null, rtcConfig)
      } else {
        cb(new Error('Got invalid WebRTC config from server: ' + res.body))
      }
    }
  })
}

function addTorrent (torrentId) {
  getClient(function (err, client) {
    if (err) return onError(err)
    var torrent = client.add(torrentId)
    addTorrentEvents(torrent)
  })
}

function seed (files) {
  if (files.length === 0) return

  // Seed from WebTorrent
  getClient(function (err, client) {
    if (err) return onError(err)
    var torrent = client.seed(files)
    addTorrentEvents(torrent)
  })
}

function addTorrentEvents (torrent) {
  torrent.on('infoHash', update)
  torrent.on('done', update)
  torrent.on('download', updateThrottled)
  torrent.on('upload', updateThrottled)
  torrent.on('ready', function () {
    torrentReady(torrent)
  })
  update()
}

function torrentReady (torrent) {
  torrentPoster(torrent, function (err, buf) {
    if (err) return onError(err)
    torrent.posterURL = URL.createObjectURL(new Blob([ buf ], { type: 'image/png' }))
    update()
  })
  update()
}

function startServer (torrent, cb) {
  // use largest file
  var index = torrent.files.indexOf(torrent.files.reduce(function (a, b) {
    return a.length > b.length ? a : b
  }))

  var server = torrent.createServer()
  server.listen(0, function () {
    var port = server.address().port
    var urlSuffix = ':' + port + '/' + index
    state.server = {
      server: server,
      localURL: 'http://localhost' + urlSuffix,
      networkURL: 'http://' + networkAddress() + urlSuffix
    }
    cb()
  })
}

function closeServer () {
  state.server.server.destroy()
  state.server = null
}

function openPlayer (torrent) {
  startServer(torrent, function () {
    state.player = 'local'
    update()
  })
}

function closePlayer () {
  closeServer()
  state.player = null
  update()
}

function openChromecast (torrent) {
  startServer(torrent, function () {
    state.view.chromecast.play(state.server.networkURL, { title: 'WebTorrent — ' + torrent.name })
    state.view.chromecast.on('error', function (err) {
      err.message = 'Chromecast: ' + err.message
      onError(err)
    })
    state.player = 'chromecast'
    update()
  })
}

function openAirplay (torrent) {
  startServer(torrent, function () {
    state.view.airplay.play(state.server.networkURL, 0, function () {})
    // TODO: handle airplay errors
    state.player = 'airplay'
    update()
  })
}

function setDimensions (dimensions) {
  state.view.savedWindowBounds = electron.remote.getCurrentWindow().getBounds()

  // Limit window size to screen size
  var workAreaSize = electron.remote.screen.getPrimaryDisplay().workAreaSize
  var width = Math.min(dimensions.width, workAreaSize.width)
  var height = Math.min(dimensions.height, workAreaSize.height)
  var aspectRatio = width / height

  // add header height
  height += HEADER_HEIGHT

  // Center window on screen
  var x = Math.floor((workAreaSize.width - width) / 2)
  var y = Math.floor((workAreaSize.height - height) / 2)

  electron.ipcRenderer.send('setAspectRatio', aspectRatio, { width: 0, height: HEADER_HEIGHT })
  electron.ipcRenderer.send('setBounds', { x, y, width, height })
}

function restoreBounds () {
  electron.ipcRenderer.send('setAspectRatio', 0)
  electron.ipcRenderer.send('setBounds', state.view.savedWindowBounds, true)
}

// function onTorrent (torrent) {
  // function updateSpeed () {
  //   var progress = (100 * torrent.progress).toFixed(1)
  //   util.updateSpeed(
  //     '<b>Peers:</b> ' + torrent.swarm.wires.length + ' ' +
  //     '<b>Progress:</b> ' + progress + '% ' +
  //     '<b>Download speed:</b> ' + prettyBytes(window.client.downloadSpeed) + '/s ' +
  //     '<b>Upload speed:</b> ' + prettyBytes(window.client.uploadSpeed) + '/s'
  //   )
  // }

  // setInterval(updateSpeed, 5000)
  // updateSpeed()
// }

function onError (err) {
  console.error(err.stack)
  window.alert(err.message || err)
  update()
}

function onWarning (err) {
  console.log('warning: %s', err.message)
}

// Seed via upload input element
// var uploadElement = require('upload-element')
// var upload = document.querySelector('input[name=upload]')
// uploadElement(upload, function (err, files) {
//   if (err) return onError(err)
//   files = files.map(function (file) { return file.file })
//   onFiles(files)
// })

// Download via input element
// document.querySelector('form').addEventListener('submit', function (e) {
//   e.preventDefault()
//   addTorrent(document.querySelector('form input[name=torrentId]').value.trim())
// })
