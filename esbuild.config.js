const esbuild = require('esbuild');

const buildConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outdir: 'dist',
  format: ['cjs', 'esm'],
  outExtension: { '.js': '.js', '.mjs': '.mjs' },
  sourcemap: true,
  minify: false,
  external: ['glpk.js'],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

// Development build
if (process.argv.includes('--dev')) {
  buildConfig.minify = false;
  buildConfig.sourcemap = true;
  buildConfig.define = {
    'process.env.NODE_ENV': '"development"'
  };
}

// Production build
if (process.argv.includes('--prod')) {
  buildConfig.minify = true;
  buildConfig.sourcemap = false;
}

esbuild.build(buildConfig).catch(() => process.exit(1));
