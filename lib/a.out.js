// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    process['exit'](1);
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependent on the others
  throw new Error('Unknown runtime environment. Where are we?');
}

if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    if (!func) return; // on null pointer, return undefined
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    Runtime.stackSave()
  },
  'stackRestore': function() {
    Runtime.stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = Runtime.stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = Runtime.stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};
// For fast lookup of conversion functions
var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

// C calling interface.
function ccall (ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = Runtime.stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === 'string') ret = Pointer_stringify(ret);
  if (stack !== 0) {
    Runtime.stackRestore(stack);
  }
  return ret;
}

function cwrap (ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments);
  }
}




/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}


/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}


var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}


// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}


// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}


// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}


// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}


function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}


function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}


function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}


function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}


// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}


function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}


function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}


function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 1984;
/* global initializers */  __ATINIT__.push();


memoryInitializer = "a.out.js.mem";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___lock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  function _abort() {
      Module['abort']();
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    } 
__ATEXIT__.push(flush_NO_FILESYSTEM);;
DYNAMICTOP_PTR = Runtime.staticAlloc(4);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

var ASSERTIONS = false;

// All functions here should be maybeExported from jsifier.js

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}





function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_abort": _abort, "_emscripten_memcpy_big": _emscripten_memcpy_big, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'use asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var ___lock=env.___lock;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var _abort=env._abort;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function _malloc($0) {
 $0 = $0 | 0;
 var $$$0192$i = 0, $$$0193$i = 0, $$$4351$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i18$i = 0, $$01$i$i = 0, $$0189$i = 0, $$0192$lcssa$i = 0, $$01928$i = 0, $$0193$lcssa$i = 0, $$01937$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0, $$024371$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0289$i$i = 0, $$0295$i$i = 0, $$0296$i$i = 0, $$0342$i = 0, $$0344$i = 0, $$0345$i = 0, $$0347$i = 0, $$0353$i = 0, $$0358$i = 0, $$0359$i = 0, $$0361$i = 0, $$0362$i = 0, $$0368$i = 0, $$1196$i = 0, $$1198$i = 0, $$124470$i = 0, $$1291$i$i = 0, $$1293$i$i = 0, $$1343$i = 0, $$1348$i = 0, $$1363$i = 0, $$1370$i = 0, $$1374$i = 0, $$2234253237$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2355$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i201 = 0, $$3350$i = 0, $$3372$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$415$i = 0, $$4236$i = 0, $$4351$lcssa$i = 0, $$435114$i = 0, $$4357$$4$i = 0, $$4357$ph$i = 0, $$435713$i = 0, $$723948$i = 0, $$749$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i20$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi11$i$iZ2D = 0, $$pre$phiZ2D = 0, $1 = 0, $1001 = 0, $1007 = 0, $101 = 0, $1010 = 0, $1011 = 0, $102 = 0, $1029 = 0, $1031 = 0, $1038 = 0, $1039 = 0, $1040 = 0, $1048 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $108 = 0, $112 = 0, $114 = 0, $115 = 0, $117 = 0, $119 = 0, $121 = 0, $123 = 0, $125 = 0, $127 = 0, $129 = 0, $134 = 0, $138 = 0, $14 = 0, $142 = 0, $145 = 0, $148 = 0, $149 = 0, $155 = 0, $157 = 0, $16 = 0, $160 = 0, $162 = 0, $165 = 0, $167 = 0, $17 = 0, $170 = 0, $173 = 0, $174 = 0, $176 = 0, $177 = 0, $179 = 0, $18 = 0, $180 = 0, $182 = 0, $183 = 0, $188 = 0, $189 = 0, $19 = 0, $20 = 0, $201 = 0, $205 = 0, $211 = 0, $218 = 0, $222 = 0, $231 = 0, $232 = 0, $234 = 0, $235 = 0, $239 = 0, $240 = 0, $248 = 0, $249 = 0, $250 = 0, $252 = 0, $253 = 0, $258 = 0, $259 = 0, $262 = 0, $264 = 0, $267 = 0, $27 = 0, $272 = 0, $279 = 0, $289 = 0, $293 = 0, $299 = 0, $30 = 0, $303 = 0, $306 = 0, $310 = 0, $312 = 0, $313 = 0, $315 = 0, $317 = 0, $319 = 0, $321 = 0, $323 = 0, $325 = 0, $327 = 0, $337 = 0, $338 = 0, $34 = 0, $348 = 0, $350 = 0, $353 = 0, $355 = 0, $358 = 0, $360 = 0, $363 = 0, $366 = 0, $367 = 0, $369 = 0, $37 = 0, $370 = 0, $372 = 0, $373 = 0, $375 = 0, $376 = 0, $381 = 0, $382 = 0, $387 = 0, $394 = 0, $398 = 0, $404 = 0, $41 = 0, $411 = 0, $415 = 0, $423 = 0, $426 = 0, $427 = 0, $428 = 0, $432 = 0, $433 = 0, $439 = 0, $44 = 0, $444 = 0, $445 = 0, $448 = 0, $450 = 0, $453 = 0, $458 = 0, $464 = 0, $466 = 0, $468 = 0, $47 = 0, $470 = 0, $487 = 0, $489 = 0, $49 = 0, $496 = 0, $497 = 0, $498 = 0, $50 = 0, $506 = 0, $508 = 0, $509 = 0, $511 = 0, $52 = 0, $520 = 0, $524 = 0, $526 = 0, $527 = 0, $528 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $546 = 0, $548 = 0, $549 = 0, $555 = 0, $557 = 0, $559 = 0, $56 = 0, $564 = 0, $566 = 0, $568 = 0, $569 = 0, $570 = 0, $578 = 0, $579 = 0, $58 = 0, $582 = 0, $586 = 0, $589 = 0, $591 = 0, $597 = 0, $6 = 0, $60 = 0, $601 = 0, $605 = 0, $614 = 0, $615 = 0, $62 = 0, $621 = 0, $623 = 0, $627 = 0, $630 = 0, $632 = 0, $637 = 0, $64 = 0, $643 = 0, $648 = 0, $649 = 0, $650 = 0, $656 = 0, $657 = 0, $658 = 0, $662 = 0, $67 = 0, $673 = 0, $678 = 0, $679 = 0, $681 = 0, $687 = 0, $689 = 0, $69 = 0, $693 = 0, $699 = 0, $7 = 0, $70 = 0, $703 = 0, $709 = 0, $71 = 0, $711 = 0, $717 = 0, $72 = 0, $721 = 0, $722 = 0, $727 = 0, $73 = 0, $733 = 0, $738 = 0, $741 = 0, $742 = 0, $745 = 0, $747 = 0, $749 = 0, $752 = 0, $763 = 0, $768 = 0, $77 = 0, $770 = 0, $773 = 0, $775 = 0, $778 = 0, $781 = 0, $782 = 0, $783 = 0, $785 = 0, $787 = 0, $788 = 0, $790 = 0, $791 = 0, $796 = 0, $797 = 0, $8 = 0, $80 = 0, $810 = 0, $813 = 0, $814 = 0, $820 = 0, $828 = 0, $834 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $843 = 0, $844 = 0, $850 = 0, $855 = 0, $856 = 0, $859 = 0, $861 = 0, $864 = 0, $869 = 0, $87 = 0, $875 = 0, $877 = 0, $879 = 0, $880 = 0, $898 = 0, $9 = 0, $900 = 0, $907 = 0, $908 = 0, $909 = 0, $916 = 0, $92 = 0, $920 = 0, $924 = 0, $926 = 0, $93 = 0, $932 = 0, $933 = 0, $935 = 0, $936 = 0, $940 = 0, $945 = 0, $946 = 0, $947 = 0, $95 = 0, $953 = 0, $955 = 0, $96 = 0, $961 = 0, $966 = 0, $969 = 0, $970 = 0, $971 = 0, $975 = 0, $976 = 0, $98 = 0, $982 = 0, $987 = 0, $988 = 0, $991 = 0, $993 = 0, $996 = 0, label = 0, sp = 0, $955$looptemp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 do if ($0 >>> 0 < 245) {
  $6 = $0 >>> 0 < 11 ? 16 : $0 + 11 & -8;
  $7 = $6 >>> 3;
  $8 = HEAP32[95] | 0;
  $9 = $8 >>> $7;
  if ($9 & 3 | 0) {
   $14 = ($9 & 1 ^ 1) + $7 | 0;
   $16 = 420 + ($14 << 1 << 2) | 0;
   $17 = $16 + 8 | 0;
   $18 = HEAP32[$17 >> 2] | 0;
   $19 = $18 + 8 | 0;
   $20 = HEAP32[$19 >> 2] | 0;
   do if (($16 | 0) == ($20 | 0)) HEAP32[95] = $8 & ~(1 << $14); else {
    if ($20 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort();
    $27 = $20 + 12 | 0;
    if ((HEAP32[$27 >> 2] | 0) == ($18 | 0)) {
     HEAP32[$27 >> 2] = $16;
     HEAP32[$17 >> 2] = $20;
     break;
    } else _abort();
   } while (0);
   $30 = $14 << 3;
   HEAP32[$18 + 4 >> 2] = $30 | 3;
   $34 = $18 + $30 + 4 | 0;
   HEAP32[$34 >> 2] = HEAP32[$34 >> 2] | 1;
   $$0 = $19;
   STACKTOP = sp;
   return $$0 | 0;
  }
  $37 = HEAP32[97] | 0;
  if ($6 >>> 0 > $37 >>> 0) {
   if ($9 | 0) {
    $41 = 2 << $7;
    $44 = $9 << $7 & ($41 | 0 - $41);
    $47 = ($44 & 0 - $44) + -1 | 0;
    $49 = $47 >>> 12 & 16;
    $50 = $47 >>> $49;
    $52 = $50 >>> 5 & 8;
    $54 = $50 >>> $52;
    $56 = $54 >>> 2 & 4;
    $58 = $54 >>> $56;
    $60 = $58 >>> 1 & 2;
    $62 = $58 >>> $60;
    $64 = $62 >>> 1 & 1;
    $67 = ($52 | $49 | $56 | $60 | $64) + ($62 >>> $64) | 0;
    $69 = 420 + ($67 << 1 << 2) | 0;
    $70 = $69 + 8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    $72 = $71 + 8 | 0;
    $73 = HEAP32[$72 >> 2] | 0;
    do if (($69 | 0) == ($73 | 0)) {
     $77 = $8 & ~(1 << $67);
     HEAP32[95] = $77;
     $98 = $77;
    } else {
     if ($73 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort();
     $80 = $73 + 12 | 0;
     if ((HEAP32[$80 >> 2] | 0) == ($71 | 0)) {
      HEAP32[$80 >> 2] = $69;
      HEAP32[$70 >> 2] = $73;
      $98 = $8;
      break;
     } else _abort();
    } while (0);
    $84 = ($67 << 3) - $6 | 0;
    HEAP32[$71 + 4 >> 2] = $6 | 3;
    $87 = $71 + $6 | 0;
    HEAP32[$87 + 4 >> 2] = $84 | 1;
    HEAP32[$87 + $84 >> 2] = $84;
    if ($37 | 0) {
     $92 = HEAP32[100] | 0;
     $93 = $37 >>> 3;
     $95 = 420 + ($93 << 1 << 2) | 0;
     $96 = 1 << $93;
     if (!($98 & $96)) {
      HEAP32[95] = $98 | $96;
      $$0199 = $95;
      $$pre$phiZ2D = $95 + 8 | 0;
     } else {
      $101 = $95 + 8 | 0;
      $102 = HEAP32[$101 >> 2] | 0;
      if ($102 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
       $$0199 = $102;
       $$pre$phiZ2D = $101;
      }
     }
     HEAP32[$$pre$phiZ2D >> 2] = $92;
     HEAP32[$$0199 + 12 >> 2] = $92;
     HEAP32[$92 + 8 >> 2] = $$0199;
     HEAP32[$92 + 12 >> 2] = $95;
    }
    HEAP32[97] = $84;
    HEAP32[100] = $87;
    $$0 = $72;
    STACKTOP = sp;
    return $$0 | 0;
   }
   $108 = HEAP32[96] | 0;
   if (!$108) $$0197 = $6; else {
    $112 = ($108 & 0 - $108) + -1 | 0;
    $114 = $112 >>> 12 & 16;
    $115 = $112 >>> $114;
    $117 = $115 >>> 5 & 8;
    $119 = $115 >>> $117;
    $121 = $119 >>> 2 & 4;
    $123 = $119 >>> $121;
    $125 = $123 >>> 1 & 2;
    $127 = $123 >>> $125;
    $129 = $127 >>> 1 & 1;
    $134 = HEAP32[684 + (($117 | $114 | $121 | $125 | $129) + ($127 >>> $129) << 2) >> 2] | 0;
    $138 = (HEAP32[$134 + 4 >> 2] & -8) - $6 | 0;
    $142 = HEAP32[$134 + 16 + (((HEAP32[$134 + 16 >> 2] | 0) == 0 & 1) << 2) >> 2] | 0;
    if (!$142) {
     $$0192$lcssa$i = $134;
     $$0193$lcssa$i = $138;
    } else {
     $$01928$i = $134;
     $$01937$i = $138;
     $145 = $142;
     while (1) {
      $148 = (HEAP32[$145 + 4 >> 2] & -8) - $6 | 0;
      $149 = $148 >>> 0 < $$01937$i >>> 0;
      $$$0193$i = $149 ? $148 : $$01937$i;
      $$$0192$i = $149 ? $145 : $$01928$i;
      $145 = HEAP32[$145 + 16 + (((HEAP32[$145 + 16 >> 2] | 0) == 0 & 1) << 2) >> 2] | 0;
      if (!$145) {
       $$0192$lcssa$i = $$$0192$i;
       $$0193$lcssa$i = $$$0193$i;
       break;
      } else {
       $$01928$i = $$$0192$i;
       $$01937$i = $$$0193$i;
      }
     }
    }
    $155 = HEAP32[99] | 0;
    if ($$0192$lcssa$i >>> 0 < $155 >>> 0) _abort();
    $157 = $$0192$lcssa$i + $6 | 0;
    if ($$0192$lcssa$i >>> 0 >= $157 >>> 0) _abort();
    $160 = HEAP32[$$0192$lcssa$i + 24 >> 2] | 0;
    $162 = HEAP32[$$0192$lcssa$i + 12 >> 2] | 0;
    do if (($162 | 0) == ($$0192$lcssa$i | 0)) {
     $173 = $$0192$lcssa$i + 20 | 0;
     $174 = HEAP32[$173 >> 2] | 0;
     if (!$174) {
      $176 = $$0192$lcssa$i + 16 | 0;
      $177 = HEAP32[$176 >> 2] | 0;
      if (!$177) {
       $$3$i = 0;
       break;
      } else {
       $$1196$i = $177;
       $$1198$i = $176;
      }
     } else {
      $$1196$i = $174;
      $$1198$i = $173;
     }
     while (1) {
      $179 = $$1196$i + 20 | 0;
      $180 = HEAP32[$179 >> 2] | 0;
      if ($180 | 0) {
       $$1196$i = $180;
       $$1198$i = $179;
       continue;
      }
      $182 = $$1196$i + 16 | 0;
      $183 = HEAP32[$182 >> 2] | 0;
      if (!$183) break; else {
       $$1196$i = $183;
       $$1198$i = $182;
      }
     }
     if ($$1198$i >>> 0 < $155 >>> 0) _abort(); else {
      HEAP32[$$1198$i >> 2] = 0;
      $$3$i = $$1196$i;
      break;
     }
    } else {
     $165 = HEAP32[$$0192$lcssa$i + 8 >> 2] | 0;
     if ($165 >>> 0 < $155 >>> 0) _abort();
     $167 = $165 + 12 | 0;
     if ((HEAP32[$167 >> 2] | 0) != ($$0192$lcssa$i | 0)) _abort();
     $170 = $162 + 8 | 0;
     if ((HEAP32[$170 >> 2] | 0) == ($$0192$lcssa$i | 0)) {
      HEAP32[$167 >> 2] = $162;
      HEAP32[$170 >> 2] = $165;
      $$3$i = $162;
      break;
     } else _abort();
    } while (0);
    L73 : do if ($160 | 0) {
     $188 = HEAP32[$$0192$lcssa$i + 28 >> 2] | 0;
     $189 = 684 + ($188 << 2) | 0;
     do if (($$0192$lcssa$i | 0) == (HEAP32[$189 >> 2] | 0)) {
      HEAP32[$189 >> 2] = $$3$i;
      if (!$$3$i) {
       HEAP32[96] = $108 & ~(1 << $188);
       break L73;
      }
     } else if ($160 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
      HEAP32[$160 + 16 + (((HEAP32[$160 + 16 >> 2] | 0) != ($$0192$lcssa$i | 0) & 1) << 2) >> 2] = $$3$i;
      if (!$$3$i) break L73; else break;
     } while (0);
     $201 = HEAP32[99] | 0;
     if ($$3$i >>> 0 < $201 >>> 0) _abort();
     HEAP32[$$3$i + 24 >> 2] = $160;
     $205 = HEAP32[$$0192$lcssa$i + 16 >> 2] | 0;
     do if ($205 | 0) if ($205 >>> 0 < $201 >>> 0) _abort(); else {
      HEAP32[$$3$i + 16 >> 2] = $205;
      HEAP32[$205 + 24 >> 2] = $$3$i;
      break;
     } while (0);
     $211 = HEAP32[$$0192$lcssa$i + 20 >> 2] | 0;
     if ($211 | 0) if ($211 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
      HEAP32[$$3$i + 20 >> 2] = $211;
      HEAP32[$211 + 24 >> 2] = $$3$i;
      break;
     }
    } while (0);
    if ($$0193$lcssa$i >>> 0 < 16) {
     $218 = $$0193$lcssa$i + $6 | 0;
     HEAP32[$$0192$lcssa$i + 4 >> 2] = $218 | 3;
     $222 = $$0192$lcssa$i + $218 + 4 | 0;
     HEAP32[$222 >> 2] = HEAP32[$222 >> 2] | 1;
    } else {
     HEAP32[$$0192$lcssa$i + 4 >> 2] = $6 | 3;
     HEAP32[$157 + 4 >> 2] = $$0193$lcssa$i | 1;
     HEAP32[$157 + $$0193$lcssa$i >> 2] = $$0193$lcssa$i;
     if ($37 | 0) {
      $231 = HEAP32[100] | 0;
      $232 = $37 >>> 3;
      $234 = 420 + ($232 << 1 << 2) | 0;
      $235 = 1 << $232;
      if (!($8 & $235)) {
       HEAP32[95] = $8 | $235;
       $$0189$i = $234;
       $$pre$phi$iZ2D = $234 + 8 | 0;
      } else {
       $239 = $234 + 8 | 0;
       $240 = HEAP32[$239 >> 2] | 0;
       if ($240 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
        $$0189$i = $240;
        $$pre$phi$iZ2D = $239;
       }
      }
      HEAP32[$$pre$phi$iZ2D >> 2] = $231;
      HEAP32[$$0189$i + 12 >> 2] = $231;
      HEAP32[$231 + 8 >> 2] = $$0189$i;
      HEAP32[$231 + 12 >> 2] = $234;
     }
     HEAP32[97] = $$0193$lcssa$i;
     HEAP32[100] = $157;
    }
    $$0 = $$0192$lcssa$i + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   }
  } else $$0197 = $6;
 } else if ($0 >>> 0 > 4294967231) $$0197 = -1; else {
  $248 = $0 + 11 | 0;
  $249 = $248 & -8;
  $250 = HEAP32[96] | 0;
  if (!$250) $$0197 = $249; else {
   $252 = 0 - $249 | 0;
   $253 = $248 >>> 8;
   if (!$253) $$0358$i = 0; else if ($249 >>> 0 > 16777215) $$0358$i = 31; else {
    $258 = ($253 + 1048320 | 0) >>> 16 & 8;
    $259 = $253 << $258;
    $262 = ($259 + 520192 | 0) >>> 16 & 4;
    $264 = $259 << $262;
    $267 = ($264 + 245760 | 0) >>> 16 & 2;
    $272 = 14 - ($262 | $258 | $267) + ($264 << $267 >>> 15) | 0;
    $$0358$i = $249 >>> ($272 + 7 | 0) & 1 | $272 << 1;
   }
   $279 = HEAP32[684 + ($$0358$i << 2) >> 2] | 0;
   L117 : do if (!$279) {
    $$2355$i = 0;
    $$3$i201 = 0;
    $$3350$i = $252;
    label = 81;
   } else {
    $$0342$i = 0;
    $$0347$i = $252;
    $$0353$i = $279;
    $$0359$i = $249 << (($$0358$i | 0) == 31 ? 0 : 25 - ($$0358$i >>> 1) | 0);
    $$0362$i = 0;
    while (1) {
     $289 = (HEAP32[$$0353$i + 4 >> 2] & -8) - $249 | 0;
     if ($289 >>> 0 < $$0347$i >>> 0) if (!$289) {
      $$415$i = $$0353$i;
      $$435114$i = 0;
      $$435713$i = $$0353$i;
      label = 85;
      break L117;
     } else {
      $$1343$i = $$0353$i;
      $$1348$i = $289;
     } else {
      $$1343$i = $$0342$i;
      $$1348$i = $$0347$i;
     }
     $293 = HEAP32[$$0353$i + 20 >> 2] | 0;
     $$0353$i = HEAP32[$$0353$i + 16 + ($$0359$i >>> 31 << 2) >> 2] | 0;
     $$1363$i = ($293 | 0) == 0 | ($293 | 0) == ($$0353$i | 0) ? $$0362$i : $293;
     $299 = ($$0353$i | 0) == 0;
     if ($299) {
      $$2355$i = $$1363$i;
      $$3$i201 = $$1343$i;
      $$3350$i = $$1348$i;
      label = 81;
      break;
     } else {
      $$0342$i = $$1343$i;
      $$0347$i = $$1348$i;
      $$0359$i = $$0359$i << (($299 ^ 1) & 1);
      $$0362$i = $$1363$i;
     }
    }
   } while (0);
   if ((label | 0) == 81) {
    if (($$2355$i | 0) == 0 & ($$3$i201 | 0) == 0) {
     $303 = 2 << $$0358$i;
     $306 = $250 & ($303 | 0 - $303);
     if (!$306) {
      $$0197 = $249;
      break;
     }
     $310 = ($306 & 0 - $306) + -1 | 0;
     $312 = $310 >>> 12 & 16;
     $313 = $310 >>> $312;
     $315 = $313 >>> 5 & 8;
     $317 = $313 >>> $315;
     $319 = $317 >>> 2 & 4;
     $321 = $317 >>> $319;
     $323 = $321 >>> 1 & 2;
     $325 = $321 >>> $323;
     $327 = $325 >>> 1 & 1;
     $$4$ph$i = 0;
     $$4357$ph$i = HEAP32[684 + (($315 | $312 | $319 | $323 | $327) + ($325 >>> $327) << 2) >> 2] | 0;
    } else {
     $$4$ph$i = $$3$i201;
     $$4357$ph$i = $$2355$i;
    }
    if (!$$4357$ph$i) {
     $$4$lcssa$i = $$4$ph$i;
     $$4351$lcssa$i = $$3350$i;
    } else {
     $$415$i = $$4$ph$i;
     $$435114$i = $$3350$i;
     $$435713$i = $$4357$ph$i;
     label = 85;
    }
   }
   if ((label | 0) == 85) while (1) {
    label = 0;
    $337 = (HEAP32[$$435713$i + 4 >> 2] & -8) - $249 | 0;
    $338 = $337 >>> 0 < $$435114$i >>> 0;
    $$$4351$i = $338 ? $337 : $$435114$i;
    $$4357$$4$i = $338 ? $$435713$i : $$415$i;
    $$435713$i = HEAP32[$$435713$i + 16 + (((HEAP32[$$435713$i + 16 >> 2] | 0) == 0 & 1) << 2) >> 2] | 0;
    if (!$$435713$i) {
     $$4$lcssa$i = $$4357$$4$i;
     $$4351$lcssa$i = $$$4351$i;
     break;
    } else {
     $$415$i = $$4357$$4$i;
     $$435114$i = $$$4351$i;
     label = 85;
    }
   }
   if (!$$4$lcssa$i) $$0197 = $249; else if ($$4351$lcssa$i >>> 0 < ((HEAP32[97] | 0) - $249 | 0) >>> 0) {
    $348 = HEAP32[99] | 0;
    if ($$4$lcssa$i >>> 0 < $348 >>> 0) _abort();
    $350 = $$4$lcssa$i + $249 | 0;
    if ($$4$lcssa$i >>> 0 >= $350 >>> 0) _abort();
    $353 = HEAP32[$$4$lcssa$i + 24 >> 2] | 0;
    $355 = HEAP32[$$4$lcssa$i + 12 >> 2] | 0;
    do if (($355 | 0) == ($$4$lcssa$i | 0)) {
     $366 = $$4$lcssa$i + 20 | 0;
     $367 = HEAP32[$366 >> 2] | 0;
     if (!$367) {
      $369 = $$4$lcssa$i + 16 | 0;
      $370 = HEAP32[$369 >> 2] | 0;
      if (!$370) {
       $$3372$i = 0;
       break;
      } else {
       $$1370$i = $370;
       $$1374$i = $369;
      }
     } else {
      $$1370$i = $367;
      $$1374$i = $366;
     }
     while (1) {
      $372 = $$1370$i + 20 | 0;
      $373 = HEAP32[$372 >> 2] | 0;
      if ($373 | 0) {
       $$1370$i = $373;
       $$1374$i = $372;
       continue;
      }
      $375 = $$1370$i + 16 | 0;
      $376 = HEAP32[$375 >> 2] | 0;
      if (!$376) break; else {
       $$1370$i = $376;
       $$1374$i = $375;
      }
     }
     if ($$1374$i >>> 0 < $348 >>> 0) _abort(); else {
      HEAP32[$$1374$i >> 2] = 0;
      $$3372$i = $$1370$i;
      break;
     }
    } else {
     $358 = HEAP32[$$4$lcssa$i + 8 >> 2] | 0;
     if ($358 >>> 0 < $348 >>> 0) _abort();
     $360 = $358 + 12 | 0;
     if ((HEAP32[$360 >> 2] | 0) != ($$4$lcssa$i | 0)) _abort();
     $363 = $355 + 8 | 0;
     if ((HEAP32[$363 >> 2] | 0) == ($$4$lcssa$i | 0)) {
      HEAP32[$360 >> 2] = $355;
      HEAP32[$363 >> 2] = $358;
      $$3372$i = $355;
      break;
     } else _abort();
    } while (0);
    L164 : do if (!$353) $470 = $250; else {
     $381 = HEAP32[$$4$lcssa$i + 28 >> 2] | 0;
     $382 = 684 + ($381 << 2) | 0;
     do if (($$4$lcssa$i | 0) == (HEAP32[$382 >> 2] | 0)) {
      HEAP32[$382 >> 2] = $$3372$i;
      if (!$$3372$i) {
       $387 = $250 & ~(1 << $381);
       HEAP32[96] = $387;
       $470 = $387;
       break L164;
      }
     } else if ($353 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
      HEAP32[$353 + 16 + (((HEAP32[$353 + 16 >> 2] | 0) != ($$4$lcssa$i | 0) & 1) << 2) >> 2] = $$3372$i;
      if (!$$3372$i) {
       $470 = $250;
       break L164;
      } else break;
     } while (0);
     $394 = HEAP32[99] | 0;
     if ($$3372$i >>> 0 < $394 >>> 0) _abort();
     HEAP32[$$3372$i + 24 >> 2] = $353;
     $398 = HEAP32[$$4$lcssa$i + 16 >> 2] | 0;
     do if ($398 | 0) if ($398 >>> 0 < $394 >>> 0) _abort(); else {
      HEAP32[$$3372$i + 16 >> 2] = $398;
      HEAP32[$398 + 24 >> 2] = $$3372$i;
      break;
     } while (0);
     $404 = HEAP32[$$4$lcssa$i + 20 >> 2] | 0;
     if (!$404) $470 = $250; else if ($404 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
      HEAP32[$$3372$i + 20 >> 2] = $404;
      HEAP32[$404 + 24 >> 2] = $$3372$i;
      $470 = $250;
      break;
     }
    } while (0);
    do if ($$4351$lcssa$i >>> 0 < 16) {
     $411 = $$4351$lcssa$i + $249 | 0;
     HEAP32[$$4$lcssa$i + 4 >> 2] = $411 | 3;
     $415 = $$4$lcssa$i + $411 + 4 | 0;
     HEAP32[$415 >> 2] = HEAP32[$415 >> 2] | 1;
    } else {
     HEAP32[$$4$lcssa$i + 4 >> 2] = $249 | 3;
     HEAP32[$350 + 4 >> 2] = $$4351$lcssa$i | 1;
     HEAP32[$350 + $$4351$lcssa$i >> 2] = $$4351$lcssa$i;
     $423 = $$4351$lcssa$i >>> 3;
     if ($$4351$lcssa$i >>> 0 < 256) {
      $426 = 420 + ($423 << 1 << 2) | 0;
      $427 = HEAP32[95] | 0;
      $428 = 1 << $423;
      if (!($427 & $428)) {
       HEAP32[95] = $427 | $428;
       $$0368$i = $426;
       $$pre$phi$i211Z2D = $426 + 8 | 0;
      } else {
       $432 = $426 + 8 | 0;
       $433 = HEAP32[$432 >> 2] | 0;
       if ($433 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
        $$0368$i = $433;
        $$pre$phi$i211Z2D = $432;
       }
      }
      HEAP32[$$pre$phi$i211Z2D >> 2] = $350;
      HEAP32[$$0368$i + 12 >> 2] = $350;
      HEAP32[$350 + 8 >> 2] = $$0368$i;
      HEAP32[$350 + 12 >> 2] = $426;
      break;
     }
     $439 = $$4351$lcssa$i >>> 8;
     if (!$439) $$0361$i = 0; else if ($$4351$lcssa$i >>> 0 > 16777215) $$0361$i = 31; else {
      $444 = ($439 + 1048320 | 0) >>> 16 & 8;
      $445 = $439 << $444;
      $448 = ($445 + 520192 | 0) >>> 16 & 4;
      $450 = $445 << $448;
      $453 = ($450 + 245760 | 0) >>> 16 & 2;
      $458 = 14 - ($448 | $444 | $453) + ($450 << $453 >>> 15) | 0;
      $$0361$i = $$4351$lcssa$i >>> ($458 + 7 | 0) & 1 | $458 << 1;
     }
     $464 = 684 + ($$0361$i << 2) | 0;
     HEAP32[$350 + 28 >> 2] = $$0361$i;
     $466 = $350 + 16 | 0;
     HEAP32[$466 + 4 >> 2] = 0;
     HEAP32[$466 >> 2] = 0;
     $468 = 1 << $$0361$i;
     if (!($470 & $468)) {
      HEAP32[96] = $470 | $468;
      HEAP32[$464 >> 2] = $350;
      HEAP32[$350 + 24 >> 2] = $464;
      HEAP32[$350 + 12 >> 2] = $350;
      HEAP32[$350 + 8 >> 2] = $350;
      break;
     }
     $$0344$i = $$4351$lcssa$i << (($$0361$i | 0) == 31 ? 0 : 25 - ($$0361$i >>> 1) | 0);
     $$0345$i = HEAP32[$464 >> 2] | 0;
     while (1) {
      if ((HEAP32[$$0345$i + 4 >> 2] & -8 | 0) == ($$4351$lcssa$i | 0)) {
       label = 139;
       break;
      }
      $487 = $$0345$i + 16 + ($$0344$i >>> 31 << 2) | 0;
      $489 = HEAP32[$487 >> 2] | 0;
      if (!$489) {
       label = 136;
       break;
      } else {
       $$0344$i = $$0344$i << 1;
       $$0345$i = $489;
      }
     }
     if ((label | 0) == 136) if ($487 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
      HEAP32[$487 >> 2] = $350;
      HEAP32[$350 + 24 >> 2] = $$0345$i;
      HEAP32[$350 + 12 >> 2] = $350;
      HEAP32[$350 + 8 >> 2] = $350;
      break;
     } else if ((label | 0) == 139) {
      $496 = $$0345$i + 8 | 0;
      $497 = HEAP32[$496 >> 2] | 0;
      $498 = HEAP32[99] | 0;
      if ($497 >>> 0 >= $498 >>> 0 & $$0345$i >>> 0 >= $498 >>> 0) {
       HEAP32[$497 + 12 >> 2] = $350;
       HEAP32[$496 >> 2] = $350;
       HEAP32[$350 + 8 >> 2] = $497;
       HEAP32[$350 + 12 >> 2] = $$0345$i;
       HEAP32[$350 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $$4$lcssa$i + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   } else $$0197 = $249;
  }
 } while (0);
 $506 = HEAP32[97] | 0;
 if ($506 >>> 0 >= $$0197 >>> 0) {
  $508 = $506 - $$0197 | 0;
  $509 = HEAP32[100] | 0;
  if ($508 >>> 0 > 15) {
   $511 = $509 + $$0197 | 0;
   HEAP32[100] = $511;
   HEAP32[97] = $508;
   HEAP32[$511 + 4 >> 2] = $508 | 1;
   HEAP32[$511 + $508 >> 2] = $508;
   HEAP32[$509 + 4 >> 2] = $$0197 | 3;
  } else {
   HEAP32[97] = 0;
   HEAP32[100] = 0;
   HEAP32[$509 + 4 >> 2] = $506 | 3;
   $520 = $509 + $506 + 4 | 0;
   HEAP32[$520 >> 2] = HEAP32[$520 >> 2] | 1;
  }
  $$0 = $509 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $524 = HEAP32[98] | 0;
 if ($524 >>> 0 > $$0197 >>> 0) {
  $526 = $524 - $$0197 | 0;
  HEAP32[98] = $526;
  $527 = HEAP32[101] | 0;
  $528 = $527 + $$0197 | 0;
  HEAP32[101] = $528;
  HEAP32[$528 + 4 >> 2] = $526 | 1;
  HEAP32[$527 + 4 >> 2] = $$0197 | 3;
  $$0 = $527 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 if (!(HEAP32[213] | 0)) {
  HEAP32[215] = 4096;
  HEAP32[214] = 4096;
  HEAP32[216] = -1;
  HEAP32[217] = -1;
  HEAP32[218] = 0;
  HEAP32[206] = 0;
  $538 = $1 & -16 ^ 1431655768;
  HEAP32[$1 >> 2] = $538;
  HEAP32[213] = $538;
  $542 = 4096;
 } else $542 = HEAP32[215] | 0;
 $539 = $$0197 + 48 | 0;
 $540 = $$0197 + 47 | 0;
 $541 = $542 + $540 | 0;
 $543 = 0 - $542 | 0;
 $544 = $541 & $543;
 if ($544 >>> 0 <= $$0197 >>> 0) {
  $$0 = 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $546 = HEAP32[205] | 0;
 if ($546 | 0) {
  $548 = HEAP32[203] | 0;
  $549 = $548 + $544 | 0;
  if ($549 >>> 0 <= $548 >>> 0 | $549 >>> 0 > $546 >>> 0) {
   $$0 = 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 L244 : do if (!(HEAP32[206] & 4)) {
  $555 = HEAP32[101] | 0;
  L246 : do if (!$555) label = 163; else {
   $$0$i$i = 828;
   while (1) {
    $557 = HEAP32[$$0$i$i >> 2] | 0;
    if ($557 >>> 0 <= $555 >>> 0) {
     $559 = $$0$i$i + 4 | 0;
     if (($557 + (HEAP32[$559 >> 2] | 0) | 0) >>> 0 > $555 >>> 0) break;
    }
    $564 = HEAP32[$$0$i$i + 8 >> 2] | 0;
    if (!$564) {
     label = 163;
     break L246;
    } else $$0$i$i = $564;
   }
   $589 = $541 - $524 & $543;
   if ($589 >>> 0 < 2147483647) {
    $591 = _sbrk($589 | 0) | 0;
    if (($591 | 0) == ((HEAP32[$$0$i$i >> 2] | 0) + (HEAP32[$559 >> 2] | 0) | 0)) if (($591 | 0) == (-1 | 0)) $$2234253237$i = $589; else {
     $$723948$i = $589;
     $$749$i = $591;
     label = 180;
     break L244;
    } else {
     $$2247$ph$i = $591;
     $$2253$ph$i = $589;
     label = 171;
    }
   } else $$2234253237$i = 0;
  } while (0);
  do if ((label | 0) == 163) {
   $566 = _sbrk(0) | 0;
   if (($566 | 0) == (-1 | 0)) $$2234253237$i = 0; else {
    $568 = $566;
    $569 = HEAP32[214] | 0;
    $570 = $569 + -1 | 0;
    $$$i = (($570 & $568 | 0) == 0 ? 0 : ($570 + $568 & 0 - $569) - $568 | 0) + $544 | 0;
    $578 = HEAP32[203] | 0;
    $579 = $$$i + $578 | 0;
    if ($$$i >>> 0 > $$0197 >>> 0 & $$$i >>> 0 < 2147483647) {
     $582 = HEAP32[205] | 0;
     if ($582 | 0) if ($579 >>> 0 <= $578 >>> 0 | $579 >>> 0 > $582 >>> 0) {
      $$2234253237$i = 0;
      break;
     }
     $586 = _sbrk($$$i | 0) | 0;
     if (($586 | 0) == ($566 | 0)) {
      $$723948$i = $$$i;
      $$749$i = $566;
      label = 180;
      break L244;
     } else {
      $$2247$ph$i = $586;
      $$2253$ph$i = $$$i;
      label = 171;
     }
    } else $$2234253237$i = 0;
   }
  } while (0);
  do if ((label | 0) == 171) {
   $597 = 0 - $$2253$ph$i | 0;
   if (!($539 >>> 0 > $$2253$ph$i >>> 0 & ($$2253$ph$i >>> 0 < 2147483647 & ($$2247$ph$i | 0) != (-1 | 0)))) if (($$2247$ph$i | 0) == (-1 | 0)) {
    $$2234253237$i = 0;
    break;
   } else {
    $$723948$i = $$2253$ph$i;
    $$749$i = $$2247$ph$i;
    label = 180;
    break L244;
   }
   $601 = HEAP32[215] | 0;
   $605 = $540 - $$2253$ph$i + $601 & 0 - $601;
   if ($605 >>> 0 >= 2147483647) {
    $$723948$i = $$2253$ph$i;
    $$749$i = $$2247$ph$i;
    label = 180;
    break L244;
   }
   if ((_sbrk($605 | 0) | 0) == (-1 | 0)) {
    _sbrk($597 | 0) | 0;
    $$2234253237$i = 0;
    break;
   } else {
    $$723948$i = $605 + $$2253$ph$i | 0;
    $$749$i = $$2247$ph$i;
    label = 180;
    break L244;
   }
  } while (0);
  HEAP32[206] = HEAP32[206] | 4;
  $$4236$i = $$2234253237$i;
  label = 178;
 } else {
  $$4236$i = 0;
  label = 178;
 } while (0);
 if ((label | 0) == 178) if ($544 >>> 0 < 2147483647) {
  $614 = _sbrk($544 | 0) | 0;
  $615 = _sbrk(0) | 0;
  $621 = $615 - $614 | 0;
  $623 = $621 >>> 0 > ($$0197 + 40 | 0) >>> 0;
  if (!(($614 | 0) == (-1 | 0) | $623 ^ 1 | $614 >>> 0 < $615 >>> 0 & (($614 | 0) != (-1 | 0) & ($615 | 0) != (-1 | 0)) ^ 1)) {
   $$723948$i = $623 ? $621 : $$4236$i;
   $$749$i = $614;
   label = 180;
  }
 }
 if ((label | 0) == 180) {
  $627 = (HEAP32[203] | 0) + $$723948$i | 0;
  HEAP32[203] = $627;
  if ($627 >>> 0 > (HEAP32[204] | 0) >>> 0) HEAP32[204] = $627;
  $630 = HEAP32[101] | 0;
  do if (!$630) {
   $632 = HEAP32[99] | 0;
   if (($632 | 0) == 0 | $$749$i >>> 0 < $632 >>> 0) HEAP32[99] = $$749$i;
   HEAP32[207] = $$749$i;
   HEAP32[208] = $$723948$i;
   HEAP32[210] = 0;
   HEAP32[104] = HEAP32[213];
   HEAP32[103] = -1;
   $$01$i$i = 0;
   do {
    $637 = 420 + ($$01$i$i << 1 << 2) | 0;
    HEAP32[$637 + 12 >> 2] = $637;
    HEAP32[$637 + 8 >> 2] = $637;
    $$01$i$i = $$01$i$i + 1 | 0;
   } while (($$01$i$i | 0) != 32);
   $643 = $$749$i + 8 | 0;
   $648 = ($643 & 7 | 0) == 0 ? 0 : 0 - $643 & 7;
   $649 = $$749$i + $648 | 0;
   $650 = $$723948$i + -40 - $648 | 0;
   HEAP32[101] = $649;
   HEAP32[98] = $650;
   HEAP32[$649 + 4 >> 2] = $650 | 1;
   HEAP32[$649 + $650 + 4 >> 2] = 40;
   HEAP32[102] = HEAP32[217];
  } else {
   $$024371$i = 828;
   while (1) {
    $656 = HEAP32[$$024371$i >> 2] | 0;
    $657 = $$024371$i + 4 | 0;
    $658 = HEAP32[$657 >> 2] | 0;
    if (($$749$i | 0) == ($656 + $658 | 0)) {
     label = 190;
     break;
    }
    $662 = HEAP32[$$024371$i + 8 >> 2] | 0;
    if (!$662) break; else $$024371$i = $662;
   }
   if ((label | 0) == 190) if (!(HEAP32[$$024371$i + 12 >> 2] & 8)) if ($630 >>> 0 < $$749$i >>> 0 & $630 >>> 0 >= $656 >>> 0) {
    HEAP32[$657 >> 2] = $658 + $$723948$i;
    $673 = $630 + 8 | 0;
    $678 = ($673 & 7 | 0) == 0 ? 0 : 0 - $673 & 7;
    $679 = $630 + $678 | 0;
    $681 = (HEAP32[98] | 0) + ($$723948$i - $678) | 0;
    HEAP32[101] = $679;
    HEAP32[98] = $681;
    HEAP32[$679 + 4 >> 2] = $681 | 1;
    HEAP32[$679 + $681 + 4 >> 2] = 40;
    HEAP32[102] = HEAP32[217];
    break;
   }
   $687 = HEAP32[99] | 0;
   if ($$749$i >>> 0 < $687 >>> 0) {
    HEAP32[99] = $$749$i;
    $752 = $$749$i;
   } else $752 = $687;
   $689 = $$749$i + $$723948$i | 0;
   $$124470$i = 828;
   while (1) {
    if ((HEAP32[$$124470$i >> 2] | 0) == ($689 | 0)) {
     label = 198;
     break;
    }
    $693 = HEAP32[$$124470$i + 8 >> 2] | 0;
    if (!$693) break; else $$124470$i = $693;
   }
   if ((label | 0) == 198) if (!(HEAP32[$$124470$i + 12 >> 2] & 8)) {
    HEAP32[$$124470$i >> 2] = $$749$i;
    $699 = $$124470$i + 4 | 0;
    HEAP32[$699 >> 2] = (HEAP32[$699 >> 2] | 0) + $$723948$i;
    $703 = $$749$i + 8 | 0;
    $709 = $$749$i + (($703 & 7 | 0) == 0 ? 0 : 0 - $703 & 7) | 0;
    $711 = $689 + 8 | 0;
    $717 = $689 + (($711 & 7 | 0) == 0 ? 0 : 0 - $711 & 7) | 0;
    $721 = $709 + $$0197 | 0;
    $722 = $717 - $709 - $$0197 | 0;
    HEAP32[$709 + 4 >> 2] = $$0197 | 3;
    do if (($717 | 0) == ($630 | 0)) {
     $727 = (HEAP32[98] | 0) + $722 | 0;
     HEAP32[98] = $727;
     HEAP32[101] = $721;
     HEAP32[$721 + 4 >> 2] = $727 | 1;
    } else {
     if (($717 | 0) == (HEAP32[100] | 0)) {
      $733 = (HEAP32[97] | 0) + $722 | 0;
      HEAP32[97] = $733;
      HEAP32[100] = $721;
      HEAP32[$721 + 4 >> 2] = $733 | 1;
      HEAP32[$721 + $733 >> 2] = $733;
      break;
     }
     $738 = HEAP32[$717 + 4 >> 2] | 0;
     if (($738 & 3 | 0) == 1) {
      $741 = $738 & -8;
      $742 = $738 >>> 3;
      L314 : do if ($738 >>> 0 < 256) {
       $745 = HEAP32[$717 + 8 >> 2] | 0;
       $747 = HEAP32[$717 + 12 >> 2] | 0;
       $749 = 420 + ($742 << 1 << 2) | 0;
       do if (($745 | 0) != ($749 | 0)) {
        if ($745 >>> 0 < $752 >>> 0) _abort();
        if ((HEAP32[$745 + 12 >> 2] | 0) == ($717 | 0)) break;
        _abort();
       } while (0);
       if (($747 | 0) == ($745 | 0)) {
        HEAP32[95] = HEAP32[95] & ~(1 << $742);
        break;
       }
       do if (($747 | 0) == ($749 | 0)) $$pre$phi11$i$iZ2D = $747 + 8 | 0; else {
        if ($747 >>> 0 < $752 >>> 0) _abort();
        $763 = $747 + 8 | 0;
        if ((HEAP32[$763 >> 2] | 0) == ($717 | 0)) {
         $$pre$phi11$i$iZ2D = $763;
         break;
        }
        _abort();
       } while (0);
       HEAP32[$745 + 12 >> 2] = $747;
       HEAP32[$$pre$phi11$i$iZ2D >> 2] = $745;
      } else {
       $768 = HEAP32[$717 + 24 >> 2] | 0;
       $770 = HEAP32[$717 + 12 >> 2] | 0;
       do if (($770 | 0) == ($717 | 0)) {
        $781 = $717 + 16 | 0;
        $782 = $781 + 4 | 0;
        $783 = HEAP32[$782 >> 2] | 0;
        if (!$783) {
         $785 = HEAP32[$781 >> 2] | 0;
         if (!$785) {
          $$3$i$i = 0;
          break;
         } else {
          $$1291$i$i = $785;
          $$1293$i$i = $781;
         }
        } else {
         $$1291$i$i = $783;
         $$1293$i$i = $782;
        }
        while (1) {
         $787 = $$1291$i$i + 20 | 0;
         $788 = HEAP32[$787 >> 2] | 0;
         if ($788 | 0) {
          $$1291$i$i = $788;
          $$1293$i$i = $787;
          continue;
         }
         $790 = $$1291$i$i + 16 | 0;
         $791 = HEAP32[$790 >> 2] | 0;
         if (!$791) break; else {
          $$1291$i$i = $791;
          $$1293$i$i = $790;
         }
        }
        if ($$1293$i$i >>> 0 < $752 >>> 0) _abort(); else {
         HEAP32[$$1293$i$i >> 2] = 0;
         $$3$i$i = $$1291$i$i;
         break;
        }
       } else {
        $773 = HEAP32[$717 + 8 >> 2] | 0;
        if ($773 >>> 0 < $752 >>> 0) _abort();
        $775 = $773 + 12 | 0;
        if ((HEAP32[$775 >> 2] | 0) != ($717 | 0)) _abort();
        $778 = $770 + 8 | 0;
        if ((HEAP32[$778 >> 2] | 0) == ($717 | 0)) {
         HEAP32[$775 >> 2] = $770;
         HEAP32[$778 >> 2] = $773;
         $$3$i$i = $770;
         break;
        } else _abort();
       } while (0);
       if (!$768) break;
       $796 = HEAP32[$717 + 28 >> 2] | 0;
       $797 = 684 + ($796 << 2) | 0;
       do if (($717 | 0) == (HEAP32[$797 >> 2] | 0)) {
        HEAP32[$797 >> 2] = $$3$i$i;
        if ($$3$i$i | 0) break;
        HEAP32[96] = HEAP32[96] & ~(1 << $796);
        break L314;
       } else if ($768 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
        HEAP32[$768 + 16 + (((HEAP32[$768 + 16 >> 2] | 0) != ($717 | 0) & 1) << 2) >> 2] = $$3$i$i;
        if (!$$3$i$i) break L314; else break;
       } while (0);
       $810 = HEAP32[99] | 0;
       if ($$3$i$i >>> 0 < $810 >>> 0) _abort();
       HEAP32[$$3$i$i + 24 >> 2] = $768;
       $813 = $717 + 16 | 0;
       $814 = HEAP32[$813 >> 2] | 0;
       do if ($814 | 0) if ($814 >>> 0 < $810 >>> 0) _abort(); else {
        HEAP32[$$3$i$i + 16 >> 2] = $814;
        HEAP32[$814 + 24 >> 2] = $$3$i$i;
        break;
       } while (0);
       $820 = HEAP32[$813 + 4 >> 2] | 0;
       if (!$820) break;
       if ($820 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
        HEAP32[$$3$i$i + 20 >> 2] = $820;
        HEAP32[$820 + 24 >> 2] = $$3$i$i;
        break;
       }
      } while (0);
      $$0$i18$i = $717 + $741 | 0;
      $$0287$i$i = $741 + $722 | 0;
     } else {
      $$0$i18$i = $717;
      $$0287$i$i = $722;
     }
     $828 = $$0$i18$i + 4 | 0;
     HEAP32[$828 >> 2] = HEAP32[$828 >> 2] & -2;
     HEAP32[$721 + 4 >> 2] = $$0287$i$i | 1;
     HEAP32[$721 + $$0287$i$i >> 2] = $$0287$i$i;
     $834 = $$0287$i$i >>> 3;
     if ($$0287$i$i >>> 0 < 256) {
      $837 = 420 + ($834 << 1 << 2) | 0;
      $838 = HEAP32[95] | 0;
      $839 = 1 << $834;
      do if (!($838 & $839)) {
       HEAP32[95] = $838 | $839;
       $$0295$i$i = $837;
       $$pre$phi$i20$iZ2D = $837 + 8 | 0;
      } else {
       $843 = $837 + 8 | 0;
       $844 = HEAP32[$843 >> 2] | 0;
       if ($844 >>> 0 >= (HEAP32[99] | 0) >>> 0) {
        $$0295$i$i = $844;
        $$pre$phi$i20$iZ2D = $843;
        break;
       }
       _abort();
      } while (0);
      HEAP32[$$pre$phi$i20$iZ2D >> 2] = $721;
      HEAP32[$$0295$i$i + 12 >> 2] = $721;
      HEAP32[$721 + 8 >> 2] = $$0295$i$i;
      HEAP32[$721 + 12 >> 2] = $837;
      break;
     }
     $850 = $$0287$i$i >>> 8;
     do if (!$850) $$0296$i$i = 0; else {
      if ($$0287$i$i >>> 0 > 16777215) {
       $$0296$i$i = 31;
       break;
      }
      $855 = ($850 + 1048320 | 0) >>> 16 & 8;
      $856 = $850 << $855;
      $859 = ($856 + 520192 | 0) >>> 16 & 4;
      $861 = $856 << $859;
      $864 = ($861 + 245760 | 0) >>> 16 & 2;
      $869 = 14 - ($859 | $855 | $864) + ($861 << $864 >>> 15) | 0;
      $$0296$i$i = $$0287$i$i >>> ($869 + 7 | 0) & 1 | $869 << 1;
     } while (0);
     $875 = 684 + ($$0296$i$i << 2) | 0;
     HEAP32[$721 + 28 >> 2] = $$0296$i$i;
     $877 = $721 + 16 | 0;
     HEAP32[$877 + 4 >> 2] = 0;
     HEAP32[$877 >> 2] = 0;
     $879 = HEAP32[96] | 0;
     $880 = 1 << $$0296$i$i;
     if (!($879 & $880)) {
      HEAP32[96] = $879 | $880;
      HEAP32[$875 >> 2] = $721;
      HEAP32[$721 + 24 >> 2] = $875;
      HEAP32[$721 + 12 >> 2] = $721;
      HEAP32[$721 + 8 >> 2] = $721;
      break;
     }
     $$0288$i$i = $$0287$i$i << (($$0296$i$i | 0) == 31 ? 0 : 25 - ($$0296$i$i >>> 1) | 0);
     $$0289$i$i = HEAP32[$875 >> 2] | 0;
     while (1) {
      if ((HEAP32[$$0289$i$i + 4 >> 2] & -8 | 0) == ($$0287$i$i | 0)) {
       label = 265;
       break;
      }
      $898 = $$0289$i$i + 16 + ($$0288$i$i >>> 31 << 2) | 0;
      $900 = HEAP32[$898 >> 2] | 0;
      if (!$900) {
       label = 262;
       break;
      } else {
       $$0288$i$i = $$0288$i$i << 1;
       $$0289$i$i = $900;
      }
     }
     if ((label | 0) == 262) if ($898 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
      HEAP32[$898 >> 2] = $721;
      HEAP32[$721 + 24 >> 2] = $$0289$i$i;
      HEAP32[$721 + 12 >> 2] = $721;
      HEAP32[$721 + 8 >> 2] = $721;
      break;
     } else if ((label | 0) == 265) {
      $907 = $$0289$i$i + 8 | 0;
      $908 = HEAP32[$907 >> 2] | 0;
      $909 = HEAP32[99] | 0;
      if ($908 >>> 0 >= $909 >>> 0 & $$0289$i$i >>> 0 >= $909 >>> 0) {
       HEAP32[$908 + 12 >> 2] = $721;
       HEAP32[$907 >> 2] = $721;
       HEAP32[$721 + 8 >> 2] = $908;
       HEAP32[$721 + 12 >> 2] = $$0289$i$i;
       HEAP32[$721 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $709 + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   }
   $$0$i$i$i = 828;
   while (1) {
    $916 = HEAP32[$$0$i$i$i >> 2] | 0;
    if ($916 >>> 0 <= $630 >>> 0) {
     $920 = $916 + (HEAP32[$$0$i$i$i + 4 >> 2] | 0) | 0;
     if ($920 >>> 0 > $630 >>> 0) break;
    }
    $$0$i$i$i = HEAP32[$$0$i$i$i + 8 >> 2] | 0;
   }
   $924 = $920 + -47 | 0;
   $926 = $924 + 8 | 0;
   $932 = $924 + (($926 & 7 | 0) == 0 ? 0 : 0 - $926 & 7) | 0;
   $933 = $630 + 16 | 0;
   $935 = $932 >>> 0 < $933 >>> 0 ? $630 : $932;
   $936 = $935 + 8 | 0;
   $940 = $$749$i + 8 | 0;
   $945 = ($940 & 7 | 0) == 0 ? 0 : 0 - $940 & 7;
   $946 = $$749$i + $945 | 0;
   $947 = $$723948$i + -40 - $945 | 0;
   HEAP32[101] = $946;
   HEAP32[98] = $947;
   HEAP32[$946 + 4 >> 2] = $947 | 1;
   HEAP32[$946 + $947 + 4 >> 2] = 40;
   HEAP32[102] = HEAP32[217];
   $953 = $935 + 4 | 0;
   HEAP32[$953 >> 2] = 27;
   HEAP32[$936 >> 2] = HEAP32[207];
   HEAP32[$936 + 4 >> 2] = HEAP32[208];
   HEAP32[$936 + 8 >> 2] = HEAP32[209];
   HEAP32[$936 + 12 >> 2] = HEAP32[210];
   HEAP32[207] = $$749$i;
   HEAP32[208] = $$723948$i;
   HEAP32[210] = 0;
   HEAP32[209] = $936;
   $955 = $935 + 24 | 0;
   do {
    $955$looptemp = $955;
    $955 = $955 + 4 | 0;
    HEAP32[$955 >> 2] = 7;
   } while (($955$looptemp + 8 | 0) >>> 0 < $920 >>> 0);
   if (($935 | 0) != ($630 | 0)) {
    $961 = $935 - $630 | 0;
    HEAP32[$953 >> 2] = HEAP32[$953 >> 2] & -2;
    HEAP32[$630 + 4 >> 2] = $961 | 1;
    HEAP32[$935 >> 2] = $961;
    $966 = $961 >>> 3;
    if ($961 >>> 0 < 256) {
     $969 = 420 + ($966 << 1 << 2) | 0;
     $970 = HEAP32[95] | 0;
     $971 = 1 << $966;
     if (!($970 & $971)) {
      HEAP32[95] = $970 | $971;
      $$0211$i$i = $969;
      $$pre$phi$i$iZ2D = $969 + 8 | 0;
     } else {
      $975 = $969 + 8 | 0;
      $976 = HEAP32[$975 >> 2] | 0;
      if ($976 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
       $$0211$i$i = $976;
       $$pre$phi$i$iZ2D = $975;
      }
     }
     HEAP32[$$pre$phi$i$iZ2D >> 2] = $630;
     HEAP32[$$0211$i$i + 12 >> 2] = $630;
     HEAP32[$630 + 8 >> 2] = $$0211$i$i;
     HEAP32[$630 + 12 >> 2] = $969;
     break;
    }
    $982 = $961 >>> 8;
    if (!$982) $$0212$i$i = 0; else if ($961 >>> 0 > 16777215) $$0212$i$i = 31; else {
     $987 = ($982 + 1048320 | 0) >>> 16 & 8;
     $988 = $982 << $987;
     $991 = ($988 + 520192 | 0) >>> 16 & 4;
     $993 = $988 << $991;
     $996 = ($993 + 245760 | 0) >>> 16 & 2;
     $1001 = 14 - ($991 | $987 | $996) + ($993 << $996 >>> 15) | 0;
     $$0212$i$i = $961 >>> ($1001 + 7 | 0) & 1 | $1001 << 1;
    }
    $1007 = 684 + ($$0212$i$i << 2) | 0;
    HEAP32[$630 + 28 >> 2] = $$0212$i$i;
    HEAP32[$630 + 20 >> 2] = 0;
    HEAP32[$933 >> 2] = 0;
    $1010 = HEAP32[96] | 0;
    $1011 = 1 << $$0212$i$i;
    if (!($1010 & $1011)) {
     HEAP32[96] = $1010 | $1011;
     HEAP32[$1007 >> 2] = $630;
     HEAP32[$630 + 24 >> 2] = $1007;
     HEAP32[$630 + 12 >> 2] = $630;
     HEAP32[$630 + 8 >> 2] = $630;
     break;
    }
    $$0206$i$i = $961 << (($$0212$i$i | 0) == 31 ? 0 : 25 - ($$0212$i$i >>> 1) | 0);
    $$0207$i$i = HEAP32[$1007 >> 2] | 0;
    while (1) {
     if ((HEAP32[$$0207$i$i + 4 >> 2] & -8 | 0) == ($961 | 0)) {
      label = 292;
      break;
     }
     $1029 = $$0207$i$i + 16 + ($$0206$i$i >>> 31 << 2) | 0;
     $1031 = HEAP32[$1029 >> 2] | 0;
     if (!$1031) {
      label = 289;
      break;
     } else {
      $$0206$i$i = $$0206$i$i << 1;
      $$0207$i$i = $1031;
     }
    }
    if ((label | 0) == 289) if ($1029 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
     HEAP32[$1029 >> 2] = $630;
     HEAP32[$630 + 24 >> 2] = $$0207$i$i;
     HEAP32[$630 + 12 >> 2] = $630;
     HEAP32[$630 + 8 >> 2] = $630;
     break;
    } else if ((label | 0) == 292) {
     $1038 = $$0207$i$i + 8 | 0;
     $1039 = HEAP32[$1038 >> 2] | 0;
     $1040 = HEAP32[99] | 0;
     if ($1039 >>> 0 >= $1040 >>> 0 & $$0207$i$i >>> 0 >= $1040 >>> 0) {
      HEAP32[$1039 + 12 >> 2] = $630;
      HEAP32[$1038 >> 2] = $630;
      HEAP32[$630 + 8 >> 2] = $1039;
      HEAP32[$630 + 12 >> 2] = $$0207$i$i;
      HEAP32[$630 + 24 >> 2] = 0;
      break;
     } else _abort();
    }
   }
  } while (0);
  $1048 = HEAP32[98] | 0;
  if ($1048 >>> 0 > $$0197 >>> 0) {
   $1050 = $1048 - $$0197 | 0;
   HEAP32[98] = $1050;
   $1051 = HEAP32[101] | 0;
   $1052 = $1051 + $$0197 | 0;
   HEAP32[101] = $1052;
   HEAP32[$1052 + 4 >> 2] = $1050 | 1;
   HEAP32[$1051 + 4 >> 2] = $$0197 | 3;
   $$0 = $1051 + 8 | 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 HEAP32[(___errno_location() | 0) >> 2] = 12;
 $$0 = 0;
 STACKTOP = sp;
 return $$0 | 0;
}

function _free($0) {
 $0 = $0 | 0;
 var $$0212$i = 0, $$0212$in$i = 0, $$0383 = 0, $$0384 = 0, $$0396 = 0, $$0403 = 0, $$1 = 0, $$1382 = 0, $$1387 = 0, $$1390 = 0, $$1398 = 0, $$1402 = 0, $$2 = 0, $$3 = 0, $$3400 = 0, $$pre$phi443Z2D = 0, $$pre$phi445Z2D = 0, $$pre$phiZ2D = 0, $10 = 0, $104 = 0, $105 = 0, $112 = 0, $114 = 0, $115 = 0, $122 = 0, $124 = 0, $13 = 0, $130 = 0, $135 = 0, $136 = 0, $139 = 0, $141 = 0, $143 = 0, $158 = 0, $16 = 0, $163 = 0, $165 = 0, $168 = 0, $17 = 0, $171 = 0, $174 = 0, $177 = 0, $178 = 0, $179 = 0, $181 = 0, $183 = 0, $184 = 0, $186 = 0, $187 = 0, $193 = 0, $194 = 0, $2 = 0, $207 = 0, $21 = 0, $210 = 0, $211 = 0, $217 = 0, $232 = 0, $235 = 0, $236 = 0, $237 = 0, $24 = 0, $241 = 0, $242 = 0, $248 = 0, $253 = 0, $254 = 0, $257 = 0, $259 = 0, $26 = 0, $262 = 0, $267 = 0, $273 = 0, $277 = 0, $278 = 0, $28 = 0, $296 = 0, $298 = 0, $3 = 0, $305 = 0, $306 = 0, $307 = 0, $315 = 0, $41 = 0, $46 = 0, $48 = 0, $51 = 0, $53 = 0, $56 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $63 = 0, $65 = 0, $66 = 0, $68 = 0, $69 = 0, $7 = 0, $74 = 0, $75 = 0, $88 = 0, $9 = 0, $91 = 0, $92 = 0, $98 = 0, label = 0;
 if (!$0) return;
 $2 = $0 + -8 | 0;
 $3 = HEAP32[99] | 0;
 if ($2 >>> 0 < $3 >>> 0) _abort();
 $6 = HEAP32[$0 + -4 >> 2] | 0;
 $7 = $6 & 3;
 if (($7 | 0) == 1) _abort();
 $9 = $6 & -8;
 $10 = $2 + $9 | 0;
 L10 : do if (!($6 & 1)) {
  $13 = HEAP32[$2 >> 2] | 0;
  if (!$7) return;
  $16 = $2 + (0 - $13) | 0;
  $17 = $13 + $9 | 0;
  if ($16 >>> 0 < $3 >>> 0) _abort();
  if (($16 | 0) == (HEAP32[100] | 0)) {
   $104 = $10 + 4 | 0;
   $105 = HEAP32[$104 >> 2] | 0;
   if (($105 & 3 | 0) != 3) {
    $$1 = $16;
    $$1382 = $17;
    $112 = $16;
    break;
   }
   HEAP32[97] = $17;
   HEAP32[$104 >> 2] = $105 & -2;
   HEAP32[$16 + 4 >> 2] = $17 | 1;
   HEAP32[$16 + $17 >> 2] = $17;
   return;
  }
  $21 = $13 >>> 3;
  if ($13 >>> 0 < 256) {
   $24 = HEAP32[$16 + 8 >> 2] | 0;
   $26 = HEAP32[$16 + 12 >> 2] | 0;
   $28 = 420 + ($21 << 1 << 2) | 0;
   if (($24 | 0) != ($28 | 0)) {
    if ($24 >>> 0 < $3 >>> 0) _abort();
    if ((HEAP32[$24 + 12 >> 2] | 0) != ($16 | 0)) _abort();
   }
   if (($26 | 0) == ($24 | 0)) {
    HEAP32[95] = HEAP32[95] & ~(1 << $21);
    $$1 = $16;
    $$1382 = $17;
    $112 = $16;
    break;
   }
   if (($26 | 0) == ($28 | 0)) $$pre$phi445Z2D = $26 + 8 | 0; else {
    if ($26 >>> 0 < $3 >>> 0) _abort();
    $41 = $26 + 8 | 0;
    if ((HEAP32[$41 >> 2] | 0) == ($16 | 0)) $$pre$phi445Z2D = $41; else _abort();
   }
   HEAP32[$24 + 12 >> 2] = $26;
   HEAP32[$$pre$phi445Z2D >> 2] = $24;
   $$1 = $16;
   $$1382 = $17;
   $112 = $16;
   break;
  }
  $46 = HEAP32[$16 + 24 >> 2] | 0;
  $48 = HEAP32[$16 + 12 >> 2] | 0;
  do if (($48 | 0) == ($16 | 0)) {
   $59 = $16 + 16 | 0;
   $60 = $59 + 4 | 0;
   $61 = HEAP32[$60 >> 2] | 0;
   if (!$61) {
    $63 = HEAP32[$59 >> 2] | 0;
    if (!$63) {
     $$3 = 0;
     break;
    } else {
     $$1387 = $63;
     $$1390 = $59;
    }
   } else {
    $$1387 = $61;
    $$1390 = $60;
   }
   while (1) {
    $65 = $$1387 + 20 | 0;
    $66 = HEAP32[$65 >> 2] | 0;
    if ($66 | 0) {
     $$1387 = $66;
     $$1390 = $65;
     continue;
    }
    $68 = $$1387 + 16 | 0;
    $69 = HEAP32[$68 >> 2] | 0;
    if (!$69) break; else {
     $$1387 = $69;
     $$1390 = $68;
    }
   }
   if ($$1390 >>> 0 < $3 >>> 0) _abort(); else {
    HEAP32[$$1390 >> 2] = 0;
    $$3 = $$1387;
    break;
   }
  } else {
   $51 = HEAP32[$16 + 8 >> 2] | 0;
   if ($51 >>> 0 < $3 >>> 0) _abort();
   $53 = $51 + 12 | 0;
   if ((HEAP32[$53 >> 2] | 0) != ($16 | 0)) _abort();
   $56 = $48 + 8 | 0;
   if ((HEAP32[$56 >> 2] | 0) == ($16 | 0)) {
    HEAP32[$53 >> 2] = $48;
    HEAP32[$56 >> 2] = $51;
    $$3 = $48;
    break;
   } else _abort();
  } while (0);
  if (!$46) {
   $$1 = $16;
   $$1382 = $17;
   $112 = $16;
  } else {
   $74 = HEAP32[$16 + 28 >> 2] | 0;
   $75 = 684 + ($74 << 2) | 0;
   do if (($16 | 0) == (HEAP32[$75 >> 2] | 0)) {
    HEAP32[$75 >> 2] = $$3;
    if (!$$3) {
     HEAP32[96] = HEAP32[96] & ~(1 << $74);
     $$1 = $16;
     $$1382 = $17;
     $112 = $16;
     break L10;
    }
   } else if ($46 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
    HEAP32[$46 + 16 + (((HEAP32[$46 + 16 >> 2] | 0) != ($16 | 0) & 1) << 2) >> 2] = $$3;
    if (!$$3) {
     $$1 = $16;
     $$1382 = $17;
     $112 = $16;
     break L10;
    } else break;
   } while (0);
   $88 = HEAP32[99] | 0;
   if ($$3 >>> 0 < $88 >>> 0) _abort();
   HEAP32[$$3 + 24 >> 2] = $46;
   $91 = $16 + 16 | 0;
   $92 = HEAP32[$91 >> 2] | 0;
   do if ($92 | 0) if ($92 >>> 0 < $88 >>> 0) _abort(); else {
    HEAP32[$$3 + 16 >> 2] = $92;
    HEAP32[$92 + 24 >> 2] = $$3;
    break;
   } while (0);
   $98 = HEAP32[$91 + 4 >> 2] | 0;
   if (!$98) {
    $$1 = $16;
    $$1382 = $17;
    $112 = $16;
   } else if ($98 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
    HEAP32[$$3 + 20 >> 2] = $98;
    HEAP32[$98 + 24 >> 2] = $$3;
    $$1 = $16;
    $$1382 = $17;
    $112 = $16;
    break;
   }
  }
 } else {
  $$1 = $2;
  $$1382 = $9;
  $112 = $2;
 } while (0);
 if ($112 >>> 0 >= $10 >>> 0) _abort();
 $114 = $10 + 4 | 0;
 $115 = HEAP32[$114 >> 2] | 0;
 if (!($115 & 1)) _abort();
 if (!($115 & 2)) {
  $122 = HEAP32[100] | 0;
  if (($10 | 0) == (HEAP32[101] | 0)) {
   $124 = (HEAP32[98] | 0) + $$1382 | 0;
   HEAP32[98] = $124;
   HEAP32[101] = $$1;
   HEAP32[$$1 + 4 >> 2] = $124 | 1;
   if (($$1 | 0) != ($122 | 0)) return;
   HEAP32[100] = 0;
   HEAP32[97] = 0;
   return;
  }
  if (($10 | 0) == ($122 | 0)) {
   $130 = (HEAP32[97] | 0) + $$1382 | 0;
   HEAP32[97] = $130;
   HEAP32[100] = $112;
   HEAP32[$$1 + 4 >> 2] = $130 | 1;
   HEAP32[$112 + $130 >> 2] = $130;
   return;
  }
  $135 = ($115 & -8) + $$1382 | 0;
  $136 = $115 >>> 3;
  L108 : do if ($115 >>> 0 < 256) {
   $139 = HEAP32[$10 + 8 >> 2] | 0;
   $141 = HEAP32[$10 + 12 >> 2] | 0;
   $143 = 420 + ($136 << 1 << 2) | 0;
   if (($139 | 0) != ($143 | 0)) {
    if ($139 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort();
    if ((HEAP32[$139 + 12 >> 2] | 0) != ($10 | 0)) _abort();
   }
   if (($141 | 0) == ($139 | 0)) {
    HEAP32[95] = HEAP32[95] & ~(1 << $136);
    break;
   }
   if (($141 | 0) == ($143 | 0)) $$pre$phi443Z2D = $141 + 8 | 0; else {
    if ($141 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort();
    $158 = $141 + 8 | 0;
    if ((HEAP32[$158 >> 2] | 0) == ($10 | 0)) $$pre$phi443Z2D = $158; else _abort();
   }
   HEAP32[$139 + 12 >> 2] = $141;
   HEAP32[$$pre$phi443Z2D >> 2] = $139;
  } else {
   $163 = HEAP32[$10 + 24 >> 2] | 0;
   $165 = HEAP32[$10 + 12 >> 2] | 0;
   do if (($165 | 0) == ($10 | 0)) {
    $177 = $10 + 16 | 0;
    $178 = $177 + 4 | 0;
    $179 = HEAP32[$178 >> 2] | 0;
    if (!$179) {
     $181 = HEAP32[$177 >> 2] | 0;
     if (!$181) {
      $$3400 = 0;
      break;
     } else {
      $$1398 = $181;
      $$1402 = $177;
     }
    } else {
     $$1398 = $179;
     $$1402 = $178;
    }
    while (1) {
     $183 = $$1398 + 20 | 0;
     $184 = HEAP32[$183 >> 2] | 0;
     if ($184 | 0) {
      $$1398 = $184;
      $$1402 = $183;
      continue;
     }
     $186 = $$1398 + 16 | 0;
     $187 = HEAP32[$186 >> 2] | 0;
     if (!$187) break; else {
      $$1398 = $187;
      $$1402 = $186;
     }
    }
    if ($$1402 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
     HEAP32[$$1402 >> 2] = 0;
     $$3400 = $$1398;
     break;
    }
   } else {
    $168 = HEAP32[$10 + 8 >> 2] | 0;
    if ($168 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort();
    $171 = $168 + 12 | 0;
    if ((HEAP32[$171 >> 2] | 0) != ($10 | 0)) _abort();
    $174 = $165 + 8 | 0;
    if ((HEAP32[$174 >> 2] | 0) == ($10 | 0)) {
     HEAP32[$171 >> 2] = $165;
     HEAP32[$174 >> 2] = $168;
     $$3400 = $165;
     break;
    } else _abort();
   } while (0);
   if ($163 | 0) {
    $193 = HEAP32[$10 + 28 >> 2] | 0;
    $194 = 684 + ($193 << 2) | 0;
    do if (($10 | 0) == (HEAP32[$194 >> 2] | 0)) {
     HEAP32[$194 >> 2] = $$3400;
     if (!$$3400) {
      HEAP32[96] = HEAP32[96] & ~(1 << $193);
      break L108;
     }
    } else if ($163 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
     HEAP32[$163 + 16 + (((HEAP32[$163 + 16 >> 2] | 0) != ($10 | 0) & 1) << 2) >> 2] = $$3400;
     if (!$$3400) break L108; else break;
    } while (0);
    $207 = HEAP32[99] | 0;
    if ($$3400 >>> 0 < $207 >>> 0) _abort();
    HEAP32[$$3400 + 24 >> 2] = $163;
    $210 = $10 + 16 | 0;
    $211 = HEAP32[$210 >> 2] | 0;
    do if ($211 | 0) if ($211 >>> 0 < $207 >>> 0) _abort(); else {
     HEAP32[$$3400 + 16 >> 2] = $211;
     HEAP32[$211 + 24 >> 2] = $$3400;
     break;
    } while (0);
    $217 = HEAP32[$210 + 4 >> 2] | 0;
    if ($217 | 0) if ($217 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
     HEAP32[$$3400 + 20 >> 2] = $217;
     HEAP32[$217 + 24 >> 2] = $$3400;
     break;
    }
   }
  } while (0);
  HEAP32[$$1 + 4 >> 2] = $135 | 1;
  HEAP32[$112 + $135 >> 2] = $135;
  if (($$1 | 0) == (HEAP32[100] | 0)) {
   HEAP32[97] = $135;
   return;
  } else $$2 = $135;
 } else {
  HEAP32[$114 >> 2] = $115 & -2;
  HEAP32[$$1 + 4 >> 2] = $$1382 | 1;
  HEAP32[$112 + $$1382 >> 2] = $$1382;
  $$2 = $$1382;
 }
 $232 = $$2 >>> 3;
 if ($$2 >>> 0 < 256) {
  $235 = 420 + ($232 << 1 << 2) | 0;
  $236 = HEAP32[95] | 0;
  $237 = 1 << $232;
  if (!($236 & $237)) {
   HEAP32[95] = $236 | $237;
   $$0403 = $235;
   $$pre$phiZ2D = $235 + 8 | 0;
  } else {
   $241 = $235 + 8 | 0;
   $242 = HEAP32[$241 >> 2] | 0;
   if ($242 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
    $$0403 = $242;
    $$pre$phiZ2D = $241;
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $$1;
  HEAP32[$$0403 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $$0403;
  HEAP32[$$1 + 12 >> 2] = $235;
  return;
 }
 $248 = $$2 >>> 8;
 if (!$248) $$0396 = 0; else if ($$2 >>> 0 > 16777215) $$0396 = 31; else {
  $253 = ($248 + 1048320 | 0) >>> 16 & 8;
  $254 = $248 << $253;
  $257 = ($254 + 520192 | 0) >>> 16 & 4;
  $259 = $254 << $257;
  $262 = ($259 + 245760 | 0) >>> 16 & 2;
  $267 = 14 - ($257 | $253 | $262) + ($259 << $262 >>> 15) | 0;
  $$0396 = $$2 >>> ($267 + 7 | 0) & 1 | $267 << 1;
 }
 $273 = 684 + ($$0396 << 2) | 0;
 HEAP32[$$1 + 28 >> 2] = $$0396;
 HEAP32[$$1 + 20 >> 2] = 0;
 HEAP32[$$1 + 16 >> 2] = 0;
 $277 = HEAP32[96] | 0;
 $278 = 1 << $$0396;
 do if (!($277 & $278)) {
  HEAP32[96] = $277 | $278;
  HEAP32[$273 >> 2] = $$1;
  HEAP32[$$1 + 24 >> 2] = $273;
  HEAP32[$$1 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $$1;
 } else {
  $$0383 = $$2 << (($$0396 | 0) == 31 ? 0 : 25 - ($$0396 >>> 1) | 0);
  $$0384 = HEAP32[$273 >> 2] | 0;
  while (1) {
   if ((HEAP32[$$0384 + 4 >> 2] & -8 | 0) == ($$2 | 0)) {
    label = 124;
    break;
   }
   $296 = $$0384 + 16 + ($$0383 >>> 31 << 2) | 0;
   $298 = HEAP32[$296 >> 2] | 0;
   if (!$298) {
    label = 121;
    break;
   } else {
    $$0383 = $$0383 << 1;
    $$0384 = $298;
   }
  }
  if ((label | 0) == 121) if ($296 >>> 0 < (HEAP32[99] | 0) >>> 0) _abort(); else {
   HEAP32[$296 >> 2] = $$1;
   HEAP32[$$1 + 24 >> 2] = $$0384;
   HEAP32[$$1 + 12 >> 2] = $$1;
   HEAP32[$$1 + 8 >> 2] = $$1;
   break;
  } else if ((label | 0) == 124) {
   $305 = $$0384 + 8 | 0;
   $306 = HEAP32[$305 >> 2] | 0;
   $307 = HEAP32[99] | 0;
   if ($306 >>> 0 >= $307 >>> 0 & $$0384 >>> 0 >= $307 >>> 0) {
    HEAP32[$306 + 12 >> 2] = $$1;
    HEAP32[$305 >> 2] = $$1;
    HEAP32[$$1 + 8 >> 2] = $306;
    HEAP32[$$1 + 12 >> 2] = $$0384;
    HEAP32[$$1 + 24 >> 2] = 0;
    break;
   } else _abort();
  }
 } while (0);
 $315 = (HEAP32[103] | 0) + -1 | 0;
 HEAP32[103] = $315;
 if (!$315) $$0212$in$i = 836; else return;
 while (1) {
  $$0212$i = HEAP32[$$0212$in$i >> 2] | 0;
  if (!$$0212$i) break; else $$0212$in$i = $$0212$i + 8 | 0;
 }
 HEAP32[103] = -1;
 return;
}

function ___stdio_write($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $12 = 0, $13 = 0, $17 = 0, $20 = 0, $25 = 0, $3 = 0, $36 = 0, $37 = 0, $4 = 0, $43 = 0, $5 = 0, $7 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $vararg_buffer3 = sp + 16 | 0;
 $vararg_buffer = sp;
 $3 = sp + 32 | 0;
 $4 = $0 + 28 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 HEAP32[$3 >> 2] = $5;
 $7 = $0 + 20 | 0;
 $9 = (HEAP32[$7 >> 2] | 0) - $5 | 0;
 HEAP32[$3 + 4 >> 2] = $9;
 HEAP32[$3 + 8 >> 2] = $1;
 HEAP32[$3 + 12 >> 2] = $2;
 $12 = $9 + $2 | 0;
 $13 = $0 + 60 | 0;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$13 >> 2];
 HEAP32[$vararg_buffer + 4 >> 2] = $3;
 HEAP32[$vararg_buffer + 8 >> 2] = 2;
 $17 = ___syscall_ret(___syscall146(146, $vararg_buffer | 0) | 0) | 0;
 L1 : do if (($12 | 0) == ($17 | 0)) label = 3; else {
  $$04756 = 2;
  $$04855 = $12;
  $$04954 = $3;
  $25 = $17;
  while (1) {
   if (($25 | 0) < 0) break;
   $$04855 = $$04855 - $25 | 0;
   $36 = HEAP32[$$04954 + 4 >> 2] | 0;
   $37 = $25 >>> 0 > $36 >>> 0;
   $$150 = $37 ? $$04954 + 8 | 0 : $$04954;
   $$1 = ($37 << 31 >> 31) + $$04756 | 0;
   $$0 = $25 - ($37 ? $36 : 0) | 0;
   HEAP32[$$150 >> 2] = (HEAP32[$$150 >> 2] | 0) + $$0;
   $43 = $$150 + 4 | 0;
   HEAP32[$43 >> 2] = (HEAP32[$43 >> 2] | 0) - $$0;
   HEAP32[$vararg_buffer3 >> 2] = HEAP32[$13 >> 2];
   HEAP32[$vararg_buffer3 + 4 >> 2] = $$150;
   HEAP32[$vararg_buffer3 + 8 >> 2] = $$1;
   $25 = ___syscall_ret(___syscall146(146, $vararg_buffer3 | 0) | 0) | 0;
   if (($$04855 | 0) == ($25 | 0)) {
    label = 3;
    break L1;
   } else {
    $$04756 = $$1;
    $$04954 = $$150;
   }
  }
  HEAP32[$0 + 16 >> 2] = 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[$7 >> 2] = 0;
  HEAP32[$0 >> 2] = HEAP32[$0 >> 2] | 32;
  if (($$04756 | 0) == 2) $$051 = 0; else $$051 = $2 - (HEAP32[$$04954 + 4 >> 2] | 0) | 0;
 } while (0);
 if ((label | 0) == 3) {
  $20 = HEAP32[$0 + 44 >> 2] | 0;
  HEAP32[$0 + 16 >> 2] = $20 + (HEAP32[$0 + 48 >> 2] | 0);
  HEAP32[$4 >> 2] = $20;
  HEAP32[$7 >> 2] = $20;
  $$051 = $2;
 }
 STACKTOP = sp;
 return $$051 | 0;
}

function runPostSets() {}
function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0, aligned_dest_end = 0, block_aligned_dest_end = 0, dest_end = 0;
 if ((num | 0) >= 8192) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0;
 ret = dest | 0;
 dest_end = dest + num | 0;
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if (!num) return ret | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   dest = dest + 1 | 0;
   src = src + 1 | 0;
   num = num - 1 | 0;
  }
  aligned_dest_end = dest_end & -4 | 0;
  block_aligned_dest_end = aligned_dest_end - 64 | 0;
  while ((dest | 0) <= (block_aligned_dest_end | 0)) {
   HEAP32[dest >> 2] = HEAP32[src >> 2];
   HEAP32[dest + 4 >> 2] = HEAP32[src + 4 >> 2];
   HEAP32[dest + 8 >> 2] = HEAP32[src + 8 >> 2];
   HEAP32[dest + 12 >> 2] = HEAP32[src + 12 >> 2];
   HEAP32[dest + 16 >> 2] = HEAP32[src + 16 >> 2];
   HEAP32[dest + 20 >> 2] = HEAP32[src + 20 >> 2];
   HEAP32[dest + 24 >> 2] = HEAP32[src + 24 >> 2];
   HEAP32[dest + 28 >> 2] = HEAP32[src + 28 >> 2];
   HEAP32[dest + 32 >> 2] = HEAP32[src + 32 >> 2];
   HEAP32[dest + 36 >> 2] = HEAP32[src + 36 >> 2];
   HEAP32[dest + 40 >> 2] = HEAP32[src + 40 >> 2];
   HEAP32[dest + 44 >> 2] = HEAP32[src + 44 >> 2];
   HEAP32[dest + 48 >> 2] = HEAP32[src + 48 >> 2];
   HEAP32[dest + 52 >> 2] = HEAP32[src + 52 >> 2];
   HEAP32[dest + 56 >> 2] = HEAP32[src + 56 >> 2];
   HEAP32[dest + 60 >> 2] = HEAP32[src + 60 >> 2];
   dest = dest + 64 | 0;
   src = src + 64 | 0;
  }
  while ((dest | 0) < (aligned_dest_end | 0)) {
   HEAP32[dest >> 2] = HEAP32[src >> 2];
   dest = dest + 4 | 0;
   src = src + 4 | 0;
  }
 } else {
  aligned_dest_end = dest_end - 4 | 0;
  while ((dest | 0) < (aligned_dest_end | 0)) {
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   HEAP8[dest + 1 >> 0] = HEAP8[src + 1 >> 0] | 0;
   HEAP8[dest + 2 >> 0] = HEAP8[src + 2 >> 0] | 0;
   HEAP8[dest + 3 >> 0] = HEAP8[src + 3 >> 0] | 0;
   dest = dest + 4 | 0;
   src = src + 4 | 0;
  }
 }
 while ((dest | 0) < (dest_end | 0)) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  dest = dest + 1 | 0;
  src = src + 1 | 0;
 }
 return ret | 0;
}

function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
 end = ptr + num | 0;
 value = value & 255;
 if ((num | 0) >= 67) {
  while (ptr & 3) {
   HEAP8[ptr >> 0] = value;
   ptr = ptr + 1 | 0;
  }
  aligned_end = end & -4 | 0;
  block_aligned_end = aligned_end - 64 | 0;
  value4 = value | value << 8 | value << 16 | value << 24;
  while ((ptr | 0) <= (block_aligned_end | 0)) {
   HEAP32[ptr >> 2] = value4;
   HEAP32[ptr + 4 >> 2] = value4;
   HEAP32[ptr + 8 >> 2] = value4;
   HEAP32[ptr + 12 >> 2] = value4;
   HEAP32[ptr + 16 >> 2] = value4;
   HEAP32[ptr + 20 >> 2] = value4;
   HEAP32[ptr + 24 >> 2] = value4;
   HEAP32[ptr + 28 >> 2] = value4;
   HEAP32[ptr + 32 >> 2] = value4;
   HEAP32[ptr + 36 >> 2] = value4;
   HEAP32[ptr + 40 >> 2] = value4;
   HEAP32[ptr + 44 >> 2] = value4;
   HEAP32[ptr + 48 >> 2] = value4;
   HEAP32[ptr + 52 >> 2] = value4;
   HEAP32[ptr + 56 >> 2] = value4;
   HEAP32[ptr + 60 >> 2] = value4;
   ptr = ptr + 64 | 0;
  }
  while ((ptr | 0) < (aligned_end | 0)) {
   HEAP32[ptr >> 2] = value4;
   ptr = ptr + 4 | 0;
  }
 }
 while ((ptr | 0) < (end | 0)) {
  HEAP8[ptr >> 0] = value;
  ptr = ptr + 1 | 0;
 }
 return end - num | 0;
}

function _fflush($0) {
 $0 = $0 | 0;
 var $$0 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $25 = 0, $29 = 0, $7 = 0, $phitmp = 0;
 do if (!$0) {
  if (!(HEAP32[94] | 0)) $29 = 0; else $29 = _fflush(HEAP32[94] | 0) | 0;
  $$02325 = HEAP32[(___ofl_lock() | 0) >> 2] | 0;
  if (!$$02325) $$024$lcssa = $29; else {
   $$02327 = $$02325;
   $$02426 = $29;
   while (1) {
    if ((HEAP32[$$02327 + 76 >> 2] | 0) > -1) $25 = ___lockfile($$02327) | 0; else $25 = 0;
    if ((HEAP32[$$02327 + 20 >> 2] | 0) >>> 0 > (HEAP32[$$02327 + 28 >> 2] | 0) >>> 0) $$1 = ___fflush_unlocked($$02327) | 0 | $$02426; else $$1 = $$02426;
    if ($25 | 0) ___unlockfile($$02327);
    $$02327 = HEAP32[$$02327 + 56 >> 2] | 0;
    if (!$$02327) {
     $$024$lcssa = $$1;
     break;
    } else $$02426 = $$1;
   }
  }
  ___ofl_unlock();
  $$0 = $$024$lcssa;
 } else {
  if ((HEAP32[$0 + 76 >> 2] | 0) <= -1) {
   $$0 = ___fflush_unlocked($0) | 0;
   break;
  }
  $phitmp = (___lockfile($0) | 0) == 0;
  $7 = ___fflush_unlocked($0) | 0;
  if ($phitmp) $$0 = $7; else {
   ___unlockfile($0);
   $$0 = $7;
  }
 } while (0);
 return $$0 | 0;
}

function ___fflush_unlocked($0) {
 $0 = $0 | 0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, label = 0;
 $1 = $0 + 20 | 0;
 $3 = $0 + 28 | 0;
 if ((HEAP32[$1 >> 2] | 0) >>> 0 > (HEAP32[$3 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$0 + 36 >> 2] & 3]($0, 0, 0) | 0;
  if (!(HEAP32[$1 >> 2] | 0)) $$0 = -1; else label = 3;
 } else label = 3;
 if ((label | 0) == 3) {
  $10 = $0 + 4 | 0;
  $11 = HEAP32[$10 >> 2] | 0;
  $12 = $0 + 8 | 0;
  $13 = HEAP32[$12 >> 2] | 0;
  if ($11 >>> 0 < $13 >>> 0) FUNCTION_TABLE_iiii[HEAP32[$0 + 40 >> 2] & 3]($0, $11 - $13 | 0, 1) | 0;
  HEAP32[$0 + 16 >> 2] = 0;
  HEAP32[$3 >> 2] = 0;
  HEAP32[$1 >> 2] = 0;
  HEAP32[$12 >> 2] = 0;
  HEAP32[$10 >> 2] = 0;
  $$0 = 0;
 }
 return $$0 | 0;
}

function _sbrk(increment) {
 increment = increment | 0;
 var oldDynamicTop = 0, newDynamicTop = 0;
 increment = increment + 15 & -16 | 0;
 oldDynamicTop = HEAP32[DYNAMICTOP_PTR >> 2] | 0;
 newDynamicTop = oldDynamicTop + increment | 0;
 if ((increment | 0) > 0 & (newDynamicTop | 0) < (oldDynamicTop | 0) | (newDynamicTop | 0) < 0) {
  abortOnCannotGrowMemory() | 0;
  ___setErrNo(12);
  return -1;
 }
 HEAP32[DYNAMICTOP_PTR >> 2] = newDynamicTop;
 if ((newDynamicTop | 0) > (getTotalMemory() | 0)) if (!(enlargeMemory() | 0)) {
  HEAP32[DYNAMICTOP_PTR >> 2] = oldDynamicTop;
  ___setErrNo(12);
  return -1;
 }
 return oldDynamicTop | 0;
}

function ___stdio_seek($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $10 = 0, $3 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $vararg_buffer = sp;
 $3 = sp + 20 | 0;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$0 + 60 >> 2];
 HEAP32[$vararg_buffer + 4 >> 2] = 0;
 HEAP32[$vararg_buffer + 8 >> 2] = $1;
 HEAP32[$vararg_buffer + 12 >> 2] = $3;
 HEAP32[$vararg_buffer + 16 >> 2] = $2;
 if ((___syscall_ret(___syscall140(140, $vararg_buffer | 0) | 0) | 0) < 0) {
  HEAP32[$3 >> 2] = -1;
  $10 = -1;
 } else $10 = HEAP32[$3 >> 2] | 0;
 STACKTOP = sp;
 return $10 | 0;
}

function ___stdout_write($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $14 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $vararg_buffer = sp;
 HEAP32[$0 + 36 >> 2] = 3;
 if (!(HEAP32[$0 >> 2] & 64)) {
  HEAP32[$vararg_buffer >> 2] = HEAP32[$0 + 60 >> 2];
  HEAP32[$vararg_buffer + 4 >> 2] = 21523;
  HEAP32[$vararg_buffer + 8 >> 2] = sp + 16;
  if (___syscall54(54, $vararg_buffer | 0) | 0) HEAP8[$0 + 75 >> 0] = -1;
 }
 $14 = ___stdio_write($0, $1, $2) | 0;
 STACKTOP = sp;
 return $14 | 0;
}

function ___stdio_close($0) {
 $0 = $0 | 0;
 var $5 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $vararg_buffer = sp;
 HEAP32[$vararg_buffer >> 2] = _dummy_135(HEAP32[$0 + 60 >> 2] | 0) | 0;
 $5 = ___syscall_ret(___syscall6(6, $vararg_buffer | 0) | 0) | 0;
 STACKTOP = sp;
 return $5 | 0;
}

function ___syscall_ret($0) {
 $0 = $0 | 0;
 var $$0 = 0;
 if ($0 >>> 0 > 4294963200) {
  HEAP32[(___errno_location() | 0) >> 2] = 0 - $0;
  $$0 = -1;
 } else $$0 = $0;
 return $$0 | 0;
}

function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 3](a1 | 0, a2 | 0, a3 | 0) | 0;
}
function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP;
 STACKTOP = STACKTOP + size | 0;
 STACKTOP = STACKTOP + 15 & -16;
 return ret | 0;
}

function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0;
 stackMax = stackMax | 0;
 STACKTOP = stackBase;
 STACK_MAX = stackMax;
}

function setThrew(threw, value) {
 threw = threw | 0;
 value = value | 0;
 if (!__THREW__) {
  __THREW__ = threw;
  threwValue = value;
 }
}

function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 1](a1 | 0) | 0;
}

function b1(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(1);
 return 0;
}

function ___errno_location() {
 return (___pthread_self_414() | 0) + 64 | 0;
}

function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value;
}

function stackRestore(top) {
 top = top | 0;
 STACKTOP = top;
}

function ___pthread_self_414() {
 return _pthread_self() | 0;
}

function _dummy_135($0) {
 $0 = $0 | 0;
 return $0 | 0;
}

function b0(p0) {
 p0 = p0 | 0;
 abort(0);
 return 0;
}

function _emscripten_get_global_libc() {
 return 876;
}

function ___ofl_unlock() {
 ___unlock(940);
 return;
}

function ___ofl_lock() {
 ___lock(940);
 return 948;
}

function ___unlockfile($0) {
 $0 = $0 | 0;
 return;
}

function ___lockfile($0) {
 $0 = $0 | 0;
 return 0;
}

function getTempRet0() {
 return tempRet0 | 0;
}

function stackSave() {
 return STACKTOP | 0;
}

function _pthread_self() {
 return 8;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,___stdout_write,___stdio_seek,___stdio_write];

  return { ___errno_location: ___errno_location, _emscripten_get_global_libc: _emscripten_get_global_libc, _fflush: _fflush, _free: _free, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
;
Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];
Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];


// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;




if (memoryInitializer) {
  if (typeof Module['locateFile'] === 'function') {
    memoryInitializer = Module['locateFile'](memoryInitializer);
  } else if (Module['memoryInitializerPrefixURL']) {
    memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, Runtime.GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      HEAPU8.set(data, Runtime.GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
            // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
            // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();


    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = run;

function exit(status, implicit) {

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}



run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}






