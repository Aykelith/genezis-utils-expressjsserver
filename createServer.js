import GenezisChecker from "@genezis/genezis/Checker";
import deleteOnProduction from "@genezis/genezis/utils/deleteOnProduction";

import Express from "express";
import body_parser from "body-parser"; // for getting GETs/POSTs data
import session from "express-session";

const GenezisCheckerConfig = deleteOnProduction({
    viewEngine: GenezisChecker.string().required({ onlyIfAvailableOneOf: ["viewsPath"] }),
    viewsPath: GenezisChecker.string().required({ onlyIfAvailableOneOf: ["viewEngine"] }),
    staticPaths: GenezisChecker.array({ of: GenezisChecker.string() }),
    supportJSONRequest: GenezisChecker.object({
        shape: {
            limit: GenezisChecker.string()
        }
    }),
    supportGet: GenezisChecker.object({
        extented: GenezisChecker.boolean(),
        limit: GenezisChecker.string()
    }),
    trustProxy: GenezisChecker.boolean(),
    hmr: GenezisChecker.object({
        shape: {
            webpackConfigFilePath: GenezisChecker.string().required()
        }
    }),
    session: GenezisChecker.object({
        shape: {
            secret: GenezisChecker.string().required(),
            saveUninitialized: GenezisChecker.boolean(),
            resave: GenezisChecker.boolean(),
            cookie: GenezisChecker.object({
                shape: {
                    secure: GenezisChecker.boolean()
                }
            }),
            store: GenezisChecker.function()
        }
    }),
    port: GenezisChecker.integer({ convert: true }),
    plugins: GenezisChecker.array({
        of: GenezisChecker.function()
    })
});

/**
 * 
 */
export default async (settings) => {
    GenezisChecker(settings, GenezisCheckerConfig);

    const app = new Express(); // Initialize Express variable

    if (settings.viewEngine) {
        app.set("view engine", settings.viewEngine); // Setting up the view engine
        app.set("views", settings.viewsPath); // Setting up the views folder
    }

    if (settings.staticPaths) {
        settings.staticPaths.forEach(path => app.use(Express.static(path)));
    }

    if (settings.supportJSONRequest) {
        console.log("RRR", settings.supportJSONRequest);
        app.use(body_parser.json({ limit: settings.supportJSONRequest.limit }));
    }

    if (settings.supportGet) {
        app.use(body_parser.urlencoded({
            extended: settings.supportGet.extended,
            limit: settings.supportGet.limit
        }));
    }

    if (settings.trustProxy) app.enable("trust proxy");

    if (settings.session) {
        if (settings.session.store) settings.session.store = settings.session.store(session); 

        app.use(session(settings.session));
    }

    if (settings.hmr) {
        const webpack = require("webpack");
        const webpackConfig = require(settings.hmr.webpackConfigFilePath);
        const compiler = webpack(webpackConfig);

        app.use(require("webpack-dev-middleware")(compiler, {
            publicPath: webpackConfig.output.publicPath
        }));
        
        app.use(require("webpack-hot-middleware")(compiler, {
            log: console.log,
            path: "/__webpack_hmr", 
            heartbeat: 10 * 1000
        }));
    }

    if (settings.plugins) {
        await Promise.all(settings.plugins.map(plugin => plugin(app)));
    }

    if (!settings.onlySecure) {
        const http = require("http");

        const server = new http.Server(app); // Create a server through Express
        server.listen(settings.port, err => {
            if (err) {
                return console.error(err);
            }
            console.info(`Server running on http://localhost:${settings.port}`);
        });
    }

    if (settings.secureSettings) {
        const fs = require("fs");
        const https = require("https");

        const httpsOptions = {
            key: fs.readFileSync(settings.secureSettings.key),
            cert: fs.readFileSync(settings.secureSettings.cert)
        };

        const server = new https.Server(httpsOptions, app); // Create a server through Express
        server.listen(settings.secureSettings.port, err => {
            if (err) {
                return console.error(err);
            }
            console.info(`Server running on port ${settings.secureSettings.port}`);
        });
    }
    

    return app;
}
