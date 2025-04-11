import { TrackOpTypes, TriggerOpTypes } from "./operations.js";

const targetMap = new WeakMap();
const ITERATE_KEY = Symbol("iterate"); // 针对依赖收集没有key的情况

let activeEffect = undefined; // 存储正在运行的函数
const effectStack = []; // 存储正在运行的函数的栈，执行完后出栈，防止无限循环
let shouldTrack = true;

export function pauseTracking() {
  shouldTrack = false;
}

export function resumeTracking() {
  shouldTrack = true;
}
// 指明针对哪个函数进行依赖收集
export function effect(fn, options = {}) {
  const { lazy = false } = options;
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      effectStack.push(effectFn);
      cleanup(effectFn);
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };
  effectFn.deps = []; // 用来存储所有与该副作用函数相关联的依赖集合，cleanup时用这个数组删除依赖关系，防止内存泄漏
  effectFn.options = options;
  if (!lazy) {
    effectFn();
  }
  return effectFn;
}

export function cleanup(effectFn) {
  const { deps } = effectFn;
  if (!deps.length) {
    return;
  }
  for (const dep of deps) {
    dep.delete(effectFn);
  }
  deps.length = 0;
}

// 依赖收集(需要依赖收集时、有正在运行的函数)  ---> 建立对应关系

// 官方
// WeakMap {
//   target (对象) => Map {
//     key (属性) => Set {
//       effectFn (依赖的副作用函数)
//     }
//   }
// }
// 具体来说，targetMap 是一个 WeakMap，它的键是响应式对象，值是一个 Map。这个 Map 的键是对象的属性，值是一个 Set，Set 中存储的是依赖于该属性的副作用函数（effectFn）

// 此处的对应关系比vue的多一层，对象(targetMap) -> 属性(propMap) -> 操作行为(typeMap) -> 对应的set/要运行的函数(depSet)
// WeakMap {
//   target (对象) => Map {
//     key (属性) => Map {
//       type (操作类型) => Set {
//         effectFn (依赖的副作用函数)
//       }
//     }
//   }
// }
// 具体来说，targetMap 是一个 WeakMap，它的键是响应式对象，值是一个 Map。这个 Map 的键是对象的属性，值也是一个 Map。第二个 Map 的键是操作类型（如 GET、SET 等），值是一个 Set，Set 中存储的是依赖于该属性的副作用函数（effectFn）。
export function track(target, type, key) {
  if (!shouldTrack || !activeEffect) {
    return;
  }
  let propMap = targetMap.get(target);
  if (!propMap) {
    propMap = new Map();
    targetMap.set(target, propMap);
  }

  if (type === TrackOpTypes.ITERATE) {
    key = ITERATE_KEY;
  }
  let typeMap = propMap.get(key);
  if (!typeMap) {
    typeMap = new Map();
    propMap.set(key, typeMap);
  }

  let depSet = typeMap.get(type);
  if (!depSet) {
    depSet = new Set();
    typeMap.set(type, depSet);
  }

  if (!depSet.has(activeEffect)) {
    depSet.add(activeEffect);
    console.log(depSet);
    activeEffect.deps.push(depSet);
  }
}

// 派发更新(找到对应函数依次运行)
export function trigger(target, type, key) {
  const effectFns = getEffectFns(target, type, key);
  if (!effectFns) {
    return;
  }
  for (const effectFn of effectFns) {
    // 防止重复运行,当前依赖收集的函数和派发更新的函数相同时，不运行
    if (effectFn === activeEffect) {
      continue;
    }
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  }
}

function getEffectFns(target, type, key) {
  // 对象和属性的对应关系
  const propMap = targetMap.get(target);
  if (!propMap) {
    return;
  }

  // 属性和操作方法的对应关系
  const keys = [key];
  if (type === TriggerOpTypes.ADD || type === TriggerOpTypes.DELETE) {
    keys.push(ITERATE_KEY);
  }
  const effectFns = new Set();
  const triggerTypeMap = {
    [TriggerOpTypes.SET]: [TrackOpTypes.GET],
    [TriggerOpTypes.ADD]: [
      TrackOpTypes.GET,
      TrackOpTypes.ITERATE,
      TrackOpTypes.HAS,
    ],
    [TriggerOpTypes.DELETE]: [
      TrackOpTypes.GET,
      TrackOpTypes.ITERATE,
      TrackOpTypes.HAS,
    ],
  };
  for (const key of keys) {
    const typeMap = propMap.get(key);
    if (!typeMap) {
      continue;
    }
    const trackTypes = triggerTypeMap[type];
    for (const trackType of trackTypes) {
      const dep = typeMap.get(trackType);
      if (!dep) {
        continue;
      }
      for (const effectFn of dep) {
        effectFns.add(effectFn);
      }
    }
  }
  return effectFns;
}
