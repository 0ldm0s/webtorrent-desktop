module.exports = TorrentList

var h = require('virtual-dom/h')

function TorrentList (state, dispatch) {
  var list = state.torrents.map(function (torrent) {
    var style = {}
    if (torrent.posterURL) {
      style['background-image'] = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%), url("' + torrent.posterURL + '")'
    }
    return h('.torrent', {
      style: style
    }, [
      h('.metadata', [
        h('.name.ellipsis', torrent.name || 'Loading torrent...'),
        h('.status', [
          h('span.progress', Math.floor(100 * torrent.progress) + '%'),
          (function () {
            if (torrent.ready && torrent.files.length > 1) {
              return h('span.files', torrent.files.length + ' files')
            }
          })()
        ])
      ]),
      h('i.btn.icon.play', {
        className: !torrent.ready ? 'disabled' : '',
        onclick: openPlayer
      }, 'play_arrow'),
      (function () {
        if (state.chromecast) {
          return h('i.btn.icon.chromecast', {
            className: !torrent.ready ? 'disabled' : '',
            onclick: openChromecast
          }, 'cast')
        }
      })(),
      (function () {
        if (state.airplay) {
          return h('i.btn.icon.airplay', {
            className: !torrent.ready ? 'disabled' : '',
            onclick: openAirplay
          }, 'airplay')
        }
      })()
    ])

    function openPlayer () {
      dispatch('openPlayer', torrent)
    }

    function openChromecast () {
      dispatch('openChromecast', torrent)
    }

    function openAirplay () {
      dispatch('openAirplay', torrent)
    }
  })
  return h('.torrent-list', list)
}
