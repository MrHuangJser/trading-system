const { composePlugins, withNx } = require('@nx/rspack');
const rspack = require('@rspack/core');

module.exports = composePlugins(withNx(), (config) => {
  config.optimization = {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            keep_classnames: true,
            keep_fnames: true,
          },
          mangle: {
            keep_classnames: true,
            keep_fnames: true,
          },
        },
      }),
    ],
  };
  return config;
});
