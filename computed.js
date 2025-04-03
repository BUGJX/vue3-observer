import { effect } from "./effect.js";
import { track, trigger } from "./effect.js";
import { TrackOpTypes, TriggerOpTypes } from "./operations.js";
// 参数可能是一个对象，也可能是一个函数，此处进行参数归一化
function normalizeParamter(getterOrOptions) {
  let getter, setter;
  if (typeof getterOrOptions === "function") {
    getter = getterOrOptions;
    setter: () => {
      console.warn("Computed property was assigned to but it has no setter.");
    };
  } else {
    setter = getterOrOptions.setter;
    getter = getterOrOptions.getter;
  }
  return { getter, setter };
}

export function computed(getterOrOptions) {
  const { getter, setter } = normalizeParamter(getterOrOptions);
  let value,
    dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler: () => {
      dirty = true, 
      trigger(obj, TriggerOpTypes.SET, "value");
    },
  });
  // 读取value时，如果dirty为true，说明依赖的数据发生了变化，需要重新计算value
  const obj = {
    get value() {
      track(obj, TrackOpTypes.GET, "value");
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      return value;
    },
    set value(newValue) {
      setter(newValue);
    }
  };
  return obj;
}
