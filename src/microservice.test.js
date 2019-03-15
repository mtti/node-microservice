/*
Copyright 2018-2019 Matti Hiltunen

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const fs = require('fs');
const Microservice = require('./microservice');

jest.mock('fs');

describe('Microservice', () => {
  let service;

  beforeEach(() => {
    service = new Microservice('test-service');
  });

  describe('use()', () => {
    // TODO
  });

  describe('config()', () => {
    describe('called with a function', () => {
      let callback;

      beforeEach(() => {
        callback = jest.fn();
        service.config(callback);
      });

      test('has exactly one configurator', () => {
        expect(service._configurationCallbacks.length).toBe(1);
      });

      test('added callback as configurator', () => {
        expect(service._configurationCallbacks[0]).toBe(callback);
      });

      test('callback was not called', () => {
        expect(callback.mock.calls.length).toBe(0);
      });
    });

    describe('called with a key and value', () => {
      beforeEach(() => {
        service.config('someKey', 'someValue');
      });

      test('there is exactly one configurator', () => {
        expect(service._configurationCallbacks.length).toBe(1);
      });
    });

    describe('called with a file path', () => {
      // TODO
    });

    describe('called with an object', () => {
      beforeEach(() => {
        service.config({
          firstKey: 'firstValue',
          secondKey: 'secondValue',
        });
      });

      test('there is exactly one configurator', () => {
        expect(service._configurationCallbacks.length).toBe(1);
      });
    });
  });

  describe('init()', () => {
    describe('called with a function', () => {
      let callback;

      beforeEach(() => {
        callback = jest.fn();
        service.init(callback);
      });

      test('has one initialization callback', () => {
        expect(service._initializationCallbacks.length).toBe(1);
      });

      test('added the callback', () => {
        expect(service._initializationCallbacks[0]).toBe(callback);
      });

      test('callback was not called', () => {
        expect(callback.mock.calls.length).toBe(0);
      });
    });
  });

  describe('start()', () => {
    // TODO
  });

  describe('_createFileConfigurator() result', () => {
    const baseConfig = {
      firstKey: 'oldFirstValue',
      secondKey: 'oldSecondValue',
    };

    const configJson = {
      firstKey: 'newFirstValue',
      thirdKey: 'newThirdValue',
    };

    let result;
    let error;

    beforeEach(() => {
      result = null;
      error = null;
      fs.readFileSync.mockReturnValue(JSON.stringify(configJson));
    });

    afterEach(() => {
      fs.readFileSync.mockReset();
    });

    describe('called with path to non-JSON file', () => {
      beforeEach(async () => {
        error = null;
        const cb = service._createFileConfigurator('/path/to/some.txt');
        try {
          result = await cb(baseConfig);
        } catch (err) {
          error = err;
        }
      });

      it('does not call fs.readFileSync', () => {
        expect(fs.readFileSync.mock.calls.length).toBe(0);
      });

      it('throws an exception', () => {
        expect(error).toBeTruthy();
      });
    });

    describe('called with path to JSON file', () => {
      beforeEach(async () => {
        const cb = service._createFileConfigurator('/path/to/config.json');
        result = await cb(baseConfig);
      });

      it('calls fs.readFileSync with file path', () => {
        expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/config.json');
      });

      it('returns new object', () => {
        expect(result).not.toBe(baseConfig);
      });

      it('firstKey has been overridden', () => {
        expect(result.firstKey).toBe('newFirstValue');
      });

      it('secondKey has not been overridden', () => {
        expect(result.secondKey).toBe('oldSecondValue');
      });

      it('thirdKey has been added', () => {
        expect(result.thirdKey).toBe('newThirdValue');
      });
    });
  });

  describe('_executeConfigurator()', () => {
    let callback;
    let oldConfig;
    let newConfig;
    let error;

    beforeEach(() => {
      oldConfig = service._context.config;
      error = null;
    });

    describe('when configurator resolves correctly', () => {
      beforeEach(() => {
        callback = jest.fn(async (config) => {
          newConfig = { ...config, someKey: 'someValue' };
          return newConfig;
        });
      });

      beforeEach(() => service._executeConfigurator(callback));

      test('called callback exactly once', () => {
        expect(callback.mock.calls.length).toBe(1);
      });

      test('sets config to the object resolved from configurator', () => {
        expect(service._context.config).toBe(newConfig);
      });

      test('option value set by the configurator is correct', () => {
        expect(service._context.config.someKey).toEqual('someValue');
      });
    });

    describe('when configurator throws an error', () => {
      beforeEach(() => {
        callback = jest.fn(async () => {
          throw new Error('test error');
        });
      });

      beforeEach(async () => {
        try {
          await service._executeConfigurator(callback);
        } catch (err) {
          error = err;
        }
      });

      test('called callback exactly once', () => {
        expect(callback.mock.calls.length).toBe(1);
      });

      test('throws the same error', () => {
        expect(error.message).toEqual('test error');
      });

      test('does not alter the config object', () => {
        expect(service._context.config).toBe(oldConfig);
      });
    });

    describe('when configurator returns a non-promise', () => {
      beforeEach(() => {
        callback = jest.fn(() => 'not a promise');
      });

      beforeEach(async () => {
        try {
          await service._executeConfigurator(callback);
        } catch (err) {
          error = err;
        }
      });

      test('called callback exactly once', () => {
        expect(callback.mock.calls.length).toBe(1);
      });

      test('throws an error', () => {
        expect(error.message).toEqual('Configuration callback must return a promise');
      });

      test('does not alter the config object', () => {
        expect(service._context.config).toBe(oldConfig);
      });
    });
  });

  describe('_executeConfigurators()', () => {
    let callbacks;
    let error;

    beforeEach(() => {
      error = null;

      const createConfigurator = result => async config => ({ ...config, ...result });
      callbacks = [
        jest.fn(createConfigurator({ first: 'firstValue' })),
        jest.fn(createConfigurator({ second: 'secondValue' })),
        jest.fn(createConfigurator({ third: 'thirdValue', second: 'overriddenValue' })),
      ];
    });

    describe('when all configurators resolve correctly', () => {
      beforeEach(() => {
        callbacks.forEach(callback => service.config(callback));
        return service._executeConfigurators();
      });

      test('each configurator was called once', () => {
        callbacks.forEach(callback => expect(callback.mock.calls.length).toBe(1));
      });

      test('first option has its initial value', () => {
        expect(service._context.config.first).toEqual('firstValue');
      });

      test('second option has an overridden value', () => {
        expect(service._context.config.second).toEqual('overriddenValue');
      });

      test('third option has its initial value', () => {
        expect(service._context.config.third).toEqual('thirdValue');
      });
    });

    describe('when one configurator throws an error', () => {
      beforeEach(() => {
        callbacks[1] = jest.fn(() => {
          throw new Error('Test error');
        });
      });

      beforeEach(async () => {
        callbacks.forEach(callback => service.config(callback));
        try {
          await service._executeConfigurators();
        } catch (err) {
          error = err;
        }
      });

      test('throws an error', () => {
        expect(error).toBeTruthy();
      });

      test('does not call the last configurator', () => {
        expect(callbacks[2].mock.calls.length).toBe(0);
      });
    });
  });

  describe('_executeInitializer()', () => {
    const fakePromise = { then: () => null };
    let callback;
    let result;
    let error;

    beforeEach(() => {
      result = null;
      error = null;
    });

    describe('initializer returns a promise-like object', () => {
      beforeEach(() => {
        callback = jest.fn().mockReturnValue(fakePromise);
        result = service._executeInitializer(callback);
      });

      it('calls the initializer', () => {
        expect(callback).toHaveBeenCalled();
      });

      it('returns the promise returned by the initializer', () => {
        expect(result).toBe(fakePromise);
      });
    });

    describe('initializer returns a non-promise-like value', () => {
      beforeEach(() => {
        callback = jest.fn().mockReturnValue('not a promise');
        try {
          result = service._executeInitializer(callback);
        } catch (err) {
          error = err;
        }
      });

      it('calls the initializer', () => {
        expect(callback).toHaveBeenCalled();
      });

      it('throws an exception', () => {
        expect(error).toBeTruthy();
      });
    });
  });

  describe('_executeInitializers()', () => {
    let callbacks;

    beforeEach(() => {
      callbacks = [
        jest.fn(async () => null),
        jest.fn(async () => null),
        jest.fn(async () => null),
      ];
      callbacks.forEach(callback => service.init(callback));
    });

    beforeEach(() => service._executeInitializers());

    test('each initializer was called once', () => {
      callbacks.forEach(callback => expect(callback.mock.calls.length).toBe(1));
    });
  });
});