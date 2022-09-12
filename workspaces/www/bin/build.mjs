import 'dotenv/config'
import esbuild from 'esbuild'
import envFilePlugin from 'esbuild-envfile-plugin'
import fs from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http-server'
import { execSync } from 'child_process'
import { getWorkflowId } from 'data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const libDir = resolve(__dirname, '../lib')
const buildDir = resolve(__dirname, '../build')

const copy = (f) => fs.copyFileSync(join(libDir, f), join(buildDir, f))

const sha = () => execSync('git rev-parse HEAD').toString().trim()

const { dev, prod } = process.argv.slice(2).reduce((acc, k) => {
  acc[k.slice(2)] = true
  return acc
}, {})

const plugins = {
  env: envFilePlugin.setup,
  server: (b) => {
    if (!dev) {
      return
    }
    const s = createServer({
      root: buildDir,
      cache: -1,
    })
    const ready = new Promise(res => s.listen(8080, () => {
      console.log('Listening on http://localhost:8080')
      res()
    }))
    b.onStart(() => ready)
  },
  clean: (b) => {
    b.onStart(async () => {
      await fs.promises.rm(buildDir, { recursive: true, force: true })
      await fs.promises.mkdir(buildDir, { recursive: true })
    })
  },
  html: (build) => {
    build.onEnd((a) => {
      copy('index.html')
    })
  },
}

const config = {
  entryPoints: [
    join(libDir, 'index.css'),
    join(libDir, 'index.js'),
  ],
  outdir: buildDir,
  loader: {
    '.woff': 'file',
    '.woff2': 'file',
    '.json': 'file',
  },
  metafile: true,
  bundle: true,
  minify: prod,
  ...(dev && {
    sourcemap: true,
    watch: {
      onRebuild: (err) => !err && console.log('Rebuilt'),
    },
  }),
  define: {
    'process.env.PROJECT_REPOSITORY': JSON.stringify(process.env.PROJECT_REPOSITORY),
    'process.env.SITE_NAME': JSON.stringify(process.env.SITE_NAME),
    'process.env.SITE_URL': JSON.stringify(process.env.SITE_URL),
    'process.env.BUILD_CONTEXT': JSON.stringify({
      sha: sha(),
      date: new Date(),
      id: getWorkflowId(),
    }),
  },
  plugins: Object.entries(plugins).map(([name, setup]) => ({ name, setup })),
}

await esbuild.build(config)
  .then(({ metafile }) => Object.keys(metafile.outputs).join('\n'))
  .then(console.log)
  .catch((err) => {
    process.exitCode = 1
    console.error(err)
  })
