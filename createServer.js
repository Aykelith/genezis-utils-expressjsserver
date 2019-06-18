import GenezisChecker from "genezis/Checker";

import http from 'http';
import Express from 'express';
import body_parser from 'body-parser'; // for getting GETs/POSTs data   
import session from 'express-session';

/**
 * 
 */
export default async (settings) => {
    GenezisChecker(settings, {
        viewEngine: GenezisChecker.string().required({ onlyIfFieldsAreDeclared: ["viewsPath"] }),
        viewsPath: GenezisChecker.string().required({ onlyIfFieldsAreDeclared: ["viewEngine"] }),
        staticPaths: GenezisChecker.array({ of: GenezisChecker.string() }),
        supportJSONRequest: GenezisChecker.object({
            shape: {
                limit: GenezisChecker.string().default("100mb")
            }
        }),
        supportGet: GenezisChecker.object({
            extented: GenezisChecker.boolean().default(true),
            limit: GenezisChecker.string().default("100mb")
        }),
        trustProxy: GenezisChecker.boolean().default(false),
        hmr: GenezisChecker.object({
            shape: {
                webpackConfigFilePath: GenezisChecker.string().required()
            }
        }),
        session: GenezisChecker.object({
            shape: {
                secret: GenezisChecker.string().required(),
                saveUninitialized: GenezisChecker.boolean().default(false),
                resave: GenezisChecker.boolean().default(false),
                cookie: GenezisChecker.object({
                    shape: {
                        secure: GenezisChecker.boolean().default(true)
                    }
                }),
                store: GenezisChecker.object()
            }
        }),
        port: GenezisChecker.integer().default(process.env.NODE_PORT),
        plugins: GenezisChecker.array({
            of: GenezisChecker.function()
        })
    });

    const app = new Express(); // Initialize Express variable

    if (settings.viewEngine) {
        app.set('view engine', settings.viewEngine); // Setting up the view engine
        app.set('views', settings.viewsPath); // Setting up the views folder
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

    if (settings.trustProxy) app.enable('trust proxy');

    if (settings.session) {
        app.use(session(settings.session));
    }

    if (settings.hmr) {
        const webpack = require('webpack');
        const webpackConfig = require(settings.hmr.webpackConfigFilePath);
        const compiler = webpack(webpackConfig);

        app.use(require("webpack-dev-middleware")(compiler, {
            publicPath: webpackConfig.output.publicPath
        }));
        
        app.use(require("webpack-hot-middleware")(compiler, {
            log: console.log,
            path: '/__webpack_hmr', 
            heartbeat: 10 * 1000
        }));
    }

    if (settings.plugins) {
        await Promise.all(settings.plugins.map(plugin => plugin(app)));
    }

    const server = new http.Server(app); // Create a server through Express
    server.listen(settings.port, err => {
        if (err) {
            return console.error(err);
        }
        console.info(`Server running on http://localhost:${settings.port}`);
    });

    return app;
}