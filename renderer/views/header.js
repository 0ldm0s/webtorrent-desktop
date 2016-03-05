module.exports = Header

var h = require('virtual-dom/h')
var hyperx = require('hyperx')
var hx = hyperx(h)

function Header (state, dispatch) {
  return hx`
    <div className="header">
      ${getTitle()}
      <div className="nav left">
        <i className="icon back" onclick=${onBack}>chevron_left</i>
        <i className="icon forward" onclick=${onForward}>chevron_right</i>
      </div>
      <div className="nav right">
        ${plusButton()}
      </div>
    </div>
  `

  function getTitle () {
    if (process.platform === 'darwin') {
      return hx`<div className="title">${state.view.title}</div>`
    }
  }

  function plusButton () {
    if (state.view.url !== '/player') {
      return hx`<i className="icon add" onclick=${onAddTorrent}>add</i>`
    }
  }

  function onBack (e) {
    dispatch('back')
  }

  function onForward (e) {
    dispatch('forward')
  }

  function onAddTorrent (e) {
    var torrentId = 'magnet:?xt=urn:btih:6a9759bffd5c0af65319979fb7832189f4f3c35d&dn=sintel.mp4'
    dispatch('addTorrent', torrentId)
  }
}
