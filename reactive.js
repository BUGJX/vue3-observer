
import { handlers } from "./handlers.js";
import { isObject } from "./utils.js";

// 存储监听对象和代理之间的关系  数据格式：{对象: 代理}
const targetMap = new WeakMap();

export function reactive(target) {
  // 如果不是对象，直接返回
  if (!isObject(target)) {
    return target;
  }

  // 如果已经代理过了，直接返回
  if (targetMap.has(target)) {
    return targetMap.get(target);
  }

  // 没有代理过，建立对应关系并返回代理
  const proxy = new Proxy(target, handlers);
  targetMap.set(target, proxy);
  // console.log(targetMap);
  return proxy;
}
