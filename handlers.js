import { track, trigger, pauseTracking, resumeTracking } from "./effect.js";
import { isObject, hasChanged } from "./utils.js";
import { reactive } from "./reactive.js";
import { TrackOpTypes, TriggerOpTypes } from "./operations.js";

const arrayInstrumentations = {};
const RAW = Symbol("raw");

// 当无法在代理对象中找到时，去原始数组中重新找一次
["includes", "indexOf", "lastIndexOf"].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    // this ---> proxy
    // 依赖收集
    // 1.先正常在代理对象中找
    const res = Array.prototype[key].apply(this, args);
    // 2.找不到，在原始对象中重新找一遍
    if (res < 0 || res === false) {
      console.log("找不到，重新在原始对象中找一遍");
      return Array.prototype[key].apply(this[RAW], args);
    }
    return res;
  };
});

// 调用这些方法时，只进行派发更新，暂停依赖收集，调用结束后，恢复依赖收集
["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    pauseTracking();
    const res = Array.prototype[key].apply(this, args);
    resumeTracking();
    return res;
  };
});

function get(target, key, receiver) {
  if (key === RAW) {
    return target;
  }
  // receiver指的是代理对象
  track(target, TrackOpTypes.GET, key);

  // 如果属性是个数组,且使用了数组中的方法，返回改动后的
  if (arrayInstrumentations.hasOwnProperty(key) && Array.isArray(target)) {
    return arrayInstrumentations[key];
  }

  const result = Reflect.get(target, key, receiver);

  // 如果对象的值还是一个对象，继续进行代理，完成深度代理
  if (isObject(result)) {
    return reactive(result);
  }

  return result; // 返回对象的相应属性值
}

function set(target, key, value, receiver) {
  // 细分操作类型（SET、ADD）
  const type = target.hasOwnProperty(key)
    ? TriggerOpTypes.SET
    : TriggerOpTypes.ADD;

  // 值有变化或者新增属性才派发更新
  const oldValue = target[key];
  const oldLen = Array.isArray(target) ? target.length : undefined;
  const result = Reflect.set(target, key, value, receiver);
  // 赋值未成功，直接返回
  if (!result) {
    return result;
  }
  const newLen = Array.isArray(target) ? target.length : undefined;
  if (hasChanged(oldValue, value) || type == TriggerOpTypes.ADD) {
    trigger(target, type, key);
    // 1.设置的对象是个数组
    // 2.设置前后length发生变化

    if (Array.isArray(target) && oldLen !== newLen) {
      // 3.设置的不是length属性，手动触发length属性的变化
      if (key !== "length") {
        trigger(target, TriggerOpTypes.SET, "length");
      } else {
        //设置的是length属性，找到被删除的下标，依次触发派发更新
        for (let i = newLen; i < oldLen; i++) {
          trigger(target, TriggerOpTypes.DELETE, i.toString());
        }
      }
    }
  }

  // 设置对象的相应属性值
  return result;
}

function has(target, key) {
  track(target, TrackOpTypes.HAS, key);
  return Reflect.has(target, key); // 判断对象是否有相应的属性
}

function ownKeys(target) {
  track(target, TrackOpTypes.ITERATE);
  return Reflect.ownKeys(target); // 返回对象的所有属性名
}

function deleteProperty(target, key) {
  // 原先有现在没有并且删除成功，才派发更新
  const hadkey = target.hasOwnProperty(key);
  const result = Reflect.deleteProperty(target, key);
  if (hadkey && result) {
    trigger(target, TriggerOpTypes.DELETE, key);
  }
  return result; // 删除对象的相应属性
}

export const handlers = {
  get,
  set,
  has,
  ownKeys,
  deleteProperty,
};
