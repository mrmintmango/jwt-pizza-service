const express = require('express');
const { authRouter, setAuthUser } = require('./routes/authRouter.js');
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const userRouter = require('./routes/userRouter.js');
const version = require('./version.json');
const config = require('./config.js');
const { metricsMiddleware, startMetricsPushing, metrics } = require('./metrics.js');
const logger = require('./logger.js');

const app = express();
app.use(express.json());
app.use(setAuthUser);
app.use(logger.httpLogger);
app.use(metricsMiddleware);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

const apiRouter = express.Router();
app.use('/api', apiRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/user', userRouter);
apiRouter.use('/order', orderRouter);
apiRouter.use('/franchise', franchiseRouter);

apiRouter.use('/docs', (req, res) => {
  res.json({
    version: version.version,
    endpoints: [...authRouter.docs, ...userRouter.docs, ...orderRouter.docs, ...franchiseRouter.docs],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

apiRouter.get('/metrics', (req, res) => {
  res.json(metrics.getAllMetrics());
});

app.get('/', (req, res) => {
  res.json({
    message: 'welcome to JWT Pizza',
    version: version.version,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    message: 'unknown endpoint',
  });
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
  logger.exceptionLogger(err, {
    path: req.originalUrl,
    method: req.method,
    body: req.body,
  });
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
  next();
});

// Use metrics middleware
app.use(metricsMiddleware);

// Start pushing metrics to Grafana every 30 seconds
if (process.env.NODE_ENV !== 'test') {
  startMetricsPushing(30000); // Push every 30 seconds
}

module.exports = app;
