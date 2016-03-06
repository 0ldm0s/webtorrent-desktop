module.exports = TorrentList

var h = require('virtual-dom/h')
var hyperx = require('hyperx')
var hx = hyperx(h)
var prettyBytes = require('pretty-bytes')

function TorrentList (state, dispatch) {
  var list = state.client.torrents.map((torrent) => renderTorrent(torrent, dispatch))
  return hx`<div class="torrent-list">${list}</div>`
}

// Renders a torrent in the torrent list
// Includes name, download status, play button, background image
// May be expanded for additional info, including the list of files inside
function renderTorrent (torrent, dispatch) {
  // Background image: show some nice visuals, like a frame from the movie, if possible
  var style = {}
  if (torrent.posterURL) {
    style['background-image'] = `linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%), url("${torrent.posterURL}")`
  }

  // Foreground: name of the torrent, basic info like size, play button,
  // cast buttons if available, and delete
  var elements = [
    renderTorrentMetadata(torrent),
    hx`
      <i
        class="icon delete"
        onclick=${() => dispatch('deleteTorrent', torrent)}>
        close
      </i>
    `,
    hx`
      <i.btn.icon.play
        class="${!torrent.ready ? 'disabled' : ''}"
        onclick=${() => dispatch('openPlayer', torrent)}>
        play_arrow
      </i>
    `
  ]

  return hx`<div class="torrent" style=${style}>${elements}</div>`
}

// Renders the torrent name and download progress
function renderTorrentMetadata (torrent) {
  var progress = Math.floor(100 * (torrent.progress || 0))
  var downloaded = prettyBytes(torrent.downloaded || 0)
  var total = prettyBytes(torrent.length || 0)

  if (downloaded !== total) downloaded += ` / ${total}`

  return hx`
    <div class="metadata">
      <div class="name ellipsis">${torrent.name || 'Loading torrent...'}</div>
      <div class="status">
        <span class="progress">${progress}%</span>
        <span>${downloaded}</span>
      </div>
      ${getFilesLength()}
      <span>${getPeers()}</span>
      <span>↓ ${prettyBytes(torrent.downloadSpeed || 0)}/s</span>
      <span>↑ ${prettyBytes(torrent.uploadSpeed || 0)}/s</span>
    </div>
  `

  function getPeers () {
    var count = torrent.numPeers === 1 ? 'peer' : 'peers'
    return `${torrent.numPeers} ${count}`
  }

  function getFilesLength () {
    if (torrent.ready && torrent.files.length > 1) {
      return hx`<span class="files">${torrent.files.length} files</span>`
    }
  }
}
