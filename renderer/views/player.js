module.exports = Player

var h = require('virtual-dom/h')
var hyperx = require('hyperx')
var hx = hyperx(h)

function Player (state, dispatch) {
  // Unfortunately, play/pause can't be done just by modifying HTML.
  // Instead, grab the DOM node and play/pause it if necessary
  var videoElement = document.querySelector('video')
  if (videoElement !== null) {
    if (state.temp.video.isPaused && !videoElement.paused) {
      videoElement.pause()
    } else if (!state.temp.video.isPaused && videoElement.paused) {
      videoElement.play()
    }
    // When the user clicks or drags on the progress bar, jump to that position
    if (state.temp.video.jumpToTime) {
      videoElement.currentTime = state.temp.video.jumpToTime
      state.temp.video.jumpToTime = null
    }
    state.temp.video.currentTime = videoElement.currentTime
    state.temp.video.duration = videoElement.duration
  }

  // Show the video as large as will fit in the window, play immediately
  return hx`
    <div class="player">
      <div class="letterbox">
        <video
          src="${state.temp.server.localURL}"
          onloadedmetadata=${onLoadedMetadata}
          autoplay="autoplay">
        </video>
      </div>
      ${renderPlayerControls(state, dispatch)}
    </div>
  `

  // As soon as the video loads far enough to know the dimensions, resize the
  // window to match the video resolution
  function onLoadedMetadata (e) {
    var video = e.target
    var dimensions = {
      width: video.videoWidth,
      height: video.videoHeight
    }
    dispatch('setDimensions', dimensions)
  }
}

// Renders all video controls: play/pause, scrub, loading bar
// TODO: cast buttons
function renderPlayerControls (state, dispatch) {
  var positionPercent = 100 * state.temp.video.currentTime / state.temp.video.duration
  var playbackCursorStyle = { left: 'calc(' + positionPercent + '% - 8px)' }
  var torrent = state.temp.torrentPlaying._torrent

  var elements = [
    hx`
      <div class="playback-bar">
        ${renderLoadingBar(state)}
        <div class="playback-cursor" style=${playbackCursorStyle}></div>
        <div class="scrub-bar"
          draggable="true"
          onclick=${handleScrub},
          ondrag=${handleScrub}></div>
      </div>
    `,
    hx`
      <i class="icon fullscreen"
        onclick=${() => dispatch('toggleFullScreen')}>
        fullscreen
      </i>
    `
  ]
  // If we've detected a Chromecast or AppleTV, the user can play video there
  if (state.temp.devices.chromecast) {
    elements.push(hx`
      <i.icon.chromecast
        onclick=${() => dispatch('openChromecast', torrent)}>
        cast
      </i>
    `)
  }
  if (state.temp.devices.airplay) {
    elements.push(hx`
      <i.icon.airplay
        onclick=${() => dispatch('openAirplay', torrent)}>
        airplay
      </i>
    `)
  }
  // On OSX, the back button is in the title bar of the window; see app.js
  // On other platforms, we render one over the video on mouseover
  if (process.platform !== 'darwin') {
    elements.push(hx`
      <i.icon.back
        onclick=${() => dispatch('back')}>
        chevron_left
      </i>
    `)
  }
  elements.push(hx`
    <i class="icon play-pause" onclick=${() => dispatch('playPause')}>
      ${state.temp.video.isPaused ? 'play_arrow' : 'pause'}
    </i>
  `)

  return hx`<div class="player-controls">${elements}</div>`

  // Handles a click or drag to scrub (jump to another position in the video)
  function handleScrub (e) {
    var windowWidth = document.querySelector('body').clientWidth
    var fraction = e.clientX / windowWidth
    var position = fraction * state.temp.video.duration /* seconds */
    dispatch('playbackJump', position)
  }
}

// Renders the loading bar. Shows which parts of the torrent are loaded, which
// can be "spongey" / non-contiguous
function renderLoadingBar (state) {
  var torrent = state.temp.torrentPlaying._torrent
  if (torrent === null) {
    return []
  }

  // Find all contiguous parts of the torrent which are loaded
  var parts = []
  var lastPartPresent = false
  var numParts = torrent.pieces.length
  for (var i = 0; i < numParts; i++) {
    var partPresent = torrent.bitfield.get(i)
    if (partPresent && !lastPartPresent) {
      parts.push({start: i, count: 1})
    } else if (partPresent) {
      parts[parts.length - 1].count++
    }
    lastPartPresent = partPresent
  }

  // Output an list of rectangles to show loading progress
  return hx`
    <div class="loading-bar">
      ${parts.map(function (part) {
        var style = {
          left: (100 * part.start / numParts) + '%',
          width: (100 * part.count / numParts) + '%'
        }

        return hx`<div class="loading-bar-part" style=${style}></div>`
      })}
    </div>
  `
}
