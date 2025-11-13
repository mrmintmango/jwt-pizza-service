const config = require('./config.js');

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  dbLogger(query, params) {
    const logData = {
      query: query,
      params: params,
    };
    this.log('info', 'database', logData);
  }

  factoryLogger(requestBody, responseBody, statusCode) {
    const logData = {
      requestBody: JSON.stringify(requestBody),
      responseBody: JSON.stringify(responseBody),
      statusCode: statusCode,
    };
    const level = this.statusToLogLevel(statusCode);
    this.log(level, 'factory', logData);
  }

  exceptionLogger(error, context = {}) {
    const logData = {
      message: error.message,
      stack: error.stack,
      ...context,
    };
    this.log('error', 'exception', logData);
  }

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    // Sanitize passwords
    logData = logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
    logData = logData.replace(/"password":\s*"[^"]*"/g, '"password": "*****"');
    // Sanitize API keys
    logData = logData.replace(/\\"apiKey\\":\s*\\"[^"]*\\"/g, '\\"apiKey\\": \\"*****\\"');
    logData = logData.replace(/"apiKey":\s*"[^"]*"/g, '"apiKey": "*****"');
    // Sanitize authorization tokens
    logData = logData.replace(/\\"authorization\\":\s*\\"Bearer [^"]*\\"/g, '\\"authorization\\": \\"Bearer *****\\"');
    logData = logData.replace(/"authorization":\s*"Bearer [^"]*"/g, '"authorization": "Bearer *****"');
    logData = logData.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer *****');
    // Sanitize JWT tokens
    logData = logData.replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\": \\"*****\\"');
    logData = logData.replace(/"token":\s*"[^"]*"/g, '"token": "*****"');
    return logData;
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    }).catch((err) => {
      console.log('Error sending log to Grafana:', err.message);
    });
  }
}
module.exports = new Logger();