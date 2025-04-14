import { effect } from "./effect.js";

export function watch(source, cb, options = {}) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  let oldValue, newValue;
  // 提取 scheduler 调度函数为一个独立的 job 函数,在scheduler中执行副作用函数，获取新值，并触发回调函数，并更新旧值

  const job = () => {
    newValue = effectFn();
    cb(newValue, oldValue);
    oldValue = newValue;
  };
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: () => {
      // flush的值还可以指定为'pre', 'post','sync'，默认为'post', 即在组件更新之前执行回调函数，代表调度函数需要将副作用函数放到一个微任务队列中
      if (options.flush === "post") {
        const p = Promise.resolve();
        p.then(job);
      } else {
        job();
      }
    },
  });
  if (options.immediate) {
    job();
  } else {
    // 手动执行一次副作用函数，获取旧值
    oldValue = effectFn();
  }
}

function traverse(val, seen = new Set()) {
  if (typeof val !== "object" || val === null || seen.has(val)) {
    return;
  }
  seen.add(val);
  for (const key in val) {
    traverse(val[key], seen);
  }
  return val;
}
