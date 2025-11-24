const { metrics, metricsMiddleware, getCpuUsagePercentage, getMemoryUsagePercentage } = require('./metrics');
const EventEmitter = require('events');

beforeEach(() => {
    metrics.reset();
});

afterAll(() => {
    // ensure reset after tests
    metrics.reset();
});

test('middleware tracks requests, methods, and endpoint latencies', () => {
    const dateNowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    dateNowSpy.mockImplementation(() => now);

    const req = { method: 'POST', route: { path: '/test' }, path: '/test', user: { id: 'user1' } };
    const res = new EventEmitter();
    // Express res emits 'finish' when done
    res.on = res.addListener.bind(res);

    const next = jest.fn();
    metricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    // advance time and emit finish
    now = 1600;
    res.emit('finish');

    expect(metrics.metrics.totalRequests).toBe(1);
    expect(metrics.metrics.requestsByMethod.POST).toBe(1);
    expect(metrics.getActiveUserCount()).toBe(1);

    const key = 'POST /test';
    expect(metrics.metrics.endpointLatencies[key].length).toBe(1);
    expect(metrics.metrics.endpointLatencies[key][0].latency).toBe(600);

    dateNowSpy.mockRestore();
});

test('auth success and failure are recorded and counted per minute', () => {
    const dateNowSpy = jest.spyOn(Date, 'now');
    const base = 1_000_000;
    dateNowSpy.mockImplementation(() => base);

    metrics.recordAuthSuccess('alice');
    metrics.recordAuthFailure();

    // within a minute
    dateNowSpy.mockImplementation(() => base + 30_000);
    const perMinute = metrics.getAuthAttemptsPerMinute();
    expect(perMinute.successful).toBe(1);
    expect(perMinute.failed).toBe(1);
    expect(perMinute.total).toBe(2);
    expect(metrics.getActiveUserCount()).toBe(1);

    dateNowSpy.mockRestore();
});

test('pizza sales and revenue per minute are tracked', () => {
    const dateNowSpy = jest.spyOn(Date, 'now');
    const base = 2_000_000;
    dateNowSpy.mockImplementation(() => base);

    metrics.recordPizzaSale(9.99, 2); // two pizzas for $9.99
    metrics.recordPizzaSale(5.01, 1);

    dateNowSpy.mockImplementation(() => base + 10_000);
    expect(metrics.getPizzasSoldPerMinute()).toBe(3);
    expect(metrics.getPizzaRevenuePerMinute()).toBeCloseTo(9.99 + 5.01);

    dateNowSpy.mockRestore();
});

test('pizza creation latency averages are computed', () => {
    metrics.recordPizzaCreationLatency(100);
    metrics.recordPizzaCreationLatency(200);
    metrics.recordPizzaCreationLatency(300);

    const avg = metrics.getAveragePizzaCreationLatency();
    expect(avg).toBe((100 + 200 + 300) / 3);
});

test('endpoint latencies record and report averages, min, max, count', () => {
    metrics.recordEndpointLatency('/order', 'GET', 120);
    metrics.recordEndpointLatency('/order', 'GET', 80);
    metrics.recordEndpointLatency('/order', 'GET', 200);

    const avg = metrics.getAverageEndpointLatency('/order', 'GET');
    expect(avg).toBe((120 + 80 + 200) / 3);

    const all = metrics.getAllEndpointLatencies();
    const key = 'GET /order';
    expect(all[key]).toBeDefined();
    expect(all[key].count).toBe(3);
    expect(all[key].min).toBe(80);
    expect(all[key].max).toBe(200);
    expect(all[key].average).toBeCloseTo(avg);
});

test('system cpu and memory getters return finite numbers', () => {
    const cpu = getCpuUsagePercentage();
    const mem = getMemoryUsagePercentage();
    expect(typeof cpu).toBe('number');
    expect(Number.isFinite(cpu)).toBe(true);
    expect(typeof mem).toBe('number');
    expect(Number.isFinite(mem)).toBe(true);
});