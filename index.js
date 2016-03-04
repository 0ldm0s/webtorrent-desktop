var startTime = Date.now()

require('debug/browser')

var debug = require('debug')('index')
var electron = require('electron')
var path = require('path')

var app = electron.app
var mainWindow, menu

// report crashes
// require('crash-reporter').start({
//   productName: 'WebTorrent',
//   companyName: 'WebTorrent',
//   submitURL: 'https://webtorrent.io/crash-report',
//   autoSubmit: true
// })

app.on('open-file', onOpen)
app.on('open-url', onOpen)

app.on('ready', function () {
  createMainWindow()

  menu = electron.Menu.buildFromTemplate(getMenuTemplate())
  electron.Menu.setApplicationMenu(menu)
})

app.on('activate', function () {
  if (mainWindow) {
    mainWindow.show()
  } else {
    createMainWindow()
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

var isQuitting = false
app.on('before-quit', function () {
  isQuitting = true
})

electron.ipcMain.on('addTorrentFromPaste', function (e) {
  addTorrentFromPaste()
})

electron.ipcMain.on('setBounds', function (e, bounds) {
  setBounds(bounds)
})

electron.ipcMain.on('setAspectRatio', function (e, aspectRatio, extraSize) {
  setAspectRatio(aspectRatio, extraSize)
})

electron.ipcMain.on('setBadge', function (e, text) {
  setBadge(text)
})

electron.ipcMain.on('setProgress', function (e, progress) {
  setProgress(progress)
})

function createMainWindow () {
  mainWindow = new electron.BrowserWindow({
    backgroundColor: '#282828',
    darkTheme: true,
    minWidth: 375,
    minHeight: 158,
    show: false,
    title: 'WebTorrent',
    titleBarStyle: 'hidden-inset',
    width: 450,
    height: 300
  })
  mainWindow.loadURL('file://' + path.join(__dirname, 'main', 'index.html'))
  mainWindow.webContents.on('did-finish-load', function () {
    setTimeout(function () {
      debug('startup time: %sms', Date.now() - startTime)
      mainWindow.show()
    }, 50)
  })
  mainWindow.on('enter-full-screen', onToggleFullScreen)
  mainWindow.on('leave-full-screen', onToggleFullScreen)
  mainWindow.on('close', function (e) {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.once('closed', function () {
    mainWindow = null
  })
}

function onOpen (e, torrentId) {
  e.preventDefault()
  mainWindow.send('addTorrent', torrentId)
}

function addTorrentFromPaste () {
  debug('addTorrentFromPaste')
  var torrentIds = electron.clipboard.readText().split('\n')
  torrentIds.forEach(function (torrentId) {
    torrentId = torrentId.trim()
    if (torrentId.length === 0) return
    mainWindow.send('addTorrent', torrentId)
  })
}

function setBounds (bounds) {
  debug('setBounds %o', bounds)
  if (mainWindow) {
    mainWindow.setBounds(bounds, true)
  }
}

function setAspectRatio (aspectRatio, extraSize) {
  debug('setAspectRatio %o %o', aspectRatio, extraSize)
  if (mainWindow) {
    mainWindow.setAspectRatio(aspectRatio, extraSize)
  }
}

// Display string in dock badging area (OS X)
function setBadge (text) {
  debug('setBadge %s', text)
  app.dock.setBadge(String(text))
}

// Show progress bar. Valid range is [0, 1]. Remove when < 0; indeterminate when > 1.
function setProgress (progress) {
  debug('setProgress %s', progress)
  if (mainWindow) {
    mainWindow.setProgressBar(progress)
  }
}

function toggleFullScreen () {
  debug('toggleFullScreen')
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
    onToggleFullScreen()
  }
}

function onToggleFullScreen () {
  getMenuItem('Full Screen').checked = mainWindow.isFullScreen()
}

// Sets whether the window should always show on top of other windows
function toggleAlwaysOnTop () {
  debug('toggleAlwaysOnTop %s')
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop())
    getMenuItem('Float on Top').checked = mainWindow.isAlwaysOnTop()
  }
}

function toggleDevTools () {
  debug('toggleDevTools')
  if (mainWindow) {
    mainWindow.toggleDevTools()
  }
}

function reloadWindow () {
  debug('reloadWindow')
  if (mainWindow) {
    startTime = Date.now()
    mainWindow.webContents.reloadIgnoringCache()
  }
}

function getMenuTemplate () {
  var template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Create New Torrent...',
          accelerator: 'CmdOrCtrl+N',
          click: function () {
            electron.dialog.showOpenDialog({
              title: 'Select a file or folder for the torrent file.',
              properties: [ 'openFile', 'openDirectory', 'multiSelections' ]
            }, function (filenames) {
              if (!Array.isArray(filenames)) return
              mainWindow.send('seed', filenames)
            })
          }
        },
        {
          label: 'Open Torrent File...',
          accelerator: 'CmdOrCtrl+O',
          click: function () {
            electron.dialog.showOpenDialog(mainWindow, {
              title: 'Select a .torrent file to open.',
              properties: [ 'openFile', 'multiSelections' ]
            }, function (filenames) {
              if (!Array.isArray(filenames)) return
              filenames.forEach(function (filename) {
                mainWindow.send('addTorrent', filename)
              })
            })
          }
        },
        {
          label: 'Open Torrent Address...',
          accelerator: 'CmdOrCtrl+U',
          click: function () { electron.dialog.showMessageBox({ message: 'TODO', buttons: ['OK'] }) }
        },
        {
          type: 'separator'
        },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste Torrent Address',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Full Screen',
          type: 'checkbox',
          accelerator: (function () {
            if (process.platform === 'darwin') return 'Ctrl+Command+F'
            else return 'F11'
          })(),
          click: toggleFullScreen
        },
        {
          label: 'Float on Top',
          type: 'checkbox',
          click: toggleAlwaysOnTop
        },
        {
          type: 'separator'
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: reloadWindow
        },
        {
          label: 'Developer Tools',
          accelerator: (function () {
            if (process.platform === 'darwin') return 'Alt+Command+I'
            else return 'Ctrl+Shift+I'
          })(),
          click: toggleDevTools
        }
      ]
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        }
      ]
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Learn more about WebTorrent',
          click: function () { electron.shell.openExternal('https://webtorrent.io') }
        },
        {
          label: 'Contribute on GitHub',
          click: function () { electron.shell.openExternal('https://github.com/feross/webtorrent-app') }
        },
        {
          type: 'separator'
        },
        {
          label: 'Report an Issue...',
          click: function () { electron.shell.openExternal('https://github.com/feross/webtorrent-app/issues') }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    var name = app.getName()
    template.unshift({
      label: name,
      submenu: [
        {
          label: 'About ' + name,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide ' + name,
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Alt+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function () { app.quit() }
        }
      ]
    })

    // Window menu
    template[4].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    )
  }

  return template
}

function getMenuItem (label) {
  for (var i = 0; i < menu.items.length; i++) {
    var menuItem = menu.items[i].submenu.items.find(function (item) {
      return item.label === label
    })
    if (menuItem) return menuItem
  }
}
