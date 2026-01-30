#!/usr/bin/env node

import { runInstaller } from './installer.js'

runInstaller().catch((err) => {
  console.error('Installation failed:', err.message)
  process.exit(1)
})
