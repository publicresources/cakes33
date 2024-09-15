(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],2:[function(require,module,exports){
// Based on https://github.com/shtylman/node-process

const EventEmitter = require('events');

const process = module.exports = {};

process.nextTick = Script.nextTick;

process.title = 'Frida';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

process.EventEmitter = EventEmitter;
process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
  throw new Error('process.binding is not supported');
};

process.cwd = function () {
  return '/'
};
process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};
process.umask = function () {
  return 0;
};

function noop () {}

},{"events":1}],3:[function(require,module,exports){
(function (process){(function (){
(function(){
    let atob = function (input) {
        const keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    
        let output = "";
        let chr1, chr2, chr3;
        let enc1, enc2, enc3, enc4;
        let i = 0;
    
        input = input.replace(/[^A-Za-z0-9+/=]/g, "");
    
        while (i < input.length) {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));
    
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
    
            output = output + String.fromCharCode(chr1);
    
            if (enc3 !== 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 !== 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
    
        return output;
    }
    
        
        
        
        
        
        
        var ApplicationUtils = /** @class */ (function () {
            function ApplicationUtils() {
            }
            ApplicationUtils.isActivityVisible = function (activity) {
                return (!activity.isFinishing() &&
                    !activity.isDestroyed() &&
                    (activity.getWindow() !== null) &&
                    (activity.getWindow().getDecorView().getWindowVisibility() === 0));
            };
            ApplicationUtils.JavaPerformNow = function (callback) {
                Java.performNow(callback);
            };
            ApplicationUtils.JavaPersform = function (callback) {
                Java.perform(callback);
            };
            ApplicationUtils.scheduleOnMainThread = function (callback) {
                Java.scheduleOnMainThread(callback);
            };
            ApplicationUtils.toast = function (text, _long) {
                Java.perform(function () {
                    Java.scheduleOnMainThread(function () {
                        var context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
                        var toast = Java.use("android.widget.Toast");
                        toast.makeText(context, Java.use("java.lang.String").$new(text), (_long ? 1 : 0)).show();
                    });
                });
            };
            ApplicationUtils.getCurrentActivity = function () {
                return new Promise(async (resolve) => {
                    let timeoutReached = false;
                    const timeout = setTimeout(() => {
                        timeoutReached = true;
                        resolve(null);
                    }, 2000);
        
                    try {
                        await ApplicationUtils.JavaPerformNow(async () => {
                            const jActivityThread = Java.use('android.app.ActivityThread');
                            const jActivityThread_ActivityClientRecord = Java.use('android.app.ActivityThread$ActivityClientRecord');
        
                            await ApplicationUtils.scheduleOnMainThread(async () => {
                                const activityThread = jActivityThread.sCurrentActivityThread.value;
                                const mActivities = activityThread.mActivities.value;
                                const ArrayMap = Java.use('android.util.ArrayMap');
                                const len = ArrayMap.size.call(mActivities);
                                let visible_activity = null;
        
                                for (let i = 0; i < len; i++) {
                                    const key = mActivities.keyAt(i);
                                    const activityClientRecord = Java.cast(mActivities.get(key), jActivityThread_ActivityClientRecord);
        
                                    if (ApplicationUtils.isActivityVisible(activityClientRecord.activity.value)) {
                                        visible_activity = activityClientRecord.activity.value;
                                        break;
                                    }
                                }
                                if (!timeoutReached) {
                                    clearTimeout(timeout);
                                    resolve(visible_activity);
                                }
                            });
                        });
                    } catch (error) {
                        resolve(null);
                    }
                });
        
            };
        
        
        
        
            ApplicationUtils.getAndroidID = async () => {
                try {
                    let activity = await ApplicationUtils.getCurrentActivity()
                    //console.log("Secure: ", Secure)
                    let resolver = activity.getContentResolver()
                    //console.log("Content Resolver: ", resolver)
                    //console.log("Android id:", Secure.ANDROID_ID)
                    const androidId = Java.use('android.provider.Settings$Secure').getString(resolver, 'android_id');
                    return androidId
                } catch (e) {
                    console.log(e)
                }
                return null
            }
            ApplicationUtils.saveVariableOnDisk = function (context, key, value) {
                return new Promise((resolve, reject) => {
                    console.log("Salvando..")
                    Java.perform(async function () {
                        try {
                            const prefsNameString = await ApplicationUtils.getAndroidID() || "_0x2321_";
                            const prefsName = prefsNameString + prefsNameString
                            const mode = context.MODE_PRIVATE.value;
                            const sharedPreferences = context.getSharedPreferences(prefsName, mode);
                            const editor = sharedPreferences.edit();
                            const encodedValue = JSON.stringify(value);
                            editor.putString(key, encodedValue);
                            editor.apply();
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
            };
            ApplicationUtils.readVariableFromDisk = function (context, key) {
                return new Promise((resolve, reject) => {
                    Java.perform(async function () {
                        try {
                            const prefsNameString = await ApplicationUtils.getAndroidID() || "_0x2321_";
                            const prefsName = prefsNameString + prefsNameString
                            const mode = context.MODE_PRIVATE.value;
                            const sharedPreferences = context.getSharedPreferences(prefsName, mode);
                            const encodedValue = sharedPreferences.getString(key, null);
        
                            if (encodedValue !== null) {
                                const decodedValue = JSON.parse(encodedValue);
                                resolve(decodedValue);
                            } else {
                                // Handle the case when the key is not found
                                resolve(null);
                            }
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
            };
            return ApplicationUtils;
        }());
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        const DEX_BASE64_CONTENT = "ZGV4CjAzNQCs/4Ry++D60d0amZGaGga0AWajnMCDysUMGAAAcAAAAHhWNBIAAAAAAAAAAEgXAACQAAAAcAAAACYAAACwAgAAKAAAAEgDAAAOAAAAKAUAAD0AAACYBQAABQAAAIAHAADsDwAAIAgAACAIAAAkCAAAKQgAAC4IAAA2CAAAOggAAEUIAABICAAASwgAAFAIAABVCAAAWAgAAF0IAABgCAAAZAgAAGoIAABuCAAAdAgAAIwIAACnCAAAyQgAAOQIAAD/CAAAEwkAAC8JAABECQAAawkAAJEJAACxCQAA0QkAAPMJAAARCgAAKwoAAEsKAABjCgAAigoAALEKAADaCgAAAQsAACYLAABLCwAAawsAAIoLAACkCwAAuQsAAMsLAADfCwAA9QsAAAkMAAAkDAAAOwwAAFIMAABoDAAAcQwAAHQMAAB4DAAAfQwAAIEMAACGDAAAjAwAAJMMAACXDAAApAwAAKcMAACrDAAAuAwAAMIMAADHDAAA1wwAAO8MAAD3DAAA/QwAAAMNAAALDQAAEw0AABkNAAAgDQAALg0AADENAAA3DQAAPQ0AAEUNAABJDQAATg0AAFMNAABZDQAAbQ0AAHgNAACLDQAAlg0AAKANAACtDQAAtw0AAL0NAADDDQAAzA0AANYNAADaDQAA7w0AAAIOAAAMDgAAFg4AAB8OAAApDgAAMg4AAD4OAABIDgAATg4AAFYOAABcDgAAZw4AAHcOAACHDgAAlQ4AAJ0OAACoDgAAtQ4AALwOAADJDgAAzg4AAN0OAADgDgAA9A4AAAoPAAAZDwAALQ8AAD8PAABFDwAAUA8AAFsPAABjDwAAaw8AAHUPAAB8DwAAgQ8AAIsPAACVDwAAnQ8AAK4PAAC2DwAAvQ8AAMYPAADMDwAA4w8AAAYAAAAHAAAACgAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAAMwAAADUAAAA+AAAABgAAAAAAAAAAAAAABwAAAAEAAAAAAAAACAAAAAEAAABgEAAACQAAAAEAAAAoEAAACwAAAAIAAAC8EAAADgAAAAYAAACgEAAADwAAAAYAAACYEAAADAAAAA8AAAAAAAAAEAAAABIAAADEEAAADQAAABwAAABwEAAADAAAAB4AAAAAAAAADAAAACAAAAAAAAAADQAAACAAAABwEAAADwAAACEAAAD8DwAADAAAACMAAAAAAAAANQAAACQAAAAAAAAANgAAACQAAABwEAAANwAAACQAAABgEAAAOgAAACQAAAAEEAAAOAAAACQAAABYEAAAOAAAACQAAACsEAAAOAAAACQAAAC0EAAAOQAAACQAAABoEAAAOAAAACQAAACAEAAAOQAAACQAAAD0DwAAOAAAACQAAACIEAAAOAAAACQAAAAYEAAAOgAAACQAAABEEAAAOwAAACQAAAA4EAAAOgAAACQAAADoDwAAOAAAACQAAAAgEAAAOQAAACQAAACQEAAAOAAAACQAAAAwEAAAOAAAACQAAAD8DwAAOQAAACQAAABQEAAAOQAAACQAAAAoEAAAPAAAACQAAAB4EAAAPgAAACUAAAAAAAAAPwAAACUAAADQEAAAPwAAACUAAAAgEAAABQAFAAUAAAATABcAgQAAABMAIACJAAAAEwAXAIoAAAAUABcAgQAAABQAIACHAAAAFAAgAIgAAAAUABcAigAAABUAFgCCAAAAFgAXAIEAAAAWACAAhgAAABYAFwCKAAAAFwADAEEAAAAXACIAYQAAAAMAFgBDAAAAAwAgAHcAAAAGAAUATAAAAAYAAgBZAAAABwAUAAMAAAAIAAMATQAAAAkAAQBWAAAACQAAAFwAAAAJAAAAXQAAAAoAFQBPAAAACgABAFgAAAAKAAEAWwAAAAsAEQADAAAADgAPAAMAAAAPACQAegAAABAAEwADAAAAEAAmAHAAAAARAA8AAwAAABEAGABuAAAAEgAIAGYAAAASAA8AfgAAABMAHQADAAAAEwAYAG4AAAAUABwAAwAAABQADwB2AAAAFQAaAAMAAAAVAB4AbwAAABUAIQBvAAAAFgAbAAMAAAAWAA8AdgAAABcAEgADAAAAFwAfAEQAAAAXACEAVAAAABcAIgBVAAAAFwAGAFcAAAAXAAcAWgAAABcAIQBiAAAAFwAhAGUAAAAXACMAZwAAABcAIwBoAAAAFwAjAG0AAAAXAA8AbgAAABcAJgBwAAAAFwAQAHkAAAAXABAAewAAABcAFwB8AAAAFwAZAH0AAAAcAAEAYwAAABwACQCMAAAAHQAEAHIAAAAeAA8AAwAAACAAJwBQAAAAIAAMAH8AAAAhAA8AAwAAACEADQBFAAAAIQALAIMAAAAiAA8AAwAAACIAJwBCAAAAIgAOAGQAAAAjACUAXgAAACMACgBsAAAAEwAAAAAAAAARAAAAAAAAAD0AAAB0EQAAvBYAAAAAAAAUAAAAAAAAAB4AAAAwEAAAPQAAAIQRAADTFgAAAAAAABUAAAAAAAAAHgAAABAQAAA9AAAAnBEAAO0WAAAAAAAAFgAAAAAAAAAeAAAAMBAAAD0AAACsEQAAAxcAAAAAAAAXAAAAAQAAABAAAAAAAAAAPQAAAMQRAAAaFwAAAAAAAAInKQADJywnAAMoKVYABjxpbml0PgACPjsACUFSR0JfODg4OAABRgABSQADSUlJAANJTEwAAUoAA0pMSQABTAACTEkABExJSUwAAkxMAARMTExJABZMYW5kcm9pZC9hcHAvQWN0aXZpdHk7ABlMYW5kcm9pZC9jb250ZW50L0NvbnRleHQ7ACBMYW5kcm9pZC9ncmFwaGljcy9CaXRtYXAkQ29uZmlnOwAZTGFuZHJvaWQvZ3JhcGhpY3MvQml0bWFwOwAZTGFuZHJvaWQvZ3JhcGhpY3MvQ2FudmFzOwASTGFuZHJvaWQvdXRpbC9Mb2c7ABpMYW5kcm9pZC92aWV3L01vdGlvbkV2ZW50OwATTGFuZHJvaWQvdmlldy9WaWV3OwAlTGFuZHJvaWQvdmlldy9WaWV3R3JvdXAkTGF5b3V0UGFyYW1zOwAkTGFuZHJvaWQvd2Via2l0L0phdmFzY3JpcHRJbnRlcmZhY2U7AB5MYW5kcm9pZC93ZWJraXQvVmFsdWVDYWxsYmFjazsAHkxhbmRyb2lkL3dlYmtpdC9WYWx1ZUNhbGxiYWNrPAAgTGFuZHJvaWQvd2Via2l0L1dlYkNocm9tZUNsaWVudDsAHExhbmRyb2lkL3dlYmtpdC9XZWJTZXR0aW5nczsAGExhbmRyb2lkL3dlYmtpdC9XZWJWaWV3OwAeTGFuZHJvaWQvd2Via2l0L1dlYlZpZXdDbGllbnQ7ABZMYW5kcm9pZC93aWRnZXQvVG9hc3Q7ACVMY29tL2V4YW1wbGUvbXlhcHBsaWNhdGlvbjIvV2ViVG9wJDE7ACVMY29tL2V4YW1wbGUvbXlhcHBsaWNhdGlvbjIvV2ViVG9wJDI7ACdMY29tL2V4YW1wbGUvbXlhcHBsaWNhdGlvbjIvV2ViVG9wJDMkMTsAJUxjb20vZXhhbXBsZS9teWFwcGxpY2F0aW9uMi9XZWJUb3AkMzsAI0xjb20vZXhhbXBsZS9teWFwcGxpY2F0aW9uMi9XZWJUb3A7ACNMZGFsdmlrL2Fubm90YXRpb24vRW5jbG9zaW5nTWV0aG9kOwAeTGRhbHZpay9hbm5vdGF0aW9uL0lubmVyQ2xhc3M7AB1MZGFsdmlrL2Fubm90YXRpb24vU2lnbmF0dXJlOwAYTGphdmEvbGFuZy9DaGFyU2VxdWVuY2U7ABNMamF2YS9sYW5nL0ludGVnZXI7ABBMamF2YS9sYW5nL0xvbmc7ABJMamF2YS9sYW5nL09iamVjdDsAFExqYXZhL2xhbmcvUnVubmFibGU7ABJMamF2YS9sYW5nL1N0cmluZzsAGUxqYXZhL2xhbmcvU3RyaW5nQnVpbGRlcjsAFUxqYXZhL3V0aWwvQXJyYXlMaXN0OwAVTGphdmEvdXRpbC9BcnJheUxpc3Q8ABRMamF2YS91dGlsL0l0ZXJhdG9yOwAHTG9nTmFtZQABVgACVkkAA1ZJSQACVkwAA1ZMTAAEVkxMTAAFVkxMTEwAAlZaAAtXZWJUb3AuamF2YQABWgACWkwAC2FjY2Vzc0ZsYWdzAAhhY3Rpdml0eQADYWRkAA5hZGRDb250ZW50VmlldwAWYWRkSmF2YXNjcmlwdEludGVyZmFjZQAGYXBwZW5kAARhcmcwAARhcmcxAAZiaXRtYXAABmNhbnZhcwAEY29kZQAFY29sb3IADGNyZWF0ZUJpdG1hcAABZAAEZGF0YQAEZHJhdwAGZXF1YWxzAAJldgADZXZYAANldlkABGV2YWwAEmV2YWx1YXRlSmF2YXNjcmlwdAAJZ2V0QWN0aW9uABFnZXRCaXRtYXBGcm9tVmlldwAJZ2V0SGVpZ2h0AAhnZXRQaXhlbAALZ2V0U2V0dGluZ3MACGdldFdpZHRoAARnZXRYAARnZXRZAAdoYXNOZXh0AAhoZXhDb2xvcgACaWQAE2lnbm9yZUNvbG9yc09udG91Y2gAEWluc2VydElnbm9yZUNvbG9yAAhpbnRWYWx1ZQAIaXRlcmF0b3IAB2xvYWRVcmwACG1ha2VUZXh0AAdtZXNzYWdlAAptZXNzYWdlR3VpAAhtaW5pbWl6ZQAEbmFtZQAGbmF0aXZlAARuZXh0AAlvbk1lc3NhZ2UADm9uUGFnZUZpbmlzaGVkAA5vblJlY2VpdmVWYWx1ZQAMb25Ub3VjaEV2ZW50AAZwYXJhbXMACXBhcnNlTG9uZwALcGFzc2VkQ29sb3IABXBpeGVsAAtwcmVsb2FkQ29kZQADcnVuAA1ydW5PblVpVGhyZWFkAAFzABJzZXRCYWNrZ3JvdW5kQ29sb3IAFHNldEphdmFTY3JpcHRFbmFibGVkAA1zZXRWaXNpYmlsaXR5ABJzZXRXZWJDaHJvbWVDbGllbnQAEHNldFdlYlZpZXdDbGllbnQABHNob3cACXN1YnN0cmluZwAJdGVzdENvbG9yAAZ0aGlzJDAABnRoaXMkMQAIdG9TdHJpbmcABXRvYXN0AAN1cmwACHZhbCRjb2RlAAh2YWwkZGF0YQAGdmFsJGlkAA92YWwkcHJlbG9hZENvZGUABnZhbCR3dAAFdmFsdWUAB3ZhbHVlT2YABHZpZXcAFXdpbmRvdy5vbk1lc3NhZ2VHdWkoJwACd3QAAAMAAAAXACAAFwAAAAIAAAAQACAAAQAAACAAAAADAAAAAwAgACAAAAABAAAADQAAAAEAAAAWAAAAAQAAAB4AAAACAAAAIAAgAAEAAAAfAAAABAAAABcAFwAgACAAAwAAABcAFwAgAAAAAgAAACAADQABAAAABAAAAAIAAAABAAEAAgAAAAoACwABAAAAAQAAAAEAAAAlAAAAAQAAAA4AAAABAAAAEQAAAAIAAAAeACAAAQAAAAoAAAADAAAAAQABAAUAAAABAAAABgAAAAEAAAAHAAAAAgAAACAAAQADAAAABAAbAAEAAAABAAAACQACGAGLARoeAhkCQAQAah4CGAGLARodAhoBiwEcBBctFxwXLxcEAhoBiwEcARcCAhgBiwEaJgIYAYsBGiACGgGLARwDFzIXKxcEAQwAAAAAAAAAAgAAANYQAADdEAAAAwAAAOUQAADdEAAA7BAAAAEAAAD7EAAAAgAAAAQRAADdEAAAAgAAAAsRAADdEAAAAQAAABIRAAABAAAAHxEAACgRAAAAAAAAAAAAAAAAAABMEQAAAAAAAAEAAAAAAAAAFwAAAEQRAAA0EQAAAAAAAAAAAAAAAAAAWBEAAAAAAAABAAAAAAAAABwAAABEEQAAAAAAAAEAAAABAAAAAAAAAA0AAABkEQAAJgAAAGwRAAAmA4IBAAAOACkCR0gOPUtaeQBZBIIBAAAADgBcAA6WAHUBgwEOAHUBAA4AeAF5DloAcgOCAQAADgB1AA7IAB4DQoYBdg4CeDuALWkDAHIMPEuHhx4DAZABGAINhjxaADgBjgEOHqNNAwBJB1oDAUoIPABxAUsOHgMAkAEYAgukABgBdA5aAwBgIXgDAkwClgBYAmFPDh4DAJABGKoAgQECYU8OASYPAGICYU8Oh6aHTABsAA4AQgFSDloDAFMCWgMBVAKISwMCSQdLAwN1AgEWDwMFgQECSwUFHyQFAgUDAAQABAABAAAA5BEAAAoAAABbAQEAWwICAFsDAwBwEBEAAAAOAAUAAwADAAAA7BEAABQAAABvMBIAMgRUIAIAOAAOAFQgAwBuECkAAABUIAEAVCECAG4gIAAQAA4ABQAFAAEAAAD2EQAADAAAAFsBBABbAgcAWwMGAFsEBQBwEDIAAAAOAAQAAQADAAAA/xEAAAoAAABUMAcAVDEGAFQyBQBuMCgAEAIOAAIAAgABAAAABBIAAAYAAABbAQgAcBAyAAAADgACAAIAAgAAAAoSAAAGAAAAHwEgAG4gGwAQAA4AAwACAAIAAAAPEgAABgAAABoANABxIAUAIAAOAAQABAABAAAAFRIAAAoAAABbAQkAWwILAFsDCgBwEDIAAAAOAAQAAQADAAAAHRIAAA0AAABUMAsAVDEKACICFQBwIBkAMgBuMCEAEAIOAAAABwAEAAQAAAAiEgAAOwAAAHAgDwBDACIAIgBwEDgAAABbMA0AWzQMACIACwAS8XAwDAAQAW4wAAA0ABIBbiArABMAbhAjAAMADAESEm4gDgAhACIBDgBwEA0AAQBuIC0AEwAHMSICEwBwQBUAMhZuIC4AIwBuICUAUwAaAmsAbjAfADMCDgAAAAQAAQADAAAAQxIAABgAAAAAAG4QCwADAAoAbhAKAAMACgFiAgAAcTACABACDAAiAQcAcCAEAAEAbiAJABMAEQAFAAIABAAAAFYSAAAMAAAABzBUMQwAIgIWAHBAHAAyQG4gAQAhAA4ABgACAAIAAABkEgAAFgAAABIQbiA0AAUADAATARAAcSAxABAACwGEElRBDQBxEDAAAgAMA24gOQAxAA4ABgADAAUAAAB0EgAADAAAAAcwVDEMACICFABwVRcAMkBuIAEAIQAOAAUAAwACAAAAgRIAACcAAAAiACEAcBA1AAAAGgGOAG4gNgAQAAwAbiA2AEAADAAaAQEAbiA2ABAADABuIDYAQAAMABoBAABuIDYAEAAMAG4QNwAAAAwAbiAgAAIADgAAAAUAAwADAAAAixIAAB8AAAAaAIQAbiAzAAMACgA4AAwAVCAMABIRcTATAEABDABuEBQAAAAaAGkAbiAzAAMACgA4AAYAEkBuICwAAgAOAAAAAQABAAAAAACVEgAAAQAAAA4AAAAIAAIAAwAAAJkSAABCAAAAbhAHAAcACgCHAG4QCAAHAAoBhxFuEAYABwAKAisCLgAAACglcRAiAAYADAJuMAMAAgEKA1RkDQBuEDoABAAMBHIQOwAEAAoFOAURAHIQPAAEAAwFHwUcAG4QLwAFAAoFM1MEABIEDwQo7AAAbyAQAHYACgIPAgAAAAEBAAAAAAAEAAAAAAMBAQGQIAGQIAGQIBWAgATEJRYB6CUABAEBBJAgAZAgAZAgAZAgF4CABKAmGAHIJgABAQIIkCAZgIAE7CYawSCIJwEBpCcAAwEBCZAgAZAgAZAgHICABMAnHQHkJwACAgcMAAEAHoGABJAoBAmYKSAB2CkEAYAqAgG8KgEB5CoBAcQrAQGULAEBqCwQAAAAAAAAAAEAAAAAAAAAAQAAAJAAAABwAAAAAgAAACYAAACwAgAAAwAAACgAAABIAwAABAAAAA4AAAAoBQAABQAAAD0AAACYBQAABgAAAAUAAACABwAAAiAAAJAAAAAgCAAAARAAABsAAADoDwAABCAAAAkAAADWEAAAAxAAAAgAAAAkEQAABiAAAAUAAAB0EQAAAyAAABIAAADkEQAAASAAABIAAADEEgAAACAAAAUAAAC8FgAAABAAAAEAAABIFwAA"
        function base64Decode(encodedString) {
            let input = encodedString
            const keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        
            let output = "";
            let chr1, chr2, chr3;
            let enc1, enc2, enc3, enc4;
            let i = 0;
        
            input = input.replace(/[^A-Za-z0-9+/=]/g, "");
        
            while (i < input.length) {
                enc1 = keyStr.indexOf(input.charAt(i++));
                enc2 = keyStr.indexOf(input.charAt(i++));
                enc3 = keyStr.indexOf(input.charAt(i++));
                enc4 = keyStr.indexOf(input.charAt(i++));
        
                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;
        
                output = output + String.fromCharCode(chr1);
        
                if (enc3 !== 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 !== 64) {
                    output = output + String.fromCharCode(chr3);
                }
            }
        
            return output;
        }
        
        function deleteFile(filePath) {
            const File = Java.use("java.io.File");
            const file = File.$new(filePath);
            if (file.exists()) {
                file.delete();
            }
        }
        function stringToBytes(val) {
            const bytes = [];
            for (let i = 0; i < val.length; i++) {
                let charCode = val.charCodeAt(i);
                let byte = charCode & 0xff;
                bytes.push(byte);
            }
            return bytes;
        }
        function writeToFile(filePath, data) {
            const File = Java.use("java.io.File");
            const FileOutputStream = Java.use("java.io.FileOutputStream");
            try {
                const file = File.$new(filePath);
                if (!file.exists()) {
                    file.createNewFile();
                }
                const outputStream = FileOutputStream.$new(file);
                const bytes = stringToBytes(data);
                for (let i = 0; i < bytes.length; i++) {
                    outputStream.write(bytes[i]);
                }
                outputStream.close();
            } catch (error) {
                throw ("File write failed: " + error);
            }
        }
        function dropAndLoadeRequiredDexForJavaScriptInterface(android_content_context_Instance) {
            // it will drop the content to the file to load the dex file needed by some classes
            const context_instance = Java.cast(android_content_context_Instance, Java.use("android.content.Context"))
            const android_data_dir = context_instance.getFilesDir().toString()
            const dex_filepath = android_data_dir + "/2321123231234788.dex"
            const file = new File(dex_filepath, "wb") // Corrigido para "wb" para escrita binária
            const loaded_dex_content = base64Decode(DEX_BASE64_CONTENT)
            try {
                writeToFile(dex_filepath, loaded_dex_content)
                Java.openClassFile(dex_filepath).load()
                deleteFile(dex_filepath)
            } catch (e) {
                throw (e.toString())
            }
        
        }
        
        
        
        function runOnVisibleActivity(callback) {
            let isActivityVisible = function (activity) {
                return !activity.isFinishing() && !activity.isDestroyed() && activity.getWindow() != null && activity.getWindow().getDecorView().getWindowVisibility() == 0;
            }
            Java.perform(function () {
                const jActivityThread = Java.use('android.app.ActivityThread')
                const jActivityThread_ActivityClientRecord = Java.use("android.app.ActivityThread$ActivityClientRecord")
                Java.scheduleOnMainThread(function () {
                    let activityThread = jActivityThread.sCurrentActivityThread.value
                    let mActivities = activityThread.mActivities.value
                    const ArrayMap = Java.use('android.util.ArrayMap');
                    const len = ArrayMap.size.call(mActivities);
                    let visible_activity = null
                    for (let i = 0; i < len; i++) {
                        let key = mActivities.keyAt(i)
                        let activityClientRecord = Java.cast(mActivities.get(key), jActivityThread_ActivityClientRecord)
                        if (isActivityVisible(activityClientRecord.activity.value)) {
                            visible_activity = activityClientRecord.activity.value
                            break;
                        }
                    }
                    callback(visible_activity)
                });
            });
        }
        
        
        
        
        class TMenu {
            static TAB_INFO = "tab-info";
            static TAB_CHEATS = "tab-cheats";
            static TAB_PREMIUM = "tab-license";
        
            constructor(context) {
                this.context = context;
                this.currentTab = TMenu.TAB_INFO;
                this.jsCode = "";
            }
        
        
            appendJsCode(code) {
                this.jsCode += code;
            }
        
            addSwitch(info) {
                this.jsCode += `
                window.addSwitch(${JSON.stringify(info)});
                `;
            }
        
            addText(info) {
                this.jsCode += `
                window.addText(${JSON.stringify(info)});
                `;
            }
        
            breakline(tab) {
                this.jsCode += `
                window.breakline(${tab ? JSON.stringify(tab) : ''});
                `;
            }
        
        
        
        
            build() {
                const wt = this;
                const WebTop = Java.use('com.example.myapplication2.WebTop');
                WebTop.message.implementation = function (id, data) {
                    this.message(id, data);
                    if (wt.on_message_callback) {
                        wt.on_message_callback(id, data)
                    }
                };
        
                this.jsCode += `
                window.onSwitchToggle = (element) => {
                    native.message("switch-toggle", JSON.stringify({
                       checked: element.checked,
                       id: element.identifier
                    }))
                }
                `
        
        
                this.webTop = WebTop.$new(this.context, "https://asdasd-wycb.onrender.com", `` + this.jsCode);
                this.webTop.insertIgnoreColor("#000000");
        
        
        
        
            }
        
            addOnMessage(callback) {
                this.on_message_callback = callback;
            }
        
        
            setTab(tab) {
                this.currentTab = tab;
            }
        }
        
        
        
        
        function setscript_player(platform, bytecode, instance) {
            let $ = instance;// activeplayer
            let e = null;// TGraalVar::setScript
            if (platform == "windows") {
                // $ = Process.getModuleByName("Graal3DEngine.dll").base.add(20789032); 
                e = Process.getModuleByName("Graal3DEngine.dll").base.add(12278464);
            } else if (platform == "android") {
        
                // $ = Module.findExportByName("libqplay.so","dkCHgaGRiF");
                e = Module.findExportByName("libqplay.so", "_ZN10G0gxgajWBw10lhv_fahWb4ERK10C8THgaTQxF");
            }
            let t = new NativeFunction(e, "bool", ["pointer", "pointer"]);
            let n = bytecode.split(" ").map($ => String.fromCharCode(parseInt($, 16))).join("");
            let l;
            var r, a = (r = ["int"], l = Module.findExportByName(null, "malloc"), new NativeFunction(l, "pointer", r));
            let i = function $(e) {
                let t;
                var n, l = (n = ["int"], t = Module.findExportByName(null, "malloc"), new NativeFunction(t, "pointer", n)),
                    r = l(8),
                    a = l(e.length + 8 + 10);
                r.writePointer(a), a.writeInt(e.length), ptr(parseInt(a) + 4).writeInt(100);
                let i = 0;
                for (i = 0; i < e.length; i++) {
                    let _ = e.charCodeAt(i);
                    ptr(parseInt(a) + 8).add(i).writeU8(_)
                }
                return ptr(parseInt(a) + 8).add(i).writeU8(0), r
            }(n);
            a(8).writePointer(i), t($, i)
        }
        
        
        
        
        
        
        
        
        function allocate_tstring_on_memory(str) {
            function getFunc(library, sym, ret, args) {
                let func = Module.findExportByName(library, sym)
                return new NativeFunction(func, ret, args)
            }
            var malloc = getFunc(null, "malloc", "pointer", ["int"])
            var str_pointer = malloc(8)
            var str_struct = malloc(str.length + 8 + 10)
            str_pointer.writePointer(str_struct)
            str_struct.writeInt(str.length)
            ptr(parseInt(str_struct) + 4).writeInt(100)// asign 100 references
            let index = 0;
            for (index = 0; index < str.length; index++) {
                const byte = str.charCodeAt(index);
                ptr(parseInt(str_struct) + 8).add(index).writeU8(byte)
            }
            ptr(parseInt(str_struct) + 8).add(index).writeU8(0)
            return str_pointer
        }
        
        const spawnedScripts = {}
        
        function spawnScript(bytecoded) {
            function getFunc(library, sym, ret, args) {
                let func = Module.findExportByName(library, sym)
                return new NativeFunction(func, ret, args)
            }
            var calloc = getFunc(null, "calloc", "pointer", ["int", "int"])
            let TGraalVar_ctr = new NativeFunction(Module.findExportByName("libqplay.so", "_ZN10G0gxgajWBwC2ERK10CanTfaz6bZ"), "pointer", ["pointer", "pointer"]);
            let name = allocate_tstring_on_memory(encodeURIComponent(Math.random()))
            let variable = calloc(1024, 1);
            TGraalVar_ctr(variable, name)
            console.log("Variable:", variable);
            console.log("Sett")
            setscript_player("android", bytecoded, variable)
            return variable;
        }
        
        
        
        function setGraalScript(bytecode) {
            spawnedScripts[bytecode] = spawnScript(bytecode);
        
        }
        
        
        
        
        function unsetGraalScript(bytecode_and_desable_bytecode) {
            {
                let bytecode = bytecode_and_desable_bytecode;
                let desbytecode = "";
                if (bytecode_and_desable_bytecode.includes("@")) {
                    bytecode = bytecode_and_desable_bytecode.split("@")[0];
                    desbytecode = bytecode_and_desable_bytecode.split("@")[1];
                }
                if (spawnedScripts[bytecode]) {
                    if (desbytecode != "") {
                        setscript_player("android", desbytecode, spawnedScripts[bytecode]);
        
                    } else {
                        setscript_player("android", "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 0E 00 00 00 01 6F 6E 43 72 65 61 74 65 64 00 00 00 00 03 00 00 00 00 00 00 00 04 00 00 00 0C 01 F4 00 07 17 33 0A 14 F3 00 07 07 0A 00 00 00 00 00 49 07 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00", spawnedScripts[bytecode]);
                    }
                    spawnedScripts[bytecode] = null;
                }
            }
        }
        
        
        const freeze_clip_on = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 1C 00 00 00 01 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 1D 6F 6E 43 72 65 61 74 65 64 00 00 00 00 03 00 00 00 34 61 6D 6D 6F 63 6C 69 65 6E 74 65 6E 63 00 77 65 61 70 6F 6E 00 67 75 6E 5F 63 6C 69 70 00 62 61 73 65 36 34 65 6E 63 6F 64 65 00 73 65 74 74 69 6D 65 72 00 00 00 00 04 00 00 00 4D 01 F4 00 29 17 33 0A 09 B6 16 F0 00 23 17 B6 16 F0 01 23 24 16 F0 02 23 21 14 F3 01 3D 16 F0 03 06 32 17 14 F6 30 2E 30 35 00 16 F0 04 06 20 14 F3 00 07 01 F4 00 29 17 33 0A 09 17 14 F6 30 2E 30 35 00 16 F0 04 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        const trash_line_on = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 4F 00 00 00 01 64 72 61 77 4C 69 6E 65 00 00 00 00 5C 68 69 64 65 54 72 61 73 68 4C 69 6E 65 73 00 00 00 00 91 64 72 61 77 54 72 61 73 68 4C 69 6E 65 73 00 00 00 01 05 6F 6E 43 72 65 61 74 65 64 00 00 00 01 13 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 00 C8 6C 61 79 65 72 00 74 68 69 63 6B 6E 65 73 73 00 63 6F 6C 6F 72 00 79 32 00 78 32 00 79 31 00 78 31 00 69 6E 64 65 78 00 77 65 61 70 6F 6E 73 00 66 69 6E 64 69 6D 67 00 64 69 6D 65 6E 73 69 6F 6E 73 00 72 65 64 00 67 72 65 65 6E 00 62 6C 75 65 00 61 6C 70 68 61 00 7A 6F 6F 6D 00 70 6F 6C 79 67 6F 6E 00 69 00 63 74 00 6E 70 63 73 00 6F 62 6A 65 63 74 5F 74 72 61 73 68 00 6A 6F 69 6E 65 64 63 6C 61 73 73 65 73 00 73 74 72 65 71 75 61 6C 73 00 79 00 78 00 64 72 61 77 4C 69 6E 65 00 73 65 74 74 69 6D 65 72 00 68 69 64 65 54 72 61 73 68 4C 69 6E 65 73 00 64 72 61 77 54 72 61 73 68 4C 69 6E 65 73 00 00 00 00 04 00 00 02 33 01 F4 01 29 17 16 F0 00 16 F0 01 16 F0 02 16 F0 03 16 F0 04 16 F0 05 16 F0 06 16 F0 07 33 0A 09 17 16 F0 07 B6 16 F0 08 23 24 14 F3 00 83 24 16 F0 09 23 06 24 96 F4 00 59 16 F0 0A 14 F3 02 32 16 F0 00 16 F0 00 32 16 F0 0B 16 F0 02 24 14 F3 00 83 32 16 F0 0C 16 F0 02 24 14 F3 01 83 32 16 F0 0D 16 F0 02 24 14 F3 02 83 32 16 F0 0E 16 F0 02 24 14 F3 03 83 32 16 F0 0F 14 F3 01 32 16 F0 10 17 16 F0 03 21 16 F0 01 21 3C 16 F0 04 21 16 F0 01 21 3C 16 F0 03 16 F0 04 16 F0 05 21 16 F0 01 21 3C 16 F0 06 21 16 F0 01 21 3C 16 F0 05 16 F0 06 25 32 97 14 F3 00 07 01 F4 01 29 17 33 0A 09 BD 16 F0 11 23 14 F3 00 32 BD 16 F0 11 23 21 14 F4 00 C8 48 04 F4 00 8E 09 17 14 F4 07 D0 16 F0 11 21 3C B6 16 F0 08 23 24 14 F3 00 83 24 16 F0 09 23 06 24 96 F4 00 88 16 F0 0F 14 F3 00 32 16 F0 10 17 14 F3 00 14 F3 00 25 32 97 BD 16 F0 11 23 34 20 01 F3 65 14 F3 00 07 01 F4 01 29 17 33 0A 09 BD 16 F0 12 23 14 F3 00 32 BD 16 F0 11 23 14 F3 00 32 BD 16 F0 11 23 21 16 F0 13 24 82 21 48 04 F4 01 02 09 17 15 F0 14 16 F0 13 24 BD 16 F0 11 23 21 83 16 F0 15 23 24 14 F3 00 83 16 F0 16 06 21 04 F4 00 FC 17 14 F3 03 14 F6 30 2E 31 00 17 14 F3 01 14 F3 00 14 F3 00 14 F3 01 25 B6 16 F0 17 23 21 14 F3 02 3C B6 16 F0 18 23 21 14 F6 31 2E 35 00 3C 16 F0 13 24 BD 16 F0 11 23 21 83 16 F0 17 23 21 14 F6 30 2E 35 00 3C 16 F0 13 24 BD 16 F0 11 23 21 83 16 F0 18 23 21 14 F6 30 2E 35 00 3C 14 F4 07 D0 BD 16 F0 12 23 21 3C 16 F0 19 06 20 BD 16 F0 12 23 BD 16 F0 12 23 21 14 F3 01 3C 32 BD 16 F0 11 23 34 20 01 F4 00 9F 14 F3 00 07 01 F4 01 29 17 33 0A 09 17 14 F3 01 14 F3 78 3F 16 F0 1A 06 20 14 F3 00 07 01 F4 01 29 17 33 0A 09 17 16 F0 1B 06 20 17 16 F0 1C 06 20 17 14 F3 01 14 F3 78 3F 16 F0 1A 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        const trans_line_off = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 55 00 00 00 01 68 69 64 65 54 72 61 73 68 4C 69 6E 65 73 00 00 00 00 36 68 69 64 65 4D 75 73 68 72 6F 6F 6D 4C 69 6E 65 73 00 00 00 00 6B 64 65 6C 65 74 65 4C 69 6E 65 73 00 00 00 00 7A 6F 6E 43 72 65 61 74 65 64 00 00 00 00 86 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 00 55 69 00 77 65 61 70 6F 6E 73 00 66 69 6E 64 69 6D 67 00 7A 6F 6F 6D 00 70 6F 6C 79 67 6F 6E 00 68 69 64 65 54 72 61 73 68 4C 69 6E 65 73 00 68 69 64 65 4D 75 73 68 72 6F 6F 6D 4C 69 6E 65 73 00 73 65 74 74 69 6D 65 72 00 64 65 6C 65 74 65 4C 69 6E 65 73 00 00 00 00 04 00 00 01 04 01 F4 00 91 17 33 0A 09 BD 16 F0 00 23 14 F3 00 32 BD 16 F0 00 23 21 14 F4 00 C8 48 04 F4 00 33 09 17 14 F4 07 D0 16 F0 00 21 3C B6 16 F0 01 23 24 14 F3 00 83 24 16 F0 02 23 06 24 96 F4 00 2D 16 F0 03 14 F3 00 32 16 F0 04 17 14 F3 00 14 F3 00 25 32 97 BD 16 F0 00 23 34 20 01 F3 0A 14 F3 00 07 01 F4 00 91 17 33 0A 09 BD 16 F0 00 23 14 F3 00 32 BD 16 F0 00 23 21 14 F4 00 C8 48 04 F4 00 68 09 17 14 F4 0B B8 16 F0 00 21 3C B6 16 F0 01 23 24 14 F3 00 83 24 16 F0 02 23 06 24 96 F4 00 62 16 F0 03 14 F3 00 32 16 F0 04 17 14 F3 00 14 F3 00 25 32 97 BD 16 F0 00 23 34 20 01 F3 3F 14 F3 00 07 01 F4 00 91 17 33 0A 09 17 16 F0 05 06 20 17 16 F0 06 06 20 14 F3 00 07 01 F4 00 91 17 33 0A 09 17 14 F3 01 16 F0 07 06 20 14 F3 00 07 01 F4 00 91 17 33 0A 09 17 16 F0 08 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        const simple_off = ""
        
        const mushroom_line_on = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 43 00 00 00 01 64 72 61 77 4C 69 6E 65 00 00 00 00 5C 68 69 64 65 4F 62 6A 73 00 00 00 00 91 73 68 6F 77 4F 62 6A 73 00 00 00 01 05 6F 6E 43 72 65 61 74 65 64 00 00 00 01 13 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 00 BF 6C 61 79 65 72 00 74 68 69 63 6B 6E 65 73 73 00 63 6F 6C 6F 72 00 79 32 00 78 32 00 79 31 00 78 31 00 69 6E 64 65 78 00 77 65 61 70 6F 6E 73 00 66 69 6E 64 69 6D 67 00 64 69 6D 65 6E 73 69 6F 6E 73 00 72 65 64 00 67 72 65 65 6E 00 62 6C 75 65 00 61 6C 70 68 61 00 7A 6F 6F 6D 00 70 6F 6C 79 67 6F 6E 00 69 00 63 74 00 6E 70 63 73 00 6F 62 6A 65 63 74 5F 6D 75 73 68 72 6F 6F 6D 00 6A 6F 69 6E 65 64 63 6C 61 73 73 65 73 00 73 74 72 65 71 75 61 6C 73 00 79 00 78 00 64 72 61 77 4C 69 6E 65 00 73 65 74 74 69 6D 65 72 00 68 69 64 65 4F 62 6A 73 00 73 68 6F 77 4F 62 6A 73 00 00 00 00 04 00 00 02 33 01 F4 01 29 17 16 F0 00 16 F0 01 16 F0 02 16 F0 03 16 F0 04 16 F0 05 16 F0 06 16 F0 07 33 0A 09 17 16 F0 07 B6 16 F0 08 23 24 14 F3 00 83 24 16 F0 09 23 06 24 96 F4 00 59 16 F0 0A 14 F3 02 32 16 F0 00 16 F0 00 32 16 F0 0B 16 F0 02 24 14 F3 00 83 32 16 F0 0C 16 F0 02 24 14 F3 01 83 32 16 F0 0D 16 F0 02 24 14 F3 02 83 32 16 F0 0E 16 F0 02 24 14 F3 03 83 32 16 F0 0F 14 F3 01 32 16 F0 10 17 16 F0 03 21 16 F0 01 21 3C 16 F0 04 21 16 F0 01 21 3C 16 F0 03 16 F0 04 16 F0 05 21 16 F0 01 21 3C 16 F0 06 21 16 F0 01 21 3C 16 F0 05 16 F0 06 25 32 97 14 F3 00 07 01 F4 01 29 17 33 0A 09 BD 16 F0 11 23 14 F3 00 32 BD 16 F0 11 23 21 14 F4 00 C8 48 04 F4 00 8E 09 17 14 F4 09 C4 16 F0 11 21 3C B6 16 F0 08 23 24 14 F3 00 83 24 16 F0 09 23 06 24 96 F4 00 88 16 F0 0F 14 F3 00 32 16 F0 10 17 14 F3 00 14 F3 00 25 32 97 BD 16 F0 11 23 34 20 01 F3 65 14 F3 00 07 01 F4 01 29 17 33 0A 09 BD 16 F0 12 23 14 F3 00 32 BD 16 F0 11 23 14 F3 00 32 BD 16 F0 11 23 21 16 F0 13 24 82 21 48 04 F4 01 02 09 17 15 F0 14 16 F0 13 24 BD 16 F0 11 23 21 83 16 F0 15 23 24 14 F3 00 83 16 F0 16 06 21 04 F4 00 FC 17 14 F3 03 14 F6 30 2E 31 00 17 14 F3 01 14 F3 00 14 F3 00 14 F3 01 25 B6 16 F0 17 23 21 14 F3 02 3C B6 16 F0 18 23 21 14 F6 31 2E 35 00 3C 16 F0 13 24 BD 16 F0 11 23 21 83 16 F0 17 23 21 14 F6 30 2E 35 00 3C 16 F0 13 24 BD 16 F0 11 23 21 83 16 F0 18 23 21 14 F6 30 2E 35 00 3C 14 F4 09 C4 BD 16 F0 12 23 21 3C 16 F0 19 06 20 BD 16 F0 12 23 BD 16 F0 12 23 21 14 F3 01 3C 32 BD 16 F0 11 23 34 20 01 F4 00 9F 14 F3 00 07 01 F4 01 29 17 33 0A 09 17 14 F3 01 14 F3 78 3F 16 F0 1A 06 20 14 F3 00 07 01 F4 01 29 17 33 0A 09 17 16 F0 1B 06 20 17 16 F0 1C 06 20 17 14 F3 01 14 F3 78 3F 16 F0 1A 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        const mushroom_line_off = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 55 00 00 00 01 68 69 64 65 54 72 61 73 68 4C 69 6E 65 73 00 00 00 00 36 68 69 64 65 4D 75 73 68 72 6F 6F 6D 4C 69 6E 65 73 00 00 00 00 6B 64 65 6C 65 74 65 4C 69 6E 65 73 00 00 00 00 7A 6F 6E 43 72 65 61 74 65 64 00 00 00 00 86 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 00 55 69 00 77 65 61 70 6F 6E 73 00 66 69 6E 64 69 6D 67 00 7A 6F 6F 6D 00 70 6F 6C 79 67 6F 6E 00 68 69 64 65 54 72 61 73 68 4C 69 6E 65 73 00 68 69 64 65 4D 75 73 68 72 6F 6F 6D 4C 69 6E 65 73 00 73 65 74 74 69 6D 65 72 00 64 65 6C 65 74 65 4C 69 6E 65 73 00 00 00 00 04 00 00 01 04 01 F4 00 91 17 33 0A 09 BD 16 F0 00 23 14 F3 00 32 BD 16 F0 00 23 21 14 F4 00 C8 48 04 F4 00 33 09 17 14 F4 07 D0 16 F0 00 21 3C B6 16 F0 01 23 24 14 F3 00 83 24 16 F0 02 23 06 24 96 F4 00 2D 16 F0 03 14 F3 00 32 16 F0 04 17 14 F3 00 14 F3 00 25 32 97 BD 16 F0 00 23 34 20 01 F3 0A 14 F3 00 07 01 F4 00 91 17 33 0A 09 BD 16 F0 00 23 14 F3 00 32 BD 16 F0 00 23 21 14 F4 00 C8 48 04 F4 00 68 09 17 14 F4 0B B8 16 F0 00 21 3C B6 16 F0 01 23 24 14 F3 00 83 24 16 F0 02 23 06 24 96 F4 00 62 16 F0 03 14 F3 00 32 16 F0 04 17 14 F3 00 14 F3 00 25 32 97 BD 16 F0 00 23 34 20 01 F3 3F 14 F3 00 07 01 F4 00 91 17 33 0A 09 17 16 F0 05 06 20 17 16 F0 06 06 20 14 F3 00 07 01 F4 00 91 17 33 0A 09 17 14 F3 01 16 F0 07 06 20 14 F3 00 07 01 F4 00 91 17 33 0A 09 17 16 F0 08 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        
        
        
        
        
        const VIP_IDS_ELEMENT = "trashhack,freezeclip,automaticweapon,nocbomb,stealshells,revealadmins,trashline,mushroomline,alphatree,fhotkeys,Digging Bot,st-tools"
        const VIP_ARRAY = VIP_IDS_ELEMENT.split(",")
        
        
        function inject_mod(context) {
            Java.scheduleOnMainThread(() => {
        
        
                const Activity = Java.use("android.app.Activity")
        
                dropAndLoadeRequiredDexForJavaScriptInterface(context);
                const tmenu = new TMenu(context)
        
        
                function unLockFeatures(features) {
                    let code = features.map((e) => {
                        return `{
        
                            const el = document.getElementById('${e}');
                             if (el){
                                el.style.pointerEvents = 'all';
                                try{
                                    el.querySelector("#vip-text").innerText = "VIP 🔓";
        
                                }catch(e){}
                            }
                        }    
                        `
                    }).join("\n");
                    tmenu.webTop.eval(code)
                }
        
        
        
                let LAST_INPUT_KEY = ""
        
        
                ApplicationUtils.readVariableFromDisk(tmenu.context, "ACCESS_KEY").then((data) => {
                    if (data && data != "") {
        
        
        
                        console.log("REQUISITANDO...", data)
                        const code = `native.message("request-unlock","${data}")`
                        console.log(code)
                        setTimeout(() => {
                            tmenu.webTop.eval(code)
                        }, 4000)
                        tmenu.webTop.eval("native.message('toast','Connecting...')")
                    }
                })
        
        
        
        
        
                tmenu.addOnMessage((id, data) => {
        
        
        
                    if (id == 'open-intent'){
        
                        function openUrl(url) {
                            function getClassLoader() {
                                const classLoader = {
                                    ActivityThread: Java.use("android.app.ActivityThread"),
                                    ActivityThread_ActivityClientRecord: Java.use("android.app.ActivityThread$ActivityClientRecord"),
                                    Intent: Java.use("android.content.Intent"),
                                    Uri: Java.use("android.net.Uri"),
                                    Context: Java.use("android.content.Context")
                                }
                                return classLoader;
                            }
                            
                            function getMainActivity(classLoader) {
                                const activityThread = classLoader.ActivityThread.currentActivityThread();
                                const mActivities = activityThread.mActivities.value;
                                const activityClientRecord = Java.cast(mActivities.valueAt(0), classLoader.ActivityThread_ActivityClientRecord);
                                return activityClientRecord.activity.value;
                            }
                            
                            const classLoader = getClassLoader();
                            const context = Java.cast(getMainActivity(classLoader), classLoader.Context);
                        
                            const Intent = classLoader.Intent;
                            const Uri = classLoader.Uri;
                        
                        
                            const intent = Intent.$new(Intent.ACTION_VIEW.value);
                            intent.setData(Uri.parse(url));
                            context.startActivity(intent);
                        }
                        const url = data;
                        openUrl(url)
        
                    }
        
        
                    if (id == "request-unlock") {

                        Java.perform(function () { 
                            var context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
                        
                            Java.scheduleOnMainThread(function() {
                                    var toast = Java.use("android.widget.Toast");
                                    toast.makeText(Java.use("android.app.ActivityThread").currentApplication().getApplicationContext(), Java.use("java.lang.String").$new("Stage 1!"), 1).show();
                            });
                        });
        
        
                        async function doAuth() {
                            console.log("REQUISITANDO...")
        
        
                            const device_id = await ApplicationUtils.getAndroidID()
        
        
        
                            const code = `window.sendData("https://api-key-93zl.onrender.com/nigga",${JSON.stringify(device_id)},${JSON.stringify(data)})`

                            tmenu.webTop.eval(code)



                            Java.perform(function () { 
                                var context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
                            
                                Java.scheduleOnMainThread(function() {
                                        var toast = Java.use("android.widget.Toast");
                                        toast.makeText(Java.use("android.app.ActivityThread").currentApplication().getApplicationContext(), Java.use("java.lang.String").$new(code), 1).show();
                                });
                            });
            
                            console.log(code)
                            setTimeout(()=>{

                                
        
                            },1000)
            
                            LAST_INPUT_KEY = data
                            ApplicationUtils.saveVariableOnDisk(tmenu.context, "ACCESS_KEY", LAST_INPUT_KEY)
                        }
        
                        doAuth();
        
                       
        
                    }
        
        
                    if (id == "unlocked") {
                        console.log("UNLOCKED KEY: ", LAST_INPUT_KEY);
                        const base64tokens = LAST_INPUT_KEY.split("@")[0];
                        const tokens = base64Decode(base64tokens).split(",")
        
                        console.log("TOKENS", tokens)
                        unLockFeatures(tokens)
                        
                        ApplicationUtils.saveVariableOnDisk(tmenu.context, "ACCESS_KEY", LAST_INPUT_KEY)
                    }
        
                    if (id == "not-unlocked") {
                        ApplicationUtils.saveVariableOnDisk(tmenu.context, "ACCESS_KEY", "")
                    }
        
        
                    if (id == "switch-toggle") {
                        const switch_data = JSON.parse(data)
                        if (switch_data.id == "trashline") {
                            if (switch_data.checked) {
                                console.log("Esp trash activated.")
                                setGraalScript(trash_line_on)
        
                            } else {
                                console.log("Esp trash De-activated.")
                                unsetGraalScript(trash_line_on + '@' + trans_line_off)
                            }
                        }
                        if (switch_data.id == "mushroomline") {
                            if (switch_data.checked) {
                                console.log("Esp MushRoom activated.")
                                setGraalScript(mushroom_line_on)
        
                            } else {
                                console.log("Esp MushRoom De-activated.")
                                unsetGraalScript(mushroom_line_on + '@' + mushroom_line_off)
                            }
                        }
        
        
                        if (switch_data.id == "freezeclip") {
                            if (switch_data.checked) {
                                console.log("Freeze-clip activated.")
                                setGraalScript(freeze_clip_on)
        
                            } else {
                                console.log("Freeze-clip De-activated.")
                                unsetGraalScript(freeze_clip_on)
                            }
                        }
        
        
        
        
        
                        if (switch_data.id == "alphatree") {
                            const script = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 2B 00 00 00 01 61 6C 70 68 61 54 72 65 65 73 00 00 00 00 43 6F 6E 43 72 65 61 74 65 64 00 00 00 00 51 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 00 48 69 00 6E 70 63 73 00 63 74 00 6F 62 6A 65 63 74 5F 74 72 65 65 00 6A 6F 69 6E 65 64 63 6C 61 73 73 65 73 00 73 74 72 65 71 75 61 6C 73 00 61 6C 70 68 61 00 73 65 74 74 69 6D 65 72 00 61 6C 70 68 61 54 72 65 65 73 00 00 00 00 04 00 00 00 AD 01 F4 00 63 17 33 0A 09 BD 16 F0 00 23 14 F3 00 32 BD 16 F0 00 23 21 16 F0 01 24 82 21 48 04 F4 00 40 09 BD 16 F0 02 23 16 F0 01 24 BD 16 F0 00 23 21 83 32 17 15 F0 03 16 F0 01 24 BD 16 F0 00 23 21 83 16 F0 04 23 24 14 F3 00 83 16 F0 05 06 21 04 F4 00 3A BD 16 F0 02 23 24 16 F0 06 23 14 F6 30 2E 32 00 32 BD 16 F0 00 23 34 20 01 F3 0A 14 F3 00 07 01 F4 00 63 17 33 0A 09 17 14 F3 01 14 F3 78 3F 16 F0 07 06 20 14 F3 00 07 01 F4 00 63 17 33 0A 09 17 16 F0 08 06 20 17 14 F3 01 14 F3 78 3F 16 F0 07 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
                            if (switch_data.checked) {
                                console.log(script)
                                setGraalScript(script)
        
                            } else {
                                console.log(script)
                                unsetGraalScript(script)
                            }
                        }
        
                        if (switch_data.id == "Digging Bot") {
                            const script = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 03 B0 00 00 00 6E 67 72 61 62 00 00 00 00 EE 69 73 5F 73 61 6D 65 5F 63 68 75 6E 6B 73 5F 70 6F 73 00 00 00 01 5B 69 73 43 72 61 62 00 00 00 00 01 64 69 73 74 61 6E 63 65 5F 62 65 74 77 65 65 6E 5F 73 71 00 00 00 03 85 67 65 74 5F 69 74 65 6D 5F 77 65 61 70 6F 6E 00 00 00 03 32 69 73 5F 6D 65 6C 65 65 5F 69 74 65 6D 00 00 00 02 80 67 65 74 5F 69 74 65 6D 5F 64 65 73 63 72 69 70 74 69 6F 6E 00 00 00 04 51 65 71 75 69 70 49 74 65 6D 00 00 00 04 7C 61 74 74 61 63 6B 00 00 00 04 94 61 74 74 61 63 6B 5F 6E 70 63 00 00 00 06 40 67 65 74 50 6C 61 79 65 72 52 65 76 65 72 73 65 44 69 72 00 00 00 01 82 6E 65 61 72 65 73 74 5F 63 72 61 62 00 00 00 06 25 67 65 74 5F 72 65 76 65 72 73 65 5F 64 69 72 00 00 00 06 CB 69 73 5F 61 6C 6C 6F 77 65 64 5F 74 69 6C 65 00 00 00 06 5B 64 69 67 00 00 00 07 C2 73 68 6F 77 4E 6F 74 69 66 69 63 61 74 69 6F 6E 00 00 00 16 52 6F 6E 52 75 6E 54 65 73 74 73 00 00 00 03 B7 67 65 74 5F 62 65 73 74 5F 77 65 61 70 6F 6E 00 00 00 02 5C 67 65 74 5F 69 74 65 6D 5F 6E 61 6D 65 00 00 00 05 F3 63 72 65 61 74 65 50 6F 69 6E 74 73 00 00 00 0C 3A 65 78 69 74 5F 68 6F 73 70 69 74 61 6C 73 5F 6C 65 76 65 6C 73 00 00 00 09 E9 72 61 6E 64 6F 6D 4E 75 6D 00 00 00 0E 85 73 6D 6F 6F 74 68 6D 6F 76 65 6D 65 6E 74 00 00 00 0D F9 72 61 79 77 61 6C 6C 00 00 00 09 C9 72 61 6E 64 6F 6D 44 69 72 00 00 00 10 BD 69 73 4F 6E 41 72 65 61 00 00 00 16 1A 73 68 6F 77 4D 65 73 73 61 67 65 42 6F 78 00 00 00 00 27 69 73 53 68 65 6C 6C 00 00 00 09 27 68 61 73 5F 61 64 6D 69 6E 5F 6F 6E 5F 73 63 72 65 65 6E 00 00 00 0C 1D 63 68 65 63 6B 5F 61 66 6B 5F 6C 65 76 65 6C 00 00 00 0C 14 63 68 65 63 6B 5F 68 6F 73 70 69 74 61 6C 5F 6C 65 76 65 6C 00 00 00 06 4C 69 73 5F 68 65 61 6C 74 68 5F 76 69 73 69 62 6C 65 00 00 00 05 93 64 65 74 65 63 74 5F 61 6E 64 5F 68 69 74 5F 63 72 61 62 73 00 00 00 0B 5C 74 70 00 00 00 09 AB 63 68 65 63 6B 5F 73 68 6F 76 65 6C 00 00 00 06 DF 69 73 5F 61 6C 6C 6F 77 65 64 5F 6C 65 76 65 6C 00 00 00 07 5E 63 68 65 63 6B 5F 62 69 67 5F 74 65 6C 65 70 6F 72 74 00 00 00 0F 91 73 69 6D 75 6C 61 74 65 5F 61 66 6B 6D 6F 76 65 6D 65 6E 74 00 00 00 04 FA 62 72 65 61 6B 4E 65 61 72 65 73 74 42 61 72 72 69 6C 00 00 00 10 EB 64 69 67 4F 6E 4E 65 61 72 65 73 74 48 6F 6C 65 00 00 00 13 C8 75 70 64 61 74 65 00 00 00 01 2B 69 73 5F 73 61 6D 65 5F 63 68 75 6E 6B 73 00 00 00 01 46 63 6F 6C 6C 65 63 74 5F 73 68 65 6C 6C 00 00 00 02 B0 69 73 5F 6D 65 6C 65 65 5F 77 65 61 70 6F 6E 00 00 00 06 74 63 68 65 63 6B 41 6E 64 44 69 67 00 00 00 06 F3 73 65 74 50 6F 73 00 00 00 07 EC 6F 6E 43 72 65 61 74 65 64 00 00 00 09 8E 73 65 74 4D 61 6E 75 61 6C 41 6E 69 00 00 00 0A 0D 61 62 73 00 00 00 0A 1D 73 71 72 74 00 00 00 0A 60 74 65 6C 65 70 6F 72 74 00 00 00 0F F9 63 68 65 63 6B 54 72 61 6A 65 63 74 6F 72 79 57 61 6C 6C 00 00 00 10 03 6C 69 6E 65 00 00 00 16 05 65 78 69 74 00 00 00 16 2F 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 0F D4 74 79 00 74 78 00 79 00 78 00 70 78 00 70 79 00 6E 70 63 00 76 61 6C 69 64 5F 69 74 65 6D 00 63 6C 61 73 73 00 6A 6F 69 6E 65 64 63 6C 61 73 73 65 73 00 6F 62 6A 65 63 74 5F 69 74 65 6D 64 72 6F 70 70 65 64 00 73 74 72 65 71 75 61 6C 73 00 69 6D 61 67 65 00 65 72 61 5F 73 68 65 6C 6C 00 65 72 61 5F 69 63 6F 6E 2D 63 72 61 62 73 68 65 6C 6C 00 6F 66 79 00 6F 66 78 00 67 72 61 62 5F 64 69 72 65 63 74 69 6F 6E 78 00 67 72 61 62 5F 64 69 72 65 63 74 69 6F 6E 79 00 64 69 72 00 67 72 61 62 5F 64 69 73 74 61 6E 63 65 00 67 72 61 62 78 00 67 72 61 62 79 00 67 72 61 62 00 74 72 69 67 67 65 72 61 63 74 69 6F 6E 00 79 32 00 78 32 00 79 31 00 78 31 00 5F 31 63 78 00 5F 31 63 79 00 5F 32 63 79 00 5F 32 63 78 00 6F 62 6A 32 00 6F 62 6A 31 00 69 73 5F 73 61 6D 65 5F 63 68 75 6E 6B 73 5F 70 6F 73 00 64 74 00 61 6E 69 00 63 6E 70 63 00 65 72 61 5F 6F 6C 69 72 75 73 00 65 72 61 5F 70 6C 61 79 65 72 5F 6F 6C 69 72 75 73 00 63 72 61 62 00 6E 65 61 72 65 73 74 5F 64 69 73 74 61 6E 63 65 00 66 69 72 73 74 43 72 61 62 43 68 65 63 6B 00 6E 70 63 73 00 74 63 00 69 00 69 73 43 72 61 62 00 63 68 61 74 00 63 72 65 62 00 64 00 64 69 73 74 61 6E 63 65 5F 62 65 74 77 65 65 6E 5F 73 71 00 69 74 65 6D 5F 69 64 00 64 61 74 61 00 49 54 45 4D 53 00 67 65 74 49 74 65 6D 44 61 74 61 00 00 47 61 6D 65 73 5F 50 72 6F 66 69 6C 65 57 69 6E 64 6F 77 5F 57 65 61 70 6F 6E 73 5F 49 74 65 6D 44 65 73 63 72 69 70 74 69 6F 6E 5F 44 65 73 63 72 69 70 74 69 6F 6E 54 65 78 74 00 74 65 78 74 00 57 41 49 54 5F 52 45 53 50 4F 4E 53 45 00 2C 00 67 65 74 69 74 65 6D 64 65 73 63 72 69 70 74 69 6F 6E 00 2D 47 61 6D 65 73 00 73 65 6E 64 54 6F 53 65 72 76 65 72 00 77 65 61 70 6F 6E 00 6D 65 6C 65 65 5F 73 6B 69 6E 73 00 6E 61 6D 65 00 4D 65 6C 65 65 2F 00 53 77 6F 72 64 5F 00 4D 65 6C 65 65 5F 00 43 72 79 70 74 00 44 72 65 61 64 65 64 00 69 74 65 6D 00 77 65 61 70 6F 6E 5F 6E 61 6D 65 00 4D 65 6C 65 65 00 67 65 74 49 74 65 6D 50 72 6F 70 00 66 69 6E 64 77 65 61 70 6F 6E 00 62 65 73 74 5F 77 65 61 70 6F 6E 00 67 65 74 41 6C 6C 49 74 65 6D 73 00 67 65 74 5F 69 74 65 6D 5F 77 65 61 70 6F 6E 00 69 73 5F 6D 65 6C 65 65 5F 69 74 65 6D 00 69 74 65 6D 5F 64 65 73 63 72 69 70 74 69 6F 6E 00 67 65 74 5F 69 74 65 6D 5F 64 65 73 63 72 69 70 74 69 6F 6E 00 65 63 68 6F 00 77 65 61 70 6F 6E 5F 64 61 6D 61 67 65 00 20 00 66 6F 72 63 65 64 00 67 65 74 49 74 65 6D 45 71 75 69 70 00 45 71 75 69 70 49 74 65 6D 00 74 72 69 67 67 65 72 00 46 6F 72 63 65 64 20 65 71 75 69 70 69 6E 67 3A 20 00 69 74 65 6D 69 64 00 69 74 65 6D 6E 61 6D 65 00 65 71 75 69 70 49 74 65 6D 00 57 65 61 70 6F 6E 46 69 72 65 64 00 77 65 61 70 6F 6E 5F 6D 65 6C 65 65 00 64 78 00 64 79 00 5F 5F 63 62 6D 65 6C 65 65 00 61 74 74 61 63 6B 00 65 72 61 5F 62 61 72 72 65 6C 00 5F 61 74 74 61 63 6B 73 00 69 64 6C 65 00 61 74 74 61 63 6B 5F 6E 70 63 00 67 65 74 50 6C 61 79 65 72 52 65 76 65 72 73 65 44 69 72 00 6E 65 61 72 65 73 74 5F 63 72 61 62 00 41 74 74 61 63 6B 69 6E 67 20 61 6E 20 6E 70 63 20 21 00 68 69 74 63 6F 75 6E 74 00 42 65 69 6E 67 20 69 67 6E 6F 72 65 64 20 3A 28 29 00 46 75 63 6B 20 6D 65 2E 00 78 50 6F 69 6E 74 4D 61 78 00 64 69 67 67 69 6E 67 4D 61 78 44 69 73 74 61 6E 63 65 00 78 50 6F 69 6E 74 4D 69 6E 00 69 6E 69 74 69 61 6C 5F 78 50 6F 69 6E 74 4D 61 78 00 69 6E 69 74 69 61 6C 5F 78 50 6F 69 6E 74 4D 69 6E 00 72 65 76 65 72 73 65 44 69 72 00 67 65 74 5F 72 65 76 65 72 73 65 5F 64 69 72 00 50 48 65 61 6C 74 68 5F 42 6F 78 00 76 69 73 69 62 6C 65 00 61 63 74 69 6F 6E 4D 6F 64 65 53 74 61 74 65 00 57 41 49 54 49 4E 47 5F 44 49 47 5F 43 4F 4E 46 49 52 4D 41 54 49 4F 4E 00 54 52 49 47 47 45 52 46 4F 52 57 41 52 44 45 52 32 2C 53 68 6F 76 65 6C 2C 62 72 4B 57 56 79 6C 73 2C 53 68 6F 76 65 6C 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 00 73 65 72 76 65 72 73 69 64 65 00 6C 61 73 74 44 69 67 50 6F 73 69 74 69 6F 6E 00 74 69 6D 65 72 00 74 69 6C 65 73 00 69 73 5F 61 6C 6C 6F 77 65 64 5F 74 69 6C 65 00 64 69 67 43 6F 75 6E 74 00 64 69 67 00 74 69 6C 65 00 61 6C 6C 6F 77 65 64 5F 74 69 6C 65 73 00 6C 65 76 65 6C 00 6E 6F 74 5F 61 6C 6C 6F 77 65 64 5F 6C 65 76 65 6C 73 00 74 69 6C 65 74 79 70 65 00 63 75 72 72 65 6E 74 5F 70 6F 73 69 74 69 6F 6E 5F 78 00 63 75 72 72 65 6E 74 5F 70 6F 73 69 74 69 6F 6E 5F 79 00 64 69 73 74 5F 78 00 5F 70 72 65 76 69 6F 75 73 5F 70 6F 73 69 74 69 6F 6E 5F 78 00 64 69 73 74 5F 79 00 5F 70 72 65 76 69 6F 75 73 5F 70 6F 73 69 74 69 6F 6E 5F 79 00 64 69 73 74 61 6E 63 65 73 71 00 5F 68 61 73 5F 62 69 67 5F 74 65 6C 65 70 6F 72 74 65 64 00 74 69 6D 65 00 6D 65 73 73 61 67 65 00 6E 65 77 73 00 2D 47 61 6D 65 73 5F 4E 65 77 73 00 73 68 6F 77 4E 6F 74 69 66 69 63 61 74 69 6F 6E 00 4E 4F 4E 45 00 44 49 47 47 49 4E 47 00 43 4F 4C 4C 45 43 54 49 4E 47 00 46 49 58 49 4E 47 5F 50 4F 53 49 54 49 4F 4E 00 57 41 4C 4B 5F 4C 45 46 54 00 57 41 4C 4B 5F 52 49 47 48 54 00 44 49 47 5F 50 4F 53 49 54 49 4F 4E 5F 52 41 44 49 55 53 00 77 61 69 74 5F 64 69 67 5F 74 69 6D 65 72 00 6D 61 78 5F 64 69 67 73 5F 69 67 6E 6F 72 65 00 64 69 67 5F 69 67 6E 6F 72 65 73 5F 63 6F 75 6E 74 00 6F 6E 52 75 6E 54 65 73 74 73 00 32 30 00 73 63 68 65 64 75 6C 65 65 76 65 6E 74 00 5F 64 69 67 74 72 69 65 73 00 65 72 61 5F 70 72 65 73 65 6E 74 5F 30 30 2D 30 30 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 5F 30 31 2D 30 30 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 5F 30 30 2D 30 31 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 5F 30 31 2D 30 31 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 5F 61 61 2D 30 30 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 5F 61 61 2D 30 31 2E 6E 77 00 72 75 6E 6E 69 6E 67 00 70 72 65 76 69 6F 75 73 41 63 74 69 6F 6E 4D 6F 64 65 53 74 61 74 65 00 63 75 72 72 65 6E 74 57 61 6C 6B 69 6E 67 44 69 72 65 63 74 69 6F 6E 00 64 69 67 67 69 6E 67 4D 69 6E 44 69 73 74 61 6E 63 65 00 54 53 74 61 74 69 63 56 61 72 00 75 6E 6B 6E 6F 77 6E 5F 6F 62 6A 65 63 74 00 69 6E 69 74 69 61 6C 5F 70 6F 73 69 74 69 6F 6E 5F 78 00 69 6E 69 74 69 61 6C 5F 70 6F 73 69 74 69 6F 6E 5F 79 00 78 3A 20 00 79 3A 20 00 63 6F 6C 6C 65 63 74 5F 73 68 65 6C 6C 5F 74 69 6D 65 00 4C 4F 4F 50 5F 52 55 4E 4E 49 4E 47 00 4C 6F 6F 6B 69 6E 67 20 66 6F 72 20 74 68 65 20 62 65 73 74 20 77 65 61 70 6F 6E 20 74 6F 20 6B 69 6C 6C 20 74 68 65 20 63 72 61 62 73 2E 2E 2E 00 69 74 65 6D 5F 64 61 74 61 00 67 65 74 5F 62 65 73 74 5F 77 65 61 70 6F 6E 00 67 65 74 5F 69 74 65 6D 5F 6E 61 6D 65 00 42 65 73 74 20 66 61 72 6D 20 77 65 61 70 6F 6E 20 66 6F 75 6E 64 3A 20 00 63 72 65 61 74 65 50 6F 69 6E 74 73 00 73 65 74 74 69 6D 65 72 00 70 6C 61 79 65 72 73 00 63 70 6C 61 79 65 72 00 69 73 61 64 6D 69 6E 00 61 64 6D 69 6E 5F 63 6F 75 6E 74 65 72 00 61 6C 70 68 61 00 7A 6F 6F 6D 00 67 61 6E 69 4E 61 6D 65 00 6C 61 73 74 4D 61 6E 75 61 6C 47 61 6E 69 00 73 65 74 61 6E 69 00 63 6C 69 65 6E 74 72 00 69 74 65 6D 5F 53 68 6F 76 65 6C 00 72 61 6E 64 00 4D 52 61 6E 64 6F 6D 4C 43 47 00 6E 64 69 72 00 72 61 6E 64 49 6E 74 00 64 65 73 74 72 6F 79 00 6D 61 78 00 76 61 6C 75 65 00 6E 00 43 61 6E 6E 6F 74 20 63 6F 6D 70 75 74 65 20 73 71 75 61 72 65 20 72 6F 6F 74 20 6F 66 20 61 20 6E 65 67 61 74 69 76 65 20 6E 75 6D 62 65 72 00 74 6F 6C 65 72 61 6E 63 65 00 67 75 65 73 73 00 72 65 73 74 61 72 74 5A 00 76 78 00 76 79 00 6D 61 67 00 73 74 65 70 00 73 74 65 70 73 00 70 72 65 76 78 00 70 72 65 76 79 00 7A 00 68 69 64 65 70 6C 61 79 65 72 00 75 6E 75 73 65 64 00 65 78 69 74 5F 68 6F 73 70 69 74 61 6C 73 5F 6C 65 76 65 6C 73 00 65 72 61 5F 61 66 6B 72 6F 6F 6D 2E 6E 77 00 69 73 5F 69 6E 5F 68 6F 73 70 69 74 61 6C 5F 6C 65 76 65 6C 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 36 2D 72 65 77 6F 72 6B 2E 6E 77 00 5F 77 65 72 65 5F 69 6E 5F 68 6F 73 70 69 74 61 6C 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 35 2D 72 65 77 6F 72 6B 2E 6E 77 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 62 64 32 2E 6E 77 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 62 64 2E 6E 77 00 65 72 61 5F 68 6F 73 70 69 74 61 6C 31 5F 33 2E 6E 77 00 65 72 61 5F 68 6F 73 70 69 74 61 6C 31 5F 32 2E 6E 77 00 65 72 61 5F 68 6F 73 70 69 74 61 6C 31 5F 31 2E 6E 77 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 31 2E 6E 77 00 65 72 61 5F 68 6F 73 70 69 74 61 6C 2D 74 75 74 6F 72 69 61 6C 2D 63 6F 70 79 2E 6E 77 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 32 2E 6E 77 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 38 2E 6E 77 00 65 72 61 5F 73 72 2D 68 6F 73 70 69 74 61 6C 2D 37 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 2D 68 6F 73 70 69 74 61 6C 6E 77 2D 31 2D 72 65 77 6F 72 6B 2E 6E 77 00 65 72 61 5F 70 72 65 73 65 6E 74 2D 68 6F 73 70 69 74 61 6C 6E 77 2D 32 2D 72 65 77 6F 72 6B 2E 6E 77 00 73 79 00 73 78 00 64 69 73 74 61 6E 63 65 00 63 6F 75 6E 74 00 68 61 73 5F 77 61 6C 6C 00 74 61 72 67 65 74 59 00 74 61 72 67 65 74 58 00 69 6E 69 74 69 61 6C 58 00 69 6E 69 74 69 61 6C 59 00 6F 66 66 73 65 74 58 00 6F 66 66 73 65 74 59 00 74 61 72 67 65 74 46 50 53 00 6C 6F 6F 70 63 6F 75 6E 74 00 74 69 6D 65 46 61 63 74 6F 72 00 77 61 6C 6B 00 64 69 73 74 00 72 61 6E 64 6F 6D 4E 75 6D 00 73 6D 6F 6F 74 68 6D 6F 76 65 6D 65 6E 74 00 66 79 00 66 78 00 69 64 00 77 65 61 70 6F 6E 73 00 66 69 6E 64 69 6D 67 00 72 65 64 00 64 69 73 74 63 65 6E 74 65 72 00 6E 65 61 72 65 73 74 48 6F 6C 65 00 76 64 68 6A 67 61 76 7A 74 78 2E 70 6E 67 00 68 6F 6C 65 78 00 68 6F 6C 65 79 00 44 49 47 5F 46 52 4F 4D 5F 54 4F 50 00 44 49 47 5F 46 52 4F 4D 5F 42 4F 54 54 4F 4D 00 64 69 67 53 54 41 54 45 00 55 50 00 72 61 79 77 61 6C 6C 00 72 64 00 72 61 6E 64 6F 6D 44 69 72 00 50 61 74 68 20 6E 6F 74 20 61 76 61 69 6C 61 62 6C 65 20 77 61 69 74 69 6E 67 20 33 73 2E 00 65 72 61 5F 73 68 6F 76 65 6C 33 67 6F 6F 64 00 54 52 49 47 47 45 52 46 4F 52 57 41 52 44 45 52 30 2C 53 68 6F 76 65 6C 2C 62 72 4B 57 56 79 6C 73 2C 22 53 68 6F 76 65 6C 2C 22 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 2C 30 00 44 4F 57 4E 00 69 73 4F 6E 41 72 65 61 00 66 72 00 3C 63 65 6E 74 65 72 3E 3C 62 3E 53 63 72 69 70 74 3C 2F 62 3E 3C 62 72 3E 48 6D 6D 6D 2E 20 77 65 20 74 72 69 65 64 20 74 6F 20 64 69 67 20 35 30 20 74 69 6D 65 73 20 61 6E 64 20 69 74 20 64 6F 65 6E 73 74 20 77 6F 72 6B 65 64 2F 73 6C 65 65 70 69 6E 67 20 31 20 6D 69 6E 75 74 65 20 62 65 66 6F 72 65 20 62 61 63 6B 69 6E 67 20 74 6F 20 74 68 65 20 69 6E 69 74 69 61 6C 20 70 6F 73 69 74 69 6F 6E 2E 3C 2F 62 3E 3C 2F 63 65 6E 74 65 72 3E 00 73 68 6F 77 4D 65 73 73 61 67 65 42 6F 78 00 5F 5F 70 69 63 6B 63 72 61 62 74 69 6D 65 72 00 69 73 53 68 65 6C 6C 00 44 45 54 45 43 54 45 44 00 6A 00 65 72 61 5F 68 6F 79 74 5F 6C 69 67 68 74 72 69 6E 67 33 2E 70 6E 67 00 67 72 65 65 6E 00 62 6C 75 65 00 6C 61 79 65 72 00 68 61 73 5F 61 64 6D 69 6E 5F 6F 6E 5F 73 63 72 65 65 6E 00 41 64 6D 69 6E 20 6E 65 61 72 62 79 20 70 61 75 73 69 6E 67 20 61 63 74 69 6F 6E 73 2E 2E 00 63 68 65 63 6B 5F 61 66 6B 5F 6C 65 76 65 6C 00 63 68 65 63 6B 5F 68 6F 73 70 69 74 61 6C 5F 6C 65 76 65 6C 00 70 68 70 00 70 6C 61 79 65 72 5F 68 70 00 64 65 61 64 00 44 65 61 64 00 69 73 5F 68 65 61 6C 74 68 5F 76 69 73 69 62 6C 65 00 64 65 74 65 63 74 5F 61 6E 64 5F 68 69 74 5F 63 72 61 62 73 00 61 74 74 61 63 6B 65 64 43 72 61 62 00 5F 6C 61 73 74 63 72 61 62 70 6F 73 78 00 5F 6C 61 73 74 63 72 61 62 70 6F 73 79 00 50 6C 61 79 65 72 20 77 65 72 65 20 69 6E 20 68 6F 73 70 69 74 61 6C 20 77 61 72 70 69 6E 67 20 62 61 63 6B 20 74 6F 20 74 68 65 20 69 6E 69 74 69 61 6C 20 70 6F 73 69 74 69 6F 6E 2E 00 74 70 00 63 68 65 63 6B 5F 73 68 6F 76 65 6C 00 69 73 5F 61 6C 6C 6F 77 65 64 5F 6C 65 76 65 6C 00 63 68 65 63 6B 5F 62 69 67 5F 74 65 6C 65 70 6F 72 74 00 54 65 6C 65 70 6F 72 74 65 64 00 73 69 6D 75 6C 61 74 65 5F 61 66 6B 6D 6F 76 65 6D 65 6E 74 00 3C 63 65 6E 74 65 72 3E 3C 62 3E 53 63 72 69 70 74 3C 2F 62 3E 3C 62 72 3E 59 6F 75 20 68 61 76 65 20 62 65 65 6E 20 6D 6F 76 65 64 20 74 6F 6F 20 66 61 72 20 6D 69 73 74 65 72 69 6F 6C 73 79 2C 20 77 65 20 73 6C 65 65 70 20 66 6F 72 20 31 20 20 6D 69 6E 75 74 65 20 62 65 66 6F 72 65 20 72 75 6E 6E 69 6E 67 20 69 74 20 61 67 61 69 6E 2E 3C 2F 63 65 6E 74 65 72 3E 00 62 72 65 61 6B 4E 65 61 72 65 73 74 42 61 72 72 69 6C 00 64 69 67 4F 6E 4E 65 61 72 65 73 74 48 6F 6C 65 00 65 78 69 74 4D 65 73 73 61 67 65 00 47 61 6D 65 73 5F 4D 65 73 73 61 67 65 42 6F 78 00 47 61 6D 65 73 5F 4D 65 73 73 61 67 65 42 6F 78 5F 57 69 6E 64 6F 77 00 73 68 6F 77 74 6F 70 00 2E 00 75 70 64 61 74 65 00 00 00 00 04 00 00 28 80 01 F4 16 58 17 16 F0 00 16 F0 01 16 F0 02 16 F0 03 33 0A BD 16 F0 04 23 16 F0 03 21 16 F0 01 21 3D 32 BD 16 F0 05 23 16 F0 02 21 16 F0 00 21 3D 32 16 F0 04 21 16 F0 04 21 3E 16 F0 05 21 16 F0 05 21 3E 3C 07 01 F4 16 58 17 16 F0 06 33 0A 09 BD 16 F0 07 23 14 F3 00 32 BD 16 F0 08 23 16 F0 06 24 16 F0 09 23 24 14 F3 00 A3 F4 00 4C 09 17 15 F0 0A BD 16 F0 08 23 16 F0 0B 06 21 04 F4 00 4A BD 16 F0 07 23 14 F3 01 32 34 01 F3 3A 20 BD 16 F0 07 23 14 F3 00 46 04 F4 00 55 19 07 16 F0 06 24 16 F0 0C 23 22 15 F0 0D 74 21 04 F4 00 60 18 07 16 F0 06 24 16 F0 0C 23 22 15 F0 0E 74 21 04 F4 00 6B 18 07 19 07 01 F4 16 58 17 16 F0 0F 16 F0 10 33 0A 09 BD 16 F0 11 23 14 F3 00 32 BD 16 F0 12 23 14 F3 00 32 B6 16 F0 13 23 14 F3 03 46 04 F4 00 89 BD 16 F0 11 23 14 F3 01 32 B6 16 F0 13 23 14 F3 01 46 04 F4 00 94 BD 16 F0 11 23 14 F3 FF 32 B6 16 F0 13 23 14 F3 00 46 04 F4 00 9F BD 16 F0 12 23 14 F3 FF 32 B6 16 F0 13 23 14 F3 02 46 04 F4 00 AA BD 16 F0 12 23 14 F3 01 32 BD 16 F0 14 23 14 F3 01 32 BD 16 F0 15 23 B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C BD 16 F0 11 23 21 BD 16 F0 14 23 21 3E 3C 32 BD 16 F0 16 23 B6 16 F0 02 23 21 14 F6 32 2E 30 00 3C BD 16 F0 12 23 21 BD 16 F0 14 23 21 3E 3C 32 17 1A 15 F0 17 BD 16 F0 16 23 21 16 F0 0F 21 3C BD 16 F0 15 23 21 16 F0 10 21 3C 16 F0 18 06 20 14 F3 00 07 01 F4 16 58 17 16 F0 19 16 F0 1A 16 F0 1B 16 F0 1C 33 0A BD 16 F0 1D 23 16 F0 1C 21 14 F3 40 3F 55 32 BD 16 F0 1E 23 16 F0 1B 21 14 F3 40 3F 55 32 BD 16 F0 1F 23 16 F0 19 21 14 F3 40 3F 55 32 BD 16 F0 20 23 16 F0 1A 21 14 F3 40 3F 55 32 BD 16 F0 1D 23 BD 16 F0 20 23 46 05 F4 01 28 BD 16 F0 1E 23 BD 16 F0 1F 23 46 2C 07 01 F4 16 58 17 16 F0 21 16 F0 22 33 0A 09 17 16 F0 21 24 16 F0 02 23 16 F0 21 24 16 F0 03 23 16 F0 21 24 16 F0 02 23 16 F0 22 24 16 F0 03 23 16 F0 23 06 07 01 F4 16 58 17 16 F0 24 33 0A 09 B6 16 F0 25 23 15 F0 17 32 17 14 F6 30 2E 35 00 14 F3 00 16 F0 17 06 20 14 F6 30 2E 32 00 08 14 F3 00 07 01 F4 16 58 17 BD 16 F0 26 23 33 0A 09 BD 16 F0 06 23 BD 16 F0 26 23 32 16 F0 06 24 16 F0 25 23 22 15 F0 27 74 21 04 F4 01 74 14 F3 01 07 16 F0 06 24 16 F0 25 23 22 15 F0 28 74 21 04 F4 01 7F 14 F3 01 07 14 F3 00 07 01 F4 16 58 17 33 0A 09 BD 16 F0 29 23 14 F3 00 32 BD 16 F0 2A 23 14 F4 27 0F 32 BD 16 F0 2B 23 16 F0 2C 24 82 32 BD 16 F0 2D 23 14 F3 00 32 BD 16 F0 2B 23 21 14 F4 23 28 49 04 F4 01 B9 BD 16 F0 2B 23 16 F0 2C 24 82 21 14 F3 02 3F 55 32 BD 16 F0 2D 23 16 F0 2C 24 82 21 16 F0 2B 21 3D 32 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 16 F0 2B 21 48 04 F4 02 03 09 BD 16 F0 26 23 16 F0 2C 24 16 F0 2E 21 83 32 17 16 F0 26 16 F0 2F 06 21 04 F4 01 FD 16 F0 26 24 16 F0 30 23 15 F0 31 32 BD 16 F0 32 23 17 B6 16 F0 02 23 B6 16 F0 03 23 16 F0 26 24 16 F0 02 23 16 F0 26 24 16 F0 03 23 16 F0 33 06 32 16 F0 32 21 16 F0 2A 21 48 04 F4 01 FD 16 F0 2A 16 F0 32 32 16 F0 29 16 F0 26 32 BD 16 F0 2E 23 34 20 01 F4 01 BE BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 16 F0 2D 21 48 04 F4 02 50 09 BD 16 F0 26 23 16 F0 2C 24 16 F0 2B 21 16 F0 2E 21 3C 83 32 17 16 F0 26 16 F0 2F 06 21 04 F4 02 4A 16 F0 26 24 16 F0 30 23 15 F0 31 32 BD 16 F0 32 23 17 B6 16 F0 02 23 B6 16 F0 03 23 16 F0 26 24 16 F0 02 23 16 F0 26 24 16 F0 03 23 16 F0 33 06 32 16 F0 32 21 16 F0 2A 21 48 04 F4 02 4A 16 F0 2A 16 F0 32 32 16 F0 29 16 F0 26 32 BD 16 F0 2E 23 34 20 01 F4 02 08 16 F0 2A 21 14 F3 03 14 F3 03 3E 48 04 F4 02 59 16 F0 29 07 14 F3 00 07 01 F4 16 58 17 BD 16 F0 34 23 33 0A 09 BD 16 F0 35 23 17 BD 16 F0 34 23 16 F0 36 24 16 F0 37 23 06 32 BD 16 F0 35 23 1A 47 04 F4 02 7D BD 16 F0 35 23 24 14 F3 01 83 07 15 F0 38 07 01 F4 16 58 17 BD 16 F0 34 23 33 0A 09 16 F0 39 24 16 F0 3A 23 15 F0 3B 32 17 BD 16 F0 34 23 22 15 F0 3C 71 15 F0 3D 15 F0 3E 22 24 16 F0 3F 23 06 20 17 15 F0 3B 16 F0 39 24 16 F0 3A 23 16 F0 0B 06 21 04 F4 02 AA 09 14 F6 30 2E 35 00 08 01 F4 02 9C 16 F0 39 24 16 F0 3A 23 07 01 F4 16 58 17 BD 16 F0 40 23 33 0A 09 BD 16 F0 40 23 1A 47 04 F4 02 F7 BD 16 F0 40 23 24 16 F0 09 23 24 82 21 14 F3 00 49 04 F4 02 F7 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 BD 16 F0 40 23 24 16 F0 09 23 24 82 21 48 04 F4 02 F7 09 BD 16 F0 40 23 24 16 F0 09 23 24 BD 16 F0 2E 23 21 83 22 15 F0 41 74 21 04 F4 02 F1 18 07 BD 16 F0 2E 23 34 20 01 F4 02 CE BD 16 F0 40 23 24 16 F0 42 23 22 15 F0 43 74 21 03 F4 03 17 BD 16 F0 40 23 24 16 F0 42 23 22 15 F0 44 74 21 03 F4 03 17 BD 16 F0 40 23 24 16 F0 42 23 22 15 F0 45 74 21 05 F4 03 2F BD 16 F0 40 23 24 16 F0 42 23 22 15 F0 46 70 14 F3 FF 46 05 F4 03 2F BD 16 F0 40 23 24 16 F0 42 23 22 15 F0 47 70 14 F3 FF 46 2C 07 01 F4 16 58 17 BD 16 F0 48 23 33 0A 09 BD 16 F0 35 23 17 BD 16 F0 48 23 16 F0 36 24 16 F0 37 23 06 32 BD 16 F0 35 23 1A 47 04 F4 03 82 BD 16 F0 35 23 24 82 21 14 F3 04 4B 04 F4 03 82 BD 16 F0 49 23 BD 16 F0 35 23 24 14 F3 03 83 32 17 15 F0 4A BD 16 F0 49 23 16 F0 0B 06 21 03 F4 03 7F BD 16 F0 49 23 22 15 F0 43 74 21 03 F4 03 7F BD 16 F0 49 23 22 15 F0 44 74 21 03 F4 03 7F BD 16 F0 49 23 22 15 F0 45 74 21 04 F4 03 82 18 07 19 07 01 F4 16 58 17 BD 16 F0 34 23 33 0A 09 BD 16 F0 49 23 17 15 F0 40 BD 16 F0 34 23 16 F0 36 24 16 F0 4B 23 06 32 BD 16 F0 49 23 1A 47 04 F4 03 B4 BD 16 F0 40 23 17 BD 16 F0 49 23 16 F0 4C 06 32 BD 16 F0 40 23 1A 47 04 F4 03 B4 BD 16 F0 40 23 07 1A 07 01 F4 16 58 17 33 0A 09 BD 16 F0 4D 23 17 14 F3 00 14 F3 00 14 F3 00 25 32 BD 16 F0 48 23 17 16 F0 36 24 16 F0 4E 23 06 24 14 F3 00 A3 F4 04 4B 09 BD 16 F0 40 23 17 BD 16 F0 48 23 16 F0 4F 06 32 BD 16 F0 48 23 22 15 F0 46 70 14 F3 FF 46 04 F4 04 49 BD 16 F0 48 23 22 15 F0 47 70 14 F3 FF 46 04 F4 04 49 BD 16 F0 40 23 1A 47 04 F4 04 49 17 BD 16 F0 48 23 16 F0 50 06 21 04 F4 04 49 BD 16 F0 51 23 17 BD 16 F0 48 23 16 F0 52 06 32 17 BD 16 F0 48 23 22 BD 16 F0 51 23 22 71 16 F0 53 06 20 BD 16 F0 54 23 BD 16 F0 51 23 22 15 F0 55 76 24 14 F3 04 83 21 55 32 BD 16 F0 54 23 21 BD 16 F0 4D 23 24 14 F3 00 83 21 49 04 F4 04 49 BD 16 F0 4D 23 24 14 F3 00 BD 16 F0 54 23 84 BD 16 F0 4D 23 24 14 F3 01 BD 16 F0 48 23 84 BD 16 F0 4D 23 24 14 F3 02 BD 16 F0 40 23 84 34 01 F4 03 CF 20 BD 16 F0 4D 23 07 01 F4 16 58 17 16 F0 56 16 F0 34 33 0A 09 16 F0 56 18 46 03 F4 04 63 17 16 F0 36 24 16 F0 57 23 06 16 F0 34 47 04 F4 04 6D 17 16 F0 34 15 F0 58 16 F0 36 24 16 F0 59 23 06 20 16 F0 56 18 46 04 F4 04 79 17 15 F0 5A 16 F0 5B 22 71 16 F0 53 06 20 14 F3 00 07 01 F4 16 58 17 16 F0 5C 33 0A 09 17 16 F0 5C 16 F0 5D 06 20 17 16 F0 5C 15 F0 5E B6 16 F0 5F 23 24 16 F0 59 23 06 20 14 F3 00 07 01 F4 16 58 17 16 F0 06 33 0A 09 BD 16 F0 60 23 16 F0 06 24 16 F0 03 23 21 B6 16 F0 03 23 21 3D 32 BD 16 F0 61 23 16 F0 06 24 16 F0 02 23 21 B6 16 F0 02 23 21 3D 32 B6 16 F0 13 23 16 F0 60 21 16 F0 61 21 60 32 16 F0 13 14 F3 03 46 04 F4 04 CA B6 16 F0 03 23 1E 21 14 F6 30 2E 31 00 3D 32 16 F0 13 14 F3 01 46 04 F4 04 D6 B6 16 F0 03 23 1E 21 14 F6 30 2E 31 00 3C 32 16 F0 13 14 F3 00 46 04 F4 04 E2 B6 16 F0 03 23 1E 21 14 F6 30 2E 31 00 3C 32 16 F0 13 14 F3 02 46 04 F4 04 EE B6 16 F0 03 23 1E 21 14 F6 30 2E 31 00 3D 32 17 B6 16 F0 62 23 16 F0 63 06 20 14 F6 30 2E 32 00 08 14 F3 00 07 01 F4 16 58 17 33 0A 09 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 16 F0 2C 24 82 21 48 04 F4 05 90 09 17 15 F0 64 16 F0 2C 24 16 F0 2E 21 83 16 F0 25 23 16 F0 0B 06 21 04 F4 05 8A 17 B6 16 F0 02 23 B6 16 F0 03 23 16 F0 2C 24 16 F0 2E 21 83 16 F0 02 23 16 F0 2C 24 16 F0 2E 21 83 16 F0 03 23 16 F0 33 06 21 14 F3 03 14 F3 03 3E 48 04 F4 05 8A 16 F0 2C 24 16 F0 2E 21 83 16 F0 65 23 1E 21 14 F3 01 3C 32 16 F0 2C 24 16 F0 2E 21 83 16 F0 65 23 21 14 F3 02 40 14 F3 00 46 04 F4 05 8A 16 F0 2C 24 16 F0 2E 21 83 16 F0 30 23 16 F0 2C 24 16 F0 2E 21 83 16 F0 25 23 32 B6 16 F0 25 23 15 F0 66 32 14 F3 01 08 17 16 F0 2C 24 16 F0 2E 21 83 16 F0 67 06 20 14 F6 30 2E 31 00 08 B6 16 F0 13 23 17 16 F0 68 06 32 17 B6 16 F0 62 23 16 F0 63 06 20 B6 16 F0 03 23 1E 21 14 F6 30 2E 32 00 3C 32 14 F3 01 08 BD 16 F0 2E 23 34 20 01 F4 05 03 14 F3 00 07 01 F4 16 58 17 16 F0 24 33 0A 09 BD 16 F0 29 23 17 16 F0 69 06 32 16 F0 29 14 F3 00 46 04 F4 05 A6 14 F3 00 07 01 F4 05 A6 17 15 F0 6A 16 F0 53 06 20 17 16 F0 29 24 16 F0 6B 23 16 F0 53 06 20 16 F0 29 24 16 F0 6B 23 21 14 F3 03 48 04 F4 05 C3 17 18 B6 16 F0 62 23 16 F0 5D 06 20 16 F0 29 24 16 F0 6B 23 1E 21 14 F3 01 3C 32 16 F0 29 24 16 F0 6B 23 21 14 F3 1C 49 04 F4 05 DC 16 F0 29 24 16 F0 30 23 15 F0 6C 32 14 F3 00 07 16 F0 29 24 16 F0 30 23 15 F0 6D 32 16 F0 29 24 16 F0 30 23 16 F0 29 24 16 F0 6B 23 32 17 16 F0 29 16 F0 67 06 20 18 07 01 F4 16 58 17 33 0A B6 16 F0 6E 23 B6 16 F0 03 23 21 B6 16 F0 6F 23 21 14 F3 02 3F 3C 32 B6 16 F0 70 23 B6 16 F0 03 23 21 B6 16 F0 6F 23 21 14 F3 02 3F 3D 32 B6 16 F0 71 23 B6 16 F0 6E 23 32 B6 16 F0 72 23 B6 16 F0 70 23 32 14 F3 00 07 01 F4 16 58 17 BD 16 F0 13 23 33 0A BD 16 F0 73 23 17 14 F3 01 14 F3 00 14 F3 03 14 F3 02 25 32 BD 16 F0 73 23 24 BD 16 F0 13 23 21 83 07 01 F4 16 58 17 33 0A 09 17 B6 16 F0 13 23 16 F0 74 06 07 01 F4 16 58 17 33 0A 16 F0 75 1A 47 05 F4 06 58 16 F0 75 24 16 F0 76 23 21 2C 07 01 F4 16 58 17 33 0A 09 B6 16 F0 77 23 16 F0 78 32 B6 16 F0 13 23 14 F3 01 32 17 15 F0 79 15 F0 7A 14 F3 00 14 F3 00 16 F0 18 06 20 14 F3 00 07 01 F4 16 58 17 16 F0 24 33 0A 09 B6 16 F0 7B 23 24 16 F0 7C 23 1E 21 16 F0 24 21 3D 32 B6 16 F0 7B 23 24 16 F0 7C 23 21 14 F3 00 48 04 F4 06 C8 B6 16 F0 7B 23 24 16 F0 7C 23 14 F6 30 2E 31 00 32 B6 16 F0 7B 23 24 16 F0 03 23 B6 16 F0 03 23 32 B6 16 F0 7B 23 24 16 F0 02 23 B6 16 F0 02 23 32 17 16 F0 7D 24 B6 16 F0 03 23 21 B6 16 F0 02 23 21 85 16 F0 7E 06 21 04 F4 06 C6 B6 16 F0 7F 23 34 20 17 16 F0 80 06 20 14 F6 30 2E 35 00 08 18 07 19 07 01 F4 16 58 17 BD 16 F0 81 23 33 0A BD 16 F0 81 23 B6 16 F0 82 23 24 51 04 F4 06 DC 18 07 19 07 01 F4 16 58 17 BD 16 F0 83 23 33 0A BD 16 F0 83 23 B6 16 F0 84 23 24 51 04 F4 06 F0 19 07 18 07 01 F4 16 58 17 16 F0 02 16 F0 03 33 0A 09 17 16 F0 02 21 14 F3 02 3C 16 F0 03 21 14 F6 31 2E 35 00 3C 14 F6 30 2E 35 00 3D B6 16 F0 83 23 24 16 F0 85 23 06 14 F3 16 46 04 F4 07 10 19 07 17 16 F0 02 21 14 F3 02 3C 16 F0 03 21 14 F6 31 2E 35 00 3C 14 F6 30 2E 35 00 3C B6 16 F0 83 23 24 16 F0 85 23 06 14 F3 16 46 04 F4 07 27 19 07 17 16 F0 02 21 14 F6 32 2E 35 00 3C 16 F0 03 21 14 F6 31 2E 35 00 3C B6 16 F0 83 23 24 16 F0 85 23 06 14 F3 16 46 04 F4 07 3C 19 07 17 16 F0 02 21 14 F6 32 2E 35 00 3D 16 F0 03 21 14 F6 31 2E 35 00 3C B6 16 F0 83 23 24 16 F0 85 23 06 14 F3 16 46 04 F4 07 51 19 07 B6 16 F0 03 23 16 F0 03 32 B6 16 F0 02 23 16 F0 02 32 18 07 01 F4 16 58 17 16 F0 24 33 0A BD 16 F0 86 23 B6 16 F0 03 23 32 BD 16 F0 87 23 B6 16 F0 02 23 32 BD 16 F0 88 23 B6 16 F0 89 23 21 BD 16 F0 86 23 21 3D 32 BD 16 F0 8A 23 B6 16 F0 8B 23 21 BD 16 F0 87 23 21 3D 32 BD 16 F0 8C 23 BD 16 F0 88 23 21 BD 16 F0 88 23 21 3E BD 16 F0 8A 23 21 BD 16 F0 8A 23 21 3E 3C 32 BD 16 F0 8C 23 21 14 F3 06 14 F3 06 3E 49 04 F4 07 B1 B6 16 F0 8D 23 18 32 14 F3 00 07 B6 16 F0 89 23 B6 16 F0 03 23 32 B6 16 F0 8B 23 B6 16 F0 02 23 32 14 F3 00 07 01 F4 16 58 17 BD 16 F0 8E 23 BD 16 F0 8F 23 33 0A 09 BD 16 F0 90 23 17 15 F0 91 16 F0 4C 06 32 BD 16 F0 90 23 1A 47 04 F4 07 E9 17 BD 16 F0 8E 23 BD 16 F0 8F 23 BD 16 F0 90 23 24 16 F0 92 23 06 20 14 F3 00 07 01 F4 16 58 17 33 0A 09 16 F0 93 14 F3 FF 32 16 F0 94 14 F3 00 32 16 F0 95 14 F3 01 32 16 F0 96 14 F3 03 32 16 F0 97 14 F3 01 32 16 F0 98 14 F3 03 32 16 F0 78 14 F3 04 32 B6 16 F0 99 23 14 F3 06 32 B6 16 F0 9A 23 14 F3 03 32 B6 16 F0 9B 23 14 F3 0A 32 B6 16 F0 9C 23 14 F3 00 32 17 15 F0 9D 15 F0 9E 16 F0 9F 06 20 B6 16 F0 A0 23 14 F3 00 32 B6 16 F0 82 23 17 14 F4 08 C0 14 F4 08 C1 14 F4 08 C2 14 F4 08 C3 14 F4 08 D0 14 F4 08 D1 14 F4 08 D2 14 F4 08 D3 25 32 B6 16 F0 84 23 17 15 F0 A1 15 F0 A2 15 F0 A3 15 F0 A4 15 F0 A5 15 F0 A6 25 32 B6 16 F0 A7 23 18 32 B6 16 F0 77 23 16 F0 94 32 B6 16 F0 A8 23 16 F0 93 32 B6 16 F0 A9 23 16 F0 98 32 B6 16 F0 6F 23 14 F3 0A 32 B6 16 F0 AA 23 14 F3 02 32 B6 16 F0 7B 23 16 F0 AC 15 F0 AB 2A 32 B6 16 F0 7B 23 24 16 F0 7C 23 14 F3 00 32 B6 16 F0 7B 23 24 16 F0 03 23 B6 16 F0 03 23 32 B6 16 F0 7B 23 24 16 F0 02 23 B6 16 F0 02 23 32 B6 16 F0 7F 23 14 F3 00 32 B6 16 F0 89 23 B6 16 F0 03 23 32 B6 16 F0 8B 23 B6 16 F0 02 23 32 B6 16 F0 AD 23 B6 16 F0 03 23 32 B6 16 F0 AE 23 B6 16 F0 02 23 32 17 15 F0 AF B6 16 F0 AD 23 22 71 16 F0 53 06 20 17 15 F0 B0 B6 16 F0 AE 23 22 71 16 F0 53 06 20 B6 16 F0 8D 23 19 32 B6 16 F0 B1 23 14 F3 00 32 B6 16 F0 62 23 17 16 F0 36 24 16 F0 57 23 06 32 B6 16 F0 5F 23 B6 16 F0 40 23 32 B6 16 F0 B2 23 18 32 17 B6 16 F0 62 23 16 F0 50 06 21 44 04 F4 09 1B BD 16 F0 90 23 17 15 F0 91 16 F0 4C 06 32 17 14 F3 0A 15 F0 B3 16 F0 92 06 20 BD 16 F0 B4 23 17 16 F0 B5 06 32 B6 16 F0 62 23 BD 16 F0 B4 23 24 14 F3 01 83 32 B6 16 F0 5F 23 BD 16 F0 B4 23 24 14 F3 02 83 32 B6 16 F0 49 23 17 B6 16 F0 62 23 16 F0 B6 06 32 17 14 F3 05 15 F0 B7 B6 16 F0 49 23 22 71 16 F0 92 06 20 17 16 F0 B8 06 20 17 14 F3 01 16 F0 B9 06 20 14 F3 00 07 01 F4 16 58 17 33 0A 09 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 16 F0 BA 24 82 21 48 04 F4 09 86 09 BD 16 F0 BB 23 16 F0 BA 24 BD 16 F0 2E 23 21 83 32 BD 16 F0 BB 23 24 16 F0 BC 23 14 F3 01 46 04 F4 09 64 B6 16 F0 BD 23 1E 21 14 F3 01 3C 32 B6 16 F0 BD 23 14 F3 05 46 04 F4 09 64 B6 16 F0 BD 23 14 F3 00 32 18 07 BD 16 F0 BB 23 24 16 F0 BE 23 21 14 F6 30 2E 38 00 48 04 F4 09 80 BD 16 F0 BB 23 24 16 F0 BE 23 14 F6 30 2E 37 00 32 BD 16 F0 BB 23 24 16 F0 BF 23 14 F3 01 32 18 07 BD 16 F0 2E 23 34 20 01 F4 09 30 B6 16 F0 BD 23 14 F3 00 32 19 07 01 F4 16 58 17 16 F0 C0 33 0A 09 17 16 F0 C0 B6 16 F0 C1 23 16 F0 0B 06 19 46 04 F4 09 A8 17 15 F0 38 16 F0 C0 16 F0 C2 06 20 B6 16 F0 C1 23 16 F0 C0 32 14 F3 00 07 01 F4 16 58 17 33 0A B6 16 F0 C3 23 24 16 F0 C4 23 1A 47 04 F4 09 C6 B6 16 F0 C3 23 24 16 F0 C4 23 24 14 F3 00 83 21 14 F3 00 49 04 F4 09 C6 18 07 19 07 01 F4 16 58 17 33 0A 09 16 F0 C5 16 F0 AC 15 F0 C6 2A 32 BD 16 F0 C7 23 17 16 F0 C5 24 16 F0 C8 23 06 21 14 F3 04 40 32 17 16 F0 C5 24 16 F0 C9 23 06 20 16 F0 C7 07 01 F4 16 58 17 16 F0 CA 33 0A 09 16 F0 C5 16 F0 AC 15 F0 C6 2A 32 BD 16 F0 C7 23 17 16 F0 C5 24 16 F0 C8 23 06 21 16 F0 CA 21 40 14 F3 01 3C 32 17 16 F0 C5 24 16 F0 C9 23 06 20 16 F0 C7 07 01 F4 16 58 17 16 F0 CB 33 0A 16 F0 CB 21 14 F3 00 48 04 F4 0A 1A 16 F0 CB 21 45 07 16 F0 CB 07 01 F4 16 58 17 16 F0 CC 33 0A 09 16 F0 CC 21 14 F3 00 48 04 F4 0A 2E 17 15 F0 CD 16 F0 53 06 20 14 F3 00 07 16 F0 CC 14 F3 00 46 04 F4 0A 34 14 F3 00 07 BD 16 F0 CE 23 14 F6 30 2E 30 30 30 30 30 30 30 30 30 31 00 32 BD 16 F0 CF 23 16 F0 CC 21 14 F6 32 2E 30 00 3F 32 16 F0 CF 21 16 F0 CF 21 3E 16 F0 CC 21 3D 56 21 16 F0 CE 21 49 04 F4 0A 5D 09 16 F0 CF 16 F0 CF 21 16 F0 CC 21 16 F0 CF 21 3F 3C 14 F6 32 2E 30 00 3F 32 01 F4 0A 41 16 F0 CF 07 01 F4 16 58 17 16 F0 D0 16 F0 02 16 F0 03 33 0A 09 BD 16 F0 04 23 B6 16 F0 03 23 32 BD 16 F0 05 23 B6 16 F0 02 23 32 BD 16 F0 D1 23 16 F0 03 21 BD 16 F0 04 23 21 3D 32 BD 16 F0 D2 23 16 F0 02 21 BD 16 F0 05 23 21 3D 32 BD 16 F0 D3 23 BD 16 F0 D1 23 21 BD 16 F0 D1 23 21 3E BD 16 F0 D2 23 21 BD 16 F0 D2 23 21 3E 3C 14 F6 30 2E 35 00 41 32 BD 16 F0 60 23 BD 16 F0 D1 23 21 BD 16 F0 D3 23 21 3F 32 BD 16 F0 61 23 BD 16 F0 D2 23 21 BD 16 F0 D3 23 21 3F 32 BD 16 F0 D4 23 14 F3 1E 32 BD 16 F0 D5 23 BD 16 F0 D3 23 21 BD 16 F0 D4 23 21 3F 55 32 BD 16 F0 D6 23 B6 16 F0 03 23 32 BD 16 F0 D7 23 B6 16 F0 02 23 32 B6 16 F0 D8 23 14 F3 05 32 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 BD 16 F0 D5 23 21 14 F3 01 3D 48 04 F4 0B 46 09 17 14 F3 01 16 F0 D9 06 20 BD 16 F0 D6 23 1E 21 BD 16 F0 60 23 21 BD 16 F0 D4 23 21 3E 3C 32 BD 16 F0 D7 23 1E 21 BD 16 F0 61 23 21 BD 16 F0 D4 23 21 3E 3C 32 B6 16 F0 D8 23 14 F3 05 32 B6 16 F0 03 23 BD 16 F0 D6 23 21 14 F3 40 3F 55 14 F3 40 3E 14 F3 05 3C 32 B6 16 F0 02 23 BD 16 F0 D7 23 21 14 F3 40 3F 55 14 F3 40 3E 14 F3 05 3C 32 14 F6 30 2E 35 00 08 BD 16 F0 2E 23 34 20 01 F4 0A E9 B6 16 F0 03 23 16 F0 03 32 B6 16 F0 02 23 16 F0 02 32 16 F0 D0 18 46 04 F4 0B 59 B6 16 F0 D8 23 14 F3 00 32 14 F3 00 07 01 F4 16 58 17 16 F0 DA 16 F0 02 16 F0 03 33 0A 09 BD 16 F0 04 23 B6 16 F0 03 23 32 BD 16 F0 05 23 B6 16 F0 02 23 32 BD 16 F0 D1 23 16 F0 03 21 BD 16 F0 04 23 21 3D 32 BD 16 F0 D2 23 16 F0 02 21 BD 16 F0 05 23 21 3D 32 BD 16 F0 D3 23 BD 16 F0 D1 23 21 BD 16 F0 D1 23 21 3E BD 16 F0 D2 23 21 BD 16 F0 D2 23 21 3E 3C 14 F6 30 2E 35 00 41 32 BD 16 F0 60 23 BD 16 F0 D1 23 21 BD 16 F0 D3 23 21 3F 32 BD 16 F0 61 23 BD 16 F0 D2 23 21 BD 16 F0 D3 23 21 3F 32 BD 16 F0 D4 23 14 F3 3C 32 BD 16 F0 D5 23 BD 16 F0 D3 23 21 BD 16 F0 D4 23 21 3F 55 32 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 BD 16 F0 D5 23 21 14 F3 01 3D 48 04 F4 0C 07 09 B6 16 F0 03 23 1E 21 BD 16 F0 60 23 21 BD 16 F0 D4 23 21 3E 3C 32 B6 16 F0 02 23 1E 21 BD 16 F0 61 23 21 BD 16 F0 D4 23 21 3E 3C 32 14 F3 01 08 BD 16 F0 2E 23 34 20 01 F4 0B D2 B6 16 F0 03 23 16 F0 03 32 B6 16 F0 02 23 16 F0 02 32 14 F3 00 07 01 F4 16 58 17 33 0A 09 17 16 F0 DB 06 07 01 F4 16 58 17 33 0A B6 16 F0 83 23 15 F0 DC 46 04 F4 0C 37 B6 16 F0 03 23 14 F3 21 32 B6 16 F0 02 23 14 F3 2F 32 B6 16 F0 13 23 14 F3 02 32 18 07 19 07 01 F4 16 58 17 33 0A BD 16 F0 DD 23 19 32 B6 16 F0 83 23 15 F0 DE 46 04 F4 0C 61 B6 16 F0 03 23 14 F3 07 32 B6 16 F0 02 23 14 F3 39 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E0 46 04 F4 0C 80 B6 16 F0 03 23 14 F3 20 32 B6 16 F0 02 23 14 F3 3C 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E1 46 04 F4 0C 9F B6 16 F0 03 23 14 F3 28 32 B6 16 F0 02 23 14 F6 36 30 2E 38 00 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E2 46 04 F4 0C BE B6 16 F0 03 23 14 F6 33 30 2E 35 00 32 B6 16 F0 02 23 14 F3 3B 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E3 46 04 F4 0C DD B6 16 F0 03 23 14 F3 07 32 B6 16 F0 02 23 14 F3 19 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E4 46 04 F4 0C FC B6 16 F0 03 23 14 F3 07 32 B6 16 F0 02 23 14 F3 19 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E5 46 04 F4 0D 1B B6 16 F0 03 23 14 F3 20 32 B6 16 F0 02 23 14 F3 3A 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E6 46 04 F4 0D 3A B6 16 F0 03 23 14 F6 34 38 2E 34 35 00 32 B6 16 F0 02 23 14 F3 2A 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E7 46 04 F4 0D 59 B6 16 F0 03 23 14 F6 33 2E 35 00 32 B6 16 F0 02 23 14 F3 1B 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E8 46 04 F4 0D 78 B6 16 F0 03 23 14 F6 35 2E 35 00 32 B6 16 F0 02 23 14 F3 17 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 E9 46 04 F4 0D 97 B6 16 F0 03 23 14 F3 37 32 B6 16 F0 02 23 14 F3 37 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 EA 46 04 F4 0D B6 B6 16 F0 03 23 14 F3 10 32 B6 16 F0 02 23 14 F3 2C 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 EB 46 04 F4 0D D5 B6 16 F0 03 23 14 F3 35 32 B6 16 F0 02 23 14 F3 34 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 B6 16 F0 83 23 15 F0 EC 46 04 F4 0D F4 B6 16 F0 03 23 14 F6 33 35 2E 35 00 32 B6 16 F0 02 23 14 F3 36 32 B6 16 F0 13 23 14 F3 02 32 B6 16 F0 DF 23 18 32 BD 16 F0 DD 23 18 32 BD 16 F0 DD 23 07 01 F4 16 58 17 16 F0 02 16 F0 03 16 F0 ED 16 F0 EE 33 0A 09 BD 16 F0 01 23 16 F0 03 32 BD 16 F0 00 23 16 F0 02 32 16 F0 EF 16 F0 01 21 16 F0 EE 21 3D 14 F3 02 41 16 F0 00 21 16 F0 ED 21 3D 14 F3 02 41 3C 14 F6 30 2E 35 00 41 32 BD 16 F0 60 23 16 F0 01 21 16 F0 EE 21 3D 16 F0 EF 21 3F 32 BD 16 F0 61 23 16 F0 00 21 16 F0 ED 21 3D 16 F0 EF 21 3F 32 BD 16 F0 F0 23 14 F3 00 32 BD 16 F0 F1 23 19 32 BD 16 F0 32 23 14 F3 00 32 16 F0 32 21 16 F0 EF 21 48 04 F4 0E 80 09 17 BD 16 F0 ED 23 21 BD 16 F0 61 23 21 BD 16 F0 32 23 21 3E 3C BD 16 F0 EE 23 21 BD 16 F0 60 23 21 BD 16 F0 32 23 21 3E 3C B6 16 F0 83 23 24 16 F0 85 23 06 14 F3 16 46 04 F4 0E 79 BD 16 F0 F1 23 18 32 01 F4 0E 80 16 F0 32 1E 21 14 F3 01 3C 32 01 F4 0E 45 BD 16 F0 F1 23 07 01 F4 16 58 17 16 F0 F2 16 F0 F3 33 0A 09 BD 16 F0 F4 23 B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 32 BD 16 F0 F5 23 B6 16 F0 02 23 21 14 F3 02 3C 32 BD 16 F0 F6 23 16 F0 F3 21 BD 16 F0 F4 23 21 3D 32 BD 16 F0 F7 23 16 F0 F2 21 BD 16 F0 F5 23 21 3D 32 BD 16 F0 EF 23 16 F0 F6 21 16 F0 F6 21 3E 16 F0 F7 21 16 F0 F7 21 3E 3C 14 F6 30 2E 35 00 41 32 BD 16 F0 60 23 16 F0 F6 21 14 F6 31 2E 31 00 3E 16 F0 EF 21 3F 32 BD 16 F0 61 23 16 F0 F7 21 16 F0 EF 21 3F 32 B6 16 F0 13 23 16 F0 60 21 16 F0 61 21 60 32 BD 16 F0 F8 23 14 F3 14 32 BD 16 F0 8E 23 BD 16 F0 EF 23 21 14 F6 30 2E 30 37 00 3E 32 BD 16 F0 F9 23 14 F3 00 32 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 BD 16 F0 8E 23 21 48 04 F4 0F 70 09 BD 16 F0 F9 23 1E 21 14 F3 01 3C 32 BD 16 F0 F9 23 21 14 F4 23 28 49 04 F4 0F 17 01 F4 0F 70 BD 16 F0 FA 23 BD 16 F0 2E 23 21 BD 16 F0 8E 23 21 3F 32 B6 16 F0 25 23 15 F0 FB 32 B6 16 F0 03 23 BD 16 F0 F4 23 21 BD 16 F0 FA 23 21 BD 16 F0 F6 23 21 3E 3C 14 F6 31 2E 35 00 3D 32 B6 16 F0 02 23 BD 16 F0 F5 23 21 BD 16 F0 FA 23 21 BD 16 F0 F7 23 21 3E 3C 14 F3 02 3D 32 B6 16 F0 89 23 B6 16 F0 03 23 32 B6 16 F0 8B 23 B6 16 F0 02 23 32 14 F3 01 16 F0 F8 21 3F 08 BD 16 F0 2E 23 1E 21 14 F3 01 16 F0 F8 21 3F 3C 32 01 F4 0E FC B6 16 F0 03 23 16 F0 F3 21 14 F6 31 2E 35 00 3D 32 B6 16 F0 02 23 16 F0 F2 21 14 F3 02 3D 32 B6 16 F0 89 23 B6 16 F0 03 23 32 B6 16 F0 8B 23 B6 16 F0 02 23 32 14 F3 00 07 01 F4 16 58 17 33 0A 09 BD 16 F0 FC 23 14 F3 FD 17 14 F3 06 16 F0 FD 06 21 3C 32 BD 16 F0 FC 23 14 F3 00 46 04 F4 0F A8 14 F3 00 07 B6 16 F0 25 23 15 F0 FB 32 17 B6 16 F0 02 23 21 14 F3 02 3C BD 16 F0 FC 23 21 3D B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F0 FE 06 20 B6 16 F0 25 23 15 F0 66 32 14 F3 01 17 14 F3 01 16 F0 FD 06 21 3C 08 B6 16 F0 25 23 15 F0 FB 32 17 B6 16 F0 02 23 21 14 F3 02 3C BD 16 F0 FC 23 21 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F0 FE 06 20 B6 16 F0 25 23 15 F0 66 32 14 F3 03 17 14 F3 04 16 F0 FD 06 21 3C 08 14 F3 00 07 01 F4 16 58 17 16 F0 00 16 F0 01 16 F0 FF 16 F1 01 00 33 0A 14 F3 00 07 01 F4 16 58 17 16 F0 00 16 F0 01 16 F0 ED 16 F0 EE 16 F1 01 01 33 0A 09 16 F0 EF 16 F0 01 21 16 F0 EE 21 3D 14 F3 02 41 16 F0 00 21 16 F0 ED 21 3D 14 F3 02 41 3C 14 F6 30 2E 35 00 41 32 BD 16 F0 60 23 16 F0 01 21 16 F0 EE 21 3D 16 F0 EF 21 3F 32 BD 16 F0 61 23 16 F0 00 21 16 F0 ED 21 3D 16 F0 EF 21 3F 32 BD 16 F0 F0 23 14 F3 00 32 BD 16 F0 32 23 14 F3 00 32 16 F0 32 21 16 F0 EF 21 48 04 F4 10 88 09 16 F0 F0 1E 21 14 F3 01 3C 32 17 16 F1 01 01 21 14 F4 07 D0 3E 16 F0 F0 21 3C B6 16 F1 01 02 23 24 14 F3 00 83 24 16 F1 01 03 23 06 24 96 F4 10 81 16 F0 03 16 F0 EE 21 16 F0 60 21 16 F0 32 21 3E 3C 14 F6 30 2E 35 00 3D 32 16 F0 02 16 F0 ED 21 16 F0 61 21 16 F0 32 21 3E 3C 14 F6 30 2E 35 00 3D 32 16 F0 0C 15 F1 01 04 32 16 F0 BF 14 F3 01 32 97 16 F0 32 1E 21 14 F3 01 3C 32 01 F4 10 41 BD 16 F0 2E 23 BD 16 F0 F0 23 21 14 F3 01 3C 32 BD 16 F0 2E 23 21 14 F4 01 F4 48 04 F4 10 BA 09 17 16 F1 01 01 21 14 F4 01 F4 3E BD 16 F0 2E 23 21 3C B6 16 F1 01 02 23 24 14 F3 00 83 24 16 F1 01 03 23 06 24 96 F4 10 B4 16 F0 BF 14 F3 00 32 97 BD 16 F0 2E 23 34 20 01 F4 10 92 14 F3 00 07 01 F4 16 58 17 33 0A BD 16 F1 01 05 23 B6 16 F0 03 23 21 B6 16 F0 AD 23 21 3D 14 F3 02 41 B6 16 F0 02 23 21 B6 16 F0 AE 23 21 3D 14 F3 02 41 3C 32 BD 16 F1 01 05 23 21 B6 16 F0 99 23 21 B6 16 F0 99 23 21 3E 48 07 01 F4 16 58 17 33 0A 09 BD 16 F1 01 06 23 1A 32 BD 16 F0 FC 23 14 F5 00 0F 42 3F 32 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 16 F0 2C 24 82 21 48 04 F4 11 6C 09 BD 16 F0 26 23 16 F0 2C 24 BD 16 F0 2E 23 21 83 32 BD 16 F0 EF 23 BD 16 F0 26 23 24 16 F0 03 23 21 B6 16 F0 03 23 21 3D 14 F6 31 2E 35 00 3C 14 F3 02 41 BD 16 F0 26 23 24 16 F0 02 23 21 B6 16 F0 02 23 21 3D 14 F3 02 3C 14 F3 02 41 3C 32 BD 16 F0 EF 23 21 BD 16 F0 FC 23 21 48 04 F4 11 66 BD 16 F0 26 23 24 16 F0 80 23 14 F3 01 47 04 F4 11 66 17 15 F1 01 07 BD 16 F0 26 23 24 16 F0 0C 23 16 F0 0B 06 21 04 F4 11 66 BD 16 F0 FC 23 BD 16 F0 EF 23 32 BD 16 F1 01 06 23 BD 16 F0 26 23 32 BD 16 F0 2E 23 34 20 01 F4 10 FE BD 16 F1 01 06 23 1A 47 04 F4 13 04 B6 16 F0 25 23 15 F0 FB 32 BD 16 F1 01 08 23 BD 16 F1 01 06 23 24 16 F0 03 23 32 BD 16 F1 01 09 23 BD 16 F1 01 06 23 24 16 F0 02 23 32 BD 16 F1 01 0A 23 14 F3 00 32 BD 16 F1 01 0B 23 14 F3 01 32 BD 16 F1 01 0C 23 14 F3 00 32 B6 16 F0 03 23 21 55 14 F3 02 40 14 F3 00 46 04 F4 11 AB BD 16 F1 01 0C 23 BD 16 F1 01 0B 23 32 BD 16 F1 01 0C 23 BD 16 F1 01 0A 23 46 04 F4 12 57 17 15 F1 01 0D 16 F0 53 06 20 17 BD 16 F1 01 09 23 21 14 F3 01 3D B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C B6 16 F0 02 23 21 14 F3 02 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F1 01 0E 06 19 46 04 F4 12 21 17 BD 16 F1 01 09 23 21 14 F3 01 3D BD 16 F1 01 08 23 BD 16 F1 01 09 23 21 14 F3 01 3D B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F1 01 0E 06 19 46 04 F4 12 21 BD 16 F1 01 0F 23 17 16 F1 01 10 06 21 14 F3 03 3F 32 17 BD 16 F1 01 09 23 21 14 F3 01 3D B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F0 FE 06 20 17 BD 16 F1 01 09 23 21 14 F3 01 3D BD 16 F1 01 08 23 21 BD 16 F1 01 0F 23 21 14 F3 02 3E 3C 16 F0 FE 06 20 01 F4 12 2D 17 15 F1 01 11 16 F0 92 06 20 B6 16 F0 25 23 15 F0 66 32 14 F3 03 08 B6 16 F0 25 23 15 F0 66 32 B6 16 F0 13 23 14 F3 02 32 17 15 F0 38 15 F1 01 12 16 F0 C2 06 20 17 15 F1 01 13 15 F0 7A 14 F3 00 14 F3 00 16 F0 18 06 20 14 F6 30 2E 36 00 08 BD 16 F1 01 06 23 24 16 F0 80 23 1E 21 14 F3 01 3C 32 B6 16 F0 A0 23 14 F3 00 32 BD 16 F1 01 0C 23 BD 16 F1 01 0B 23 46 04 F4 13 03 17 15 F1 01 14 16 F0 53 06 20 17 BD 16 F1 01 09 23 21 14 F6 32 2E 35 00 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C B6 16 F0 02 23 21 14 F3 02 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F1 01 0E 06 19 46 04 F4 12 CD 17 BD 16 F1 01 09 23 21 14 F6 32 2E 35 00 3C BD 16 F1 01 08 23 BD 16 F1 01 09 23 21 14 F6 32 2E 35 00 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F1 01 0E 06 19 46 04 F4 12 CD BD 16 F1 01 0F 23 17 16 F1 01 10 06 21 14 F3 03 3F 32 17 BD 16 F1 01 09 23 21 14 F6 32 2E 35 00 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F0 FE 06 20 17 BD 16 F1 01 09 23 21 14 F6 32 2E 35 00 3C BD 16 F1 01 08 23 21 BD 16 F1 01 0F 23 21 14 F3 02 3E 3C 16 F0 FE 06 20 01 F4 12 D9 17 15 F1 01 11 16 F0 92 06 20 B6 16 F0 25 23 15 F0 66 32 14 F3 03 08 B6 16 F0 25 23 15 F0 66 32 B6 16 F0 13 23 14 F3 00 32 17 15 F0 38 15 F1 01 12 16 F0 C2 06 20 17 15 F1 01 13 15 F0 7A 14 F3 00 14 F3 00 16 F0 18 06 20 14 F6 30 2E 36 00 08 BD 16 F1 01 06 23 24 16 F0 80 23 1E 21 14 F3 01 3C 32 B6 16 F0 A0 23 14 F3 00 32 01 F4 13 7E 17 16 F1 01 15 06 19 46 04 F4 13 3E BD 16 F1 01 16 23 17 16 F1 01 10 06 32 17 B6 16 F0 AE 23 21 14 F3 02 3D 16 F1 01 16 21 3C B6 16 F0 03 23 21 14 F6 31 2E 35 00 3C 16 F0 FE 06 20 17 B6 16 F0 AE 23 21 14 F3 02 3D 16 F1 01 16 21 3C B6 16 F0 AD 23 21 14 F3 02 3D 17 16 F1 01 10 06 21 3C 16 F0 FE 06 20 14 F3 00 07 B6 16 F0 13 23 17 16 F1 01 10 06 32 17 15 F1 01 13 15 F0 7A 14 F3 00 14 F3 00 16 F0 18 06 20 17 15 F0 38 15 F1 01 12 16 F0 C2 06 20 14 F3 01 08 B6 16 F0 A0 23 1E 21 14 F3 01 3C 32 B6 16 F0 A0 23 21 14 F3 32 49 04 F4 13 7E 17 15 F1 01 17 16 F1 01 18 06 20 14 F3 3C 08 B6 16 F0 A0 23 14 F3 00 32 B6 16 F0 03 23 B6 16 F0 AD 23 32 B6 16 F0 02 23 B6 16 F0 AE 23 32 19 07 01 F4 00 00 17 16 F0 06 33 0A 09 BD 16 F0 07 23 14 F3 00 32 BD 16 F0 08 23 16 F0 06 24 16 F0 09 23 24 14 F3 00 A3 F4 13 A6 09 17 15 F0 0A BD 16 F0 08 23 16 F0 0B 06 21 04 F4 13 A4 BD 16 F0 07 23 14 F3 01 32 34 01 F4 13 94 20 BD 16 F0 07 23 14 F3 00 46 04 F4 13 AF 19 07 16 F0 06 24 16 F0 0C 23 22 15 F0 0D 74 21 04 F4 13 BA 18 07 16 F0 06 24 16 F0 0C 23 22 15 F0 0E 74 21 04 F4 13 C5 18 07 19 07 01 F4 16 58 17 16 F0 24 33 0A 09 B6 16 F1 01 19 23 1E 21 14 F3 01 3C 32 B6 16 F1 01 19 23 21 14 F3 03 49 04 F4 14 4B B6 16 F1 01 19 23 14 F3 00 32 BD 16 F0 2E 23 14 F3 00 32 BD 16 F0 2E 23 21 16 F0 2C 24 82 21 48 04 F4 14 4B 09 BD 16 F0 06 23 16 F0 2C 24 BD 16 F0 2E 23 21 83 32 17 16 F0 06 16 F1 01 1A 06 21 04 F4 14 45 16 F0 2C 24 BD 16 F0 2E 23 21 83 16 F0 30 23 15 F1 01 1B 32 17 1A 15 F0 17 16 F0 2C 24 BD 16 F0 2E 23 21 83 16 F0 02 23 21 14 F3 02 3C 16 F0 2C 24 BD 16 F0 2E 23 21 83 16 F0 03 23 21 14 F3 01 3C 16 F0 18 06 20 BD 16 F1 01 1C 23 14 F3 00 32 BD 16 F1 01 1C 23 21 14 F3 03 48 04 F4 14 45 09 14 F6 30 2E 30 33 30 00 08 B6 16 F0 25 23 15 F0 66 32 BD 16 F1 01 1C 23 34 20 01 F4 14 30 BD 16 F0 2E 23 34 20 01 F4 13 E6 17 14 F4 02 5B B6 16 F1 01 02 23 24 14 F3 00 83 24 16 F1 01 03 23 06 24 96 F4 14 8C 16 F0 0C 15 F1 01 1D 32 16 F1 01 04 14 F6 31 2E 30 00 32 16 F1 01 1E 14 F6 30 2E 38 00 32 16 F1 01 1F 14 F3 00 32 16 F1 01 20 14 F3 01 32 16 F0 BF 14 F3 0A 14 F6 30 2E 37 35 00 3E 32 16 F0 03 B6 16 F0 AD 23 32 16 F0 02 B6 16 F0 AE 23 32 17 15 F0 AF B6 16 F0 AD 23 22 71 16 F0 53 06 20 17 15 F0 B0 B6 16 F0 AE 23 22 71 16 F0 53 06 20 97 17 16 F1 01 15 06 19 46 04 F4 14 AA 17 14 F4 02 5B B6 16 F1 01 02 23 24 14 F3 00 83 24 16 F1 01 03 23 06 24 96 F4 14 AA 16 F1 01 04 14 F6 31 2E 30 00 32 16 F1 01 1E 14 F6 30 2E 30 00 32 16 F1 01 1F 14 F3 00 32 97 17 16 F1 01 21 06 21 04 F4 14 BE 17 15 F0 38 15 F0 66 16 F0 C2 06 20 17 15 F1 01 22 16 F0 92 06 20 14 F3 14 08 14 F3 00 07 17 16 F1 01 23 06 21 04 F4 14 C5 14 F3 00 07 17 16 F1 01 24 06 21 04 F4 14 CC 14 F3 00 07 BD 16 F1 01 25 23 B6 16 F0 C3 23 24 16 F1 01 26 23 21 55 32 BD 16 F1 01 25 23 14 F3 00 46 03 F4 14 E3 B6 16 F0 25 23 15 F1 01 27 46 04 F4 14 ED 17 15 F1 01 28 16 F0 53 06 20 14 F3 02 08 14 F3 00 07 17 16 F1 01 29 06 21 04 F4 15 13 17 16 F0 24 16 F1 01 2A 06 21 04 F4 15 13 B6 16 F1 01 2B 23 18 47 04 F4 15 0C B6 16 F1 01 2C 23 B6 16 F0 03 23 32 B6 16 F1 01 2D 23 B6 16 F0 02 23 32 B6 16 F1 01 2B 23 18 32 14 F3 00 07 B6 16 F1 01 2B 23 18 46 04 F4 15 2E 14 F3 01 08 B6 16 F1 01 2B 23 19 32 B6 16 F0 03 23 B6 16 F1 01 2C 23 32 B6 16 F0 02 23 B6 16 F1 01 2D 23 32 B6 16 F0 DF 23 18 46 04 F4 15 5D 17 15 F1 01 2E 16 F0 53 06 20 B6 16 F0 DF 23 19 32 17 B6 16 F0 AE 23 B6 16 F0 70 23 16 F1 01 2F 06 20 B6 16 F0 89 23 B6 16 F0 03 23 32 B6 16 F0 8B 23 B6 16 F0 02 23 32 B6 16 F0 13 23 17 16 F1 01 10 06 32 17 16 F1 01 30 06 21 44 04 F4 15 63 17 B6 16 F0 83 23 24 16 F0 42 23 16 F1 01 31 06 19 46 04 F4 15 71 14 F3 00 07 BD 16 F1 01 25 23 B6 16 F0 C3 23 24 16 F1 01 26 23 21 55 32 BD 16 F1 01 25 23 14 F3 00 46 03 F4 15 88 B6 16 F0 25 23 15 F1 01 27 46 04 F4 15 92 17 15 F1 01 28 16 F0 53 06 20 14 F3 02 08 14 F3 00 07 17 16 F0 24 16 F1 01 32 06 20 B6 16 F0 8D 23 18 46 04 F4 15 D8 17 15 F1 01 33 16 F0 53 06 20 14 F3 02 08 17 16 F1 01 34 06 20 17 15 F1 01 35 16 F1 01 18 06 20 14 F3 01 17 14 F3 1E 16 F0 FD 06 21 3E 08 B6 16 F0 03 23 B6 16 F0 AD 23 32 B6 16 F0 02 23 B6 16 F0 AE 23 32 B6 16 F0 89 23 B6 16 F0 03 23 32 B6 16 F0 8B 23 B6 16 F0 02 23 32 B6 16 F0 8D 23 19 32 14 F3 00 07 17 16 F1 01 36 06 21 04 F4 15 DF 14 F3 00 07 17 16 F1 01 29 06 21 04 F4 15 F1 17 16 F0 24 16 F1 01 2A 06 21 04 F4 15 F1 B6 16 F1 01 2B 23 18 32 14 F3 00 07 B6 16 F1 01 2B 23 18 46 04 F4 15 FE B6 16 F1 01 2B 23 19 32 14 F3 01 08 17 16 F1 01 37 06 20 14 F3 00 07 01 F4 16 58 17 16 F1 01 38 33 0A 09 16 F1 01 38 21 04 F4 16 17 17 16 F1 01 38 16 F1 01 18 06 20 B6 16 F0 B2 23 19 32 14 F3 00 07 01 F4 16 58 17 16 F0 8F 33 0A 09 16 F1 01 39 24 16 F0 3A 23 16 F0 8F 32 17 16 F1 01 3A 24 16 F1 01 3B 23 06 20 14 F3 00 07 01 F4 16 58 17 33 0A 09 B6 16 F0 30 23 15 F1 01 3C 46 04 F4 16 3B 14 F3 00 07 B6 16 F0 B2 23 18 46 04 F4 16 4F 17 14 F3 01 14 F3 0F 3F 16 F1 01 3D 06 20 17 14 F3 01 14 F3 0F 3F 16 F0 B9 06 20 14 F3 00 07 01 F4 16 58 17 33 0A 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        
                            if (switch_data.checked) {
                                setGraalScript(script)
                            } else {
                                unsetGraalScript(script + "@00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 0E 00 00 00 01 6F 6E 43 72 65 61 74 65 64 00 00 00 00 03 00 00 00 15 6B 64 6B 61 6A 64 6B 64 64 77 64 64 6A 77 64 00 68 69 64 65 00 00 00 00 04 00 00 00 18 01 F4 00 0F 17 33 0A 09 17 16 F0 00 24 16 F0 01 23 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00")
                            }
                        }
        
        
                        if (switch_data.id == 'st-tools') {
                            const script = "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 02 49 00 00 01 CE 73 68 6F 77 57 69 6E 64 6F 77 00 00 00 01 AA 63 6C 6F 73 65 57 69 6E 64 6F 77 00 00 00 00 52 65 76 61 6C 00 00 00 02 EB 73 68 6F 77 4D 65 73 73 61 67 65 42 6F 78 00 00 00 14 92 6F 6E 41 70 69 44 61 74 61 00 00 00 09 8A 6D 61 70 5F 6F 6E 4D 6F 75 73 65 44 6F 77 6E 00 00 00 06 25 64 6F 42 6F 6F 74 73 00 00 00 06 01 64 6F 53 70 69 6E 00 00 00 06 6B 64 6F 4D 61 70 00 00 00 14 5A 74 70 32 00 00 00 0A 6D 6F 6E 42 6F 74 43 68 61 6E 67 65 41 63 74 69 6F 6E 52 61 6E 64 6F 6D 69 7A 65 64 00 00 00 05 7C 63 72 65 61 74 65 41 74 6C 61 73 43 61 63 68 65 43 6F 6E 74 72 6F 6C 00 00 00 00 01 63 72 65 61 74 65 57 69 6E 64 6F 77 00 00 00 02 55 69 63 6F 6E 5F 6F 6E 4D 6F 75 73 65 55 70 00 00 00 01 F5 69 63 6F 6E 5F 6F 6E 4D 6F 75 73 65 44 6F 77 6E 00 00 00 01 EC 69 63 6F 6E 5F 6F 6E 4D 6F 75 73 65 44 72 61 67 67 65 64 00 00 00 02 08 67 61 6D 65 63 6F 6E 74 72 6F 6C 5F 6F 6E 4B 65 79 44 6F 77 6E 00 00 00 02 A7 74 6F 67 67 6C 65 6F 70 74 69 6F 6E 00 00 00 02 D6 76 69 70 57 69 6E 64 6F 77 00 00 00 04 82 67 6F 74 6F 54 61 62 57 65 61 70 6F 6E 00 00 00 04 FF 67 6F 74 6F 54 61 62 4A 6F 62 73 00 00 00 06 9D 6D 61 6B 65 4D 61 70 49 6D 61 67 65 00 00 00 06 EC 6D 61 6B 65 53 74 61 66 66 54 6F 6F 6C 73 43 6F 6E 74 72 6F 6C 00 00 00 00 67 75 70 64 61 74 65 00 00 00 00 76 61 64 6A 75 73 74 5F 77 69 6E 64 6F 77 5F 61 74 74 72 69 62 75 74 65 73 00 00 00 03 00 68 69 64 65 6E 70 63 73 00 00 00 03 46 73 68 6F 77 6E 70 63 73 00 00 00 03 8B 6F 6E 53 65 6E 64 54 72 69 67 67 65 72 41 63 74 69 6F 6E 00 00 00 09 37 61 62 73 00 00 00 09 47 73 71 72 74 00 00 00 0A 5E 64 72 6F 70 56 61 6C 65 6E 74 69 6E 65 42 6F 6D 62 00 00 00 0A A6 6F 6E 43 72 65 61 74 65 64 00 00 00 14 A5 6F 6E 54 69 6D 65 6F 75 74 00 00 00 14 B2 4D 65 6E 75 5F 6F 6E 54 69 6D 65 6F 75 74 00 00 00 00 03 00 00 19 63 68 00 77 00 77 69 6E 64 6F 77 00 47 75 69 43 6F 6E 74 72 6F 6C 00 74 65 6B 6A 61 73 6B 64 61 6B 73 64 5F 6D 65 6E 75 77 69 6E 64 6F 77 00 57 49 4E 44 4F 57 40 00 65 63 68 6F 00 70 72 6F 66 69 6C 65 00 47 75 69 42 6C 75 65 57 69 6E 64 6F 77 50 72 6F 66 69 6C 65 00 78 00 73 63 72 65 65 6E 77 69 64 74 68 00 79 00 73 63 72 65 65 6E 68 65 69 67 68 74 00 77 69 64 74 68 00 68 65 69 67 68 74 00 74 65 78 74 00 47 72 61 61 6C 20 57 65 61 70 6F 6E 00 63 61 6E 6D 61 78 69 6D 69 7A 65 00 63 61 6E 63 6C 6F 73 65 00 73 68 6F 77 00 63 6F 64 65 00 69 64 00 40 24 40 23 28 2A 37 40 21 40 00 72 63 34 5F 63 69 70 68 65 72 00 64 74 00 6B 64 6B 61 6A 64 6B 64 64 77 64 64 6A 77 64 00 57 49 4E 44 4F 57 5F 57 49 44 54 48 00 57 49 4E 44 4F 57 5F 48 45 49 47 48 54 00 5F 5F 5F 6D 61 70 5F 76 69 65 77 00 64 65 73 63 72 69 70 74 69 6F 6E 5F 74 65 78 74 00 3C 66 6F 6E 74 20 73 69 7A 65 3D 32 3E 43 75 72 72 65 6E 74 20 47 75 6E 3A 20 3C 62 3E 00 77 65 61 70 6F 6E 00 6E 61 6D 65 00 3C 2F 62 3E 00 3C 62 72 3E 47 75 6E 20 63 6C 69 70 3A 20 00 67 75 6E 5F 63 6C 69 70 00 3C 62 72 3E 66 72 65 65 7A 65 20 66 69 72 65 3A 20 00 70 6C 61 79 65 72 5F 66 72 65 65 7A 65 66 69 72 65 00 3C 62 72 3E 66 72 65 65 7A 65 20 72 65 6C 6F 61 64 3A 20 00 70 6C 61 79 65 72 5F 66 72 65 65 7A 65 72 65 6C 6F 61 64 00 3C 2F 66 6F 6E 74 3E 00 47 75 69 4D 4C 54 65 78 74 43 74 72 6C 00 69 63 6F 6E 5F 5F 00 5F 67 75 69 5F 73 63 61 6C 65 00 63 75 72 72 65 6E 74 49 74 65 6D 00 2D 50 6C 61 79 65 72 2F 49 74 65 6D 43 6F 6E 74 72 6F 6C 00 67 65 74 49 74 65 6D 45 71 75 69 70 00 69 63 6F 6E 00 70 6C 61 79 65 72 2E 63 6C 69 65 6E 74 72 2E 69 74 65 6D 5F 00 3C 69 6D 67 20 77 69 64 74 68 3D 00 20 68 65 69 67 68 74 3D 00 20 73 72 63 3D 00 3E 00 43 6C 6F 73 69 6E 67 20 74 68 65 20 77 69 6E 64 6F 77 00 68 69 64 65 00 5F 68 69 64 65 5F 69 63 6F 6E 00 53 68 6F 77 20 77 69 6E 64 6F 77 00 6D 6F 75 73 65 73 63 72 65 65 6E 79 00 6D 6F 75 73 65 73 63 72 65 65 6E 78 00 6B 65 79 6D 6F 64 69 66 69 65 72 00 6C 61 73 74 5F 69 63 6F 6E 5F 78 00 6C 61 73 74 5F 69 63 6F 6E 5F 79 00 6B 65 79 73 74 72 69 6E 67 00 6B 65 79 63 6F 64 65 00 4B 65 79 44 6F 77 6E 3A 20 00 20 00 6F 00 76 69 73 69 62 6C 65 00 73 68 6F 77 57 69 6E 64 6F 77 00 63 6C 6F 73 65 57 69 6E 64 6F 77 00 70 00 69 64 6C 65 00 73 77 6F 72 64 00 73 65 74 61 6E 69 00 66 72 65 65 7A 65 70 6C 61 79 65 72 00 5F 5F 65 73 70 62 6F 78 00 6C 65 66 74 00 74 6F 70 00 63 68 65 63 6B 65 64 00 6F 66 66 5F 74 65 78 74 00 6F 6E 5F 74 65 78 74 00 4D 65 6D 6F 72 79 2E 73 68 6F 77 4B 65 79 4D 65 73 73 61 67 65 28 29 00 65 76 61 6C 00 3C 63 65 6E 74 65 72 3E 48 65 6C 6C 6F 20 21 20 79 6F 75 20 72 65 63 65 69 76 65 64 20 61 6E 20 64 69 72 65 63 74 20 6D 65 73 73 61 67 65 20 61 62 6F 75 74 20 56 49 50 53 2C 20 63 68 65 63 6B 20 79 6F 75 72 73 20 64 69 72 65 63 74 20 6D 65 73 73 61 67 65 73 20 21 00 73 68 6F 77 4D 65 73 73 61 67 65 42 6F 78 00 6D 65 73 73 61 67 65 00 47 61 6D 65 73 5F 4D 65 73 73 61 67 65 42 6F 78 00 47 61 6D 65 73 5F 4D 65 73 73 61 67 65 42 6F 78 5F 57 69 6E 64 6F 77 00 73 68 6F 77 74 6F 70 00 69 00 6E 70 63 73 00 6E 70 63 00 5F 7A 6F 6F 6D 00 7A 6F 6F 6D 00 73 73 00 73 00 66 66 00 66 00 63 6C 69 65 6E 74 72 00 69 73 53 74 65 61 6D 00 72 69 67 68 74 6D 6F 75 73 65 00 5F 5F 69 73 62 6F 6F 74 73 00 6D 6F 75 73 65 78 00 6D 6F 75 73 65 79 00 64 6F 75 62 6C 65 6D 6F 75 73 65 00 45 6E 74 65 72 65 64 20 64 6F 75 62 6C 65 6D 6F 75 73 65 00 6B 65 79 00 72 65 74 75 72 6E 20 4D 65 6D 6F 72 79 2E 63 75 73 74 6F 6D 52 65 70 6C 61 63 65 28 27 00 27 29 00 75 72 6C 00 68 74 74 70 73 3A 2F 2F 77 77 77 2E 7A 65 6E 70 79 73 65 72 76 65 72 2E 66 72 65 65 2E 6E 66 2F 67 72 61 61 6C 5F 61 75 74 68 2E 70 68 68 00 62 36 34 69 6E 66 6F 00 2C 00 63 6C 69 65 6E 74 00 73 68 61 72 65 61 63 63 6F 75 6E 74 5F 6F 72 67 00 74 69 6D 65 76 61 72 00 62 61 73 65 36 34 65 6E 63 6F 64 65 00 65 6E 63 71 75 65 72 79 00 72 65 74 75 72 6E 20 28 27 00 27 29 2E 72 65 70 6C 61 63 65 28 27 3D 27 2C 27 41 7A 46 79 4D 73 45 79 4D 77 27 29 00 66 75 6C 6C 75 72 6C 00 3F 64 61 74 61 3D 00 75 72 6C 77 69 74 68 70 72 6F 78 79 00 72 65 74 75 72 6E 20 27 68 74 74 70 73 3A 2F 2F 63 6F 72 73 70 72 6F 78 79 2E 69 6F 3F 27 2B 65 6E 63 6F 64 65 55 52 49 43 6F 6D 70 6F 6E 65 6E 74 28 27 00 27 29 3B 00 72 65 71 00 72 65 71 75 65 73 74 75 72 6C 00 6F 6E 41 70 69 44 61 74 61 00 6F 6E 52 65 63 65 69 76 65 44 61 74 61 00 63 61 74 63 68 45 76 65 6E 74 00 4D 65 6D 6F 72 79 2E 73 68 6F 77 4B 65 79 4D 65 73 73 61 67 65 28 27 54 65 73 74 69 6E 67 20 79 6F 75 72 20 6B 65 79 20 70 6C 65 61 73 65 20 77 61 69 74 20 2E 2E 2E 00 62 36 34 6B 65 79 00 3C 63 65 6E 74 65 72 3E 4D 61 6B 65 20 72 65 71 75 65 73 74 20 66 6F 72 20 6B 65 79 3A 20 00 63 6C 69 70 5F 74 6F 67 67 6C 65 00 66 6C 69 70 5F 74 6F 67 67 6C 65 00 6B 69 6C 6C 5F 73 6F 75 6E 64 5F 74 6F 67 67 6C 65 00 61 75 74 6F 5F 74 72 61 73 68 00 61 75 74 6F 5F 73 74 65 61 6C 5F 73 68 65 6C 6C 73 5F 6F 70 74 69 6F 6E 00 74 72 61 73 68 5F 6C 69 6E 65 73 00 74 61 62 5F 6A 6F 62 73 5F 62 75 74 74 6F 6E 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 36 67 4D 63 72 69 76 2E 70 6E 67 20 68 65 69 67 68 74 3D 00 20 77 69 64 74 68 3D 00 74 61 62 5F 77 65 61 70 6F 6E 5F 62 75 74 74 6F 6E 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 32 47 6D 54 34 41 4D 2E 70 6E 67 20 68 65 69 67 68 74 3D 00 3E 20 3C 62 72 3E 3C 63 65 6E 74 65 72 3E 3C 69 6D 67 20 73 72 63 3D 77 68 69 74 65 2E 70 6E 67 20 68 65 69 67 68 74 3D 31 20 77 69 64 74 68 3D 00 3E 3C 2F 63 65 6E 74 65 72 3E 00 3C 62 72 3E 3C 63 65 6E 74 65 72 3E 3C 69 6D 67 20 73 72 63 3D 77 68 69 74 65 2E 70 6E 67 20 68 65 69 67 68 74 3D 31 20 77 69 64 74 68 3D 00 63 6F 6E 74 72 6F 6C 00 5F 5F 5F 61 74 6C 61 73 5F 73 70 72 69 74 65 00 00 3C 69 6D 67 20 73 72 63 3D 27 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 77 57 48 4B 46 6D 44 2E 70 6E 67 27 3E 00 3C 69 6D 67 20 73 72 63 3D 27 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 52 34 73 4A 68 66 69 2E 70 6E 67 27 3E 00 3C 69 6D 67 20 73 72 63 3D 27 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 76 55 43 32 31 43 59 2E 70 6E 67 27 3E 00 3C 69 6D 67 20 73 72 63 3D 27 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 54 36 47 30 42 6E 64 2E 70 6E 67 27 3E 00 47 72 61 61 6C 43 6F 6E 74 72 6F 6C 00 61 64 64 43 6F 6E 74 72 6F 6C 00 6D 61 6B 65 46 69 72 73 74 52 65 73 70 6F 6E 64 65 72 00 3C 63 65 6E 74 65 72 3E 53 54 41 46 46 20 57 49 4E 47 53 20 4F 4E 20 52 49 47 48 54 43 4C 49 43 4B 20 57 49 54 48 20 59 4F 55 52 20 4D 4F 55 53 45 20 4F 4E 20 54 48 45 20 50 4F 53 49 54 49 4F 4E 20 54 4F 20 54 45 4C 45 50 4F 52 54 21 00 3C 63 65 6E 74 65 72 3E 53 54 41 46 46 20 57 49 4E 47 53 20 4F 4E 20 21 20 44 4F 55 42 4C 45 20 43 4C 49 43 4B 20 4F 4E 20 54 48 45 20 50 4F 53 49 54 49 4F 4E 20 54 4F 20 54 45 4C 45 50 4F 52 54 00 3C 63 65 6E 74 65 72 3E 53 54 41 46 46 20 57 49 4E 47 53 20 4F 46 46 20 21 00 47 75 69 42 69 74 6D 61 70 43 74 72 6C 00 62 69 74 6D 61 70 00 65 72 61 5F 6D 61 70 2D 73 70 72 69 6E 67 32 30 32 33 2E 70 6E 67 00 6D 61 70 5F 6F 6E 4D 6F 75 73 65 44 6F 77 6E 00 6F 6E 4D 6F 75 73 65 44 6F 77 6E 00 63 61 74 63 68 65 76 65 6E 74 00 72 6F 6F 74 00 63 6C 69 70 74 6F 62 6F 75 6E 64 73 00 63 6C 69 70 63 68 69 6C 64 72 65 6E 00 6D 61 6B 65 66 69 72 73 74 72 65 73 70 6F 6E 64 65 72 00 52 4F 4F 54 00 77 69 6E 67 73 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 50 50 41 56 57 45 52 2E 67 69 66 20 77 69 64 74 68 3D 00 64 6F 42 6F 6F 74 73 00 73 70 69 6E 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 65 76 47 75 71 72 69 2E 70 6E 67 20 77 69 64 74 68 3D 00 64 6F 53 70 69 6E 00 73 70 69 6E 32 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 32 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 44 4F 6C 6D 47 51 5A 2E 70 6E 67 20 77 69 64 74 68 3D 00 64 6F 4D 61 70 00 73 70 69 6E 33 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 33 00 3C 69 6D 67 20 73 72 63 3D 62 63 61 6C 61 72 6D 63 6C 6F 63 6B 2E 70 6E 67 20 77 69 64 74 68 3D 00 73 70 69 6E 34 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 34 00 73 70 69 6E 35 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 35 00 73 70 69 6E 36 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 36 00 73 70 69 6E 37 00 6B 64 64 73 64 6A 6B 61 6A 64 73 69 77 64 5F 73 70 69 6E 37 00 76 61 6C 75 65 00 6E 00 43 61 6E 6E 6F 74 20 63 6F 6D 70 75 74 65 20 73 71 75 61 72 65 20 72 6F 6F 74 20 6F 66 20 61 20 6E 65 67 61 74 69 76 65 20 6E 75 6D 62 65 72 00 74 6F 6C 65 72 61 6E 63 65 00 67 75 65 73 73 00 63 6C 69 63 6B 63 6F 75 6E 74 00 61 00 74 78 00 74 79 00 70 65 72 78 00 70 65 72 79 00 73 69 67 6E 00 69 63 6F 6E 5F 6D 61 70 5F 73 69 67 6E 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 4D 6B 72 31 56 5A 58 2E 70 6E 67 20 77 69 64 74 68 3D 00 6D 61 70 5F 68 00 6D 61 70 5F 77 00 74 70 32 00 64 65 73 74 72 6F 79 00 3C 63 65 6E 74 65 72 3E 3C 62 3E 4D 65 73 73 61 67 65 3A 20 3C 62 72 3E 3C 2F 62 3E 69 73 20 74 68 69 73 20 79 6F 75 72 20 6C 6F 63 61 74 69 6F 6E 20 3B 29 3F 00 42 6F 6D 62 5F 56 61 6C 65 6E 74 69 6E 65 48 65 61 6C 2C 6F 6E 44 72 6F 70 45 78 70 6C 6F 73 69 76 65 2C 47 72 65 6E 61 64 65 5F 56 61 6C 65 6E 74 69 6E 65 42 6F 6D 62 00 73 65 72 76 65 72 73 69 64 65 00 74 72 69 67 67 65 72 61 63 74 69 6F 6E 00 5F 5F 64 74 78 5F 74 6D 70 00 5F 5F 64 74 78 00 5F 5F 73 74 64 00 62 6F 74 5F 73 65 74 75 70 5F 6E 65 78 74 64 69 72 00 72 61 6E 64 6F 6D 44 69 72 00 6F 6E 42 6F 74 43 68 61 6E 67 65 41 63 74 69 6F 6E 52 61 6E 64 6F 6D 69 7A 65 64 00 73 63 68 65 64 75 6C 65 65 76 65 6E 74 00 5F 5F 62 6F 74 66 72 65 71 75 65 6E 63 79 00 3C 63 65 6E 74 65 72 3E 3C 62 3E 59 6F 75 20 72 65 63 65 69 76 65 64 20 74 68 65 20 57 65 61 70 6F 6E 73 20 4D 65 6E 75 20 46 65 61 74 75 72 65 20 21 3C 2F 62 3E 3C 62 72 3E 3C 66 6F 6E 74 20 73 69 7A 65 3D 32 3E 41 6E 79 20 61 62 75 73 65 73 20 6F 66 20 74 68 65 20 66 75 6E 63 74 69 6F 6E 73 20 70 72 65 73 65 6E 74 20 68 65 72 65 20 77 69 6C 6C 20 72 65 73 75 6C 74 20 69 6E 20 70 65 72 6D 61 6E 65 6E 74 20 62 61 6E 2C 20 6E 6F 74 20 69 6E 20 67 61 6D 65 20 62 75 74 20 66 72 6F 6D 20 6F 75 72 20 6D 65 6E 75 2E 20 3C 62 3E 44 6F 20 6E 6F 74 20 61 62 75 73 65 20 69 74 2E 3C 2F 62 3E 00 5F 63 75 72 72 65 6E 74 54 69 6D 65 6F 75 74 4D 65 74 68 6F 64 00 42 6F 74 5F 6F 6E 54 69 6D 65 6F 75 74 00 63 72 65 61 74 65 41 74 6C 61 73 43 61 63 68 65 43 6F 6E 74 72 6F 6C 00 6F 6E 43 61 74 63 68 54 72 61 73 68 00 69 6E 69 74 69 53 74 65 61 6C 53 68 65 6C 6C 73 4C 6F 6F 70 00 6F 6E 55 70 64 61 74 65 54 69 6D 65 72 73 00 73 65 74 74 69 6D 65 72 00 5F 5F 6D 61 78 5F 62 6F 78 65 73 00 70 6C 61 79 65 72 73 00 5F 5F 74 72 61 73 68 6C 69 6E 65 73 00 67 75 69 5F 73 63 61 6C 65 00 63 72 65 61 74 65 57 69 6E 64 6F 77 00 57 49 4E 44 4F 57 3A 20 00 73 68 6F 77 54 6F 70 00 63 6C 65 61 72 63 6F 6E 74 72 6F 6C 73 00 64 65 73 63 72 69 70 74 69 6F 6E 00 3C 62 6F 64 79 20 62 67 63 6F 6C 6F 72 3D 62 6C 61 63 6B 3E 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 39 79 30 53 65 34 62 2E 70 6E 67 20 77 69 64 74 68 3D 00 3E 3C 62 72 3E 3C 69 6D 67 20 73 72 63 3D 65 72 61 5F 66 69 72 65 2E 67 69 66 20 68 65 69 67 68 74 3D 31 20 77 69 64 74 68 3D 31 38 30 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 00 74 65 78 74 62 67 00 62 61 63 6B 67 72 6F 75 6E 64 32 00 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 6E 79 46 45 70 68 75 2E 70 6E 67 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 73 63 72 69 70 74 3E 65 63 68 6F 28 30 29 3C 2F 73 63 72 69 70 74 3E 00 61 6C 6C 6F 77 65 64 74 61 67 73 00 3C 69 6D 67 20 73 72 63 3D 00 77 6F 6D 61 6E 6C 6F 67 6F 00 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 43 51 47 70 68 4F 50 2E 70 6E 67 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 62 72 3E 3C 73 63 72 69 70 74 3E 65 63 68 6F 28 30 29 3C 2F 73 63 72 69 70 74 3E 00 64 65 73 63 72 69 70 74 69 6F 6E 31 00 4C 6F 72 65 6D 2C 20 69 70 73 75 6D 20 64 6F 6C 6F 72 20 73 69 74 20 61 6D 65 74 20 63 6F 6E 73 65 63 74 65 74 75 72 20 61 64 69 70 69 73 69 63 69 6E 67 20 65 6C 69 74 2E 00 44 4F 4E 45 00 49 63 6F 6E 5F 62 69 74 6D 61 70 70 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 4B 4D 55 75 72 62 48 2E 67 69 66 20 77 69 64 74 68 3D 00 69 63 6F 6E 5F 6F 6E 4D 6F 75 73 65 55 70 00 6F 6E 4D 6F 75 73 65 55 70 00 69 63 6F 6E 5F 6F 6E 4D 6F 75 73 65 44 6F 77 6E 00 69 63 6F 6E 5F 6F 6E 4D 6F 75 73 65 44 72 61 67 67 65 64 00 6F 6E 4D 6F 75 73 65 44 72 61 67 67 65 64 00 63 61 6E 6D 6F 76 65 00 67 61 6D 65 63 6F 6E 74 72 6F 6C 5F 6F 6E 4B 65 79 44 6F 77 6E 00 6F 6E 4B 65 79 44 6F 77 6E 00 6F 70 74 69 6F 6E 73 00 6F 70 74 69 6F 6E 73 73 73 73 73 73 73 73 73 00 6C 69 6E 65 5F 79 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 6D 67 2E 69 63 6F 6E 73 38 2E 63 6F 6D 2F 3F 73 69 7A 65 3D 31 30 30 26 69 64 3D 72 37 46 55 6A 35 7A 4A 5A 70 67 4C 26 66 6F 72 6D 61 74 3D 70 6E 67 26 63 6F 6C 6F 72 3D 30 30 30 30 30 30 26 75 6E 75 73 65 64 3D 2E 70 6E 67 20 77 69 64 74 68 3D 00 20 3E 20 3C 66 6F 6E 74 20 66 61 63 65 3D 67 6C 6F 62 61 6C 69 73 6D 2E 74 74 66 20 73 69 7A 65 3D 00 3E 46 52 45 45 5A 45 20 43 4C 49 50 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 6D 67 2E 69 63 6F 6E 73 38 2E 63 6F 6D 2F 3F 73 69 7A 65 3D 31 30 30 26 69 64 3D 77 48 62 37 45 67 39 39 55 69 39 6C 26 66 6F 72 6D 61 74 3D 70 6E 67 26 63 6F 6C 6F 72 3D 30 30 30 30 30 30 26 75 6E 75 73 65 64 3D 2E 70 6E 67 20 77 69 64 74 68 3D 00 74 6F 67 67 6C 65 6F 70 74 69 6F 6E 00 5F 5F 63 68 65 63 6B 62 6F 78 5F 66 72 65 65 7A 65 63 6C 69 70 00 3E 20 3C 66 6F 6E 74 20 66 61 63 65 3D 67 6C 6F 62 61 6C 69 73 6D 2E 74 74 66 20 73 69 7A 65 3D 00 3E 55 53 45 46 55 4C 4C 20 54 4F 4F 4C 53 00 20 3E 3C 66 6F 6E 74 20 66 61 63 65 3D 67 6C 6F 62 61 6C 69 73 6D 2E 74 74 66 20 73 69 7A 65 3D 00 5F 5F 63 68 65 63 6B 62 6F 78 5F 63 6C 69 70 63 6F 75 6E 74 65 72 00 20 3E 20 3C 2F 66 6F 6E 74 3E 3C 66 6F 6E 74 20 66 61 63 65 3D 67 6C 6F 62 61 6C 69 73 6D 2E 74 74 66 20 73 69 7A 65 3D 00 3E 50 4C 41 59 45 52 20 45 53 50 20 42 4F 58 00 5F 5F 63 68 65 63 6B 62 6F 78 5F 6B 69 6C 6C 73 6F 75 6E 64 5F 74 65 78 74 00 5F 5F 6B 69 6C 6C 73 6F 75 6E 64 5F 73 74 61 74 65 00 3E 41 55 54 4F 20 54 52 41 53 48 00 3E 41 55 54 4F 20 53 54 45 41 4C 20 53 48 45 4C 4C 53 00 3E 54 52 41 53 48 20 45 53 50 20 4C 49 4E 45 00 67 6F 74 6F 62 6F 74 5F 77 69 6E 64 6F 77 5F 62 75 74 74 6F 6E 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 56 5A 65 36 4C 57 72 2E 70 6E 67 20 77 69 64 74 68 3D 00 63 6C 6F 73 65 5F 6D 65 6E 75 5F 77 69 6E 64 6F 77 5F 61 6E 64 5F 67 6F 74 6F 5F 62 6F 74 5F 77 69 6E 64 6F 77 00 63 6C 6F 73 65 5F 62 75 74 74 6F 6E 00 3C 63 65 6E 74 65 72 3E 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 73 45 6F 37 51 42 4D 2E 70 6E 67 20 68 65 69 67 68 74 3D 00 76 69 70 5F 62 75 74 74 6F 6E 00 3C 63 65 6E 74 65 72 3E 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 6E 33 73 59 62 67 4F 2E 70 6E 67 20 77 69 64 74 68 3D 00 76 69 70 57 69 6E 64 6F 77 00 3C 69 6D 67 20 73 72 63 3D 68 74 74 70 73 3A 2F 2F 69 2E 69 6D 67 75 72 2E 63 6F 6D 2F 32 47 6D 54 34 41 4D 2E 70 6E 67 20 77 69 64 74 68 3D 00 67 6F 74 6F 54 61 62 57 65 61 70 6F 6E 00 54 65 78 74 00 67 6F 74 6F 54 61 62 4A 6F 62 73 00 5F 63 6C 69 70 5F 74 65 78 74 00 5F 63 6C 69 70 74 65 78 74 00 6D 61 70 5F 63 6F 6E 74 72 6F 6C 00 6D 61 6B 65 4D 61 70 49 6D 61 67 65 00 73 74 61 66 66 43 6F 6E 74 72 6F 6C 00 6D 61 6B 65 53 74 61 66 66 54 6F 6F 6C 73 43 6F 6E 74 72 6F 6C 00 63 6C 6F 73 65 5F 62 6F 74 5F 77 69 6E 64 6F 77 5F 61 6E 64 5F 67 6F 74 6F 5F 6D 65 6E 75 5F 77 69 6E 64 6F 77 00 61 6E 69 00 4A 34 62 44 2F 35 36 6F 68 36 45 69 6C 35 54 63 43 5A 76 2B 75 55 57 6B 47 39 6E 78 6E 6D 6E 54 76 42 54 51 4C 41 6A 69 46 49 55 3D 00 2D 47 61 6D 65 73 00 4A 34 37 44 39 70 57 39 6C 4C 59 36 6C 49 44 57 43 63 57 6D 00 64 69 72 00 44 6F 6E 65 00 64 61 74 61 6F 62 6A 00 72 65 63 65 69 76 65 64 20 64 61 74 61 3A 20 3D 3E 00 66 75 6C 6C 64 61 74 61 00 63 68 61 74 00 2E 78 00 2E 74 00 75 70 64 61 74 65 00 73 74 65 61 6C 5F 73 68 65 6C 6C 73 5F 75 70 64 61 74 65 00 61 64 6A 75 73 74 5F 77 69 6E 64 6F 77 5F 61 74 74 72 69 62 75 74 65 73 00 00 00 00 04 00 00 25 A1 01 F4 15 28 17 BD 16 F0 00 23 BD 16 F0 01 23 33 0A 09 BD 16 F0 02 23 15 F0 04 28 15 F0 03 2A 32 17 BD 16 F0 02 23 15 F0 05 16 F0 06 06 20 BD 16 F0 02 23 24 96 F4 00 4D 16 F0 07 16 F0 08 32 16 F0 09 16 F0 0A 21 14 F3 02 3F 16 F0 01 21 14 F3 02 3F 3D 32 16 F0 0B 16 F0 0C 21 14 F3 02 3F 16 F0 00 21 14 F3 02 3F 3D 32 16 F0 0D 16 F0 01 32 16 F0 0E 16 F0 00 32 16 F0 0F 15 F0 10 32 16 F0 11 19 32 16 F0 12 19 32 17 16 F0 13 06 20 97 BD 16 F0 02 23 07 01 F4 15 28 17 BD 16 F0 14 23 33 0A 09 BD 16 F0 15 23 15 F0 16 32 17 16 F0 14 BD 16 F0 15 23 16 F0 17 06 07 01 F4 15 28 17 16 F0 18 33 0A 09 17 16 F0 19 24 16 F0 13 23 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 BD 16 F0 01 23 B6 16 F0 1A 23 32 BD 16 F0 00 23 B6 16 F0 1B 23 32 B6 16 F0 02 23 24 96 F4 00 B6 16 F0 07 16 F0 08 32 16 F0 09 16 F0 0A 21 14 F3 02 3F 16 F0 01 21 14 F3 02 3F 3D 32 16 F0 0B 16 F0 0C 21 14 F3 02 3F 16 F0 00 21 14 F3 02 3F 3D 32 16 F0 0D 16 F0 01 32 16 F0 0E 16 F0 00 32 16 F0 0F 15 F0 10 32 16 F0 11 19 32 16 F0 12 19 32 97 16 F0 1C 24 96 F4 00 D6 16 F0 0E 16 F0 0C 32 16 F0 0D 16 F0 0A 32 16 F0 09 16 F0 0A 21 14 F3 02 3F 16 F0 0D 21 14 F3 02 3F 3D 32 16 F0 0B 16 F0 0C 21 14 F3 02 3F 16 F0 0E 21 14 F3 02 3F 3D 32 97 BD 16 F0 1D 23 15 F0 1E B6 16 F0 1F 23 24 16 F0 20 23 22 71 15 F0 21 71 32 16 F0 1D 16 F0 1D 22 15 F0 22 71 B6 16 F0 1F 23 24 16 F0 23 23 22 71 32 16 F0 1D 16 F0 1D 22 15 F0 24 71 B6 16 F0 1F 23 24 16 F0 25 23 24 14 F3 00 83 22 71 32 16 F0 1D 16 F0 1D 22 15 F0 26 71 B6 16 F0 1F 23 24 16 F0 27 23 24 14 F3 00 83 22 71 15 F0 28 71 32 B6 16 F0 1D 23 24 16 F0 0F 23 16 F0 1D 32 BD 16 F0 0F 23 15 F0 2A 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 01 7B 16 F0 09 14 F3 14 B6 16 F0 2B 23 21 3E 32 16 F0 0B 16 F0 1B 21 14 F3 3C B6 16 F0 2B 23 21 3E 3D 32 16 F0 0D 16 F0 1A 32 BD 16 F0 2C 23 17 15 F0 2D 22 24 16 F0 2E 23 06 32 BD 16 F0 2F 23 15 F0 30 BD 16 F0 2C 23 22 71 22 29 24 14 F3 02 83 32 16 F0 0F 15 F0 31 14 F3 32 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 32 71 14 F3 32 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 33 71 BD 16 F0 2F 23 22 71 15 F0 34 71 32 97 16 F0 19 24 96 F4 01 A7 16 F0 09 16 F0 0A 21 14 F3 02 3F 14 F4 00 A0 B6 16 F0 2B 23 21 3E 3D 32 16 F0 0B 16 F0 0C 21 14 F3 3C B6 16 F0 2B 23 21 3E 3D 32 16 F0 0D 14 F4 01 40 B6 16 F0 2B 23 21 3E 32 16 F0 0E 14 F3 32 B6 16 F0 2B 23 21 3E 32 97 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 15 F0 35 16 F0 06 06 20 17 B6 16 F0 02 23 24 16 F0 36 23 06 20 B6 16 F0 37 23 19 46 04 F4 01 CB 17 B6 16 F0 2F 23 24 16 F0 13 23 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 15 F0 38 16 F0 06 06 20 17 B6 16 F0 02 23 24 16 F0 13 23 06 20 17 B6 16 F0 2F 23 24 16 F0 36 23 06 20 14 F3 00 07 01 F4 15 28 17 16 F0 39 16 F0 3A 16 F0 3B 33 0A 14 F3 00 07 01 F4 15 28 17 16 F0 39 16 F0 3A 16 F0 3B 33 0A B6 16 F0 3C 23 16 F0 3A 32 B6 16 F0 3D 23 16 F0 39 32 14 F3 00 07 01 F4 15 28 17 16 F0 3E 16 F0 3F 16 F0 3B 33 0A 09 17 15 F0 40 16 F0 3F 22 71 15 F0 41 71 16 F0 3E 22 71 16 F0 06 06 20 16 F0 3E 15 F0 42 46 04 F4 02 32 B6 16 F0 02 23 24 16 F0 43 23 19 46 04 F4 02 2E 17 16 F0 44 06 20 01 F4 02 32 17 16 F0 45 06 20 16 F0 3E 15 F0 46 46 04 F4 02 52 17 15 F0 47 15 F0 48 16 F0 49 06 20 17 14 F6 30 2E 32 00 16 F0 4A 06 20 B6 16 F0 4B 23 18 46 04 F4 02 4D B6 16 F0 4B 23 19 32 01 F4 02 52 B6 16 F0 4B 23 18 32 14 F3 00 07 01 F4 15 28 17 16 F0 39 16 F0 3A 16 F0 3B 33 0A 09 BD 16 F0 4C 23 16 F0 3A 21 B6 16 F0 3C 23 21 3D 32 BD 16 F0 4D 23 16 F0 39 21 B6 16 F0 3D 23 21 3D 32 BD 16 F0 4C 23 21 14 F3 00 48 04 F4 02 82 BD 16 F0 4C 23 BD 16 F0 4C 23 21 45 32 BD 16 F0 4D 23 21 14 F3 00 48 04 F4 02 92 BD 16 F0 4D 23 BD 16 F0 4D 23 21 45 32 BD 16 F0 4C 23 21 14 F3 0A 48 04 F4 02 A4 BD 16 F0 4D 23 21 14 F3 0A 48 04 F4 02 A4 17 16 F0 44 06 20 14 F3 00 07 01 F4 15 28 17 16 F0 39 16 F0 3A 16 F0 3B 33 0A 16 F0 3B 24 16 F0 4E 23 18 46 04 F4 02 C4 16 F0 3B 24 16 F0 0F 23 16 F0 3B 24 16 F0 4F 23 32 16 F0 3B 24 16 F0 4E 23 19 32 01 F4 02 D3 16 F0 3B 24 16 F0 0F 23 16 F0 3B 24 16 F0 50 23 32 16 F0 3B 24 16 F0 4E 23 18 32 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 16 F0 45 06 20 17 15 F0 51 16 F0 52 06 20 17 15 F0 53 16 F0 54 06 20 14 F3 00 07 01 F4 15 28 17 16 F0 55 33 0A 09 16 F0 56 24 16 F0 0F 23 16 F0 55 32 17 16 F0 57 24 16 F0 58 23 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 BD 16 F0 59 23 14 F3 00 32 BD 16 F0 59 23 21 16 F0 5A 24 82 21 48 04 F4 03 43 09 BD 16 F0 5B 23 16 F0 5A 24 BD 16 F0 59 23 21 83 32 BD 16 F0 5B 23 24 16 F0 5C 23 21 44 04 F4 03 35 BD 16 F0 5B 23 24 16 F0 5C 23 BD 16 F0 5B 23 24 16 F0 5D 23 32 BD 16 F0 5B 23 24 16 F0 5D 23 14 F3 00 32 BD 16 F0 59 23 34 20 01 F4 03 09 14 F3 00 07 01 F4 15 28 17 33 0A 09 BD 16 F0 59 23 14 F3 00 32 BD 16 F0 59 23 21 16 F0 5A 24 82 21 48 04 F4 03 88 09 BD 16 F0 5B 23 16 F0 5A 24 BD 16 F0 59 23 21 83 32 BD 16 F0 5B 23 24 16 F0 5C 23 21 04 F4 03 82 BD 16 F0 5B 23 24 16 F0 5D 23 BD 16 F0 5B 23 24 16 F0 5C 23 32 BD 16 F0 5B 23 24 16 F0 5C 23 19 32 BD 16 F0 59 23 34 20 01 F4 03 4F 14 F3 00 07 01 F4 15 28 17 16 F0 5E 16 F0 5F 16 F0 60 16 F0 61 16 F0 42 33 0A 09 B6 16 F0 62 23 24 16 F0 63 23 14 F3 01 46 04 F4 03 B9 16 F0 5F 22 15 F0 64 74 21 04 F4 03 B8 B6 16 F0 65 23 21 04 F4 03 B8 B6 16 F0 09 23 16 F0 66 21 14 F3 02 3D 32 B6 16 F0 0B 23 16 F0 67 21 14 F3 02 3D 32 01 F4 03 D9 16 F0 5F 22 15 F0 68 74 21 04 F4 03 D9 17 15 F0 69 16 F0 06 06 20 B6 16 F0 65 23 21 04 F4 03 D9 B6 16 F0 09 23 16 F0 66 21 14 F3 02 3D 32 B6 16 F0 0B 23 16 F0 67 21 14 F3 02 3D 32 17 16 F0 5E 16 F0 5F 16 F0 60 16 F0 61 16 F0 42 16 F0 06 06 20 BD 16 F0 6A 23 17 15 F0 6B 16 F0 5E 22 71 15 F0 6C 71 16 F0 52 06 32 BD 16 F0 6A 23 14 F3 00 47 04 F4 04 7F BD 16 F0 6A 23 14 F3 FF 47 04 F4 04 7F BD 16 F0 6D 23 15 F0 6E 32 BD 16 F0 6F 23 17 BD 16 F0 6A 23 22 15 F0 70 71 16 F0 71 24 16 F0 72 23 22 71 15 F0 70 71 16 F0 73 22 71 16 F0 74 06 32 BD 16 F0 75 23 17 15 F0 76 BD 16 F0 6F 23 22 71 15 F0 77 71 16 F0 52 06 32 BD 16 F0 78 23 BD 16 F0 6D 23 22 15 F0 79 71 BD 16 F0 75 23 22 71 32 BD 16 F0 7A 23 17 15 F0 7B BD 16 F0 78 23 22 71 15 F0 7C 71 16 F0 52 06 32 BD 16 F0 7D 23 17 16 F0 7A 16 F0 7E 06 32 17 15 F0 7F 15 F0 80 BD 16 F0 7D 23 B4 16 F0 81 23 06 20 17 15 F0 82 BD 16 F0 7A 23 22 71 15 F0 6C 71 16 F0 52 06 20 BD 16 F0 83 23 17 BD 16 F0 6A 23 16 F0 74 06 32 17 BD 16 F0 83 23 16 F0 06 06 20 17 15 F0 84 BD 16 F0 6A 23 22 71 16 F0 54 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 16 F0 2A 24 16 F0 13 23 06 20 17 16 F0 85 24 16 F0 13 23 06 20 17 16 F0 86 24 16 F0 13 23 06 20 17 16 F0 87 24 16 F0 13 23 06 20 17 16 F0 88 24 16 F0 36 23 06 20 17 16 F0 89 24 16 F0 36 23 06 20 17 16 F0 8A 24 16 F0 36 23 06 20 16 F0 8B 24 96 F4 04 D4 16 F0 0F 15 F0 8C 14 F3 14 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 8D 71 14 F3 50 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 34 71 32 97 16 F0 8E 24 96 F4 04 FC 16 F0 0F 15 F0 8F 14 F3 14 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 8D 71 14 F3 32 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 90 71 14 F3 28 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 91 71 32 97 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 16 F0 2A 24 16 F0 36 23 06 20 17 16 F0 85 24 16 F0 36 23 06 20 17 16 F0 86 24 16 F0 36 23 06 20 17 16 F0 87 24 16 F0 36 23 06 20 17 16 F0 88 24 16 F0 13 23 06 20 17 16 F0 89 24 16 F0 13 23 06 20 17 16 F0 8A 24 16 F0 13 23 06 20 16 F0 8B 24 96 F4 05 5C 16 F0 0F 15 F0 8C 14 F3 14 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 8D 71 14 F3 50 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 92 71 14 F3 46 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 91 71 32 97 16 F0 8E 24 96 F4 05 79 16 F0 0F 15 F0 8F 14 F3 14 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 8D 71 14 F3 32 B6 16 F0 2B 23 21 3E 55 22 71 15 F0 34 71 32 97 14 F3 00 07 01 F4 15 28 17 33 0A 09 BD 16 F0 93 23 15 F0 94 28 15 F0 29 2A 32 BD 16 F0 93 23 24 16 F0 0F 23 15 F0 95 32 BD 16 F0 93 23 24 16 F0 0D 23 14 F4 01 90 32 BD 16 F0 93 23 24 16 F0 09 23 14 F4 00 C8 32 BD 16 F0 93 23 24 16 F0 0B 23 14 F4 00 C8 32 BD 16 F0 93 23 24 16 F0 0E 23 14 F4 01 90 32 BD 16 F0 93 23 24 16 F0 0F 23 BD 16 F0 93 23 24 16 F0 0F 23 21 15 F0 96 21 3C 32 BD 16 F0 93 23 24 16 F0 0F 23 BD 16 F0 93 23 24 16 F0 0F 23 21 15 F0 97 21 3C 32 BD 16 F0 93 23 24 16 F0 0F 23 BD 16 F0 93 23 24 16 F0 0F 23 21 15 F0 98 21 3C 32 BD 16 F0 93 23 24 16 F0 0F 23 BD 16 F0 93 23 24 16 F0 0F 23 21 15 F0 99 21 3C 32 17 BD 16 F0 93 23 16 F0 9A 24 16 F0 9B 23 06 20 14 F3 00 07 01 F4 15 28 17 16 F0 2F 33 0A 09 17 18 16 F0 9A 24 16 F0 9C 23 06 20 17 15 F0 47 15 F0 48 16 F0 49 06 20 16 F0 2F 24 16 F0 0B 23 14 F3 F6 32 14 F6 30 2E 32 00 08 16 F0 2F 24 16 F0 0B 23 14 F3 00 32 14 F3 00 07 01 F4 15 28 17 16 F0 2F 33 0A 09 17 18 16 F0 9A 24 16 F0 9C 23 06 20 B6 16 F0 65 23 18 47 04 F4 06 58 B6 16 F0 65 23 18 32 16 F0 2F 24 16 F0 0B 23 14 F3 F6 32 B6 16 F0 62 23 24 16 F0 63 23 14 F3 01 46 04 F4 06 52 17 15 F0 9D 16 F0 54 06 20 01 F4 06 57 17 15 F0 9E 16 F0 54 06 20 01 F4 06 68 B6 16 F0 65 23 19 32 16 F0 2F 24 16 F0 0B 23 14 F3 00 32 17 15 F0 9F 16 F0 54 06 20 14 F3 00 07 01 F4 15 28 17 16 F0 2F 33 0A 09 17 18 16 F0 9A 24 16 F0 9C 23 06 20 16 F0 1C 24 16 F0 43 23 18 46 04 F4 06 8D 17 16 F0 1C 24 16 F0 36 23 06 20 16 F0 2F 24 16 F0 0B 23 14 F3 00 32 01 F4 06 9A 17 16 F0 1C 24 16 F0 13 23 06 20 16 F0 2F 24 16 F0 0B 23 14 F3 F6 32 14 F3 00 07 01 F4 15 28 17 33 0A 09 BD 16 F0 93 23 15 F0 1C 28 15 F0 A0 2A 32 BD 16 F0 93 23 24 96 F4 06 E7 16 F0 0E 16 F0 0C 21 14 F4 00 A0 B6 16 F0 2B 23 21 3E 3D 32 16 F0 0D 16 F0 0C 21 14 F3 64 B6 16 F0 2B 23 21 3E 3D 32 16 F0 A1 15 F0 A2 32 16 F0 09 16 F0 0A 21 14 F3 02 3F 16 F0 0D 21 14 F3 02 3F 3D 32 16 F0 0B 16 F0 0C 21 14 F3 02 3F 16 F0 0E 21 14 F3 02 3F 3D 32 17 15 F0 A3 15 F0 A4 16 F0 20 B5 16 F0 A5 23 06 20 97 BD 16 F0 93 23 07 01 F4 15 28 17 33 0A 09 BD 16 F0 A6 23 15 F0 19 28 15 F0 03 2A 32 16 F0 19 24 16 F0 A7 23 19 32 16 F0 19 24 16 F0 A8 23 19 32 17 19 16 F0 19 24 16 F0 A9 23 06 20 17 BD 16 F0 A6 23 15 F0 AA 16 F0 06 06 20 BD 16 F0 AB 23 15 F0 AC 28 15 F0 29 2A 32 BD 16 F0 AB 23 24 96 F4 07 52 16 F0 09 14 F3 00 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 AD 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 17 15 F0 AE 15 F0 A4 16 F0 20 B5 16 F0 A5 23 06 20 97 BD 16 F0 AF 23 15 F0 B0 28 15 F0 29 2A 32 BD 16 F0 AF 23 24 96 F4 07 93 16 F0 09 14 F3 36 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B1 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 17 15 F0 B2 15 F0 A4 16 F0 20 B5 16 F0 A5 23 06 20 97 BD 16 F0 B3 23 15 F0 B4 28 15 F0 29 2A 32 BD 16 F0 B3 23 24 96 F4 07 D6 16 F0 09 14 F3 36 14 F3 02 3E 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B5 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 17 15 F0 B6 15 F0 A4 16 F0 20 B5 16 F0 A5 23 06 20 97 BD 16 F0 B7 23 15 F0 B8 28 15 F0 29 2A 32 BD 16 F0 B7 23 24 96 F4 08 10 16 F0 09 14 F3 36 14 F3 03 3E 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B9 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 97 BD 16 F0 BA 23 15 F0 BB 28 15 F0 29 2A 32 BD 16 F0 BA 23 24 96 F4 08 4A 16 F0 09 14 F3 36 14 F3 04 3E 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B9 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 97 BD 16 F0 BC 23 15 F0 BD 28 15 F0 29 2A 32 BD 16 F0 BC 23 24 96 F4 08 84 16 F0 09 14 F3 36 14 F3 05 3E 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B9 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 97 BD 16 F0 BE 23 15 F0 BF 28 15 F0 29 2A 32 BD 16 F0 BE 23 24 96 F4 08 BE 16 F0 09 14 F3 36 14 F3 06 3E 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B9 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 97 BD 16 F0 C0 23 15 F0 C1 28 15 F0 29 2A 32 BD 16 F0 C0 23 24 96 F4 08 F8 16 F0 09 14 F3 36 14 F3 07 3E 16 F0 2B 21 3E 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 32 16 F0 2B 21 3E 32 16 F0 0E 14 F3 32 16 F0 2B 21 3E 32 16 F0 0F 15 F0 B9 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 32 71 14 F3 28 16 F0 2B 21 3E 55 22 71 15 F0 34 71 32 97 17 BD 16 F0 AB 23 16 F0 19 24 16 F0 9B 23 06 20 17 BD 16 F0 AF 23 16 F0 19 24 16 F0 9B 23 06 20 17 BD 16 F0 B3 23 16 F0 19 24 16 F0 9B 23 06 20 17 BD 16 F0 B7 23 16 F0 19 24 16 F0 9B 23 06 20 17 BD 16 F0 BA 23 16 F0 19 24 16 F0 9B 23 06 20 17 BD 16 F0 BC 23 16 F0 19 24 16 F0 9B 23 06 20 16 F0 19 07 01 F4 15 28 17 16 F0 C2 33 0A 16 F0 C2 21 14 F3 00 48 04 F4 09 44 16 F0 C2 21 45 07 16 F0 C2 07 01 F4 15 28 17 16 F0 C3 33 0A 09 16 F0 C3 21 14 F3 00 48 04 F4 09 58 17 15 F0 C4 16 F0 06 06 20 14 F3 00 07 16 F0 C3 14 F3 00 46 04 F4 09 5E 14 F3 00 07 BD 16 F0 C5 23 14 F6 30 2E 30 30 30 30 30 30 30 30 30 31 00 32 BD 16 F0 C6 23 16 F0 C3 21 14 F6 32 2E 30 00 3F 32 16 F0 C6 21 16 F0 C6 21 3E 16 F0 C3 21 3D 56 21 16 F0 C5 21 49 04 F4 09 87 09 16 F0 C6 16 F0 C6 21 16 F0 C3 21 16 F0 C6 21 3F 3C 14 F6 32 2E 30 00 3F 32 01 F4 09 6B 16 F0 C6 07 01 F4 15 28 17 16 F0 C7 16 F0 39 16 F0 3A 16 F0 C8 16 F0 93 33 0A 09 BD 16 F0 C9 23 16 F0 3A 21 16 F0 93 24 16 F0 09 23 21 3D 32 BD 16 F0 CA 23 16 F0 39 21 16 F0 93 24 16 F0 0B 23 21 3D 32 BD 16 F0 CB 23 16 F0 C9 21 16 F0 93 24 16 F0 0D 23 21 3F 32 BD 16 F0 CC 23 16 F0 CA 21 16 F0 93 24 16 F0 0E 23 21 3F 32 BD 16 F0 CD 23 15 F0 CE 28 15 F0 29 2A 32 16 F0 B4 24 16 F0 0B 23 14 F3 00 32 BD 16 F0 CD 23 24 96 F4 0A 00 16 F0 0F 15 F0 CF B6 16 F0 2B 23 21 14 F3 20 3E 55 22 71 15 F0 32 71 B6 16 F0 2B 23 21 14 F3 20 3E 55 22 71 15 F0 34 71 32 16 F0 0D B6 16 F0 2B 23 21 14 F3 26 3E 32 16 F0 0E B6 16 F0 2B 23 21 14 F3 26 3E 32 97 BD 16 F0 CD 23 24 16 F0 09 23 BD 16 F0 C9 23 21 B6 16 F0 2B 23 21 14 F3 10 3E 3D 32 BD 16 F0 CD 23 24 16 F0 0B 23 BD 16 F0 CA 23 21 B6 16 F0 2B 23 21 14 F3 10 3E 3D 32 17 BD 16 F0 CD 23 16 F0 93 24 16 F0 9B 23 06 20 17 BD 16 F0 CC 23 21 B6 16 F0 D0 23 21 3E BD 16 F0 CB 23 21 B6 16 F0 D1 23 21 3E 16 F0 D2 06 20 14 F3 01 08 17 16 F0 93 24 16 F0 36 23 06 20 17 BD 16 F0 CD 23 24 16 F0 D3 23 06 20 17 15 F0 D4 16 F0 54 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 15 F0 D5 15 F0 D6 14 F3 00 14 F3 00 16 F0 D7 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 B6 16 F0 D8 23 21 04 F4 0A 7D B6 16 F0 D9 23 B6 16 F0 D8 23 32 B6 16 F0 DA 23 18 46 04 F4 0A 9A 17 16 F0 DB 06 20 17 16 F0 DC 06 21 14 F3 02 48 04 F4 0A 9A B6 16 F0 D8 23 B6 16 F0 D9 23 32 B6 16 F0 D9 23 14 F3 00 32 17 14 F3 01 14 F3 3C 3F 15 F0 DD 14 F3 1E 16 F0 DE 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 B4 16 F0 DF 23 14 F3 1E 32 17 15 F0 E0 16 F0 54 06 20 B4 16 F0 E1 23 16 F0 E2 32 B6 16 F0 D1 23 14 F3 0E 14 F3 40 3E 32 B6 16 F0 D0 23 14 F3 12 14 F3 40 3E 32 17 16 F0 E3 06 20 17 14 F3 00 16 F0 E4 06 20 17 16 F0 E5 06 20 17 14 F3 01 14 F3 3C 3F 15 F0 E6 14 F3 01 14 F3 3C 3F 16 F0 DE 06 20 17 14 F3 01 16 F0 E7 06 20 B6 16 F0 E8 23 16 F0 E9 24 82 32 B6 16 F0 4B 23 19 32 B6 16 F0 EA 23 19 32 B6 16 F0 62 23 24 16 F0 63 23 14 F3 01 46 04 F4 0B 07 BD 16 F0 EB 23 16 F0 0C 21 14 F4 02 58 3F 32 01 F4 0B 0F BD 16 F0 EB 23 16 F0 0C 21 14 F4 01 90 3F 32 B6 16 F0 2B 23 BD 16 F0 EB 23 32 17 B6 16 F0 0B 23 B6 16 F0 09 23 16 F0 06 06 20 B6 16 F0 1A 23 14 F4 01 90 BD 16 F0 EB 23 21 3E 32 B6 16 F0 1B 23 14 F4 01 2C BD 16 F0 EB 23 21 3E 32 BD 16 F0 1A 23 B6 16 F0 1A 23 32 BD 16 F0 1B 23 B6 16 F0 1B 23 32 BD 16 F0 02 23 17 B6 16 F0 1B 23 21 BD 16 F0 EB 23 21 3E B6 16 F0 1A 23 21 BD 16 F0 EB 23 21 3E 16 F0 EC 06 32 B6 16 F0 02 23 BD 16 F0 02 23 32 17 BD 16 F0 02 23 15 F0 ED 16 F0 06 06 20 17 BD 16 F0 02 23 24 16 F0 EE 23 06 20 17 BD 16 F0 02 23 24 16 F0 EF 23 06 20 B6 16 F0 37 23 19 32 BD 16 F0 0F 23 15 F0 F0 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 0B D0 16 F0 09 14 F3 00 32 16 F0 0B 14 F3 00 32 16 F0 0D 16 F0 1A 32 BD 16 F0 2C 23 17 15 F0 2D 22 24 16 F0 2E 23 06 32 BD 16 F0 2F 23 15 F0 30 BD 16 F0 2C 23 22 71 22 29 24 14 F3 02 83 32 17 BD 16 F0 2F 23 16 F0 06 06 20 16 F0 0F 15 F0 F1 14 F4 00 B4 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 32 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 F2 71 32 97 17 16 F0 0F 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 F3 23 15 F0 F4 28 15 F0 29 2A 32 16 F0 F3 24 96 F4 0C 28 16 F0 0D BD 16 F0 1A 23 21 14 F3 64 BD 16 F0 EB 23 21 3E 3C 32 16 F0 0E BD 16 F0 1B 23 21 14 F3 14 BD 16 F0 EB 23 21 3E 3D 32 16 F0 09 14 F3 14 BD 16 F0 EB 23 21 3E 45 32 16 F0 0B 14 F3 32 BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F0 31 14 F4 03 20 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F4 01 F4 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 F5 71 32 97 17 16 F0 F3 16 F0 02 24 16 F0 9B 23 06 20 17 16 F0 F3 24 16 F0 F6 23 16 F0 06 06 20 BD 16 F0 0F 23 15 F0 2A 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 0C 82 16 F0 09 14 F3 0A BD 16 F0 EB 23 21 3E 32 16 F0 0B 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 0D 16 F0 1A 32 BD 16 F0 2C 23 17 15 F0 2D 22 24 16 F0 2E 23 06 32 BD 16 F0 2F 23 15 F0 30 BD 16 F0 2C 23 22 71 22 29 24 14 F3 02 83 32 17 BD 16 F0 2F 23 16 F0 06 06 20 16 F0 0F 15 F0 F7 BD 16 F0 2F 23 22 71 15 F0 34 71 32 97 17 16 F0 0F 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 F3 23 15 F0 F8 28 15 F0 29 2A 32 16 F0 F3 24 96 F4 0C D4 16 F0 0D 14 F4 00 E6 BD 16 F0 EB 23 21 3E 32 16 F0 0E 14 F4 01 90 BD 16 F0 EB 23 21 3E 32 16 F0 09 BD 16 F0 1A 23 21 14 F4 00 FA BD 16 F0 EB 23 21 3E 3D 32 16 F0 0B 14 F3 0A BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F0 31 14 F4 01 04 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F4 01 2C BD 16 F0 EB 23 21 3E 55 22 71 15 F0 F9 71 32 97 17 16 F0 F3 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 FA 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 0D 0A 16 F0 0D BD 16 F0 1A 23 21 14 F3 14 BD 16 F0 EB 23 21 3E 3D 32 16 F0 09 14 F3 0A BD 16 F0 EB 23 21 3E 32 16 F0 0B 14 F3 14 14 F3 32 3C BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F0 FB 32 97 B6 16 F0 1D 23 BD 16 F0 0F 23 32 17 15 F0 FC 16 F0 06 06 20 BD 16 F0 2F 23 15 F0 FD 28 15 F0 29 2A 32 BD 16 F0 2F 23 24 96 F4 0D 7C 16 F0 09 16 F0 0A 21 16 F0 0A 21 14 F3 04 3F 3D 32 16 F0 0B 14 F3 0A BD 16 F0 EB 23 21 3E 32 16 F0 0D 14 F3 28 BD 16 F0 EB 23 21 3E 32 16 F0 0E 14 F3 28 BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F0 FE 14 F3 26 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 26 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 34 71 32 17 15 F0 FF 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 17 15 F1 01 01 15 F0 A4 16 F0 20 B5 16 F0 A5 23 06 20 17 15 F1 01 02 15 F1 01 03 16 F0 20 B5 16 F0 A5 23 06 20 16 F1 01 04 18 32 97 B6 16 F0 2F 23 16 F0 2F 32 16 F0 9A 24 96 F4 0D 8E 17 15 F1 01 05 15 F1 01 06 16 F0 20 B5 16 F0 A5 23 06 20 97 16 F0 02 24 96 F4 0D 9B 17 15 F1 01 05 15 F1 01 06 16 F0 20 B5 16 F0 A5 23 06 20 97 BD 16 F1 01 07 23 15 F1 01 08 28 15 F0 03 2A 32 16 F1 01 07 24 96 F4 0D C7 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0D 14 F4 01 90 BD 16 F0 EB 23 21 3E 32 16 F0 0E 14 F4 00 DC BD 16 F0 EB 23 21 3E 32 16 F0 0B 14 F3 46 BD 16 F0 EB 23 21 3E 32 97 BD 16 F1 01 09 23 14 F3 32 BD 16 F0 EB 23 21 3E 32 BD 16 F0 0F 23 15 F0 85 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 0E 66 16 F0 0D 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 BD 16 F0 0F 23 24 16 F0 50 23 15 F1 01 0A 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0B 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0C 71 32 BD 16 F0 0F 23 24 16 F0 4F 23 15 F1 01 0D 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0B 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0C 71 32 16 F0 0F BD 16 F0 0F 23 24 16 F0 4F 23 32 17 15 F1 01 0E 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 B6 16 F1 01 0F 23 BD 16 F0 0F 23 32 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 86 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 0F 0F 16 F0 0D 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 BD 16 F0 0F 23 24 16 F0 50 23 15 F1 01 0A 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 10 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 11 71 32 BD 16 F0 0F 23 24 16 F0 4F 23 15 F1 01 0D 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 12 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 11 71 32 16 F0 0F BD 16 F0 0F 23 24 16 F0 4F 23 32 17 15 F1 01 0E 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 B6 16 F1 01 13 23 BD 16 F0 0F 23 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 87 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 0F BD 16 F0 0D 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 BD 16 F0 0F 23 24 16 F0 50 23 15 F1 01 0A 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 14 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 15 71 32 BD 16 F0 0F 23 24 16 F0 4F 23 15 F1 01 0D 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 14 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 15 71 32 16 F0 0F BD 16 F0 0F 23 24 16 F0 4F 23 32 17 15 F1 01 0E 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 B6 16 F1 01 16 23 BD 16 F0 0F 23 32 B6 16 F1 01 17 23 19 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 14 F3 0A BD 16 F0 EB 23 21 3E 3C 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 BD 16 F1 01 09 23 14 F3 32 BD 16 F0 EB 23 21 3E 32 BD 16 F0 0F 23 15 F0 88 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 10 7C 16 F0 0D 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 BD 16 F0 0F 23 24 16 F0 50 23 15 F1 01 0A 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0B 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 18 71 32 BD 16 F0 0F 23 24 16 F0 4F 23 15 F1 01 0D 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0B 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 18 71 32 16 F0 0F BD 16 F0 0F 23 24 16 F0 4F 23 32 17 15 F1 01 0E 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 B6 16 F1 01 16 23 BD 16 F0 0F 23 32 B6 16 F1 01 17 23 19 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 89 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 11 2A 16 F0 0D 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 BD 16 F0 0F 23 24 16 F0 50 23 15 F1 01 0A 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0B 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 19 71 32 BD 16 F0 0F 23 24 16 F0 4F 23 15 F1 01 0D 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 0B 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 19 71 32 16 F0 0F BD 16 F0 0F 23 24 16 F0 4F 23 32 17 15 F1 01 0E 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 B6 16 F1 01 16 23 BD 16 F0 0F 23 32 B6 16 F1 01 17 23 19 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 8A 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 11 D8 16 F0 0D 14 F4 00 C8 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 BD 16 F0 0F 23 24 16 F0 50 23 15 F1 01 0A 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 14 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 1A 71 32 BD 16 F0 0F 23 24 16 F0 4F 23 15 F1 01 0D 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 12 BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 14 71 14 F3 0C BD 16 F0 EB 23 21 3E 55 22 71 15 F1 01 1A 71 32 16 F0 0F BD 16 F0 0F 23 24 16 F0 4F 23 32 17 15 F1 01 0E 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 B6 16 F1 01 16 23 BD 16 F0 0F 23 32 B6 16 F1 01 17 23 19 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 14 F3 0A BD 16 F0 EB 23 21 3E 3C 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F1 01 1B 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 12 4C 16 F0 0D 14 F4 00 91 BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 08 BD 16 F0 EB 23 21 3E 32 16 F0 0B BD 16 F1 01 09 23 21 55 32 16 F0 0F 15 F1 01 1C 14 F4 00 8C BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 20 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 34 71 32 17 15 F1 01 1D 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 16 F0 0E 14 F3 20 BD 16 F0 EB 23 21 3E 32 B6 16 F1 01 16 23 BD 16 F0 0F 23 32 B6 16 F1 01 17 23 19 32 97 BD 16 F1 01 09 23 1E 21 16 F0 0F 24 16 F0 0E 23 21 14 F3 0A BD 16 F0 EB 23 21 3E 3C 3C 32 17 16 F0 0F 16 F1 01 07 24 16 F0 9B 23 06 20 17 16 F1 01 07 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F1 01 1E 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 12 BB 16 F0 0D 14 F3 64 BD 16 F0 EB 23 21 3E 32 16 F0 09 16 F0 1A 21 14 F3 64 BD 16 F0 EB 23 21 3E 3D 32 16 F0 0B 16 F0 1B 21 14 F3 2A BD 16 F0 EB 23 21 3E 3D 32 16 F0 0F 15 F1 01 1F 14 F3 1E BD 16 F0 EB 23 21 3E 55 22 71 15 F0 8D 71 14 F3 4A BD 16 F0 EB 23 21 3E 55 22 71 15 F0 91 71 32 17 15 F0 45 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 97 17 16 F0 0F 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F1 01 20 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 13 0C 16 F0 0D 14 F3 64 BD 16 F0 EB 23 21 3E 32 16 F0 09 16 F0 1A 21 14 F3 64 BD 16 F0 EB 23 21 3E 3D 32 16 F0 0B 14 F3 10 BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F1 01 21 14 F3 28 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 14 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 91 71 32 17 15 F1 01 22 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 97 17 16 F0 0F 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 8E 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 13 5A 16 F0 0D 14 F3 3E BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 0C BD 16 F0 EB 23 21 3E 32 16 F0 0B 14 F3 3E BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F1 01 23 14 F3 18 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 32 71 14 F3 32 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 34 71 32 17 15 F1 01 24 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 97 17 BD 16 F0 0F 23 15 F1 01 25 16 F0 06 06 20 17 16 F0 0F 16 F0 02 24 16 F0 9B 23 06 20 BD 16 F0 0F 23 15 F0 8B 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 13 BC 16 F0 0D 14 F3 50 14 F3 0A 3C BD 16 F0 EB 23 21 3E 32 16 F0 09 14 F3 37 14 F3 0C 3C BD 16 F0 EB 23 21 3E 32 16 F0 0B 14 F3 3E BD 16 F0 EB 23 21 3E 32 16 F0 0E 14 F3 1C BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F0 8C 14 F3 18 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 8D 71 14 F3 18 BD 16 F0 EB 23 21 3E 55 22 71 15 F0 34 71 32 17 15 F1 01 26 15 F1 01 00 16 F0 20 B5 16 F0 A5 23 06 20 97 17 16 F0 0F 16 F0 02 24 16 F0 9B 23 06 20 17 14 F3 01 16 F0 E7 06 20 BD 16 F0 0F 23 15 F1 01 27 28 15 F0 29 2A 32 16 F0 0F 24 96 F4 13 E6 16 F0 09 14 F3 00 32 16 F0 0B 14 F3 00 32 16 F0 0D 14 F3 64 BD 16 F0 EB 23 21 3E 32 16 F0 0F 15 F0 95 32 97 B6 16 F1 01 28 23 16 F0 0F 32 17 16 F1 01 24 06 20 BD 16 F1 01 29 23 17 16 F1 01 2A 06 32 17 BD 16 F1 01 29 23 16 F0 9A 24 16 F0 9B 23 06 20 17 BD 16 F1 01 29 23 24 16 F0 36 23 06 20 BD 16 F1 01 2B 23 17 16 F1 01 2C 06 32 BD 16 F1 01 2B 23 24 96 F4 14 3E 16 F0 09 16 F0 0A 21 14 F3 02 3F 14 F4 00 A0 BD 16 F0 EB 23 21 3E 3D 32 16 F0 0B 16 F0 0C 21 14 F3 3C BD 16 F0 EB 23 21 3E 3D 32 16 F0 0D 14 F4 01 40 BD 16 F0 EB 23 21 3E 32 16 F0 0E 14 F3 32 BD 16 F0 EB 23 21 3E 32 97 17 BD 16 F1 01 2B 23 16 F0 9A 24 16 F0 9B 23 06 20 17 16 F1 01 2D 06 20 17 16 F0 45 06 20 17 16 F0 19 24 16 F0 13 23 06 20 14 F3 00 07 01 F4 15 28 17 16 F0 0B 16 F0 09 33 0A 09 B6 16 F0 09 23 16 F0 09 32 B6 16 F0 0B 23 16 F0 0B 32 B6 16 F1 01 2E 23 15 F0 47 32 14 F3 01 08 17 15 F1 01 2F 15 F1 01 30 15 F0 D6 14 F3 00 14 F3 00 16 F0 D7 06 20 14 F3 01 08 17 15 F1 01 31 15 F1 01 30 15 F0 D6 14 F3 00 14 F3 00 16 F0 D7 06 20 B6 16 F1 01 32 23 14 F3 02 32 17 15 F1 01 33 16 F0 06 06 20 14 F3 00 07 01 F4 15 28 17 16 F1 01 34 33 0A 09 17 15 F1 01 35 16 F1 01 34 24 16 F1 01 36 23 22 71 16 F0 06 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 17 B4 16 F0 E1 23 06 20 14 F3 00 07 01 F4 15 28 17 33 0A 09 B6 16 F1 01 37 23 15 F1 01 38 46 04 F4 14 DE 17 B6 16 F0 02 23 24 16 F0 D3 23 06 20 17 B6 16 F0 2F 23 24 16 F0 D3 23 06 20 17 B6 16 F1 01 28 23 24 16 F0 D3 23 06 20 B6 16 F1 01 37 23 15 F0 95 32 14 F3 00 07 B6 16 F1 01 37 23 15 F1 01 39 46 04 F4 14 FC B6 16 F1 01 37 23 15 F0 95 32 B6 16 F0 37 23 B6 16 F0 37 23 21 44 32 B6 16 F0 37 23 19 46 04 F4 14 FC 17 16 F0 45 06 20 17 14 F3 01 14 F3 64 3F 16 F1 01 3A 06 20 B6 16 F0 4B 23 16 F0 87 24 16 F0 4E 23 32 B6 16 F0 EA 23 16 F0 8A 24 16 F0 4E 23 32 17 14 F3 01 14 F3 64 3F 16 F1 01 3B 06 20 17 16 F1 01 3C 06 20 17 14 F3 01 14 F3 64 3F 16 F0 E7 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
        
                            if (switch_data.checked) {
                                setGraalScript(script)
                            } else {
                                unsetGraalScript(script + "@00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02 00 00 00 0E 00 00 00 01 6F 6E 43 72 65 61 74 65 64 00 00 00 00 03 00 00 00 15 6B 64 6B 61 6A 64 6B 64 64 77 64 64 6A 77 64 00 68 69 64 65 00 00 00 00 04 00 00 00 18 01 F4 00 0F 17 33 0A 09 17 16 F0 00 24 16 F0 01 23 06 20 14 F3 00 07 07 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00")
                            }
                        }
        
        
                    }
                })
        
        
              tmenu.addText({
                text: ` <button type="button" class=" w-full focus:outline-none text-white bg-yellow-400 hover:bg-yellow-500 focus:ring-4 focus:ring-yellow-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:focus:ring-yellow-900" onclick="window.showVipPrompt()">UNLOCK VIP</button>`
              })
        
              tmenu.addText({
                tab: TMenu.TAB_INFO,
                text: `Thanks for supporters<br><br> <button type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 w-full" onclick="native.message('open-intent','https://discord.gg/FgFMbCk3')">Discord Server</button><br>
                <iframe width="420" style='width:100%' src="https://www.youtube.com/embed/ldkbEZOB-Cw?si=XkHgn2LEOr2N3-Zi">
                
                `
              })
        
        
        
                tmenu.addSwitch({
                    text: "<div style='display:flex'>Freeze Clip <div style='color:gold' id='vip-text'> VIP</div></div>",
                    description: "Freeze the clip of yours weapons.",
                    id: "freezeclip",
                    tab: TMenu.TAB_CHEATS
                })
        
                tmenu.addSwitch({
                    text: "<div style='display:flex'>Digging Bot bot v4, <div style='color:gold' id='vip-text'> VIP</div></div>",
                    description: "for diggers",
                    id: "Digging Bot",
                    tab: TMenu.TAB_CHEATS
                })
        
        
                tmenu.addSwitch({
                    text: "<div style='display:flex'>Make trees transparent <div style='color:gold' id='vip-text'> VIP</div></div>",
                    description: "walk everywalls",
                    tab: TMenu.TAB_CHEATS,
                    id: "alphatree"
                })
        
        
                tmenu.addSwitch({
                    text: "<div style='display:flex'>Trash radar/esp line <div style='color:gold' id='vip-text'> VIP</div></div>",
                    description: "esp line from player to trashs",
                    id: "trashline",
                    tab: TMenu.TAB_CHEATS
                })
        
        
                tmenu.addSwitch({
                    text: "<div style='display:flex'>Mushroom radar/esp line <div style='color:gold' id='vip-text'> VIP</div></div>",
                    description: "esp line from player to mushrooms",
                    id: "mushroomline",
                    tab: TMenu.TAB_CHEATS
                })
        
        
                tmenu.addSwitch({
                    text: "<div style='display:flex'>Staff Tools <div style='color:gold' id='vip-text'> VIP</div></div>",
                    description: "wings teleport and map pickpoint teleport",
                    tab: TMenu.TAB_CHEATS,
                    id: 'st-tools'
                })
        
                tmenu.breakline();
        
                tmenu.breakline();
        
        
        
        
        
        
        
        
        
                
        
                tmenu.addText({
                    tab: TMenu.TAB_PREMIUM, text: `
                    <div>
                   
        
                                <div id="key-button btn btn-yellow" >Already bought one from us? <div style="color:gold">Click here</div>
                                                        <div id="key-button" onclick="native.message('open-intent','https://discord.gg/FgFMbCk3')">Want to buy one key from us?<div style="color:lightgreen">Go to discord server</div>
                                                        probably wondering why this isn't free, but if we gave it away, the game would be flooded with hackers abusing the system. By keeping access controlled, we help maintain a more balanced experience for everyone. So, enter your key and start using what we’ve got for you!
                    </div>
                    <br>
                    
            
                    </div>
        
                   
        
                `});
        
                // tmenu.addOnMessage((id,data)=>{
                //     if (id == "cafe-toast"){
                //         Java.scheduleOnMainThread(function() {
                //             var toast = Java.use("android.widget.Toast");
                //             toast.makeText(Java.use("android.app.ActivityThread").currentApplication().getApplicationContext(), Java.use("java.lang.String").$new("This is works!"), 1).show();
                //     });
                //     }
        
                // })
        
                let code = (VIP_ARRAY.map(e => {
                    return `{
                        const el = document.getElementById('${e}');
                        if (el){
                            el.style.pointerEvents = 'none';
                            try{
                                el.querySelector("#vip-text").innerText = "VIP 🔒";
        
                            }catch(e){}
                
        
                }
        
                            
                        }
                    `
                }).join("\n"));
                tmenu.appendJsCode(code)
                tmenu.appendJsCode(`
                window.onLicenseKeyInput = function(value) {
                                        Swal.fire({
          title: "Connecting to the server please wait...",
          width: 600,
          padding: "3em",
          color: "#716add",
          fontSize: 8,
          background: "#fff",
          backdrop: \`
            rgba(0,0,123,0.4)
            url("https://opengameart.org/sites/default/files/storyboard6.png")
            left top
            no-repeat
          \`
        });
                native.message("request-unlock",value)
                }
                `)
        
        
                const script_request_key = (`
        var CryptoJS=CryptoJS||function(u,p){var d={},l=d.lib={},s=function(){},t=l.Base={extend:function(a){s.prototype=this;var c=new s;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
        r=l.WordArray=t.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=p?c:4*a.length},toString:function(a){return(a||v).stringify(this)},concat:function(a){var c=this.words,e=a.words,j=this.sigBytes;a=a.sigBytes;this.clamp();if(j%4)for(var k=0;k<a;k++)c[j+k>>>2]|=(e[k>>>2]>>>24-8*(k%4)&255)<<24-8*((j+k)%4);else if(65535<e.length)for(k=0;k<a;k+=4)c[j+k>>>2]=e[k>>>2];else c.push.apply(c,e);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
        32-8*(c%4);a.length=u.ceil(c/4)},clone:function(){var a=t.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],e=0;e<a;e+=4)c.push(4294967296*u.random()|0);return new r.init(c,a)}}),w=d.enc={},v=w.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var e=[],j=0;j<a;j++){var k=c[j>>>2]>>>24-8*(j%4)&255;e.push((k>>>4).toString(16));e.push((k&15).toString(16))}return e.join("")},parse:function(a){for(var c=a.length,e=[],j=0;j<c;j+=2)e[j>>>3]|=parseInt(a.substr(j,
        2),16)<<24-4*(j%8);return new r.init(e,c/2)}},b=w.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var e=[],j=0;j<a;j++)e.push(String.fromCharCode(c[j>>>2]>>>24-8*(j%4)&255));return e.join("")},parse:function(a){for(var c=a.length,e=[],j=0;j<c;j++)e[j>>>2]|=(a.charCodeAt(j)&255)<<24-8*(j%4);return new r.init(e,c)}},x=w.Utf8={stringify:function(a){try{return decodeURIComponent(escape(b.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return b.parse(unescape(encodeURIComponent(a)))}},
        q=l.BufferedBlockAlgorithm=t.extend({reset:function(){this._data=new r.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=x.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,e=c.words,j=c.sigBytes,k=this.blockSize,b=j/(4*k),b=a?u.ceil(b):u.max((b|0)-this._minBufferSize,0);a=b*k;j=u.min(4*a,j);if(a){for(var q=0;q<a;q+=k)this._doProcessBlock(e,q);q=e.splice(0,a);c.sigBytes-=j}return new r.init(q,j)},clone:function(){var a=t.clone.call(this);
        a._data=this._data.clone();return a},_minBufferSize:0});l.Hasher=q.extend({cfg:t.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){q.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(b,e){return(new a.init(e)).finalize(b)}},_createHmacHelper:function(a){return function(b,e){return(new n.HMAC.init(a,
        e)).finalize(b)}}});var n=d.algo={};return d}(Math);
        (function(){var u=CryptoJS,p=u.lib.WordArray;u.enc.Base64={stringify:function(d){var l=d.words,p=d.sigBytes,t=this._map;d.clamp();d=[];for(var r=0;r<p;r+=3)for(var w=(l[r>>>2]>>>24-8*(r%4)&255)<<16|(l[r+1>>>2]>>>24-8*((r+1)%4)&255)<<8|l[r+2>>>2]>>>24-8*((r+2)%4)&255,v=0;4>v&&r+0.75*v<p;v++)d.push(t.charAt(w>>>6*(3-v)&63));if(l=t.charAt(64))for(;d.length%4;)d.push(l);return d.join("")},parse:function(d){var l=d.length,s=this._map,t=s.charAt(64);t&&(t=d.indexOf(t),-1!=t&&(l=t));for(var t=[],r=0,w=0;w<
        l;w++)if(w%4){var v=s.indexOf(d.charAt(w-1))<<2*(w%4),b=s.indexOf(d.charAt(w))>>>6-2*(w%4);t[r>>>2]|=(v|b)<<24-8*(r%4);r++}return p.create(t,r)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}})();
        (function(u){function p(b,n,a,c,e,j,k){b=b+(n&a|~n&c)+e+k;return(b<<j|b>>>32-j)+n}function d(b,n,a,c,e,j,k){b=b+(n&c|a&~c)+e+k;return(b<<j|b>>>32-j)+n}function l(b,n,a,c,e,j,k){b=b+(n^a^c)+e+k;return(b<<j|b>>>32-j)+n}function s(b,n,a,c,e,j,k){b=b+(a^(n|~c))+e+k;return(b<<j|b>>>32-j)+n}for(var t=CryptoJS,r=t.lib,w=r.WordArray,v=r.Hasher,r=t.algo,b=[],x=0;64>x;x++)b[x]=4294967296*u.abs(u.sin(x+1))|0;r=r.MD5=v.extend({_doReset:function(){this._hash=new w.init([1732584193,4023233417,2562383102,271733878])},
        _doProcessBlock:function(q,n){for(var a=0;16>a;a++){var c=n+a,e=q[c];q[c]=(e<<8|e>>>24)&16711935|(e<<24|e>>>8)&4278255360}var a=this._hash.words,c=q[n+0],e=q[n+1],j=q[n+2],k=q[n+3],z=q[n+4],r=q[n+5],t=q[n+6],w=q[n+7],v=q[n+8],A=q[n+9],B=q[n+10],C=q[n+11],u=q[n+12],D=q[n+13],E=q[n+14],x=q[n+15],f=a[0],m=a[1],g=a[2],h=a[3],f=p(f,m,g,h,c,7,b[0]),h=p(h,f,m,g,e,12,b[1]),g=p(g,h,f,m,j,17,b[2]),m=p(m,g,h,f,k,22,b[3]),f=p(f,m,g,h,z,7,b[4]),h=p(h,f,m,g,r,12,b[5]),g=p(g,h,f,m,t,17,b[6]),m=p(m,g,h,f,w,22,b[7]),
        f=p(f,m,g,h,v,7,b[8]),h=p(h,f,m,g,A,12,b[9]),g=p(g,h,f,m,B,17,b[10]),m=p(m,g,h,f,C,22,b[11]),f=p(f,m,g,h,u,7,b[12]),h=p(h,f,m,g,D,12,b[13]),g=p(g,h,f,m,E,17,b[14]),m=p(m,g,h,f,x,22,b[15]),f=d(f,m,g,h,e,5,b[16]),h=d(h,f,m,g,t,9,b[17]),g=d(g,h,f,m,C,14,b[18]),m=d(m,g,h,f,c,20,b[19]),f=d(f,m,g,h,r,5,b[20]),h=d(h,f,m,g,B,9,b[21]),g=d(g,h,f,m,x,14,b[22]),m=d(m,g,h,f,z,20,b[23]),f=d(f,m,g,h,A,5,b[24]),h=d(h,f,m,g,E,9,b[25]),g=d(g,h,f,m,k,14,b[26]),m=d(m,g,h,f,v,20,b[27]),f=d(f,m,g,h,D,5,b[28]),h=d(h,f,
        m,g,j,9,b[29]),g=d(g,h,f,m,w,14,b[30]),m=d(m,g,h,f,u,20,b[31]),f=l(f,m,g,h,r,4,b[32]),h=l(h,f,m,g,v,11,b[33]),g=l(g,h,f,m,C,16,b[34]),m=l(m,g,h,f,E,23,b[35]),f=l(f,m,g,h,e,4,b[36]),h=l(h,f,m,g,z,11,b[37]),g=l(g,h,f,m,w,16,b[38]),m=l(m,g,h,f,B,23,b[39]),f=l(f,m,g,h,D,4,b[40]),h=l(h,f,m,g,c,11,b[41]),g=l(g,h,f,m,k,16,b[42]),m=l(m,g,h,f,t,23,b[43]),f=l(f,m,g,h,A,4,b[44]),h=l(h,f,m,g,u,11,b[45]),g=l(g,h,f,m,x,16,b[46]),m=l(m,g,h,f,j,23,b[47]),f=s(f,m,g,h,c,6,b[48]),h=s(h,f,m,g,w,10,b[49]),g=s(g,h,f,m,
        E,15,b[50]),m=s(m,g,h,f,r,21,b[51]),f=s(f,m,g,h,u,6,b[52]),h=s(h,f,m,g,k,10,b[53]),g=s(g,h,f,m,B,15,b[54]),m=s(m,g,h,f,e,21,b[55]),f=s(f,m,g,h,v,6,b[56]),h=s(h,f,m,g,x,10,b[57]),g=s(g,h,f,m,t,15,b[58]),m=s(m,g,h,f,D,21,b[59]),f=s(f,m,g,h,z,6,b[60]),h=s(h,f,m,g,C,10,b[61]),g=s(g,h,f,m,j,15,b[62]),m=s(m,g,h,f,A,21,b[63]);a[0]=a[0]+f|0;a[1]=a[1]+m|0;a[2]=a[2]+g|0;a[3]=a[3]+h|0},_doFinalize:function(){var b=this._data,n=b.words,a=8*this._nDataBytes,c=8*b.sigBytes;n[c>>>5]|=128<<24-c%32;var e=u.floor(a/
        4294967296);n[(c+64>>>9<<4)+15]=(e<<8|e>>>24)&16711935|(e<<24|e>>>8)&4278255360;n[(c+64>>>9<<4)+14]=(a<<8|a>>>24)&16711935|(a<<24|a>>>8)&4278255360;b.sigBytes=4*(n.length+1);this._process();b=this._hash;n=b.words;for(a=0;4>a;a++)c=n[a],n[a]=(c<<8|c>>>24)&16711935|(c<<24|c>>>8)&4278255360;return b},clone:function(){var b=v.clone.call(this);b._hash=this._hash.clone();return b}});t.MD5=v._createHelper(r);t.HmacMD5=v._createHmacHelper(r)})(Math);
        (function(){var u=CryptoJS,p=u.lib,d=p.Base,l=p.WordArray,p=u.algo,s=p.EvpKDF=d.extend({cfg:d.extend({keySize:4,hasher:p.MD5,iterations:1}),init:function(d){this.cfg=this.cfg.extend(d)},compute:function(d,r){for(var p=this.cfg,s=p.hasher.create(),b=l.create(),u=b.words,q=p.keySize,p=p.iterations;u.length<q;){n&&s.update(n);var n=s.update(d).finalize(r);s.reset();for(var a=1;a<p;a++)n=s.finalize(n),s.reset();b.concat(n)}b.sigBytes=4*q;return b}});u.EvpKDF=function(d,l,p){return s.create(p).compute(d,
        l)}})();
        CryptoJS.lib.Cipher||function(u){var p=CryptoJS,d=p.lib,l=d.Base,s=d.WordArray,t=d.BufferedBlockAlgorithm,r=p.enc.Base64,w=p.algo.EvpKDF,v=d.Cipher=t.extend({cfg:l.extend(),create_0x88788or:function(e,a){return this.create(this._ENC_XFORM_MODE,e,a)},create_0x88782or:function(e,a){return this.create(this._DEC_XFORM_MODE,e,a)},init:function(e,a,b){this.cfg=this.cfg.extend(b);this._xformMode=e;this._key=a;this.reset()},reset:function(){t.reset.call(this);this._doReset()},process:function(e){this._append(e);return this._process()},
        finalize:function(e){e&&this._append(e);return this._doFinalize()},keySize:4,ivSize:4,_ENC_XFORM_MODE:1,_DEC_XFORM_MODE:2,_createHelper:function(e){return{_0x88788:function(b,k,d){return("string"==typeof k?c:a)._0x88788(e,b,k,d)},_0x88782:function(b,k,d){return("string"==typeof k?c:a)._0x88782(e,b,k,d)}}}});d.StreamCipher=v.extend({_doFinalize:function(){return this._process(!0)},blockSize:1});var b=p.mode={},x=function(e,a,b){var c=this._iv;c?this._iv=u:c=this._prevBlock;for(var d=0;d<b;d++)e[a+d]^=
        c[d]},q=(d.BlockCipherMode=l.extend({create_0x88788or:function(e,a){return this._0x88788or.create(e,a)},create_0x88782or:function(e,a){return this._0x88782or.create(e,a)},init:function(e,a){this._cipher=e;this._iv=a}})).extend();q._0x88788or=q.extend({processBlock:function(e,a){var b=this._cipher,c=b.blockSize;x.call(this,e,a,c);b._0x88788Block(e,a);this._prevBlock=e.slice(a,a+c)}});q._0x88782or=q.extend({processBlock:function(e,a){var b=this._cipher,c=b.blockSize,d=e.slice(a,a+c);b._0x88782Block(e,a);x.call(this,
        e,a,c);this._prevBlock=d}});b=b.CBC=q;q=(p.pad={}).Pkcs7={pad:function(a,b){for(var c=4*b,c=c-a.sigBytes%c,d=c<<24|c<<16|c<<8|c,l=[],n=0;n<c;n+=4)l.push(d);c=s.create(l,c);a.concat(c)},unpad:function(a){a.sigBytes-=a.words[a.sigBytes-1>>>2]&255}};d.BlockCipher=v.extend({cfg:v.cfg.extend({mode:b,padding:q}),reset:function(){v.reset.call(this);var a=this.cfg,b=a.iv,a=a.mode;if(this._xformMode==this._ENC_XFORM_MODE)var c=a.create_0x88788or;else c=a.create_0x88782or,this._minBufferSize=1;this._mode=c.call(a,
        this,b&&b.words)},_doProcessBlock:function(a,b){this._mode.processBlock(a,b)},_doFinalize:function(){var a=this.cfg.padding;if(this._xformMode==this._ENC_XFORM_MODE){a.pad(this._data,this.blockSize);var b=this._process(!0)}else b=this._process(!0),a.unpad(b);return b},blockSize:4});var n=d.CipherParams=l.extend({init:function(a){this.mixIn(a)},toString:function(a){return(a||this.formatter).stringify(this)}}),b=(p.format={}).OpenSSL={stringify:function(a){var b=a.ciphertext;a=a.salt;return(a?s.create([1398893684,
        1701076831]).concat(a).concat(b):b).toString(r)},parse:function(a){a=r.parse(a);var b=a.words;if(1398893684==b[0]&&1701076831==b[1]){var c=s.create(b.slice(2,4));b.splice(0,4);a.sigBytes-=16}return n.create({ciphertext:a,salt:c})}},a=d.SerializableCipher=l.extend({cfg:l.extend({format:b}),_0x88788:function(a,b,c,d){d=this.cfg.extend(d);var l=a.create_0x88788or(c,d);b=l.finalize(b);l=l.cfg;return n.create({ciphertext:b,key:c,iv:l.iv,algorithm:a,mode:l.mode,padding:l.padding,blockSize:a.blockSize,formatter:d.format})},
        _0x88782:function(a,b,c,d){d=this.cfg.extend(d);b=this._parse(b,d.format);return a.create_0x88782or(c,d).finalize(b.ciphertext)},_parse:function(a,b){return"string"==typeof a?b.parse(a,this):a}}),p=(p.kdf={}).OpenSSL={execute:function(a,b,c,d){d||(d=s.random(8));a=w.create({keySize:b+c}).compute(a,d);c=s.create(a.words.slice(b),4*c);a.sigBytes=4*b;return n.create({key:a,iv:c,salt:d})}},c=d.PasswordBasedCipher=a.extend({cfg:a.cfg.extend({kdf:p}),_0x88788:function(b,c,d,l){l=this.cfg.extend(l);d=l.kdf.execute(d,
        b.keySize,b.ivSize);l.iv=d.iv;b=a._0x88788.call(this,b,c,d.key,l);b.mixIn(d);return b},_0x88782:function(b,c,d,l){l=this.cfg.extend(l);c=this._parse(c,l.format);d=l.kdf.execute(d,b.keySize,b.ivSize,c.salt);l.iv=d.iv;return a._0x88782.call(this,b,c,d.key,l)}})}();
        (function(){for(var u=CryptoJS,p=u.lib.BlockCipher,d=u.algo,l=[],s=[],t=[],r=[],w=[],v=[],b=[],x=[],q=[],n=[],a=[],c=0;256>c;c++)a[c]=128>c?c<<1:c<<1^283;for(var e=0,j=0,c=0;256>c;c++){var k=j^j<<1^j<<2^j<<3^j<<4,k=k>>>8^k&255^99;l[e]=k;s[k]=e;var z=a[e],F=a[z],G=a[F],y=257*a[k]^16843008*k;t[e]=y<<24|y>>>8;r[e]=y<<16|y>>>16;w[e]=y<<8|y>>>24;v[e]=y;y=16843009*G^65537*F^257*z^16843008*e;b[k]=y<<24|y>>>8;x[k]=y<<16|y>>>16;q[k]=y<<8|y>>>24;n[k]=y;e?(e=z^a[a[a[G^z]]],j^=a[a[j]]):e=j=1}var H=[0,1,2,4,8,
        16,32,64,128,27,54],d=d._0x8387=p.extend({_doReset:function(){for(var a=this._key,c=a.words,d=a.sigBytes/4,a=4*((this._nRounds=d+6)+1),e=this._keySchedule=[],j=0;j<a;j++)if(j<d)e[j]=c[j];else{var k=e[j-1];j%d?6<d&&4==j%d&&(k=l[k>>>24]<<24|l[k>>>16&255]<<16|l[k>>>8&255]<<8|l[k&255]):(k=k<<8|k>>>24,k=l[k>>>24]<<24|l[k>>>16&255]<<16|l[k>>>8&255]<<8|l[k&255],k^=H[j/d|0]<<24);e[j]=e[j-d]^k}c=this._invKeySchedule=[];for(d=0;d<a;d++)j=a-d,k=d%4?e[j]:e[j-4],c[d]=4>d||4>=j?k:b[l[k>>>24]]^x[l[k>>>16&255]]^q[l[k>>>
        8&255]]^n[l[k&255]]},_0x88788Block:function(a,b){this._doCryptBlock(a,b,this._keySchedule,t,r,w,v,l)},_0x88782Block:function(a,c){var d=a[c+1];a[c+1]=a[c+3];a[c+3]=d;this._doCryptBlock(a,c,this._invKeySchedule,b,x,q,n,s);d=a[c+1];a[c+1]=a[c+3];a[c+3]=d},_doCryptBlock:function(a,b,c,d,e,j,l,f){for(var m=this._nRounds,g=a[b]^c[0],h=a[b+1]^c[1],k=a[b+2]^c[2],n=a[b+3]^c[3],p=4,r=1;r<m;r++)var q=d[g>>>24]^e[h>>>16&255]^j[k>>>8&255]^l[n&255]^c[p++],s=d[h>>>24]^e[k>>>16&255]^j[n>>>8&255]^l[g&255]^c[p++],t=
        d[k>>>24]^e[n>>>16&255]^j[g>>>8&255]^l[h&255]^c[p++],n=d[n>>>24]^e[g>>>16&255]^j[h>>>8&255]^l[k&255]^c[p++],g=q,h=s,k=t;q=(f[g>>>24]<<24|f[h>>>16&255]<<16|f[k>>>8&255]<<8|f[n&255])^c[p++];s=(f[h>>>24]<<24|f[k>>>16&255]<<16|f[n>>>8&255]<<8|f[g&255])^c[p++];t=(f[k>>>24]<<24|f[n>>>16&255]<<16|f[g>>>8&255]<<8|f[h&255])^c[p++];n=(f[n>>>24]<<24|f[g>>>16&255]<<16|f[h>>>8&255]<<8|f[k&255])^c[p++];a[b]=q;a[b+1]=s;a[b+2]=t;a[b+3]=n},keySize:8});u._0x8387=p._createHelper(d)})();
        const decrypt = CryptoJS._0x8387._0x88782;
        const encrypt = CryptoJS._0x8387._0x88788;
        const SEPARATOR = "550e8400-e29b-41d4-a716-446655440000";
        
        
        
        function encodeData(device_id, key) {
        
            const NEW_KEY = btoa("" + Math.random()) + btoa("" + Math.random()) + btoa("" + Math.random());
            const encryptedData = encrypt(JSON.stringify({ key, device_id }), NEW_KEY).toString();
            const encodedData = encryptedData + SEPARATOR + NEW_KEY;
            return { data: encodedData, enc_key: NEW_KEY };
        }
        
        
        
        
        window.sendData = async function (url, device_id, key) {
        
            if (! key.includes("@")) {
            setTimeout(()=>{
                 Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: 'Key invalida.',
                    });
                    native.message("not-unlocked","")
            },1000)
            return;
            }
            const enc = encodeData(device_id, key);
        
            const encodedData = enc.data;
            const encKey = enc.enc_key;
        
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ device: encodedData })
                });
        
                if (!response.ok) {
                    throw new Error('Erro ao enviar os dados para o servidor');
                }
        
                const responseData = await response.json();
                console.log("Resposta do servidor:", responseData);
        
                const encryptedDevice = responseData.device.split(SEPARATOR)[0];
                const encryptedKey = responseData.device.split(SEPARATOR)[1];
        
                if (encKey != encryptedKey) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: 'Key expirou, renove a assinatura.',
                    });
                    native.message("not-unlocked","")
                    return false;
                }
        
                // Descriptografar os dados recebidos usando a chave fornecida
                const decryptedData = decrypt(encryptedDevice, encryptedKey).toString(CryptoJS.enc.Utf8);
        
                const realData = JSON.parse(decryptedData);
                if (realData.error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: realData.error,
                    });
                    native.message("not-unlocked","")
                    return false;
                }
        
                if (realData.isExpired === true) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Assinatura Expirada',
                        text: 'Key expirou, renove a assinatura.',
                    });
        
                    return false;
                }
        
                if (realData.isExpired === false) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: 'Logado com sucesso!',
                    });
        
                    native.message("unlocked","")
                    return true;
                }
        
                return true;
        
            } catch (error) {
                console.error('Erro:', error.message);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message,
                });
                native.message("not-unlocked","")
                return false;
            }
        }`)
        
        
                tmenu.appendJsCode(script_request_key)
        
        
                setTimeout(() => {
        
                })
                tmenu.build()



        
        
        
        
            });
        }//todo fix bug
        
        function abc() {
            runOnVisibleActivity((context) => {
                if (context == null) {
        
                    setTimeout(() => {
                        abc();
                    }, 100);
        
                } else {
                    setTimeout(() => {
                        inject_mod(context);
                    }, 2000);
                }
            });
        }
        
        abc();
        function selfDestructIfExpired(expirationYear, expirationMonth, expirationDay, withinDeadlineCallback, expiredCallback) {
            const currentDate = new Date();
            const expirationDate = new Date(expirationYear, expirationMonth - 1, expirationDay);

            if (currentDate > expirationDate) {
                if (expiredCallback) {
                    expiredCallback();
                }
            } else {
                if (withinDeadlineCallback) {
                    withinDeadlineCallback();
                }
            }
        }

        let expired = true

        if (expired == false) {
            Java.perform(function () {
                var System = Java.use('java.lang.System');
                System.exit.overload('int').call(System, 0);
            });
            process.exit(0)

        }


    





        selfDestructIfExpired(2024, 12, 20, () => {
            expired = false
            console.log("Está valido")
        },
            () => {
                Java.perform(function () {
                    var System = Java.use('java.lang.System');
                    System.exit.overload('int').call(System, 0);
                });
            }
        );
        
})()

}).call(this)}).call(this,require('_process'))

},{"_process":2}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mcmlkYS1wcm9jZXNzL2luZGV4LmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIifQ==
