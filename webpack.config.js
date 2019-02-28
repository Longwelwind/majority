const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = (env, options) => {
    const PRODUCTION = options.mode === 'production';

    return {
        entry: './src/client/index.tsx',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/
                },
                {
                    use: ExtractTextPlugin.extract({
                        use: ['css-loader', 'less-loader']
                    }),
                    test: /\.less$/

                },
                {
                    test: /\.jpe?g$|\.gif$|\.ico$|\.png$|\.svg$/,
                    use: 'file-loader?name=[name].[ext]?[hash]'
                },
                {
                    test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                    loader: 'url-loader?limit=10000&mimetype=application/font-woff'
                },

                {
                    test: /\.(ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                    loader: 'file-loader'
                },

                {
                    test: /\.otf(\?.*)?$/,
                    use: 'file-loader?name=/fonts/[name].  [ext]&mimetype=application/font-otf'
                }
            ]
        },
        plugins: [
            new ExtractTextPlugin({
                filename: '[name].css',
            }),
        ],
        resolve: {
            extensions: [ '.tsx', '.ts', '.js' ],
            alias: {
                '../../theme.config$': path.join(__dirname, 'darkly-theme/theme.config')
            }
        },
        output: {
            filename: 'bundle.js',
                path: path.resolve(__dirname, 'dist')
        }
    };
};
