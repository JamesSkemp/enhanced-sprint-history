const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");

// Webpack entry points. Mapping from resulting bundle name to the source file entry.
const entries = {};

// Loop through subfolders in the "Samples" folder and add an entry for each one
const samplesDir = path.join(__dirname, "src");
fs.readdirSync(samplesDir).filter(dir => {
    if (fs.statSync(path.join(samplesDir, dir)).isDirectory()) {
        entries[dir] = "./" + path.relative(process.cwd(), path.join(samplesDir, dir, dir));
    }
});

module.exports = {
    entry: entries,
    output: {
        publicPath: "/dist/",
        filename: "[name]/[name].js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        alias: {
            "azure-devops-extension-sdk": path.resolve("node_modules/azure-devops-extension-sdk")
        },
    },
    stats: {
        warnings: false
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                test: /\.scss$/,
                use: ["style-loader", "css-loader", "azure-devops-ui/buildScripts/css-variables-loader", "sass-loader"]
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.html$/,
                loader: "asset/resource"
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/,
                type: 'asset/inline'
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
           patterns: [
               { from: "**/*.html", context: "src" }
           ]
        })
    ],
    devtool: "inline-source-map",
    devServer: {
        server: 'https',
        port: 3000,
        static: {
            serveIndex: true,
        },
        client: { overlay: { warnings: false } },
    }
};
