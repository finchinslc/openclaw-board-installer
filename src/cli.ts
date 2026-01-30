#!/usr/bin/env node

import { runInstaller } from './installer.js'
import { runManage } from './manage.js'

const command = process.argv[2]

if (!command || command === 'install') {
  runInstaller().catch((err) => {
    console.error('Installation failed:', err.message)
    process.exit(1)
  })
} else {
  runManage(command).catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
}
