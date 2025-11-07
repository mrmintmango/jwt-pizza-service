const os = require('os');
const config = require('./config.js');

class MetricsCollector {
  constructor() {
    this.metrics = {
      // HTTP request metrics
      totalRequests: 0,
      requestsByMethod: {
        GET: 0,
        PUT: 0,
        POST: 0,
        DELETE: 0,
      },
      requestDurations: [],
      
      // Active users (unique users in current session)
      activeUsers: new Set(),
      
      // Authentication metrics
      authAttempts: {
        successful: 0,
        failed: 0,
        lastMinuteSuccessful: [],
        lastMinuteFailed: [],
      },
      
      // Pizza metrics
      pizzasSold: 0,
      pizzasSoldLastMinute: [],
      pizzaCreationFailures: 0,
      pizzaRevenue: 0,
      pizzaRevenueLastMinute: [],
      
      // Latency tracking
      pizzaCreationLatencies: [],
      endpointLatencies: {},
    };
    
    // Clean up old minute-based metrics every 10 seconds
    setInterval(() => this.cleanupMinuteMetrics(), 10000);
  }

  // HTTP Request Metrics
  incrementTotalRequests() {
    this.metrics.totalRequests++;
  }

  incrementRequestByMethod(method) {
    const upperMethod = method.toUpperCase();
    if (this.metrics.requestsByMethod[upperMethod] !== undefined) {
      this.metrics.requestsByMethod[upperMethod]++;
    }
  }

  recordRequestDuration(duration) {
    this.metrics.requestDurations.push({
      duration,
      timestamp: Date.now(),
    });
    
    // Keep only last 1000 entries
    if (this.metrics.requestDurations.length > 1000) {
      this.metrics.requestDurations.shift();
    }
  }

  // Active Users
  addActiveUser(userId) {
    if (userId) {
      this.metrics.activeUsers.add(userId);
    }
  }

  removeActiveUser(userId) {
    if (userId) {
      this.metrics.activeUsers.delete(userId);
    }
  }

  getActiveUserCount() {
    return this.metrics.activeUsers.size;
  }

  // Authentication Metrics
  recordAuthSuccess(userId) {
    this.metrics.authAttempts.successful++;
    this.metrics.authAttempts.lastMinuteSuccessful.push(Date.now());
    this.addActiveUser(userId);
  }

  recordAuthFailure() {
    this.metrics.authAttempts.failed++;
    this.metrics.authAttempts.lastMinuteFailed.push(Date.now());
  }

  getAuthAttemptsPerMinute() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const successfulLastMinute = this.metrics.authAttempts.lastMinuteSuccessful.filter(
      timestamp => timestamp > oneMinuteAgo
    ).length;
    
    const failedLastMinute = this.metrics.authAttempts.lastMinuteFailed.filter(
      timestamp => timestamp > oneMinuteAgo
    ).length;
    
    return {
      successful: successfulLastMinute,
      failed: failedLastMinute,
      total: successfulLastMinute + failedLastMinute,
    };
  }

  // Pizza Metrics
  recordPizzaSale(orderTotal, pizzaCount = 1) {
    const now = Date.now();
    this.metrics.pizzasSold += pizzaCount;
    this.metrics.pizzasSoldLastMinute.push({ timestamp: now, count: pizzaCount });
    this.metrics.pizzaRevenue += orderTotal;
    this.metrics.pizzaRevenueLastMinute.push({ timestamp: now, revenue: orderTotal });
  }

  recordPizzaCreationFailure() {
    this.metrics.pizzaCreationFailures++;
  }

  getPizzasSoldPerMinute() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    return this.metrics.pizzasSoldLastMinute
      .filter(entry => entry.timestamp > oneMinuteAgo)
      .reduce((sum, entry) => sum + entry.count, 0);
  }

  getPizzaRevenuePerMinute() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    return this.metrics.pizzaRevenueLastMinute
      .filter(entry => entry.timestamp > oneMinuteAgo)
      .reduce((sum, entry) => sum + entry.revenue, 0);
  }

  // Latency Metrics
  recordPizzaCreationLatency(latency) {
    this.metrics.pizzaCreationLatencies.push({
      latency,
      timestamp: Date.now(),
    });
    
    // Keep only last 1000 entries
    if (this.metrics.pizzaCreationLatencies.length > 1000) {
      this.metrics.pizzaCreationLatencies.shift();
    }
  }

  recordEndpointLatency(endpoint, method, latency) {
    const key = `${method} ${endpoint}`;
    
    if (!this.metrics.endpointLatencies[key]) {
      this.metrics.endpointLatencies[key] = [];
    }
    
    this.metrics.endpointLatencies[key].push({
      latency,
      timestamp: Date.now(),
    });
    
    // Keep only last 100 entries per endpoint
    if (this.metrics.endpointLatencies[key].length > 100) {
      this.metrics.endpointLatencies[key].shift();
    }
  }

  // Calculate average latencies
  getAveragePizzaCreationLatency() {
    if (this.metrics.pizzaCreationLatencies.length === 0) return 0;
    
    const sum = this.metrics.pizzaCreationLatencies.reduce(
      (acc, entry) => acc + entry.latency,
      0
    );
    return sum / this.metrics.pizzaCreationLatencies.length;
  }

  getAverageEndpointLatency(endpoint, method) {
    const key = `${method} ${endpoint}`;
    const latencies = this.metrics.endpointLatencies[key];
    
    if (!latencies || latencies.length === 0) return 0;
    
    const sum = latencies.reduce((acc, entry) => acc + entry.latency, 0);
    return sum / latencies.length;
  }

  getAllEndpointLatencies() {
    const result = {};
    
    for (const [key, latencies] of Object.entries(this.metrics.endpointLatencies)) {
      if (latencies.length > 0) {
        const sum = latencies.reduce((acc, entry) => acc + entry.latency, 0);
        result[key] = {
          average: sum / latencies.length,
          count: latencies.length,
          min: Math.min(...latencies.map(e => e.latency)),
          max: Math.max(...latencies.map(e => e.latency)),
        };
      }
    }
    
    return result;
  }

  // Cleanup old minute-based metrics
  cleanupMinuteMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean auth attempts
    this.metrics.authAttempts.lastMinuteSuccessful = 
      this.metrics.authAttempts.lastMinuteSuccessful.filter(t => t > oneMinuteAgo);
    this.metrics.authAttempts.lastMinuteFailed = 
      this.metrics.authAttempts.lastMinuteFailed.filter(t => t > oneMinuteAgo);
    
    // Clean pizza sales
    this.metrics.pizzasSoldLastMinute = 
      this.metrics.pizzasSoldLastMinute.filter(e => e.timestamp > oneMinuteAgo);
    this.metrics.pizzaRevenueLastMinute = 
      this.metrics.pizzaRevenueLastMinute.filter(e => e.timestamp > oneMinuteAgo);
  }

  // System metrics
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return parseFloat((cpuUsage * 100).toFixed(2));
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return parseFloat(memoryUsage.toFixed(2));
  }

  // Get all metrics for reporting
  getAllMetrics() {
    return {
      http: {
        totalRequests: this.metrics.totalRequests,
        requestsByMethod: { ...this.metrics.requestsByMethod },
        averageRequestDuration: this.metrics.requestDurations.length > 0
          ? this.metrics.requestDurations.reduce((sum, e) => sum + e.duration, 0) / this.metrics.requestDurations.length
          : 0,
      },
      users: {
        activeUsers: this.getActiveUserCount(),
      },
      auth: {
        totalSuccessful: this.metrics.authAttempts.successful,
        totalFailed: this.metrics.authAttempts.failed,
        perMinute: this.getAuthAttemptsPerMinute(),
      },
      pizza: {
        totalSold: this.metrics.pizzasSold,
        soldPerMinute: this.getPizzasSoldPerMinute(),
        creationFailures: this.metrics.pizzaCreationFailures,
        totalRevenue: this.metrics.pizzaRevenue,
        revenuePerMinute: this.getPizzaRevenuePerMinute(),
        averageCreationLatency: this.getAveragePizzaCreationLatency(),
      },
      endpoints: this.getAllEndpointLatencies(),
      system: {
        cpuUsage: this.getCpuUsagePercentage(),
        memoryUsage: this.getMemoryUsagePercentage(),
      },
    };
  }

  // Reset all metrics (useful for testing)
  reset() {
    this.metrics = {
      totalRequests: 0,
      requestsByMethod: { GET: 0, PUT: 0, POST: 0, DELETE: 0 },
      requestDurations: [],
      activeUsers: new Set(),
      authAttempts: {
        successful: 0,
        failed: 0,
        lastMinuteSuccessful: [],
        lastMinuteFailed: [],
      },
      pizzasSold: 0,
      pizzasSoldLastMinute: [],
      pizzaCreationFailures: 0,
      pizzaRevenue: 0,
      pizzaRevenueLastMinute: [],
      pizzaCreationLatencies: [],
      endpointLatencies: {},
    };
  }
}

// Create singleton instance
const metrics = new MetricsCollector();

// Middleware to track HTTP requests
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Track request
  metrics.incrementTotalRequests();
  metrics.incrementRequestByMethod(req.method);
  
  // Track user if authenticated
  if (req.user && req.user.id) {
    metrics.addActiveUser(req.user.id);
  }
  
  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.recordRequestDuration(duration);
    
    // Record endpoint latency
    const endpoint = req.route ? req.route.path : req.path;
    metrics.recordEndpointLatency(endpoint, req.method, duration);
  });
  
  next();
}

// Helper function to create a metric in the correct format
function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes = {}) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

// Helper function to send metrics to Grafana Cloud
function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(config.metrics.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      'Content-Type': 'application/json' 
    },
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Failed to push metrics to Grafana: HTTP status ${response.status}`);
      } else {
        console.log(`✓ Successfully pushed ${metrics.length} metrics to Grafana`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

// Function to periodically send all metrics to Grafana
function pushMetricsToGrafana() {
  const allMetrics = metrics.getAllMetrics();
  const metricsList = [];
  
  // HTTP Metrics
  metricsList.push(createMetric('http_requests_total', allMetrics.http.totalRequests, 'requests', 'sum', 'asInt', {}));
  metricsList.push(createMetric('http_requests_get', allMetrics.http.requestsByMethod.GET, 'requests', 'sum', 'asInt', {}));
  metricsList.push(createMetric('http_requests_post', allMetrics.http.requestsByMethod.POST, 'requests', 'sum', 'asInt', {}));
  metricsList.push(createMetric('http_requests_put', allMetrics.http.requestsByMethod.PUT, 'requests', 'sum', 'asInt', {}));
  metricsList.push(createMetric('http_requests_delete', allMetrics.http.requestsByMethod.DELETE, 'requests', 'sum', 'asInt', {}));
  metricsList.push(createMetric('http_request_duration_avg', allMetrics.http.averageRequestDuration, 'ms', 'gauge', 'asDouble', {}));
  
  // User Metrics
  metricsList.push(createMetric('active_users', allMetrics.users.activeUsers, 'users', 'gauge', 'asInt', {}));
  
  // Auth Metrics
  metricsList.push(createMetric('auth_attempts_successful_total', allMetrics.auth.totalSuccessful, 'attempts', 'sum', 'asInt', {}));
  metricsList.push(createMetric('auth_attempts_failed_total', allMetrics.auth.totalFailed, 'attempts', 'sum', 'asInt', {}));
  metricsList.push(createMetric('auth_attempts_successful_per_minute', allMetrics.auth.perMinute.successful, 'attempts/min', 'gauge', 'asInt', {}));
  metricsList.push(createMetric('auth_attempts_failed_per_minute', allMetrics.auth.perMinute.failed, 'attempts/min', 'gauge', 'asInt', {}));
  
  // Pizza Metrics
  metricsList.push(createMetric('pizzas_sold_total', allMetrics.pizza.totalSold, 'pizzas', 'sum', 'asInt', {}));
  metricsList.push(createMetric('pizzas_sold_per_minute', allMetrics.pizza.soldPerMinute, 'pizzas/min', 'gauge', 'asInt', {}));
  metricsList.push(createMetric('pizza_creation_failures_total', allMetrics.pizza.creationFailures, 'failures', 'sum', 'asInt', {}));
  metricsList.push(createMetric('pizza_revenue_total', allMetrics.pizza.totalRevenue, 'dollars', 'sum', 'asDouble', {}));
  metricsList.push(createMetric('pizza_revenue_per_minute', allMetrics.pizza.revenuePerMinute, 'dollars/min', 'gauge', 'asDouble', {}));
  metricsList.push(createMetric('pizza_creation_latency_avg', allMetrics.pizza.averageCreationLatency, 'ms', 'gauge', 'asDouble', {}));
  
  // System Metrics
  metricsList.push(createMetric('system_cpu_usage', allMetrics.system.cpuUsage, 'percent', 'gauge', 'asDouble', {}));
  metricsList.push(createMetric('system_memory_usage', allMetrics.system.memoryUsage, 'percent', 'gauge', 'asDouble', {}));
  
  // Endpoint Latencies
  for (const [endpoint, stats] of Object.entries(allMetrics.endpoints)) {
    const sanitizedEndpoint = endpoint.replace(/[^a-zA-Z0-9_]/g, '_');
    metricsList.push(createMetric('endpoint_latency_avg', stats.average, 'ms', 'gauge', 'asDouble', { endpoint: sanitizedEndpoint }));
    metricsList.push(createMetric('endpoint_latency_min', stats.min, 'ms', 'gauge', 'asDouble', { endpoint: sanitizedEndpoint }));
    metricsList.push(createMetric('endpoint_latency_max', stats.max, 'ms', 'gauge', 'asDouble', { endpoint: sanitizedEndpoint }));
  }
  
  // Add test counter metric
  metricsList.push(createMetric('test_counter', Date.now() % 1000, '1', 'gauge', 'asInt', {}));
  
  // Send all metrics in one request
  sendMetricToGrafana(metricsList);
}

// Start periodic metric pushing (every 5 seconds)
function startMetricsPushing(intervalMs = 5000) {
  console.log(`📊 Starting metrics push to Grafana every ${intervalMs/1000}s`);
  setInterval(() => {
    pushMetricsToGrafana();
  }, intervalMs);
  
  // Push immediately on start
  pushMetricsToGrafana();
}

module.exports = {
  metrics,
  metricsMiddleware,
  getCpuUsagePercentage: () => metrics.getCpuUsagePercentage(),
  getMemoryUsagePercentage: () => metrics.getMemoryUsagePercentage(),
  sendMetricToGrafana,
  pushMetricsToGrafana,
  startMetricsPushing,
};