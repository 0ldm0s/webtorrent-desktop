module.exports = App

var h = require('virtual-dom/h')
var hyperx = require('hyperx')
var hx = hyperx(h)

var Header = require('./header')
var Player = require('./player')
var TorrentList = require('./torrent-list')
var Modals = {
  'open-torrent-address-modal': require('./open-torrent-address-modal')
}

function App (state, dispatch) {
  // Hide player controls while playing video, if the mouse stays still for a while
  // Never hide the controls when:
  // * The mouse is over the controls or we're scrubbing (see CSS)
  // * The video is paused
  // * The video is playing remotely on Chromecast or Airplay
  var hideControls = state.url === 'player' &&
    state.video.mouseStationarySince !== 0 &&
    new Date().getTime() - state.video.mouseStationarySince > 2000 &&
    !state.video.isPaused &&
    state.video.location === 'local'

  var cls = [
    'view-' + state.url, /* e.g. view-home, view-player */
    'is-' + process.platform /* e.g. is-darwin, is-win32, is-linux */
  ]

  if (state.window.isFullScreen) cls.push('is-fullscreen')
  if (state.window.isFocused) cls.push('is-focused')
  if (hideControls) cls.push('hide-video-controls')
  return hx`
    <div class='app ${cls.join(' ')}'>
      ${getHeader()}
      <div class='content'>${getView()}</div>
      ${getModal()}
    </div>
  `

  function getHeader () {
    var isOSX = process.platform === 'darwin'
    // Hide the header on Windows/Linux when in the player
    if (isOSX || state.url !== 'player') {
      return Header(state, dispatch)
    }
  }

  function getModal () {
    if (state.modal) {
      var contents = Modals[state.modal](state, dispatch)
      return hx`
        <div class='modal'>
          <div class='modal-background'></div>
          <div class='modal-content add-file-modal'>
            ${contents}
          </div>
        </div>
      `
    }
  }

  function getView () {
    if (state.url === 'home') {
      return TorrentList(state, dispatch)
    } else if (state.url === 'player') {
      return Player(state, dispatch)
    }
  }
}
