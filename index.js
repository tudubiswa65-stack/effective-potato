/**
 * APIBridge AI
 * Intelligent API mismatch detector, transformer, and learner
 * 
 * Usage:
 *   const { bridge } = require('apiBridge')
 *   const api = bridge(axiosInstance)
 *   const data = await api.get('/users/1')
 *   // data is automatically transformed to camelCase
 */

const { APIBridgeTransformer } = require('./transformer');
const { exportMismatchCSV, exportSchemaSuggestions } = require('./exporter');

/**
 * Wrap an axios instance with APIBridge
 */
function bridge(axiosInstance, options = {}) {
  const transformer = new APIBridgeTransformer(options);

  // Intercept responses
  axiosInstance.interceptors.response.use(
    (response) => {
      if (response.data) {
        response.data = transformer.transform(
          response.data,
          options.schema || null,
          'toFrontend'
        );
      }
      return response;
    },
    (error) => Promise.reject(error)
  );

  // Intercept requests (SAVE direction)
  if (options.transformRequests !== false) {
    axiosInstance.interceptors.request.use(
      (config) => {
        if (config.data && typeof config.data === 'object') {
          config.data = transformer.transform(
            config.data,
            options.schema || null,
            'toBackend'
          );
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  // Attach bridge utilities to the instance
  axiosInstance.__bridge = transformer;
  axiosInstance.approve  = (src, tgt) => transformer.approve(src, tgt);
  axiosInstance.reject   = (src, wrong, correct) => transformer.reject(src, wrong, correct);
  axiosInstance.exportCSV = (path) => exportMismatchCSV(transformer.mismatches, path);
  axiosInstance.getStats  = () => transformer.getStats();
  axiosInstance.getPending = () => transformer.getPending();

  return axiosInstance;
}

/**
 * Wrap native fetch with APIBridge
 */
function bridgeFetch(options = {}) {
  const transformer = new APIBridgeTransformer(options);

  return {
    async get(url, config = {}) {
      const res  = await fetch(url, { method: 'GET', ...config });
      const data = await res.json();
      return transformer.transform(data, options.schema || null, 'toFrontend');
    },
    async post(url, body, config = {}) {
      const transformed = transformer.transform(body, options.schema || null, 'toBackend');
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...config.headers },
        body: JSON.stringify(transformed),
        ...config,
      });
      const data = await res.json();
      return transformer.transform(data, options.schema || null, 'toFrontend');
    },
    approve:    (src, tgt)              => transformer.approve(src, tgt),
    reject:     (src, wrong, correct)   => transformer.reject(src, wrong, correct),
    exportCSV:  (path)                  => exportMismatchCSV(transformer.mismatches, path),
    getStats:   ()                      => transformer.getStats(),
    getPending: ()                      => transformer.getPending(),
    __bridge:   transformer,
  };
}

/**
 * Use directly without HTTP client — just transform any object
 */
function transform(data, options = {}) {
  const transformer = new APIBridgeTransformer(options);
  return transformer.transform(data, options.schema || null, 'toFrontend');
}

module.exports = {
  bridge,
  bridgeFetch,
  transform,
  APIBridgeTransformer,
  exportMismatchCSV,
  exportSchemaSuggestions,
};
