import esbuild from 'esbuild'
import fs from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http-server'

const __dirname = dirname(fileURLToPath(import.meta.url))
const libDir = resolve(__dirname, '../lib')
const buildDir = resolve(__dirname, '../build')

const copy = (f) => fs.copyFileSync(join(libDir, f), join(buildDir, f))

const { dev, prod } = process.argv.slice(2).reduce((acc, k) => {
  acc[k.slice(2)] = true
  return acc
}, {})

const plugins = {
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
  entryPoints: [join(libDir, 'index.js')],
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
  plugins: Object.entries(plugins).map(([name, setup]) => ({ name, setup })),
}

await esbuild.build(config)
  .then(({ metafile }) => Object.keys(metafile.outputs).join('\n'))
  .then(console.log)
  .catch((err) => {
    process.exitCode = 1
    console.error(err)
  })
