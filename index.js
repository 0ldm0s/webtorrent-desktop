require('debug/browser')

var debug = require('debug')('index')
var electron = require('electron')
var path = require('path')

var app = electron.app

app.on('open-file', onOpen)
app.on('open-url', onOpen)

function onOpen (e, torrentId) {
  e.preventDefault()
  mainWindow.send('action', 'addTorrent', torrentId)
}

// report crashes
// require('crash-reporter').start({
//   productName: 'WebTorrent',
//   companyName: 'WebTorrent',
//   submitURL: 'https://webtorrent.io/crash-report',
//   autoSubmit: true
// })

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')()

// prevent windows from being garbage collected
var mainWindow // eslint-disable-line no-unused-vars

app.on('ready', function () {
  mainWindow = createMainWindow()

  var menu = electron.Menu.buildFromTemplate(template)
  electron.Menu.setApplicationMenu(menu)
})

app.on('activate', function () {
  if (mainWindow) {
    mainWindow.show()
  } else {
    mainWindow = createMainWindow()
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

var isQuitting = false
app.on('before-quit', function () {
  isQuitting = true
})

function createMainWindow () {
  var win = new electron.BrowserWindow({
    width: 600,
    height: 400,
    title: 'WebTorrent',
    // titleBarStyle: 'hidden',
    show: false
  })
  win.loadURL('file://' + path.join(__dirname, 'main', 'index.html'))
  win.webContents.on('did-finish-load', function () {
    win.show()
  })
  win.on('close', function (e) {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })
  win.once('closed', function () {
    mainWindow = null
  })
  return win
}

electron.ipcMain.on('action', function (event, action, ...args) {
  debug('action %s', action)
})

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
            mainWindow.send('action', 'seed', filenames)
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
              mainWindow.send('action', 'addTorrent', filename)
            })
          })
        }
      },
      {
        label: 'Open Torrent Address...',
        accelerator: 'CmdOrCtrl+U',
        click: function () { window.alert('TODO') }
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
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: function () {
          var torrentIds = electron.clipboard.readText().split('\n')
          torrentIds.forEach(function (torrentId) {
            mainWindow.send('action', 'addTorrent', torrentId)
          })
        }
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
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: function (item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload()
        }
      },
      {
        label: 'Toggle Full Screen',
        accelerator: (function () {
          if (process.platform === 'darwin') return 'Ctrl+Command+F'
          else return 'F11'
        })(),
        click: function (item, focusedWindow) {
          if (focusedWindow) focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
        }
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: (function () {
          if (process.platform === 'darwin') return 'Alt+Command+I'
          else return 'Ctrl+Shift+I'
        })(),
        click: function (item, focusedWindow) {
          if (focusedWindow) focusedWindow.toggleDevTools()
        }
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
      },
      {
        label: 'Zoom',
        click: function () {
          window.alert('TODO -- Darwin only')
        }
      }
    ]
  },
  {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'Report an Issue',
        click: function () { electron.shell.openExternal('https://github.com/feross/webtorrent-app/issues') }
      },
      {
        label: 'Go to GitHub project',
        click: function () { electron.shell.openExternal('https://github.com/feross/webtorrent-app') }
      },
      {
        type: 'separator'
      },
      {
        label: 'Learn more about WebTorrent',
        click: function () { electron.shell.openExternal('https://webtorrent.io') }
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
  template[3].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  )
}

// var progress = 0
// setInterval(function () {
//   progress += 0.1
//   mainWindow.setProgressBar(progress)
// }, 1000)
